import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';
import { Interface, zeroPadValue, toQuantity } from 'ethers';

// Isolated display fixtures: no wallet, keys, real RPC requests or broadcasts.
const root = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(fs.readFileSync(path.resolve(root, '../../public/bridge/routes.json')));
const route = config.routes.find(item => item.id === 'hbr-hivex-local-bsc');
assert.ok(route, 'Expected HiveX bridge route');
const [hive, bsc] = route.endpoints;
const account = '0x1111111111111111111111111111111111111111';
const recipient = '0x2222222222222222222222222222222222222222';
const savedRoute = structuredClone(route);
savedRoute.endpoints[1].router = '0x3333333333333333333333333333333333333333';
const record = {
  id: 'address-display-fixture', account, recipient, amount: '2.5', rawAmount: '250000000',
  createdAt: 1789761600000, sourceHash: `0x${'a'.repeat(64)}`, messageId: `0x${'b'.repeat(64)}`,
  destinationHash: `0x${'c'.repeat(64)}`, destinationStartBlock: 0, stage: 'delivered',
  route: savedRoute, sourceKey: bsc.key,
};
const abi = new Interface([
  'function routers(uint32) view returns(bytes32)', 'function mailbox() view returns(address)',
  'function localDomain() view returns(uint32)', 'function decimals() view returns(uint8)',
  'function scale() view returns(uint256)', 'function wrappedToken() view returns(address)',
]);
const origin = process.env.BRIDGE_UI_URL || 'http://127.0.0.1:5174';
const output = path.join(root, 'test-results/address-display');
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
const page = await context.newPage();
const errors = [];
const writes = [];
page.on('pageerror', error => errors.push(error.message));
await page.route('**/*', async interception => {
  const request = interception.request();
  const url = new URL(request.url());
  const proxied = url.origin === origin && url.pathname === '/__bridge-rpc';
  if (url.origin === origin && !proxied) {
    if (url.pathname === '/bridge/routes.json') return interception.fulfill({ json: config });
    return interception.continue();
  }
  const endpoint = route.endpoints.find(item => proxied ? item.key === request.postDataJSON().bridgeEndpoint.key : new URL(item.rpcUrl).origin === url.origin);
  if (!endpoint || request.method() !== 'POST') return interception.abort();
  const { method, params, id } = request.postDataJSON();
  let result;
  if (method.startsWith('eth_send')) {
    writes.push(method);
    return interception.abort();
  }
  if (method === 'eth_chainId') result = toQuantity(endpoint.chainId);
  else if (method === 'eth_getCode') result = '0x6000';
  else if (method === 'eth_getLogs') result = [];
  else if (method === 'eth_call') {
    const call = abi.parseTransaction({ data: params[0].data });
    const remote = route.endpoints.find(item => item.key !== endpoint.key);
    const values = { routers: zeroPadValue(remote.router, 32), mailbox: endpoint.mailbox,
      localDomain: endpoint.domain, decimals: route.decimals, scale: 1, wrappedToken: endpoint.token };
    result = abi.encodeFunctionResult(call.name, [values[call.name]]);
  } else return interception.abort();
  return interception.fulfill({ json: { jsonrpc: '2.0', id, result } });
});
await page.addInitScript(({ routeId, sourceKey, record }) => {
  if (localStorage.getItem('address-test-seeded')) return;
  localStorage.setItem('address-test-seeded', 'true');
  localStorage.setItem('hub.bridge.form.v1', JSON.stringify({ routeId, sourceKey, amount: '', recipient: '' }));
  localStorage.setItem('hub.bridge.history.v1', JSON.stringify([record]));
}, { routeId: route.id, sourceKey: bsc.key, record });

async function field(scope, label, value) {
  const row = scope.locator('dl > div').filter({ has: page.locator('dt').filter({ hasText: label }) });
  await expect(row.locator('code')).toHaveText(value);
}
try {
  await page.goto(`${origin}/bridge`);
  await expect(page.getByText('Contracts verified', { exact: true })).toBeVisible();
  const preview = page.locator('form').getByRole('region', { name: 'Bridge addresses' });
  const history = page.locator('article').getByRole('region', { name: 'Bridge addresses' });
  await field(preview, 'Source call (Router)', bsc.router);
  await field(preview, 'Source ERC20', bsc.token);
  await field(preview, 'Delivery call (Mailbox)', hive.mailbox);
  await field(preview, 'Destination Router', hive.router);
  await field(preview, 'Destination ERC20', hive.token);
  await field(preview, 'ERC20 recipient', '--');
  await field(history, 'Source call (Router)', savedRoute.endpoints[1].router);
  await field(history, 'ERC20 recipient', recipient);
  await page.getByLabel('Destination recipient', { exact: true }).fill(account);
  await field(preview, 'ERC20 recipient', account);
  await preview.getByRole('button', { name: `Copy ${hive.name} · ERC20 recipient`, exact: true }).click();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), account);
  await page.getByRole('button', { name: 'Reverse bridge direction' }).click();
  await field(preview, 'Source call (Router)', hive.router);
  await field(preview, 'Destination ERC20', bsc.token);
  await field(preview, 'Delivery call (Mailbox)', bsc.mailbox);
  await field(history, 'Source call (Router)', savedRoute.endpoints[1].router);
  await page.reload();
  await field(preview, 'Source call (Router)', hive.router);
  await field(preview, 'ERC20 recipient', account);
  await field(history, 'ERC20 recipient', recipient);
  await page.getByLabel('Bridge asset', { exact: true }).selectOption(config.routes[1].id);
  await field(preview, 'Source call (Router)', config.routes[1].endpoints[1].router);
  await field(history, 'Source call (Router)', savedRoute.endpoints[1].router);
  await page.getByLabel('Bridge asset', { exact: true }).selectOption(route.id);
  await page.getByLabel('Destination recipient', { exact: true }).fill('invalid');
  await field(preview, 'ERC20 recipient', '--');
  await page.getByLabel('Destination recipient', { exact: true }).fill(account);
  for (const [name, width, height] of [['desktop', 1440, 1100], ['mobile', 390, 844]]) {
    await page.setViewportSize({ width, height });
    await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${name} overflow`);
    for (const code of await page.getByRole('region', { name: 'Bridge addresses' }).locator('code').all()) {
      assert.equal(await code.evaluate(node => node.scrollWidth > node.clientWidth), false, `${name} address clipping`);
    }
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(writes, []);
  console.log('PASS: contract roles, recipient, copying, reverse direction, route switching, historical snapshots, reload, desktop/mobile. No transactions sent.');
} finally { await browser.close(); }
