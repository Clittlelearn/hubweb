import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium, expect } from '@playwright/test';

const origin = process.env.HUB_TEST_ORIGIN || 'http://127.0.0.1:5174';
const account = '0x755Ccf704E17570b64E247f0794314e4C8E542CA';
const recipient = '0xeb26a104ea1347D4a71fd96f5Cf2F1170ca22BEb';
const output = new URL('test-results/okx-wallet/', import.meta.url);
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch();
try {
  for (const scenario of ['legacy-multiple', 'announced-multiple', 'okx-only', 'announced-only']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (request.method() !== 'GET') return route.abort('blockedbyclient');
      if (url.origin === origin && !url.pathname.startsWith('/api/v1/')) return route.continue();
      let data = { list: [], balances: [], total: 0 };
      if (url.pathname.includes('/balances/')) data = { balances: [{ asset_type: 'OHI', balance: '100000000000' }] };
      if (url.pathname.endsWith('/assets/catalog')) data = { list: [], total: 0, metadata_supported: true };
      return route.fulfill({ json: { code: 0, data } });
    });
    await page.addInitScript(({ scenario, account }) => {
      window.__calls = [];
      const makeProvider = name => {
        const handlers = new Map();
        let chainId = '0x7a6a';
        let authorized = sessionStorage.getItem('test-authorized-' + name) === 'true';
        return {
          isMetaMask: name === 'metamask', isOkxWallet: name === 'okx',
          on(event, callback) { handlers.set(event, [...(handlers.get(event) || []), callback]); },
          removeListener(event, callback) { handlers.set(event, (handlers.get(event) || []).filter(fn => fn !== callback)); },
          async request({ method, params }) {
            window.__calls.push({ wallet: name, method, params });
            if (method === 'eth_chainId') return chainId;
            if (method === 'eth_accounts') return authorized ? [account] : [];
            if (method === 'eth_requestAccounts' || method === 'wallet_requestPermissions') {
              authorized = true;
              sessionStorage.setItem('test-authorized-' + name, 'true');
              return method === 'eth_requestAccounts' ? [account] : [{ parentCapability: 'eth_accounts' }];
            }
            if (method === 'wallet_getPermissions') return authorized ? [{ parentCapability: 'eth_accounts' }] : [];
            if (method === 'wallet_switchEthereumChain') {
              chainId = params[0].chainId;
              (handlers.get('chainChanged') || []).forEach(fn => fn(chainId));
              return null;
            }
            if (method === 'eth_blockNumber') return '0x350';
            if (method === 'eth_estimateGas') return '0x7a120';
            if (method === 'eth_gasPrice') return '0x1';
            if (method === 'eth_getTransactionCount') return '0x1';
            // Reaching this method is the confirmation handoff. Never sign or broadcast.
            if (method === 'eth_sendTransaction') throw Object.assign(new Error('User rejected the test confirmation'), { code: 4001 });
            throw new Error('Unexpected wallet request: ' + method);
          },
        };
      };
      const okx = makeProvider('okx'), metamask = makeProvider('metamask');
      if (scenario !== 'announced-only') Object.defineProperty(window, 'okxwallet', { value: okx });
      if (scenario !== 'okx-only') Object.defineProperty(window, 'ethereum', { value: metamask });
      if (scenario.startsWith('announced')) {
        const announce = () => window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: {
          info: { uuid: 'bfb1e10e-3e04-4a1d-a917-9a21d87e492e', name: 'OKX Wallet', rdns: 'com.okex.wallet',
            icon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=' },
          provider: okx,
        } }));
        window.addEventListener('eip6963:requestProvider', announce);
        announce();
      }
    }, { scenario, account });
    await page.goto(origin + '/wallet');
    await page.getByRole('button', { name: /^Connect Wallet$/ }).last().click();
    await expect(page.getByRole('button', { name: /OKX Wallet/ })).toHaveCount(1);
    if (scenario !== 'okx-only') await expect(page.getByRole('button', { name: /Browser Wallet/ })).toBeVisible();
    await page.screenshot({ path: new URL(scenario + '-connect.png', output).pathname });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: new URL(scenario + '-connect-mobile.png', output).pathname });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole('button', { name: /OKX Wallet/ }).click();
    await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await page.getByRole('button', { name: /Select token/ }).click();
    await page.getByRole('button', { name: /HiveX.*OHI/ }).click();
    await page.getByPlaceholder('0x...', { exact: true }).fill(recipient);
    await page.getByPlaceholder('0.00', { exact: true }).fill('1');
    await page.getByRole('button', { name: 'Send OHI', exact: true }).click();
    await expect.poll(async () => page.evaluate(() => window.__calls.filter(c => c.method === 'eth_sendTransaction').length)).toBe(1);
    const calls = await page.evaluate(() => window.__calls);
    assert.ok(calls.some(c => c.wallet === 'okx' && c.method === 'wallet_switchEthereumChain'));
    assert.ok(calls.some(c => c.wallet === 'okx' && c.method === 'eth_estimateGas'));
    assert.equal(calls.filter(c => c.wallet === 'metamask' && ['eth_sendTransaction', 'wallet_switchEthereumChain', 'eth_requestAccounts', 'wallet_requestPermissions'].includes(c.method)).length, 0);
    assert.equal(calls.find(c => c.method === 'eth_sendTransaction').params[0].to.toLowerCase(), recipient.toLowerCase());
    const transfer = calls.find(c => c.method === 'eth_sendTransaction').params[0];
    assert.equal(transfer.gasPrice, '0x1');
    assert.equal(transfer.gas, '0x927c0');
    assert.equal(transfer.type, '0x0');
    assert.equal(transfer.chainId, '0x301b');
    assert.equal(transfer.data, '0x');
    assert.equal(BigInt(transfer.value), 10n ** 18n);
    assert.equal(transfer.maxFeePerGas, undefined);
    assert.equal(transfer.maxPriorityFeePerGas, undefined);
    await expect(page.getByText(/User rejected the test confirmation/).first()).toBeVisible();
    // Bridge uses the same selected connector, not the global window.ethereum.
    const bridgeResult = await page.evaluate(async ({ account, recipient }) => {
      const moduleUrl = performance.getEntriesByType('resource').map(item => item.name)
        .find(url => new URL(url).pathname === '/src/app/lib/wagmi.ts');
      const { wagmiConfig } = await import(moduleUrl || '/src/app/lib/wagmi.ts');
      const connection = wagmiConfig.state.connections.get(wagmiConfig.state.current);
      const provider = await connection.connector.getProvider();
      const { sendWalletTransaction } = await import('/src/app/lib/bridge-client.ts');
      try {
        await sendWalletTransaction(provider, { chainId: 12315 }, account, recipient, '0x', 1n);
        return 'unexpected';
      } catch (error) { return error.message; }
    }, { account, recipient });
    assert.equal(bridgeResult, 'User rejected the test confirmation');
    assert.equal(await page.evaluate(() => window.__calls.filter(c => c.wallet === 'metamask' && c.method === 'eth_sendTransaction').length), 0);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: new URL(scenario + '-mobile.png', output).pathname, fullPage: true });
    assert.deepEqual(errors, []);
    await page.close();
    console.log(scenario + ': OKX confirmation handoff, rejection, network switch and reconnect passed');
  }
} finally { await browser.close(); }
