import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { ethers } from 'ethers';
import { bridgeAmount, validateBridgeConfig, ensureBridgeWallet, readConfirmedReceipt, refreshBridgeRecord } from '../../src/app/lib/bridge-client';

const config = JSON.parse(fs.readFileSync(new URL('../../public/bridge/routes.json', import.meta.url), 'utf8'));
test('decimal amounts stay exact and invalid precision/overflow is rejected', () => {
  assert.equal(bridgeAmount('123456789.12345678', 8), 12345678912345678n);
  for (const amount of ['0', '-1', '1e8', '0.000000001', 'NaN']) assert.throws(() => bridgeAmount(amount, 8));
  assert.throws(() => bridgeAmount((ethers.MaxUint256 + 1n).toString(), 0));
});
test('configuration rejects chain collisions, zero contracts and unsupported scaling', () => {
  assert.equal(validateBridgeConfig(config).routes.length, config.routes.length);
  for (const mutate of [
    (value: any) => { value.routes[0].endpoints[1].chainId = value.routes[0].endpoints[0].chainId; },
    (value: any) => { value.routes[0].endpoints[0].router = ethers.ZeroAddress; },
    (value: any) => { value.routes[0].endpoints[0].scale = '100'; },
    (value: any) => { value.routes[0].endpoints[0].rpcUrl = 'file:///tmp/rpc'; },
  ]) {
    const invalid = structuredClone(config); mutate(invalid);
    assert.throws(() => validateBridgeConfig(invalid));
  }
});
test('wallet switch rejection propagates without adding a network or signing', async () => {
  const methods: string[] = [];
  const provider = { request: async ({ method }: { method: string }) => {
    methods.push(method);
    if (method === 'eth_chainId') return '0x1';
    throw Object.assign(new Error('Rejected'), { code: 4001 });
  } };
  await assert.rejects(() => ensureBridgeWallet(provider, config.routes[0].endpoints[0], '0x755Ccf704E17570b64E247f0794314e4C8E542CA'));
  assert.deepEqual(methods, ['eth_chainId', 'wallet_switchEthereumChain']);
});
test('wallet account change is detected before signing', async () => {
  const endpoint = config.routes[0].endpoints[0];
  const provider = { request: async ({ method }: { method: string }) => method === 'eth_chainId' ? ethers.toQuantity(endpoint.chainId) : [] };
  await assert.rejects(() => ensureBridgeWallet(provider, endpoint, '0x755Ccf704E17570b64E247f0794314e4C8E542CA'), /account changed/);
});
test('receipt without by-hash confirmation is still pending', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    const method = JSON.parse(String(init?.body)).method;
    return new Response(JSON.stringify({ result: method === 'eth_getTransactionReceipt' ? { status: '0x1', blockNumber: '0x1', blockHash: '0x1234' } : null }));
  };
  try { assert.equal(await readConfirmedReceipt(config.routes[0].endpoints[0], `0x${'1'.repeat(64)}`), null); }
  finally { globalThis.fetch = original; }
});
test('confirmed source revert becomes failed without checking destination', async () => {
  const original = globalThis.fetch;
  const methods: string[] = [];
  globalThis.fetch = async (_url, init) => {
    methods.push(JSON.parse(String(init?.body)).method);
    return new Response(JSON.stringify({ result: { status: '0x0', blockHash: '0x1234', blockNumber: '0x1' } }));
  };
  try {
    const record = await refreshBridgeRecord({ route: config.routes[0], sourceKey: config.routes[0].endpoints[0].key,
      stage: 'source-pending', sourceHash: `0x${'1'.repeat(64)}` } as any);
    assert.equal(record.stage, 'failed');
    assert.deepEqual(methods.sort(), ['eth_getTransactionByHash', 'eth_getTransactionReceipt']);
  } finally { globalThis.fetch = original; }
});
