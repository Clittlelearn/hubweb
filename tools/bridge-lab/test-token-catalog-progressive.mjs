import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium, expect } from '@playwright/test';

const origin = 'http://127.0.0.1:5174';
const account = '0x755Ccf704E17570b64E247f0794314e4C8E542CA';
const contracts = Array.from({ length: 1000 }, (_, i) => '0x' + (1000 + i).toString(16).padStart(40, '0'));
const browser = await chromium.launch();
const page = await browser.newPage();
const pending = new Map();
const reads = [];
let directoryReads = 0;
let metadataFinishes = 0;
await page.route('**/*', async route => {
  const url = new URL(route.request().url());
  if (url.origin === origin && !url.pathname.startsWith('/api/v1/')) return route.continue();
  assert.equal(route.request().method(), 'GET');
  let data = { list: [], total: 0, balances: [] };
  if (url.pathname.includes('/balances/')) data = { balances: [{ asset_type: 'OHI', balance: '100000000000' }] };
  if (url.pathname.endsWith('/assets/catalog')) {
    directoryReads++;
    data = { metadata_supported: true, list: contracts.map(contract_address => ({
      kind: 'erc20', asset_id: contract_address, contract_address, name: 'ERC20 ' + contract_address.slice(0, 8), symbol: 'TOKEN', decimals: 18, is_added: false,
    })) };
  }
  if (url.pathname.endsWith('/metadata')) {
    const contract = url.pathname.split('/').at(-2);
    reads.push(contract);
    await new Promise(resolve => pending.set(contract, resolve));
    metadataFinishes++;
    data = { name: contract === contracts.at(-1) ? 'Last Token' : 'Token ' + contracts.indexOf(contract), symbol: 'FOUND', decimals: 8 };
  }
  return route.fulfill({ json: { code: 0, data } });
});
await page.addInitScript(account => {
  Object.defineProperty(window, 'ethereum', { value: { isMetaMask: true, on() {}, removeListener() {},
    async request({ method }) {
      if (method === 'eth_chainId') return '0x301b';
      if (['eth_accounts', 'eth_requestAccounts'].includes(method)) return [account];
      if (['wallet_getPermissions', 'wallet_requestPermissions'].includes(method)) return [{ parentCapability: 'eth_accounts' }];
      throw new Error('No signing in this test');
    } } });
}, account);
try {
  await page.goto(origin + '/wallet');
  await page.getByRole('button', { name: /^Connect Wallet$/ }).last().click();
  await page.getByRole('button', { name: /Browser Wallet/ }).click();
  const start = Date.now();
  await page.getByRole('button', { name: 'Add Token', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Add TOKEN', exact: true })).toHaveCount(20, { timeout: 2000 });
  const firstPaintMs = Date.now() - start;
  assert.equal(metadataFinishes, 0, 'First page must render before any metadata returns');
  await expect(page.getByText('Loading token list...', { exact: true })).toHaveCount(0);
  await expect.poll(() => reads.length).toBe(4);
  const beforeScroll = directoryReads;
  await page.locator('.max-h-\\[24rem\\]').evaluate(node => {
    node.scrollTop = node.scrollHeight; node.dispatchEvent(new Event('scroll', { bubbles: true }));
  });
  await expect(page.getByRole('button', { name: 'Add TOKEN', exact: true })).toHaveCount(40);
  assert.equal(directoryReads, beforeScroll);
  await page.getByPlaceholder(/Search by/).fill(contracts.at(-1));
  await expect(page.getByRole('button', { name: 'Add TOKEN', exact: true })).toHaveCount(1);
  await expect.poll(() => pending.has(contracts.at(-1))).toBe(true);
  pending.get(contracts.at(-1))();
  await expect(page.getByText('Last Token', { exact: true })).toBeVisible();
  await page.getByPlaceholder(/Search by/).fill('Last Token');
  await expect(page.getByText('Last Token', { exact: true })).toBeVisible();
  const output = new URL('test-results/catalog-progressive/', import.meta.url);
  fs.mkdirSync(output, { recursive: true });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 950 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: new URL('search-' + width + '.png', output).pathname, fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  }
  await page.getByRole('button', { name: 'Close Manage Tokens' }).click();
  const beforeClose = reads.length;
  for (const release of pending.values()) release();
  await page.waitForTimeout(500);
  assert.equal(reads.length, beforeClose, 'Closing stops queued metadata work');
  await expect(page.getByRole('heading', { name: 'Manage Tokens' })).toHaveCount(0);
  console.log(JSON.stringify({ result: 'PASS', firstPaintMs, directorySize: 1000,
    checks: 'list before metadata, local scrolling, address priority, progressive name search, close cancellation, desktop/mobile; no writes' }));
} finally { for (const release of pending.values()) release(); await browser.close(); }
