import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';

// Real read-only route checks. Never connects a wallet or sends a transaction.
const origin = process.env.BRIDGE_UI_URL || 'http://192.168.1.14:8848';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const loopbackRequests = [];
const methods = [];
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => {
  const url = new URL(request.url());
  if (['127.0.0.1', 'localhost'].includes(url.hostname) && ['8545', '8546'].includes(url.port)) loopbackRequests.push(request.url());
  if (url.pathname === '/__bridge-rpc') methods.push(request.postDataJSON().method);
});
try {
  await page.goto(origin + '/bridge');
  await expect(page.getByText('Contracts verified', { exact: true })).toBeVisible({ timeout: 30000 });
  assert.ok(methods.includes('eth_chainId'));
  assert.ok(methods.includes('eth_call'));
  assert.ok(methods.every(method => !method.startsWith('eth_send')));
  assert.deepEqual(loopbackRequests, []);
  assert.deepEqual(errors, []);
  const route = await page.evaluate(async () => (await (await fetch('/bridge/routes.json')).json()).routes[0]);
  const endpoint = route.endpoints.find(item => item.chainId === 31338);
  const state = await page.evaluate(async endpoint => {
    const response = await fetch('/__bridge-rpc', { method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Bridge-Read': '1' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [], bridgeEndpoint: endpoint }) });
    return response.json();
  }, endpoint);
  assert.ok(state.result && !state.error);
  console.log(JSON.stringify({ origin, checks: 'LAN bridge verified without browser loopback RPC or signing', localBscHeight: Number(BigInt(state.result)), proxiedReads: methods.length }));
} finally { await browser.close(); }
