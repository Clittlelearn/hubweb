import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium, expect } from '@playwright/test';

const origin = new URL(process.env.HUB_TEST_ORIGIN || 'http://127.0.0.1:5174').origin;
const output = new URL('test-results/branding/', import.meta.url);
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
// Branding verification is read-only and never contacts a wallet or remote RPC.
await page.route('**/*', route => {
  const request = route.request();
  if (new URL(request.url()).origin !== origin || request.method() !== 'GET') return route.abort();
  return route.continue();
});
try {
  await page.goto(origin + '/governance', { waitUntil: 'networkidle' });
  await expect(page).toHaveTitle(/HiveX Hub/);
  await expect(page.locator('header h1')).toHaveText('HiveXHub');
  await expect(page.locator('header h1')).toBeVisible();
  const manifest = await page.request.get(origin + '/site.webmanifest').then(r => r.json());
  assert.equal(manifest.name, 'HiveX');
  assert.equal(manifest.short_name, 'HiveX');
  const networks = await page.evaluate(async () => {
    const { NETWORKS } = await import('/src/app/lib/wallet.ts');
    return NETWORKS.map(({ chainId, chainName, symbol }) => ({ chainId, chainName, symbol }));
  });
  assert.deepEqual(networks.map(n => n.chainId), [12315, 12316, 12317]);
  assert.ok(networks.every(n => n.chainName.startsWith('HiveX ') && n.symbol === 'OHI'));
  await page.screenshot({ path: new URL('desktop.png', output).pathname });
  await page.locator('header').getByRole('button', { name: 'Connect Wallet', exact: true }).click();
  await expect(page.getByText('HiveX Access', { exact: true })).toBeVisible();
  assert.ok(!/OpenHive/.test(await page.locator('body').innerText()));
  await page.screenshot({ path: new URL('wallet-connect.png', output).pathname });
  await page.reload({ waitUntil: 'networkidle' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Open navigation menu' }).click();
  await expect(page.getByRole('link', { name: /HiveX.*Hub/ })).toBeVisible();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  assert.ok(!/OpenHive/.test(await page.locator('body').innerText()));
  // Allow the navigation entrance animation to finish before visual inspection.
  await page.waitForTimeout(500);
  await page.screenshot({ path: new URL('mobile-menu.png', output).pathname });
  assert.deepEqual(errors, []);
  console.log('PASS: HiveX desktop, mobile, wallet dialog, manifest and unchanged network identities; no transactions sent.');
} finally {
  await browser.close();
}
