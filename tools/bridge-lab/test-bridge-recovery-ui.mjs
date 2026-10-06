import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import { rpc } from './rpc.mjs';

// Reads the user's already mined transaction. The injected wallet NEVER broadcasts.
const origin = process.env.BRIDGE_UI_URL || 'http://192.168.1.14:8848';
const account = '0xeb26a104ea1347D4a71fd96f5Cf2F1170ca22BEb';
const hash = '0x56e3a8bdf98352888dadb807a9a23fcbd4a3349186262da12016db0466b99de7';
const destinationHash = '0xf213c648a695fe09b46596b1efff963fc45084ccdc427dfd9f725e831edc7006';
const browser = await chromium.launch({ headless: true });
const output = new URL('test-results/bridge-recovery/', import.meta.url);
fs.mkdirSync(output, { recursive: true });
let writes = 0;
try {
  for (const mode of ['recover', 'wallet-timeout']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.exposeFunction('__readOnlyWallet', async ({ method, params = [] }) => {
      if (method === 'eth_chainId') return '0x7a6a';
      if (['eth_accounts', 'eth_requestAccounts'].includes(method)) return [account];
      if (['wallet_getPermissions', 'wallet_requestPermissions'].includes(method)) return [{ parentCapability: 'eth_accounts' }];
      if (method === 'eth_sendTransaction') {
        assert.equal(mode, 'wallet-timeout');
        writes++;
        return new Promise(() => {}); // Simulate a wallet that never returns a hash.
      }
      if (!['eth_getBalance', 'eth_call', 'eth_estimateGas', 'eth_getBlockByNumber', 'eth_getTransactionCount'].includes(method)) throw new Error('Forbidden wallet method: ' + method);
      return rpc('http://127.0.0.1:8546', method, params);
    });
    await page.addInitScript(({ mode }) => {
      localStorage.setItem('hub.bridge.form.v1', JSON.stringify({ routeId: 'hbr-hivex-local-bsc', sourceKey: 'local-bsc', amount: '', recipient: '' }));
      Object.defineProperty(window, 'ethereum', { value: { isMetaMask: true, on() {}, removeListener() {}, request: payload => window.__readOnlyWallet(payload) } });
      if (mode === 'wallet-timeout') {
        const original = window.setTimeout.bind(window);
        window.setTimeout = (fn, delay, ...args) => original(fn, delay === 120000 ? 100 : delay, ...args);
      }
    }, { mode });
    await page.goto(origin + '/bridge');
    await expect(page.getByText('Contracts verified', { exact: true })).toBeVisible({ timeout: 30000 });
    await page.getByRole('button', { name: /^Connect Wallet$/i }).last().click();
    await page.getByRole('button', { name: /Browser Wallet/ }).click();
    if (mode === 'recover') {
      await page.getByLabel('Source transaction hash').fill(hash);
      await page.getByRole('button', { name: 'Recover existing transaction' }).click();
      await expect(page.getByText('Delivered', { exact: true })).toBeVisible({ timeout: 30000 });
      const records = await page.evaluate(() => JSON.parse(localStorage.getItem('hub.bridge.history.v1')));
      assert.equal(records.length, 1);
      assert.equal(records[0].amount, '100.0');
      assert.equal(records[0].destinationHash, destinationHash);
      await page.reload();
      await expect(page.getByText('Delivered', { exact: true })).toBeVisible();
      await expect(page.getByText('Contracts verified', { exact: true })).toBeVisible({ timeout: 30000 });
      assert.equal(writes, 0);
      for (const [name, width, height] of [['desktop', 1440, 1100], ['mobile', 390, 844]]) {
        await page.setViewportSize({ width, height });
        await page.screenshot({ path: new URL(name + '.png', output).pathname, fullPage: true });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      }
    } else {
      await page.getByLabel('Bridge amount').fill('1');
      const send = page.getByRole('button', { name: 'Bridge HBR', exact: true });
      await expect(send).toBeEnabled({ timeout: 15000 });
      await send.click();
      await expect(page.getByRole('alert').filter({ hasText: 'may already be on chain' })).toBeVisible({ timeout: 15000 });
      await expect(page.getByText(/Wallet result unknown/)).toBeVisible();
      await expect(page.getByRole('tab', { name: 'Deploy contracts', exact: true })).toBeEnabled();
      await expect(page.getByRole('button', { name: 'Bridge HBR', exact: true })).toBeDisabled();
      const pending = await page.evaluate(() => JSON.parse(localStorage.getItem('hub.bridge.submissions.v1')));
      assert.equal(pending[0].state, 'awaiting-wallet');
      await page.reload();
      const reconnect = page.getByRole('button', { name: /^Connect Wallet$/i }).last();
      if (await reconnect.isVisible()) {
        await reconnect.click();
        await page.getByRole('button', { name: /Browser Wallet/ }).click();
      }
      await expect(page.getByText(/Wallet result unknown/)).toBeVisible();
      assert.equal(writes, 1, 'no automatic resend after refresh');
    }
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log('PASS: existing 100 HBR transfer recovered as delivered, survives reload; missing wallet callback exits waiting, retains intent, blocks resending. No real transactions sent.');
} finally { await browser.close(); }
