import test from 'node:test';
import assert from 'node:assert/strict';
import { Interface, zeroPadValue } from 'ethers';
import { options, validateConfig, checkRoutes, frontendReady, ensureLocalRpc } from './start-environment.mjs';

const address = n => `0x${n.toString(16).padStart(40, '0')}`;
const relayer = address(99);
const config = { schemaVersion: 1, routes: [{ id: 'test', endpoints: [1, 2].map(n => ({
  key: `chain-${n}`, chainId: n, domain: n, rpcUrl: `http://chain-${n}`,
  mailbox: address(n * 10), router: address(n * 10 + 1), token: address(n * 10 + 2),
  ism: address(n * 10 + 3), hook: address(n * 10 + 4),
})) }] };
const abi = new Interface([
  'function routers(uint32) view returns (bytes32)', 'function mailbox() view returns (address)',
  'function localDomain() view returns (uint32)', 'function trustedRelayer() view returns (address)',
]);
function mock(overrides = {}, seen = []) {
  return async (url, method, params) => {
    seen.push(method);
    const source = config.routes[0].endpoints.find(e => e.rpcUrl === url);
    const remote = config.routes[0].endpoints.find(e => e !== source);
    if (method in overrides) return overrides[method];
    if (method === 'eth_chainId') return `0x${source.chainId}`;
    if (method === 'eth_getCode') return '0x60016000';
    if (method === 'eth_getBalance') return '0x12345';
    if (method === 'eth_blockNumber') return '0x10';
    if (method === 'eth_getLogs') return [];
    assert.equal(method, 'eth_call', 'No write RPC is permitted in readiness checks');
    const parsed = abi.parseTransaction({ data: params[0].data });
    const values = { mailbox: source.mailbox, routers: zeroPadValue(remote.router, 32), localDomain: source.domain, trustedRelayer: relayer };
    return abi.encodeFunctionResult(parsed.name, [overrides[parsed.name] ?? values[parsed.name]]);
  };
}

test('strict CLI options and defaults', () => {
  assert.deepEqual(options([]), { check: false, noRelay: false, port: 5174, help: false });
  assert.deepEqual(options(['--check', '--no-relay', '--port', '5175']), { check: true, noRelay: true, port: 5175, help: false });
  for (const args of [['status'], ['--port'], ['--port', '1'], ['--port', 'abc'], ['--port', '65536']]) assert.throws(() => options(args));
});
test('reject incomplete routes and invalid contract addresses', () => {
  validateConfig(config);
  assert.throws(() => validateConfig({ routes: [] }));
  const bad = structuredClone(config);
  bad.routes[0].endpoints[0].router = address(0);
  assert.throws(() => validateConfig(bad), /Invalid.*router/);
});
test('successful checks only use read RPCs', async () => {
  const seen = [];
  await checkRoutes(config, relayer, mock({}, seen), () => {});
  assert.equal(seen.filter(m => m === 'eth_getLogs').length, 2);
  assert.ok(!seen.some(m => m.includes('send') || m.includes('sign')));
});
test('wrong chain, lost contracts, router mismatch and missing Gas fail closed', async () => {
  for (const [override, message] of [
    [{ eth_chainId: '0x999' }, /wrong chain/], [{ eth_getCode: '0x' }, /missing contract/],
    [{ routers: zeroPadValue(address(555), 32) }, /enrollment mismatch/],
    [{ mailbox: address(555) }, /mailbox mismatch/], [{ localDomain: 999 }, /domain mismatch/],
    [{ trustedRelayer: address(555) }, /identity mismatch/], [{ eth_getBalance: '0x0' }, /no Gas/],
    [{ eth_getLogs: null }, /invalid eth_getLogs/],
  ]) await assert.rejects(checkRoutes(config, relayer, mock(override), () => {}), message);
});
test('frontend reuse requires matching routes; occupied ports are not taken over', async () => {
  assert.equal(await frontendReady('http://example', config, async () => ({ ok: true, json: async () => config })), true);
  await assert.rejects(frontendReady('http://example', config, async () => ({ ok: false })), /occupied/);
  await assert.rejects(frontendReady('http://example', config, async () => ({ ok: true, json: async () => ({}) })), /differs/);
  assert.equal(await frontendReady('http://example', config, async () => { throw new Error('fetch failed', { cause: { code: 'ECONNREFUSED' } }); }), false);
  await assert.rejects(frontendReady('http://example', config, async () => { throw new Error('timeout'); }), /Cannot verify/);
});

test('read-only checks never start an offline chain and report the affected endpoint', async () => {
  let starts = 0;
  await assert.rejects(ensureLocalRpc({ name: 'bsc', url: 'http://127.0.0.1:8546', chainId: 31338, check: true,
    start: async () => { starts++; } }, async () => { throw new Error('fetch failed', { cause: { code: 'ECONNREFUSED' } }); }), /bsc.*8546.*ECONNREFUSED/);
  assert.equal(starts, 0);
});
test('startup restores only a stopped chain and validates its identity after launch', async () => {
  let starts = 0;
  const input = { name: 'bsc', url: 'http://127.0.0.1:8546', chainId: 31338, check: false, start: async () => { starts++; } };
  await ensureLocalRpc(input, async () => {
    if (!starts) throw new Error('fetch failed', { cause: { code: 'ECONNREFUSED' } });
    return '0x7a6a';
  });
  assert.equal(starts, 1);
  await ensureLocalRpc(input, async () => '0x7a6a');
  assert.equal(starts, 1, 'reuse healthy RPC without spawning');
  await assert.rejects(ensureLocalRpc(input, async () => '0x1'), /wrong chain ID/);
  await assert.rejects(ensureLocalRpc(input, async () => { throw new Error('Bad JSON-RPC'); }), /Bad JSON-RPC/);
  assert.equal(starts, 1, 'never launch over a wrong chain or broken occupied endpoint');
});
