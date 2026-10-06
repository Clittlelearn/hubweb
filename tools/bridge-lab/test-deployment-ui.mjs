import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';
import { Interface, toQuantity, zeroPadValue, getCreateAddress } from 'ethers';

// Browser fixtures only: no signing keys and no requests to live RPC nodes.
const root = path.dirname(fileURLToPath(import.meta.url));
const origin = process.env.BRIDGE_UI_URL || 'http://127.0.0.1:5174';
const output = path.join(root, 'test-results/deployment');
fs.mkdirSync(output, { recursive: true });
const config = JSON.parse(fs.readFileSync(path.resolve(root, '../../public/bridge/routes.json')));
const endpoints = config.routes.find(item => item.id === 'hbr-hivex-local-bsc').endpoints;
const account = '0x1111111111111111111111111111111111111111';
let activeAccount = account;
let zeroGas = false;
let walletFork = false;
const blockHash = '0x' + 'b'.repeat(64);
const setup = {
  endpoints, relayer: '0x2222222222222222222222222222222222222222',
  nativeFlowBridge: '0xc1b157ac921cf5b89a35d11b9482aa090a0ce921', publishToken: 'fixture', relayerRunning: true,
  artifacts: Object.fromEntries(['Mailbox', 'TrustedRelayerIsm', 'ProtocolFee', 'BridgeTestToken', 'HypERC20', 'HypERC20Collateral'].map(name => {
    const { abi, bytecode } = JSON.parse(fs.readFileSync(path.join(root, 'artifacts', name + '.json')));
    return [name, { abi, bytecode }];
  })),
};
const abi = new Interface([
  'function routers(uint32) view returns(bytes32)', 'function mailbox() view returns(address)',
  'function localDomain() view returns(uint32)', 'function decimals() view returns(uint8)',
  'function scale() view returns(uint256)', 'function wrappedToken() view returns(address)',
  'function balanceOf(address) view returns(uint256)', 'function allowance(address,address) view returns(uint256)',
]);
let chainId = 12315;
let sends = 0;
let lastIntent;
const hash = '0x' + 'a'.repeat(64);
const errors = [];
const unexpectedWrites = [];
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
page.on('pageerror', error => errors.push(error.message));
await page.route('**/*', async interception => {
  const request = interception.request();
  const url = new URL(request.url());
  const proxied = url.origin === origin && url.pathname === '/__bridge-rpc';
  if (url.origin === origin && !proxied) {
    if (request.method() !== 'GET') { unexpectedWrites.push(url.pathname); return interception.abort(); }
    if (url.pathname === '/__bridge-deploy/setup') return interception.fulfill({ json: setup });
    if (url.pathname === '/bridge/routes.json') return interception.fulfill({ json: config });
    return interception.continue();
  }
  const endpoint = endpoints.find(item => proxied ? item.key === request.postDataJSON().bridgeEndpoint.key : new URL(item.rpcUrl).origin === url.origin);
  if (!endpoint || request.method() !== 'POST') return interception.abort();
  const { method, params, id } = request.postDataJSON();
  let result;
  if (method.startsWith('eth_send')) { unexpectedWrites.push(method); return interception.abort(); }
  if (method === 'eth_chainId') result = toQuantity(endpoint.chainId);
  else if (method === 'eth_getBlockByNumber') result = { hash: blockHash, number: '0x10' };
  else if (method === 'eth_getCode') result = '0x6000';
  else if (method === 'eth_getBalance') result = '0xde0b6b3a7640000';
  else if (method === 'eth_getTransactionCount') result = '0x0';
  else if (method === 'eth_getLogs') result = [];
  else if (method === 'eth_getTransactionByHash') result = { ...lastIntent, hash, input: lastIntent.data, to: null };
  else if (method === 'eth_call') {
    const call = abi.parseTransaction({ data: params[0].data });
    if (!call) return interception.abort();
    const remote = endpoints.find(item => item.key !== endpoint.key);
    const values = { routers: zeroPadValue(remote.router, 32), mailbox: endpoint.mailbox,
      localDomain: endpoint.domain, decimals: 8, scale: 1, wrappedToken: endpoint.token, balanceOf: 0, allowance: 0 };
    result = abi.encodeFunctionResult(call.name, [values[call.name]]);
  } else return interception.abort();
  return interception.fulfill({ json: { jsonrpc: '2.0', id, result } });
});
await page.exposeFunction('__deploymentWallet', async ({ method, params = [] }) => {
  if (method === 'eth_chainId') return { result: toQuantity(chainId) };
  if (['eth_accounts', 'eth_requestAccounts'].includes(method)) return { result: [activeAccount] };
  if (method === 'eth_getBlockByNumber') return { result: { hash: walletFork ? '0x' + 'c'.repeat(64) : blockHash, number: '0x10' } };
  if (method === 'eth_getBalance') return { result: zeroGas && chainId === 12315 ? '0x0' : '0xde0b6b3a7640000' };
  if (['wallet_getPermissions', 'wallet_requestPermissions'].includes(method)) return { result: [{ parentCapability: 'eth_accounts' }] };
  if (method === 'wallet_addEthereumChain') return { result: null };
  if (method === 'wallet_switchEthereumChain') { chainId = Number(BigInt(params[0].chainId)); return { result: null }; }
  if (method === 'eth_estimateGas') return { result: '0x100000' };
  if (method === 'eth_sendTransaction') {
    sends++; lastIntent = params[0];
    return { error: sends === 1 ? { message: 'User rejected request', code: 4001 } : { message: 'Wallet transport disconnected', code: 4900 } };
  }
  throw new Error('Unexpected wallet method: ' + method);
});
await page.addInitScript(() => {
  const handlers = new Map();
  const provider = {
    isMetaMask: true,
    on(event, fn) { handlers.set(event, [...(handlers.get(event) || []), fn]); },
    removeListener(event, fn) { handlers.set(event, (handlers.get(event) || []).filter(item => item !== fn)); },
    emit(event, value) { for (const fn of handlers.get(event) || []) fn(value); },
    async request(payload) {
      const response = await window.__deploymentWallet(payload);
      if (response.error) throw Object.assign(new Error(response.error.message), { code: response.error.code });
      if (payload.method === 'wallet_switchEthereumChain') for (const fn of handlers.get('chainChanged') || []) fn(payload.params[0].chainId);
      return response.result;
    },
  };
  Object.defineProperty(window, 'ethereum', { value: provider });
});
const history = () => page.evaluate(() => JSON.parse(localStorage.getItem('hub.bridge.deployments.v1')));
try {
  await page.goto(origin + '/bridge?view=deploy');
  const section = page.getByRole('region', { name: 'Deploy bridge contracts', exact: true });
  await expect(section.getByText('Running', { exact: true })).toBeVisible();
  await page.getByLabel('Token name', { exact: true }).fill('Fresh Bridge Token');
  await page.getByLabel('Token symbol', { exact: true }).fill('FRESH');
  await page.reload();
  await expect(page.getByLabel('Token symbol', { exact: true })).toHaveValue('FRESH');
  await section.getByRole('button', { name: 'Connect wallet', exact: true }).click();
  await page.getByRole('button', { name: /Browser Wallet/ }).click();
  await section.getByRole('button', { name: 'Deploy both chains', exact: true }).click();
  await expect(section.getByRole('alert')).toContainText('rejected');
  assert.equal(sends, 1);
  assert.equal((await history())[0].steps[0].nonce, '');
  await page.reload();
  await expect(section.getByRole('button', { name: 'Resume deployment', exact: true })).toBeEnabled();
  await expect(page.getByLabel('Token symbol', { exact: true })).toHaveValue('FRESH');
  await expect(page.getByLabel('Token symbol', { exact: true })).toBeDisabled();
  // Simulate an idle tab whose journal was updated by another tab holding the lock.
  await page.evaluate(() => {
    const stored = JSON.parse(localStorage.getItem('hub.bridge.deployments.v1'));
    stored[0].steps[0].nonce = '0x0';
    localStorage.setItem('hub.bridge.deployments.v1', JSON.stringify(stored));
  });
  await section.getByRole('button', { name: 'Resume deployment', exact: true }).click();
  await expect(section.getByRole('alert')).toContainText('no recorded hash');
  assert.equal(sends, 1, 'A stale tab must read the latest journal before signing');
  await page.evaluate(() => {
    const stored = JSON.parse(localStorage.getItem('hub.bridge.deployments.v1'));
    stored[0].steps[0].nonce = '';
    localStorage.setItem('hub.bridge.deployments.v1', JSON.stringify(stored));
  });
  await page.reload();
  await section.getByRole('button', { name: 'Resume deployment', exact: true }).click();
  await expect(section.getByRole('alert')).toContainText('disconnected');
  assert.equal(sends, 2);
  await expect(section.getByRole('button', { name: 'Resume deployment', exact: true })).toBeDisabled();
  await page.reload();
  await expect(page.getByLabel(/Unrecorded wallet transaction hash/)).toBeVisible();
  await page.getByLabel(/Unrecorded wallet transaction hash/).fill(hash);
  await section.getByRole('button', { name: 'Verify transaction hash', exact: true }).click();
  await expect(section.getByRole('button', { name: 'Resume deployment', exact: true })).toBeEnabled();
  assert.equal((await history())[0].steps[0].hash, hash);
  assert.equal(sends, 2, 'Reconciliation must not resend a transaction');

  // Render a completed journal fixture to inspect full-length addresses and hashes.
  const [record] = await history();
  record.published = true; delete record.error;
  record.steps[0].state = 'confirmed';
  record.steps[0].contractAddress = getCreateAddress({ from: account, nonce: 0 });
  record.route.endpoints = structuredClone(endpoints).map(endpoint => ({ ...endpoint, ism: account, hook: setup.relayer }));
  await page.evaluate(record => localStorage.setItem('hub.bridge.deployments.v1', JSON.stringify([record])), record);
  await page.reload();
  await expect(section.getByRole('button', { name: 'Route registered', exact: true })).toBeDisabled();
  for (const [name, width, height] of [['desktop', 1440, 1100], ['wide', 1920, 1100], ['mobile', 390, 844]]) {
    await page.setViewportSize({ width, height });
    await page.screenshot({ path: path.join(output, name + '.png'), fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, name + ' overflow');
    for (const code of await section.locator('code').all()) assert.equal(await code.evaluate(node => node.scrollWidth > node.clientWidth), false, name + ' address clipping');
  }
  activeAccount = '0x3333333333333333333333333333333333333333';
  await page.evaluate(value => window.ethereum.emit('accountsChanged', [value]), activeAccount);
  await expect(section.getByRole('button', { name: 'Deploy both chains', exact: true })).toBeEnabled();
  assert.equal((await history()).length, 1, 'Switching accounts must preserve the old deployment');
  await section.getByRole('combobox').selectOption(record.id);
  await expect(section.getByRole('alert')).toContainText('another account');
  await section.getByRole('button', { name: 'New deployment', exact: true }).click();
  zeroGas = true;
  await section.getByRole('button', { name: 'Deploy both chains', exact: true }).click();
  await expect(section.getByRole('alert')).toContainText(`deployer ${activeAccount} has 0 OHI`);
  await expect(section.getByRole('alert')).toContainText(endpoints.find(e => e.chainId === 12315).rpcUrl);
  assert.equal(sends, 2, 'Gas checks must not sign');
  zeroGas = false; walletFork = true;
  await section.getByRole('button', { name: 'Resume deployment', exact: true }).click();
  await expect(section.getByRole('alert')).toContainText('wallet and deployment RPC do not match');
  assert.equal(sends, 2, 'Same-ID network mismatch must not sign');
  chainId = 56;
  await page.evaluate(() => window.ethereum.emit('chainChanged', '0x38'));
  await expect(section.getByRole('alert')).toContainText('Wallet chain 56');
  await expect(section.getByRole('button', { name: 'Resume deployment', exact: true })).toBeDisabled();
  assert.deepEqual(errors, []);
  assert.deepEqual(unexpectedWrites, []);
  console.log('PASS: history, rejection, ambiguous-submit protection, hash reconciliation, account changes, network mismatch, zero Gas identity, 390/1440/1920px. No live transactions.');
} catch (error) {
  await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true });
  console.error((await page.locator('body').innerText()).slice(-6000));
  throw error;
} finally { await browser.close(); }
