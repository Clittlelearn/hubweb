import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';

// Snapshot public indexer responses; all browser requests are read-only fixtures.
const account = '0x755Ccf704E17570b64E247f0794314e4C8E542CA';
const base = process.env.HUBSQL_URL || 'http://127.0.0.1:8080';
const origin = 'http://127.0.0.1:5174';
const responses = new Map();
for (const resource of ['/assets/catalog', '/balances/' + account, '/accounts/' + account + '/erc20-balances']) {
  const response = await fetch(base + '/api/v1' + resource, { signal: AbortSignal.timeout(10000) });
  assert.equal(response.ok, true);
  const body = await response.json();
  assert.equal(body.code, 0);
  responses.set('/api/v1' + resource, body);
}
const root = path.dirname(fileURLToPath(import.meta.url));
const output = path.join(root, 'test-results/wallet-token-names');
fs.mkdirSync(output, { recursive: true });
const catalog = responses.get('/api/v1/assets/catalog').data.list;
const balances = responses.get('/api/v1/balances/' + account).data.balances;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.route('**/*', route => {
  const request = route.request();
  const url = new URL(request.url());
  if (url.origin === origin && request.method() === 'GET' && !url.pathname.startsWith('/api/v1/')) return route.continue();
  if ([origin, 'http://127.0.0.1:8080'].includes(url.origin) && request.method() === 'GET') {
    return route.fulfill({ json: responses.get(url.pathname) || { code: 0, data: { list: [], total: 0 }, message: 'ok' } });
  }
  return route.abort();
});
await page.addInitScript(account => {
  Object.defineProperty(window, 'ethereum', { value: {
    isMetaMask: true, on() {}, removeListener() {},
    async request({ method }) {
      if (method === 'eth_chainId') return '0x301b';
      if (['eth_accounts', 'eth_requestAccounts'].includes(method)) return [account];
      if (['wallet_getPermissions', 'wallet_requestPermissions'].includes(method)) return [{ parentCapability: 'eth_accounts' }];
      throw new Error('Signing and other wallet operations are disabled: ' + method);
    },
  } });
}, account);
const getTokens = () => page.evaluate(async account => {
  const { ApiService } = await import('/src/app/apis/api-service.ts');
  return (await new ApiService('http://127.0.0.1:8080', '/api/v1').walletTokens({ address: account, chainId: 12315 })).list;
}, account);
try {
  await page.goto(origin + '/wallet');
  const tokens = await getTokens();
  for (const balance of balances) {
    const proposal = catalog.find(row => row.kind === 'proposal' && row.asset_type.toLowerCase() === balance.asset_type.toLowerCase());
    if (!proposal) continue;
    const token = tokens.find(item => item.assetType === balance.asset_type);
    assert.ok(token);
    assert.equal(token.name, balance.asset_type === 'OHI' ? 'OpenHive' : Buffer.from(proposal.name, 'base64').toString());
    assert.equal(token.balance, balance.balance, 'Name mapping must not modify raw balances');
    assert.equal(token.contractAddress, '', 'Native token identifier must remain the asset hash');
  }
  // Two proposal hashes may reference the same ERC20 without sharing names.
  const extraHash = '0x' + 'a'.repeat(64);
  const extra = { ...catalog.find(row => row.asset_type !== 'OHI' && row.kind === 'proposal'),
    asset_id: extraHash, asset_type: extraHash, name: btoa('Second proposal'), symbol: '', is_native_flow_active: true };
  const unknown = '0x' + 'b'.repeat(64);
  catalog.push(extra);
  balances.push({ asset_type: '0x' + 'A'.repeat(64), balance: '123' }, { asset_type: unknown, balance: '456' });
  const varied = await getTokens();
  assert.equal(varied.find(item => item.assetType.toLowerCase() === extraHash).name, 'Second proposal');
  assert.equal(varied.find(item => item.assetType.toLowerCase() === extraHash).symbol, 'Second proposal');
  assert.equal(varied.filter(item => item.assetType.toLowerCase() === extraHash).length, 1);
  assert.equal(varied.find(item => item.assetType === unknown).name, unknown);
  balances.splice(-2); catalog.pop();

  await page.getByRole('button', { name: /^Connect Wallet$/i }).last().click();
  await page.getByRole('button', { name: /Browser Wallet/ }).click();
  for (const name of ['xxkk01', 'W05', 'W04', 'ppst', 'PPE2E']) await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
  for (const [name, width, height] of [['desktop', 1440, 1100], ['mobile', 390, 844]]) {
    await page.setViewportSize({ width, height });
    await page.screenshot({ path: path.join(output, name + '.png'), fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, name + ' overflow');
    for (const balance of await page.locator('p.font-bold').all()) {
      assert.equal(await balance.evaluate(node => {
        const rect = node.getBoundingClientRect();
        return rect.right > innerWidth || node.scrollWidth > node.clientWidth;
      }), false, name + ' balance clipping');
    }
  }
  assert.deepEqual(errors, []);
  console.log('PASS: genesis token names, unchanged balances/identifiers, zero balances, case-insensitive hashes, shared contract proposals, unknown fallback, desktop/mobile. No transactions.');
} finally { await browser.close(); }
