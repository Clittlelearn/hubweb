import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium, expect } from '@playwright/test';

const origin = 'http://127.0.0.1:5174';
const account = '0x755Ccf704E17570b64E247f0794314e4C8E542CA';
const contracts = Array.from({ length: 40 }, (_, i) => '0x' + (i + 100).toString(16).padStart(40, '0'));
const browser = await chromium.launch();
const page = await browser.newPage();
let mode = 'old';
let reads = [];
await page.route('**/*', async route => {
  const request = route.request();
  const url = new URL(request.url());
  if (url.origin === origin && !url.pathname.startsWith('/api/v1/')) return route.continue();
  assert.equal(request.method(), 'GET');
  let data = { list: [], total: 0, balances: [] };
  if (url.pathname.includes('/balances/')) data = { balances: [{ asset_type: 'OHI', balance: '100000000000' }] };
  if (url.pathname.endsWith('/assets/catalog')) data = { ...(mode === 'old' ? {} : { metadata_supported: true }),
    list: contracts.map(contract_address => ({ kind: 'erc20', asset_id: contract_address, contract_address, name: 'ERC20 ' + contract_address.slice(0, 8), symbol: 'TOKEN', decimals: 18, is_added: false })) };
  if (url.pathname.endsWith('/metadata')) {
    reads.push(url.pathname);
    if (mode === 'proxy500') return route.fulfill({ status: 500, body: '' });
    if (mode === 'tokenerror' && url.pathname.includes(contracts[0])) return route.fulfill({ json: { code: 503, message: 'Not an ERC20' } });
    data = { name: 'Valid Token ' + contracts.indexOf(url.pathname.split('/').at(-2)), symbol: 'VALID', decimals: 8 };
  }
  return route.fulfill({ json: { code: 0, data } });
});
await page.addInitScript(account => {
  Object.defineProperty(window, 'ethereum', { value: { isMetaMask: true, on() {}, removeListener() {},
    async request({ method }) {
      if (method === 'eth_chainId') return '0x301b';
      if (['eth_accounts', 'eth_requestAccounts'].includes(method)) return [account];
      if (['wallet_getPermissions', 'wallet_requestPermissions'].includes(method)) return [{ parentCapability: 'eth_accounts' }];
      throw new Error('Signing forbidden');
    } } });
}, account);
const catalog = async (advance = 0) => page.evaluate(async ({ account, advance }) => {
  const { ApiService } = await import('/src/app/apis/api-service.ts');
  const now = Date.now;
  Date.now = () => now() + advance;
  try {
    const api = new ApiService(location.origin, '/api/v1');
    const params = { address: account, chainId: 12315, pageNum: 1, pageSize: 20 };
    const snapshot = await api.walletTokenCatalogEntries(params);
    if (snapshot.metadataSupported) await api.enrichWalletTokenCatalog(snapshot.list, new AbortController().signal, () => {});
    return await api.walletTokenCatalog(params);
  }
  finally { Date.now = now; }
}, { account, advance });
try {
  await page.goto(origin + '/wallet');
  await page.getByRole('button', { name: /^Connect Wallet$/ }).last().click();
  await page.getByRole('button', { name: /Browser Wallet/ }).click();
  await page.getByRole('button', { name: 'Add Token', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Restart the updated HubSQL');
  assert.equal(reads.length, 0, 'Old backend must receive no metadata requests');
  await expect(page.getByRole('button', { name: 'Add TOKEN', exact: true }).first()).toBeDisabled();
  const output = new URL('test-results/metadata-compat/', import.meta.url);
  fs.mkdirSync(output, { recursive: true });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 950 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: new URL('old-backend-' + width + '.png', output).pathname, fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  }
  mode = 'proxy500';
  const unavailable = await catalog();
  assert.match(unavailable.metadataWarning, /unavailable/);
  assert.ok(reads.length >= 1 && reads.length <= 4, 'Transport failure stops the batch after at most four in-flight calls');
  const count = reads.length;
  await catalog();
  assert.equal(reads.length, count, 'Repeated opening/search cannot hammer the unavailable endpoint');

  mode = 'tokenerror'; reads = [];
  const partial = await catalog(31_000);
  assert.ok(reads.length >= 36);
  assert.equal(partial.list[0].isVerified, false);
  assert.equal(partial.list[1].name, 'Valid Token 1');
  assert.equal(partial.list[1].decimals, 8);
  const failedContractReads = reads.filter(path => path.includes(contracts[0])).length;
  await catalog(31_000);
  assert.equal(reads.filter(path => path.includes(contracts[0])).length, failedContractReads);

  mode = 'healthy';
  const recovered = await catalog(62_000);
  assert.equal(recovered.list[0].name, 'Valid Token 0');
  assert.equal(recovered.metadataWarning, undefined);
  console.log('PASS: old backend compatibility, bounded proxy failures, negative caching, partial metadata and recovery; no writes.');
} finally { await browser.close(); }
