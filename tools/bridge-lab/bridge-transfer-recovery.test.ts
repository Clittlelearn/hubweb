import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { ethers } from 'ethers';
import { sendWalletTransaction, ROUTER_ABI } from '../../src/app/lib/bridge-client';
import { recoverBridgeTransfer } from '../../src/app/lib/bridge-transfer-recovery';

const route = JSON.parse(fs.readFileSync(new URL('../../public/bridge/routes.json', import.meta.url), 'utf8')).routes[0];
const source = route.endpoints.find((e: any) => e.chainId === 31338);
const target = route.endpoints.find((e: any) => e.chainId === 12315);
const account = '0x1111111111111111111111111111111111111111';
const hash = ethers.id('bridge recovery');
const blockHash = ethers.id('bridge block');

function wallet(send: () => any) {
  return { request: async ({ method }: { method: string }) => {
    if (method === 'eth_chainId') return ethers.toQuantity(source.chainId);
    if (method === 'eth_accounts') return [account];
    if (method === 'eth_estimateGas') return '0x10000';
    if (method === 'eth_getTransactionCount') return '0x2';
    if (method === 'eth_sendTransaction') return send();
    throw new Error('Unexpected method ' + method);
  } };
}

test('save intent before sending, timeout returns, and late hash remains recoverable without another send', async () => {
  let resolveHash: (hash: string) => void;
  let sends = 0;
  let saved = false;
  let savedHash = '';
  const provider = wallet(() => {
    assert.equal(saved, true);
    sends++;
    return new Promise(resolve => { resolveHash = resolve; });
  });
  await assert.rejects(sendWalletTransaction(provider, source, account, source.router, '0x', 0n, {
    beforeSend: () => { saved = true; }, onSubmitted: hash => { savedHash = hash; }, timeoutMs: 5,
  }), /may already be on chain/);
  resolveHash!(hash);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(savedHash, hash);
  assert.equal(sends, 1);
});

test('storage failure prevents sending and only explicit wallet rejection releases the saved request', async () => {
  let sends = 0;
  await assert.rejects(sendWalletTransaction(wallet(() => { sends++; }), source, account, source.router, '0x', 0n,
    { beforeSend: () => { throw new Error('Storage failed'); } }), /Storage failed/);
  assert.equal(sends, 0);
  for (const code of [4001, 4900]) {
    let released = false;
    await assert.rejects(sendWalletTransaction(wallet(() => { throw Object.assign(new Error('wallet failure'), { code }); }),
      source, account, source.router, '0x', 0n, { onRejected: () => { released = true; } }));
    assert.equal(released, code === 4001);
  }
});

test('recovery validates account, router, domain, receipt and canonical block; never sends', async t => {
  const data = ROUTER_ABI.encodeFunctionData('transferRemote', [target.domain, ethers.zeroPadValue(account, 32), 10000000000n]);
  const tx = { from: account, to: source.router, input: data, hash, blockHash, blockNumber: '0x33' };
  const receipt = { status: '0x1', transactionHash: hash, blockHash, blockNumber: '0x33' };
  let patch: Record<string, unknown> = {};
  t.mock.method(globalThis, 'fetch', async (_url: string, init: RequestInit) => {
    const { method } = JSON.parse(String(init.body));
    assert.ok(!method.startsWith('eth_send'));
    return new Response(JSON.stringify({ result: method in patch ? patch[method] : {
      eth_getTransactionByHash: tx, eth_getTransactionReceipt: receipt,
      eth_getBlockByNumber: { hash: blockHash, timestamp: '0x100' },
    }[method] }));
  });
  const recovered = await recoverBridgeTransfer(route, source.key, account, hash);
  assert.equal(recovered.amount, '100.0');
  assert.equal(recovered.destinationStartBlock, target.deploymentBlock);
  assert.equal(recovered.sourceHash, hash);
  for (patch of [
    { eth_getTransactionByHash: { ...tx, from: ethers.ZeroAddress } },
    { eth_getTransactionByHash: { ...tx, to: source.token } },
    { eth_getTransactionByHash: { ...tx, input: ROUTER_ABI.encodeFunctionData('transferRemote', [1, ethers.zeroPadValue(account, 32), 1]) } },
    { eth_getTransactionReceipt: null },
    { eth_getTransactionReceipt: { ...receipt, status: '0x0' } },
    { eth_getBlockByNumber: { hash: ethers.id('other block'), timestamp: '0x100' } },
  ]) await assert.rejects(recoverBridgeTransfer(route, source.key, account, hash));
});
