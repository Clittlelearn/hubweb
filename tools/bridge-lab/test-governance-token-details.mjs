import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';

const origin = 'http://127.0.0.1:5174';
const target = '0xea429213fd69d40b65ddcc9ef52bf6a797c989e849ff061a62675df21b636586';
const response = await fetch('http://127.0.0.1:8080/api/v1/proposals?page=1&size=100', { signal: AbortSignal.timeout(10000) });
const json = await response.json();
assert.equal(json.code, 0);
const rows = [json.data.list.find(row => row.asset === target), json.data.list.find(row => row.asset === 'OHI')];
assert.ok(rows.every(Boolean), 'Expected xxkk01 and OHI fixtures in the local indexer');
// Exercise both supported tx_info shapes without changing the source snapshot.
const fixtures = [rows[0], { ...rows[1], tx_info: JSON.stringify(rows[1].tx_info) }, {
  asset: '0x' + 'a'.repeat(64), tx_hash: '0x' + 'b'.repeat(64), address: rows[0].address,
  tx_info: {}, is_revoked: true,
}];
const output = path.join(path.dirname(fileURLToPath(import.meta.url)), 'test-results/governance-token-details');
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'], viewport: { width: 1440, height: 1100 } });
const page = await context.newPage();
const errors = [];
const writes = [];
page.on('pageerror', error => errors.push(error.message));
await page.route('**/*', route => {
  const request = route.request();
  const url = new URL(request.url());
  if (request.method() !== 'GET') { writes.push(url.pathname); return route.abort(); }
  if (url.origin === origin && !url.pathname.startsWith('/api/v1/')) return route.continue();
  if (![origin, 'http://127.0.0.1:8080'].includes(url.origin)) return route.abort();
  const data = url.pathname.endsWith('/proposals') ? { list: fixtures, total: fixtures.length } : { list: [], total: 0 };
  return route.fulfill({ json: { code: 0, message: 'ok', data } });
});
const panels = () => page.locator('dl[aria-label="Proposal token details"]');
async function field(panel, label, value) {
  const row = panel.locator(':scope > div').filter({ has: page.getByText(label, { exact: true }) });
  await expect(row.locator('dd')).toHaveText(value);
}
async function check(panel, row) {
  const info = typeof row.tx_info === 'string' ? JSON.parse(row.tx_info) : row.tx_info;
  await field(panel, 'Token name', info.name ? Buffer.from(info.name, 'base64').toString() : '--');
  await field(panel, 'Token hash (asset type)', row.asset);
  await field(panel, 'ERC20 contract', info.tokenContractAddr || '--');
  await field(panel, 'Proposal transaction hash', row.tx_hash);
}
async function screenshots(view) {
  for (const [name, width, height] of [['desktop', 1440, 1100], ['mobile', 390, 844]]) {
    await page.setViewportSize({ width, height });
    await page.screenshot({ path: path.join(output, view + '-' + name + '.png'), fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, view + ' ' + name + ' overflow');
    for (const code of await panels().locator('code').all()) assert.equal(await code.evaluate(node => node.scrollWidth > node.clientWidth), false, 'Identifier clipped');
  }
}
try {
  await page.goto(origin + '/governance');
  await expect(panels()).toHaveCount(3);
  for (let i = 0; i < fixtures.length; i++) await check(panels().nth(i), fixtures[i]);
  await panels().first().getByRole('button', { name: 'Copy Token hash (asset type)', exact: true }).click();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), target);
  await screenshots('list');
  await page.getByRole('link', { name: 'Details', exact: true }).first().click();
  await expect(panels()).toHaveCount(1);
  await check(panels().first(), rows[0]);
  await page.reload();
  await check(panels().first(), rows[0]);
  await screenshots('detail');
  for (const label of ['ERC20 contract', 'Proposal transaction hash']) {
    await panels().first().getByRole('button', { name: 'Copy ' + label, exact: true }).click();
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), label === 'ERC20 contract' ? rows[0].tx_info.tokenContractAddr : rows[0].tx_hash);
  }
  await page.goto(origin + '/governance/OHI');
  await check(panels().first(), rows[1]);
  // The governance voting identifier stays OHI, not its creation transaction hash.
  const normalized = await page.evaluate(async () => {
    const { ApiService } = await import('/src/app/apis/api-service.ts');
    const { normalizeFlatProposals } = await import('/src/app/pages/governance/utils.ts');
    const data = await new ApiService('http://127.0.0.1:8080', '/api/v1').governanceProposals({ chainId: 12315, pageNum: 1, pageSize: 50 });
    return normalizeFlatProposals(data.proposals).find(row => row.assetType === 'OHI');
  });
  assert.equal(normalized.proposalTxHash, 'OHI');
  assert.equal(normalized.proposalTransactionHash, rows[1].tx_hash);
  assert.deepEqual(errors, []);
  assert.deepEqual(writes, []);
  console.log('PASS: list/detail metadata, reload/deep link, object/string tx_info, OHI identifier distinction, missing fields, copy, desktop/mobile. No wallet or writes.');
} finally { await browser.close(); }
