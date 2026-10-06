import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';
import { toBeHex, zeroPadValue } from 'ethers';

// Read-only fixtures; no real wallet, RPC node or indexer is contacted.
const root = path.dirname(fileURLToPath(import.meta.url));
const output = path.join(root, 'test-results/flow-balance');
fs.mkdirSync(output, { recursive: true });
const origin = 'http://127.0.0.1:5174';
const account = '0x755Ccf704E17570b64E247f0794314e4C8E542CA';
const target = '0xea429213fd69d40b65ddcc9ef52bf6a797c989e849ff061a62675df21b636586';
const first = '0x' + '1'.repeat(64);
const contract = '0x5af1bf521e0576502897a9a7e8ee11fcd5157082';
const catalog = [
  { kind: 'proposal', asset_type: first, contract_address: '0x' + '1'.repeat(40), name: btoa('FIRST'), decimals: 8, is_native_flow_active: true },
  { kind: 'proposal', asset_type: target, contract_address: contract, name: btoa('xxkk01'), decimals: 8, is_native_flow_active: true },
];
let revision = 0;
let balanceReads = 0;
const errors = [];
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
await page.addInitScript(() => performance.setResourceTimingBufferSize(2000));
const refreshAssets = () => page.evaluate(async () => {
  // Reuse the mounted client's HMR URL instead of importing a second QueryClient.
  const entry = performance.getEntriesByType('resource').find(item => new URL(item.name).pathname === '/src/app/lib/wagmi.ts');
  if (!entry) throw new Error('Mounted query client module was not observed');
  const { wagmiQueryClient } = await import(entry.name);
  if (!wagmiQueryClient.getQueryCache().findAll({ queryKey: ['flow-assets'] }).length) throw new Error('Flow query is not mounted on this client');
  await wagmiQueryClient.invalidateQueries({ queryKey: ['flow-assets'] });
});
page.on('pageerror', error => errors.push(error.message));
await page.route('**/*', async route => {
  const request = route.request();
  const url = new URL(request.url());
  if (url.origin === origin && request.method() === 'GET' && !url.pathname.startsWith('/api/v1/')) return route.continue();
  if (![origin, 'http://127.0.0.1:8080'].includes(url.origin) || request.method() !== 'GET') return route.abort();
  let data = { list: [], balances: [], total: 0 };
  if (url.pathname.endsWith('/assets/catalog')) data = { list: revision === 3 ? [catalog[0]] : revision >= 2 ? [...catalog].reverse() : catalog };
  if (url.pathname.includes('/balances/')) {
    balanceReads++;
    data = { balances: [
      { asset_type: first, balance: (100000000000n + BigInt(revision)).toString() },
      { asset_type: target, balance: '1000000000000' },
    ] };
  }
  if (url.pathname.endsWith('/contracts')) data = { total: 2, list: ['in', 'out'].map((direction, index) => ({
    asset_type: target, tx_hash: '0x' + String(index + 2).repeat(64), recipient: contract,
    is_flow_in: direction === 'in', is_flow_out: direction === 'out',
    flow_in_amount: direction === 'in' ? '1000000000000' : '0',
    flow_out_amount: direction === 'out' ? '1000000000000' : '0', tx_time: 1789976609934955,
  })) };
  return route.fulfill({ json: { code: 0, message: 'ok', data } });
});
await page.exposeFunction('__flowWallet', async ({ method }) => {
  if (method === 'eth_chainId') return '0x301b';
  if (['eth_accounts', 'eth_requestAccounts'].includes(method)) return [account];
  if (['wallet_getPermissions', 'wallet_requestPermissions'].includes(method)) return [{ parentCapability: 'eth_accounts' }];
  if (method === 'eth_call') return zeroPadValue(toBeHex(2000000000000n), 32);
  throw new Error('Unexpected wallet method (signing is forbidden): ' + method);
});
await page.addInitScript(() => {
  const provider = { isMetaMask: true, on() {}, removeListener() {}, request: payload => window.__flowWallet(payload) };
  Object.defineProperty(window, 'ethereum', { value: provider });
});
try {
  await page.goto(origin + '/flow');
  await page.getByRole('button', { name: /^Connect Wallet$/i }).last().click();
  await page.getByRole('button', { name: /Browser Wallet/ }).click();
  const picker = page.locator('[role="button"][aria-expanded]');
  await expect(picker).toContainText('FIRST');
  await picker.click();
  await page.getByRole('button', { name: /xxkk01/ }).click();
  await page.getByRole('button', { name: 'Flow Out', exact: true }).click();
  await picker.click();
  const flowOptions = picker.locator('..').locator('button').filter({ hasText: /FIRST|xxkk01/ });
  assert.match((await flowOptions.allTextContents())[0], /xxkk01/, 'Flow Out lists highest balance first');
  await flowOptions.first().click();
  const available = page.getByText('Available:', { exact: true }).locator('..');
  await expect(available).toContainText(/10K|10,000/);
  const before = balanceReads;
  revision = 1;
  await refreshAssets();
  await expect.poll(() => balanceReads).toBeGreaterThan(before);
  if (process.argv.includes('--reproduce')) {
    await expect(picker).toContainText('FIRST');
    await expect(available).toContainText('1K');
    console.log('REPRODUCED: balance refresh switches xxkk01 (10K) to FIRST (1K).');
  } else {
  await expect(picker).toContainText('xxkk01');
  await expect(available).toContainText('10,000');
  await page.getByRole('button', { name: 'MAX', exact: true }).click();
  await expect(page.getByRole('spinbutton')).toHaveValue('10000.0');
  const beforeReorder = balanceReads;
  revision = 2;
  await refreshAssets();
  await expect.poll(() => balanceReads).toBeGreaterThan(beforeReorder);
  await expect(picker).toContainText('xxkk01');
  await expect(available).toContainText('10,000');
  await page.getByRole('button', { name: 'Confirm Flow Out', exact: true }).click();
  const debug = JSON.parse(await page.locator('pre').innerText());
  assert.equal(debug.decodedContractCall.amount.raw, '1000000000000');
  assert.equal(debug.ethereumRpc.decodedBeforeSigning.to, contract);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByText('+10K', { exact: true })).toBeVisible();
  await expect(page.getByText('-10K', { exact: true })).toBeVisible();
  for (const [name, width, height] of [['desktop', 1440, 1100], ['mobile', 390, 844]]) {
    await page.setViewportSize({ width, height });
    await page.screenshot({ path: path.join(output, name + '.png'), fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, name + ' overflow');
  }
  const formatted = await page.evaluate(async () => {
    const { formatBalance } = await import('/src/app/pages/flow/use-flow-form-state.ts');
    return ['10000', '1000', '0.00000001', '10000.12345678', '9007199254740993.00000001'].map(formatBalance);
  });
  assert.deepEqual(formatted, ['10,000', '1,000', '0.00000001', '10,000.12345678', '9,007,199,254,740,993.00000001']);
  await page.getByRole('button', { name: 'Confirm Flow Out', exact: true }).click();
  await expect(page.locator('pre')).toBeVisible();
  revision = 3;
  await refreshAssets();
  await expect(picker).toContainText('FIRST');
  await expect(page.getByRole('spinbutton')).toHaveValue('');
  await expect(page.locator('pre')).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirm Flow Out', exact: true })).toBeDisabled();
  assert.deepEqual(errors, []);
  console.log('PASS: stable asset on refresh/reorder, exact balance, MAX, raw FlowOut preview, history, responsive layout. No transactions.');
  }
} catch (error) {
  console.error((await page.locator('body').innerText()).slice(-5000), errors);
  throw error;
} finally { await browser.close(); }
