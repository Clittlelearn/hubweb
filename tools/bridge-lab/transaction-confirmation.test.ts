import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { ethers } from 'ethers';
import { waitForEthTransaction } from '../../src/app/lib/hivex-eth-client';
import { confirmDeploymentStep, submitDeploymentStep } from '../../src/app/lib/bridge-deployment';
import { refreshBridgeRecord, waitBridgeReceipt, type BridgeRecord } from '../../src/app/lib/bridge-client';

const hash = ethers.id('confirmation test');
const alias = ethers.id('internal hash');
const config = JSON.parse(fs.readFileSync(new URL('../../public/bridge/routes.json', import.meta.url), 'utf8'));
const route = config.routes[0];
const endpoint = route.endpoints[0];
const receipt = { transactionHash: hash, status: '0x1', blockHash: ethers.id('block'), blockNumber: '0x1' };
const transaction = { ...receipt, hash };

test('ETH confirmation stops at exactly 20 rounds and preserves both hashes', async () => {
  const methods: string[] = [];
  await assert.rejects(waitForEthTransaction({ rpcUrl: '', hashes: [hash, alias, hash], delayMs: 0,
    attempts: 100, request: async (method) => { methods.push(method); return null as any; },
  }), error => error.message.includes('after 20 queries') && error.message.includes(hash) && error.message.includes(alias));
  assert.equal(methods.filter(method => method === 'eth_getTransactionReceipt').length, 40);
  assert.equal(methods.filter(method => method === 'eth_getTransactionByHash').length, 40);
});

test('round 20 can succeed, but either missing RPC result must fail', async () => {
  for (const missing of ['', 'eth_getTransactionReceipt', 'eth_getTransactionByHash']) {
    let calls = 0;
    const pending = waitForEthTransaction({ rpcUrl: '', hashes: [hash], delayMs: 0,
      request: async (method) => {
        const round = Math.floor(calls++ / 2) + 1;
        return (round < 20 || method === missing ? null : method === 'eth_getTransactionReceipt' ? receipt : transaction) as any;
      },
    });
    if (missing) await assert.rejects(pending, /after 20 queries/);
    else assert.equal((await pending).attempts, 20);
    assert.equal(calls, 40);
  }
});

test('provider errors stop polling instead of keeping the spinner active', async () => {
  let calls = 0;
  await assert.rejects(waitForEthTransaction({ rpcUrl: '', hashes: [hash], delayMs: 0,
    request: async () => { calls++; throw new Error('RPC offline'); },
  }), /after 20 queries/);
  assert.equal(calls, 40);
});

test('HTTP confirmation uses a timeout signal and checks both RPC methods', async t => {
  const methods: string[] = [];
  t.mock.method(globalThis, 'fetch', async (_url: string, init: RequestInit) => {
    assert.ok(init.signal);
    const method = JSON.parse(String(init.body)).method;
    methods.push(method);
    return new Response(JSON.stringify({ result: method === 'eth_getTransactionReceipt' ? receipt : transaction }));
  });
  assert.equal((await waitForEthTransaction({ rpcUrl: 'http://mock', hashes: [hash], delayMs: 0 })).attempts, 1);
  assert.equal(methods.length, 2);
});

test('bridge approval and deployment stop at 20 rounds; resume never resends', async t => {
  const timeout = globalThis.setTimeout;
  t.mock.method(globalThis, 'setTimeout', (callback: (...args: any[]) => void, delay: number, ...args: any[]) =>
    timeout(callback, delay === 1500 ? 0 : delay, ...args));
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return new Response(JSON.stringify({ result: null })); });
  await assert.rejects(waitBridgeReceipt(endpoint, hash), /after 20 queries/);
  assert.equal(calls, 40);
  const step = { key: 'test', label: 'Test', endpoint: endpoint.key, state: 'submitted' as const,
    from: ethers.ZeroAddress, data: '0x6000', nonce: '0x1', value: '0x0', hash };
  const call = async () => { calls++; return null as any; };
  calls = 0;
  await assert.rejects(confirmDeploymentStep(endpoint, step, call), /after 20 queries/);
  assert.equal(calls, 40);
  assert.equal(step.hash, hash);
  assert.equal(step.state, 'submitted', 'unknown outcome must not become an on-chain revert');
  calls = 0;
  await assert.rejects(submitDeploymentStep({ request: async () => { throw new Error('must not sign'); } }, endpoint, step, () => {}, call), /after 20 queries/);
  assert.equal(calls, 40);
});

test('bridge history persists its counter, stops polling and permits read-only reconciliation', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return new Response(JSON.stringify({ result: null })); });
  let record = { route, sourceKey: endpoint.key, stage: 'source-pending', sourceHash: hash } as BridgeRecord;
  for (let attempt = 1; attempt <= 20; attempt++) {
    record = await refreshBridgeRecord(JSON.parse(JSON.stringify(record)));
    assert.equal(record.sourceConfirmationAttempts, attempt);
    assert.equal(record.stage, attempt < 20 ? 'source-pending' : 'confirmation-failed');
  }
  assert.equal(calls, 40);
  assert.equal((await refreshBridgeRecord(record)).sourceHash, hash);
  assert.equal(calls, 40);
  assert.match(record.error!, /On-chain status is unknown/);
  await refreshBridgeRecord({ ...record, stage: 'source-pending', sourceConfirmationAttempts: 0 });
  assert.equal(calls, 42);
});
