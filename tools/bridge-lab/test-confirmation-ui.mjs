import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';

// Mock all RPC traffic. No wallet signing or live chain writes.
const origin = process.env.BRIDGE_UI_URL || 'http://127.0.0.1:5174';
const config = JSON.parse(fs.readFileSync(new URL('../../public/bridge/routes.json', import.meta.url), 'utf8'));
const route = config.routes[0];
const hash = '0x' + 'f'.repeat(64);
const account = '0x1111111111111111111111111111111111111111';
const record = { id: 'confirmation-fixture', account, recipient: account, amount: '1', rawAmount: '100000000',
  createdAt: Date.now(), sourceHash: hash, destinationStartBlock: 0, route, sourceKey: route.endpoints[0].key,
  stage: 'source-pending', sourceConfirmationAttempts: 18 };
const output = new URL('test-results/confirmation/', import.meta.url);
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
let queries = 0;
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.route('**/*', async interception => {
  const request = interception.request();
  const url = new URL(request.url());
  if (url.origin === origin && url.pathname === '/bridge/routes.json') return interception.fulfill({ json: config });
  if (url.origin === origin && request.method() === 'GET' && !url.pathname.startsWith('/api/') && !url.pathname.startsWith('/__bridge')) return interception.continue();
  if (request.method() === 'POST') {
    const { method, params, id } = request.postDataJSON();
    assert.ok(!method.startsWith('eth_send'), 'no signing or sending');
    if (['eth_getTransactionReceipt', 'eth_getTransactionByHash'].includes(method) && params[0] === hash) queries++;
    return interception.fulfill({ json: { jsonrpc: '2.0', id, result: null } });
  }
  return interception.fulfill({ json: { code: 0, data: { list: [], balances: [] } } });
});
await page.addInitScript(record => {
  if (!localStorage.getItem('hub.bridge.history.v1')) localStorage.setItem('hub.bridge.history.v1', JSON.stringify([record]));
}, record);
try {
  await page.goto(origin + '/bridge');
  await expect(page.getByText('Transaction confirmation failed', { exact: true })).toBeVisible({ timeout: 20000 });
  assert.equal(queries, 4, 'only rounds 19 and 20 are issued');
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('hub.bridge.history.v1'))[0].sourceConfirmationAttempts), 20);
  await page.reload();
  await expect(page.getByText('Transaction confirmation failed', { exact: true })).toBeVisible();
  assert.equal(queries, 4, 'reload does not restart failed polling');
  await expect(page.getByText('Source transaction: ' + hash, { exact: false })).toBeVisible();
  for (const [name, width, height] of [['desktop', 1440, 1100], ['mobile', 390, 844]]) {
    await page.setViewportSize({ width, height });
    await page.screenshot({ path: new URL(name + '.png', output).pathname, fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, name + ' overflow');
  }
  await page.getByRole('button', { name: 'Recheck saved transaction' }).click();
  await expect(page.getByText('Confirming source', { exact: true })).toBeVisible();
  await expect.poll(() => queries).toBe(6);
  assert.deepEqual(errors, []);
  console.log('PASS: round-20 failure, persisted counter/hash, reload stays stopped, manual read-only recheck, desktop/mobile.');
} finally { await browser.close(); }
