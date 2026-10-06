import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';

// Read-only browser checks against the actual forwarded Hub and its HubSQL proxy.
const origin = new URL(process.env.HUB_LAN_URL || 'http://192.168.1.14:8848').origin;
const output = path.join(path.dirname(fileURLToPath(import.meta.url)), 'test-results/lan-api');
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
const errors = [];
const requests = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => {
  if (message.text().includes('Invalid DOM property')) errors.push(message.text());
});
page.on('request', request => {
  if (new URL(request.url()).pathname.startsWith('/api/v1/')) requests.push(request.url());
});
await page.route('**/*', route => {
  const request = route.request();
  if (new URL(request.url()).origin !== origin || request.method() !== 'GET') return route.abort();
  return route.continue();
});
try {
  await page.goto(origin + '/governance', { waitUntil: 'networkidle' });
  await expect(page.getByText('Governance Proposals', { exact: true })).toBeVisible();
  const result = await page.evaluate(async () => {
    const { NETWORKS } = await import('/src/app/lib/wallet.ts');
    const { ApiService } = await import('/src/app/apis/api-service.ts');
    const base = NETWORKS.find(network => network.key === 'devnet').service.baseApi;
    const api = new ApiService(base, '/api/v1');
    const wallet = await api.walletTokens({ address: '0x755Ccf704E17570b64E247f0794314e4C8E542CA', chainId: 12315 });
    const overview = await fetch('/api/v1/stats/overview').then(response => response.json());
    const deployment = await fetch('/__bridge-deploy/setup', { headers: { 'x-bridge-request': '1' } });
    return { base, tokens: wallet.list.length, overviewCode: overview.code,
      secureContext: isSecureContext, webLocks: Boolean(navigator.locks), deploymentStatus: deployment.status };
  });
  assert.equal(result.base, origin);
  assert.ok(result.tokens > 0);
  assert.equal(result.overviewCode, 0);
  for (const resource of ['/balances/', '/erc20-balances', '/assets/catalog', '/stats/overview', '/proposals']) {
    assert.ok(requests.some(url => url.includes(resource)), 'Missing API coverage: ' + resource);
  }
  assert.ok(requests.every(url => new URL(url).origin === origin), 'Browser must not call visitor localhost:8080');
  const hostname = new URL(origin).hostname;
  if (!['localhost', '127.0.0.1', '[::1]'].includes(hostname)) {
    assert.equal(result.deploymentStatus, 403, 'LAN access must not bypass deployment API security');
  }
  for (const [name, width, height] of [['desktop', 1440, 960], ['mobile', 390, 844]]) {
    await page.setViewportSize({ width, height });
    await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ result: 'PASS', origin, apiRequests: requests.length, ...result,
    liveTransactions: 0 }, null, 2));
} finally {
  await browser.close();
}
