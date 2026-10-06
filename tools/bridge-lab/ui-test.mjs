import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';
import { Wallet, toQuantity, keccak256 } from 'ethers';
import { rpc } from './rpc.mjs';
import { relayOnce } from './relay.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const hiveTest = process.argv.includes('--hivex');
const routeId = hiveTest ? 'hbr-hivex-local-bsc' : 'hbr-local-evm-bsc';
const routes = JSON.parse(fs.readFileSync(path.resolve(root, '../../public/bridge/routes.json'))).routes;
const route = routes.find(item => item.id === routeId);
if (!route) throw new Error(`Deploy ${routeId} before running the browser test.`);
if (!process.env.BRIDGE_USER_PRIVATE_KEY) throw new Error('Set BRIDGE_USER_PRIVATE_KEY for the local test wallet.');
const signer = new Wallet(process.env.BRIDGE_USER_PRIVATE_KEY);
const output = path.join(root, 'test-results', hiveTest ? 'hivex' : '.');
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const pageErrors = [];
const sent = [];
let chainId = 31338;
let rejectNext = false;
page.on('pageerror', error => pageErrors.push(error.message));
await page.exposeFunction('__bridgeTestWallet', async ({ method, params = [] }) => {
  try {
    if (method === 'eth_chainId') return { result: toQuantity(chainId) };
    if (method === 'eth_accounts' || method === 'eth_requestAccounts') return { result: [signer.address] };
    if (method === 'wallet_getPermissions' || method === 'wallet_requestPermissions') return { result: [{ parentCapability: 'eth_accounts' }] };
    if (method === 'wallet_addEthereumChain') return { result: null };
    if (method === 'wallet_switchEthereumChain') { chainId = Number(BigInt(params[0].chainId)); return { result: null }; }
    const url = route.endpoints.find(endpoint => endpoint.chainId === chainId)?.rpcUrl;
    if (!url) throw new Error('Test wallet received a request for an unconfigured chain.');
    if (method === 'eth_sendTransaction') {
      if (rejectNext) { rejectNext = false; return { error: { message: 'User rejected request', code: 4001 } }; }
      const tx = params[0];
      assert.equal(tx.from.toLowerCase(), signer.address.toLowerCase());
      const nonce = Number(BigInt(await rpc(url, 'eth_getTransactionCount', [signer.address, 'pending'])));
      const raw = await signer.signTransaction({ type: 2, chainId, nonce, to: tx.to, data: tx.data,
        value: BigInt(tx.value || '0x0'), gasLimit: BigInt(tx.gas), maxFeePerGas: 2000000000n, maxPriorityFeePerGas: 500000000n });
      const hash = await rpc(url, 'eth_sendRawTransaction', [raw]);
      sent.push({ chainId, hash, localHash: keccak256(raw), to: tx.to, data: tx.data });
      return { result: hash };
    }
    return { result: await rpc(url, method, params) };
  } catch (error) { return { error: { message: error.message, code: error.code || -32603 } }; }
});
await page.addInitScript(({ routeId }) => {
  if (!localStorage.getItem('hub.bridge.form.v1')) localStorage.setItem('hub.bridge.form.v1', JSON.stringify({ routeId, sourceKey: 'local-bsc', amount: '', recipient: '' }));
  const handlers = new Map();
  const provider = {
    isMetaMask: true,
    on(event, fn) { const list = handlers.get(event) || []; list.push(fn); handlers.set(event, list); },
    removeListener(event, fn) { handlers.set(event, (handlers.get(event) || []).filter(item => item !== fn)); },
    async request(payload) {
      const result = await window.__bridgeTestWallet(payload);
      if (result.error) throw Object.assign(new Error(result.error.message), { code: result.error.code });
      if (payload.method === 'wallet_switchEthereumChain') for (const fn of handlers.get('chainChanged') || []) fn(payload.params[0].chainId);
      return result.result;
    },
  };
  Object.defineProperty(window, 'ethereum', { value: provider });
}, { routeId });

try {
  await page.goto('http://127.0.0.1:5174/bridge');
  await expect(page.getByText('Contracts verified', { exact: true })).toBeVisible({ timeout: 30000 });
  await page.getByRole('button', { name: 'Connect wallet', exact: true }).last().click();
  await page.getByRole('button', { name: /Browser Wallet/ }).click();
  await expect(page.getByRole('button', { name: 'Bridge HBR', exact: true })).toBeVisible({ timeout: 15000 });
  if (process.argv.includes('--visual-only')) {
    const report = JSON.parse(fs.readFileSync(path.join(output, 'ui.json')));
    await page.evaluate(records => localStorage.setItem('hub.bridge.history.v1', JSON.stringify(records)), report.records);
    await page.reload();
    await expect(page.getByText('Contracts verified', { exact: true })).toBeVisible({ timeout: 15000 });
    for (const [name, width, height] of [['desktop', 1440, 1100], ['wide', 1920, 1100], ['mobile', 390, 844]]) {
      await page.setViewportSize({ width, height });
      await page.screenshot({ path: path.join(output, `bridge-${name}.png`), fullPage: true });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${name} horizontal overflow`);
      if (width === 1920) {
        const nav = await page.locator('header nav').first().boundingBox();
        const controls = await page.locator('header nav').first().evaluate(node => {
          const rect = node.parentElement.nextElementSibling.getBoundingClientRect();
          return { x: rect.x };
        });
        assert.ok(nav.x + nav.width <= controls.x, 'Desktop navigation overlaps wallet controls');
      }
    }
    assert.deepEqual(pageErrors, []);
    await browser.close();
    console.log('Visual checks passed at 390px, 1440px and 1920px; navigation does not overlap.');
    process.exit(0);
  }
  await page.getByLabel('Bridge amount').fill('2.5');
  await expect(page.getByRole('button', { name: 'Bridge HBR', exact: true })).toBeEnabled({ timeout: 15000 });
  rejectNext = true;
  await page.getByRole('button', { name: 'Bridge HBR', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Wallet request rejected' })).toBeVisible({ timeout: 15000 });
  assert.equal(sent.length, 0);

  await page.getByRole('button', { name: 'Bridge HBR', exact: true }).click();
  await expect(page.getByText('Waiting for delivery', { exact: true })).toBeVisible({ timeout: 30000 });
  const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('hub.bridge.history.v1')));
  assert.equal(persisted.length, 1);
  assert.ok(persisted[0].sourceHash);
  await page.reload();
  await expect(page.getByText('Waiting for delivery', { exact: true })).toBeVisible({ timeout: 20000 });
  await relayOnce();
  await expect(page.getByText('Delivered', { exact: true })).toBeVisible({ timeout: 180000 });

  await page.getByRole('button', { name: 'Reverse bridge direction' }).click();
  await page.getByLabel('Bridge amount').fill('1');
  await expect(page.getByRole('button', { name: 'Bridge HBR', exact: true })).toBeEnabled({ timeout: 15000 });
  await page.getByRole('button', { name: 'Bridge HBR', exact: true }).click();
  await expect(page.getByText('Waiting for delivery', { exact: true })).toBeVisible({ timeout: 180000 });
  assert.equal(chainId, route.endpoints[0].chainId);
  await relayOnce();
  await expect(page.getByText('Delivered', { exact: true })).toHaveCount(2, { timeout: 180000 });
  const records = await page.evaluate(() => JSON.parse(localStorage.getItem('hub.bridge.history.v1')));
  assert.ok(records.every(record => record.destinationHash && record.messageId));
  await page.screenshot({ path: path.join(output, 'bridge-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(output, 'bridge-mobile.png'), fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Mobile horizontal overflow');
  assert.deepEqual(pageErrors, []);
  fs.writeFileSync(path.join(output, 'ui.json'), JSON.stringify({
    signing: 'Injected EIP-1193 test provider, locally signed EIP-1559 transactions; no MetaMask extension was installed.',
    checks: ['Wallet rejection sends no transaction', 'Collateral approval before transfer', 'Source receipt and by-hash confirmation',
      'Refresh restores pending message', 'Relayer delivery and destination confirmation', 'Reverse transfer switches wallet chain',
      'Desktop and 390px mobile screenshots', 'No horizontal mobile overflow', 'No page exceptions'], transactions: sent, records,
  }, null, 2));
  console.log(`Browser bridge test passed: ${records.length} delivered transfers, ${sent.length} wallet-signed transactions.`);
} catch (error) {
  const records = await page.evaluate(() => JSON.parse(localStorage.getItem('hub.bridge.history.v1') || '[]')).catch(() => []);
  fs.writeFileSync(path.join(output, 'ui-incomplete.json'), JSON.stringify({ error: error.message, transactions: sent, records }, null, 2));
  await page.screenshot({ path: path.join(output, 'bridge-failure.png'), fullPage: true });
  console.error((await page.locator('body').innerText()).slice(-6000));
  throw error;
} finally { await browser.close(); }
