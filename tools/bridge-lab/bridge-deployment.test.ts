import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { ethers } from 'ethers';
import { assertDeploymentAccount, checkDeploymentGas, ensureDeploymentWallet, createDeployment, confirmDeploymentStep, submitDeploymentStep, persistDeployment, readDeployments,
  type DeploymentStep } from '../../src/app/lib/bridge-deployment';
import { localDeploymentRequest } from '../bridge-deploy-plugin';

const account = '0x755Ccf704E17570b64E247f0794314e4C8E542CA';
const config = JSON.parse(fs.readFileSync(new URL('../../public/bridge/routes.json', import.meta.url), 'utf8'));
const endpoint = config.routes.find((r: any) => r.endpoints.some((e: any) => e.chainId === 12315)).endpoints[0];
const hash = ethers.id('test transaction');
const blockHash = ethers.id('test block');
const step = (): DeploymentStep => ({ key: 'test', label: 'Test', endpoint: endpoint.key, state: 'submitted', from: account,
  data: '0x6000', nonce: '0x1', value: '0x0', hash });
const receipt = { blockHash, blockNumber: '0x10', status: '0x1', contractAddress: ethers.getCreateAddress({ from: account, nonce: 1 }) };
const transaction = { ...receipt, from: account, to: null, input: '0x6000', nonce: '0x1', value: '0x0' };
const mockRpc = (patch: Record<string, any> = {}) => async (_endpoint: any, method: string) => {
  if (method in patch) return patch[method];
  return { eth_getTransactionReceipt: receipt, eth_getTransactionByHash: transaction,
    eth_chainId: ethers.toQuantity(endpoint.chainId), eth_getBlockByNumber: { hash: blockHash, number: '0x10' }, eth_getCode: '0x6000', eth_getTransactionCount: '0x1' }[method];
};
const provider = (send: () => unknown) => ({ request: async ({ method }: { method: string }) => {
  if (method === 'eth_chainId') return ethers.toQuantity(endpoint.chainId);
  if (method === 'eth_accounts') return [account];
  if (method === 'eth_getBlockByNumber') return { hash: blockHash, number: '0x10' };
  if (method === 'eth_getBalance') return '0xde0b6b3a7640000';
  if (method === 'eth_estimateGas') return '0x100000';
  if (method === 'eth_sendTransaction') return send();
  throw new Error(`Unexpected wallet method ${method}`);
} });

test('selected wallet account must match even when the saved account is still authorized', async () => {
  await assert.rejects(assertDeploymentAccount({ request: async () => [ethers.ZeroAddress, account] }, account), /Wallet account changed/);
});

test('same chain ID on another chain is rejected before Gas checks', async () => {
  let balances = 0;
  const wallet = provider(() => { throw new Error('must not sign'); });
  const request = wallet.request;
  wallet.request = async (args) => {
    if (args.method === 'eth_getBalance') balances++;
    return request(args);
  };
  await assert.rejects(checkDeploymentGas(wallet, endpoint, account, mockRpc({
    eth_getBlockByNumber: { number: '0x10', hash: ethers.id('another chain') },
  }) as any), /wallet and deployment RPC do not match/);
  assert.equal(balances, 0);
});

test('Gas is read for the selected wallet after identity checks and zero balance identifies its account and RPC', async () => {
  const wallet = provider(() => { throw new Error('must not sign'); });
  // A stale balance on the independent RPC must not override the wallet used for signing.
  await checkDeploymentGas(wallet, endpoint, account, mockRpc({ eth_getBalance: '0x0' }) as any);
  const request = wallet.request;
  wallet.request = async args => args.method === 'eth_getBalance' ? '0x0' : request(args);
  await assert.rejects(checkDeploymentGas(wallet, endpoint, account, mockRpc() as any), error =>
    error.message.includes(account) && error.message.includes(endpoint.rpcUrl) && error.message.includes('has 0'));
});

test('wallet and RPC may have different latest heights but must share a canonical block', async () => {
  const heights: string[] = [];
  const rpc = async (_endpoint: any, method: string, params?: any[]) => {
    if (method === 'eth_chainId') return ethers.toQuantity(endpoint.chainId);
    heights.push(params![0]);
    return { number: params![0] === 'latest' ? '0x11' : params![0], hash: blockHash };
  };
  await ensureDeploymentWallet(provider(() => {}), endpoint, account, rpc as any);
  assert.deepEqual(heights, ['latest', '0x10']);
});

test('deployment confirmation needs receipt, by-hash and canonical block', async () => {
  const confirmed = step();
  await confirmDeploymentStep(endpoint, confirmed, mockRpc() as any, 1);
  assert.equal(confirmed.state, 'confirmed');
  assert.equal(confirmed.contractAddress, receipt.contractAddress);
  for (const patch of [
    { eth_getTransactionByHash: null },
    { eth_getTransactionByHash: { ...transaction, blockNumber: '0x11' } },
    { eth_getBlockByNumber: { hash: ethers.id('fork') } },
    { eth_getTransactionReceipt: { ...receipt, status: '0x0' } },
    { eth_getTransactionReceipt: { ...receipt, contractAddress: account } },
    { eth_getTransactionByHash: { ...transaction, input: '0xbad0' } },
  ]) await assert.rejects(confirmDeploymentStep(endpoint, step(), mockRpc(patch) as any, 1));
});
test('saved hash resumes confirmation without signing again', async () => {
  let sends = 0;
  await submitDeploymentStep(provider(() => { sends++; return hash; }), endpoint, step(), () => {}, mockRpc() as any);
  assert.equal(sends, 0);
});
test('unknown wallet outcome cannot be resent on reload', async () => {
  const unknown = { ...step(), state: 'awaiting-wallet' as const, hash: undefined };
  let sends = 0;
  await assert.rejects(submitDeploymentStep(provider(() => { sends++; }), endpoint, unknown, () => {}, mockRpc() as any), /no recorded hash/);
  assert.equal(sends, 0);
});
test('wallet rejection permits retry, transport uncertainty does not', async () => {
  for (const rejected of [true, false]) {
    const current = { ...step(), state: 'awaiting-wallet' as const, nonce: '', hash: undefined };
    const saves: string[] = [];
    const wallet = provider(() => { throw Object.assign(new Error('wallet failure'), rejected ? { code: 4001 } : {}); });
    await assert.rejects(submitDeploymentStep(wallet, endpoint, current, () => saves.push(current.nonce), mockRpc() as any));
    assert.equal(current.nonce, rejected ? '' : '0x1');
    assert.equal(saves[0], '0x1', 'save nonce before wallet submission');
  }
});
test('storage failure prevents signing and malformed history is not silently discarded', async () => {
  let sends = 0;
  const current = { ...step(), state: 'awaiting-wallet' as const, nonce: '', hash: undefined };
  await assert.rejects(submitDeploymentStep(provider(() => { sends++; }), endpoint, current,
    () => { throw new Error('Quota exceeded'); }, mockRpc() as any), /Quota/);
  assert.equal(sends, 0);
  assert.throws(() => readDeployments({ getItem: () => 'corrupt' }));
  assert.throws(() => persistDeployment({} as any, { getItem: () => '[]', setItem: () => { throw new Error('Quota'); } }), /Quota/);
});
test('deployment API only accepts loopback same-origin requests', () => {
  const request = { socket: { remoteAddress: '127.0.0.1' }, headers: { host: 'localhost:5174', origin: 'http://localhost:5174', 'x-bridge-request': '1' } };
  assert.equal(localDeploymentRequest(request), true);
  assert.equal(localDeploymentRequest({ ...request, socket: { remoteAddress: '192.168.1.5' } }), false);
  assert.equal(localDeploymentRequest({ ...request, headers: { ...request.headers, origin: 'https://evil.example' } }), false);
  assert.equal(localDeploymentRequest({ ...request, headers: { ...request.headers, origin: 'http://localhost:3000' } }), false);
  assert.equal(localDeploymentRequest({ ...request, headers: { ...request.headers, 'x-bridge-request': undefined } }), false);
});
test('invalid deployment form fails before a journal or transaction is created', () => {
  assert.throws(() => createDeployment({ relayer: account, nativeFlowBridge: account } as any,
    { name: 'Test', symbol: 'T', decimals: 8, supply: '1e8', holder: account, relayGas: '0.1' }, account), /decimal amounts/);
});
