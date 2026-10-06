import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';

const origin = process.env.HUB_TEST_ORIGIN || 'http://127.0.0.1:5174';
const account = '0x755Ccf704E17570b64E247f0794314e4C8E542CA';
const recipient = '0xeb26a104ea1347D4a71fd96f5Cf2F1170ca22BEb';
const message = 'Unable to switch wallet to the selected network. Please reconnect your wallet manually.';
const flowDirection = process.env.FLOW_DIRECTION;
const flowAsset = '0x' + 'a'.repeat(64);
const flowContract = '0x' + 'b'.repeat(40);
const browser = await chromium.launch();
try {
  for (const scenario of (process.env.SCENARIO ? [process.env.SCENARIO] : ['rejected', 'wrong-chain', 'add-rejected', 'disconnect-error', 'disconnect-hangs', 'disconnect-late', 'connector-reannounced', 'old-switch-failure'])) {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
      const request = route.request(), url = new URL(request.url());
      if (request.method() !== 'GET') return route.abort('blockedbyclient');
      if (url.origin === origin && !url.pathname.startsWith('/api/v1/')) return route.continue();
      let data = { list: [], balances: [], total: 0 };
      if (url.pathname.includes('/balances/')) data = { balances: [
        { asset_type: 'OHI', balance: '100000000000' }, { asset_type: flowAsset, balance: '100000000000' },
      ] };
      if (url.pathname.endsWith('/assets/catalog')) data = { list: flowDirection ? [{
        kind: 'proposal', asset_type: flowAsset, contract_address: flowContract,
        name: btoa('Flow Test'), symbol: btoa('FLOW'), decimals: 8, is_native_flow_active: true,
      }] : [], metadata_supported: true };
      return route.fulfill({ json: { code: 0, data } });
    });
    await page.addInitScript(({ account, scenario }) => {
      let chain = '0x7a6a';
      let authorized = sessionStorage.getItem('test-wallet-authorized') === 'true';
      const handlers = new Map();
      window.__emitWalletReconnect = () => {
        for (const fn of handlers.get('connect') || []) fn({ chainId: chain });
        for (const fn of handlers.get('accountsChanged') || []) fn([account]);
      };
      window.__switchMode = scenario;
      window.__calls = [];
      window.__config = async () => {
        const url = performance.getEntriesByType('resource').map(item => item.name)
          .find(url => new URL(url).pathname === '/src/app/lib/wagmi.ts');
        return (await import(url || '/src/app/lib/wagmi.ts')).wagmiConfig;
      };
      Object.defineProperty(window, 'okxwallet', { value: {
        isOkxWallet: true,
        on(event, fn) { handlers.set(event, [...(handlers.get(event) || []), fn]); },
        removeListener(event, fn) { handlers.set(event, (handlers.get(event) || []).filter(f => f !== fn)); },
        async request({ method, params }) {
          window.__calls.push(method);
          if (method === 'eth_chainId') return chain;
          if (method === 'eth_call') return '0x' + (100000000000n).toString(16).padStart(64, '0');
          if (method === 'eth_accounts') return authorized ? [account] : [];
          if (method === 'wallet_getPermissions') return authorized ? [{ parentCapability: 'eth_accounts' }] : [];
          if (['eth_requestAccounts', 'wallet_requestPermissions'].includes(method)) {
            authorized = true;
            sessionStorage.setItem('test-wallet-authorized', 'true');
            return method === 'eth_requestAccounts' ? [account] : [{ parentCapability: 'eth_accounts' }];
          }
          if (method === 'wallet_revokePermissions') throw new Error('Not supported');
          if (method === 'wallet_switchEthereumChain') {
            if (window.__switchMode === 'old-switch-failure') return new Promise((_, reject) => {
              window.__failOldSwitch = () => reject(Object.assign(new Error('Old switch rejected'), { code: 4001 }));
            });
            if (window.__switchMode === 'connector-reannounced') {
              const config = await window.__config();
              const alternate = config.connectors.find(connector => connector.id === 'injected');
              alternate.emitter.emit('connect', { accounts: [account], chainId: Number(BigInt(chain)) });
              throw Object.assign(new Error('Switch rejected after wallet reannouncement'), { code: 4001 });
            }
            if (window.__switchMode === 'add-rejected') throw Object.assign(new Error('Missing chain'), { code: 4902 });
            if (window.__switchMode === 'wrong-chain') return null;
            if (window.__switchMode !== 'success') throw Object.assign(new Error('Switch rejected'), { code: 4001 });
            chain = params[0].chainId;
            (handlers.get('chainChanged') || []).forEach(fn => fn(chain));
            return null;
          }
          if (method === 'wallet_addEthereumChain') throw Object.assign(new Error('Add chain rejected'), { code: 4001 });
          if (method === 'eth_blockNumber' || method === 'eth_getTransactionCount' || method === 'eth_gasPrice') return '0x1';
          if (method === 'eth_estimateGas') return '0x7a120';
          if (method === 'eth_sendTransaction') throw Object.assign(new Error('Test signing rejected'), { code: 4001 });
          throw new Error('Unexpected request: ' + method);
        },
      } });
      if (scenario === 'connector-reannounced') {
        Object.defineProperty(window, 'ethereum', { value: window.okxwallet });
      }
    }, { account, scenario });
    const connect = async () => {
      await page.getByRole('button', { name: /^Connect Wallet$/ }).last().click();
      await page.getByRole('button', { name: /OKX Wallet/ }).click();
      await expect(page.getByRole('button', { name: 'Connected wallet account' })).toBeVisible();
    };
    const send = async () => {
      if (flowDirection) {
        const direction = flowDirection === 'out' ? 'Out' : 'In';
        await page.getByRole('button', { name: `Flow ${direction}`, exact: true }).click();
        await page.getByRole('spinbutton').fill('1');
        await page.getByRole('button', { name: `Confirm Flow ${direction}`, exact: true }).click();
        await page.getByRole('button', { name: `Confirm Flow ${direction}`, exact: true }).last().click();
        return;
      }
      await page.getByRole('button', { name: 'Send', exact: true }).click();
      await page.getByRole('button', { name: /Select token/ }).click();
      await page.getByRole('button', { name: /HiveX.*OHI/ }).click();
      await page.getByPlaceholder('0x...', { exact: true }).fill(recipient);
      await page.getByPlaceholder('0.00', { exact: true }).fill('1');
      await page.getByRole('button', { name: 'Send OHI', exact: true }).click();
    };
    await page.goto(origin + (flowDirection ? '/flow' : '/wallet'));
    await connect();
    if (scenario === 'disconnect-error') await page.evaluate(async () => {
      const config = await window.__config();
      config.state.connections.get(config.state.current).connector.disconnect = async () => { throw new Error('Extension disappeared'); };
    });
    if (scenario === 'disconnect-hangs') await page.evaluate(async () => {
      const config = await window.__config();
      config.state.connections.get(config.state.current).connector.disconnect = () => new Promise(() => {});
    });
    if (scenario === 'disconnect-late') await page.evaluate(async () => {
      const config = await window.__config();
      config.state.connections.get(config.state.current).connector.disconnect = () => new Promise(resolve => {
        window.__finishDisconnect = resolve;
      });
    });
    await send();
    if (scenario === 'old-switch-failure') {
      await expect.poll(() => page.evaluate(() => typeof window.__failOldSwitch)).toBe('function');
      // Exercise the UI session actions while an older operation is still pending.
      await page.getByRole('button', { name: 'Connected wallet account' }).evaluate(el => el.click());
      await page.getByRole('button', { name: 'Disconnect Wallet', exact: true }).evaluate(el => el.click());
      await page.evaluate(() => { window.__switchMode = 'success'; });
      await connect();
      await page.evaluate(() => window.__failOldSwitch());
      await page.waitForTimeout(500);
      assert.equal(await page.evaluate(async () => (await window.__config()).state.status), 'connected');
      await expect(page.getByRole('button', { name: 'Connected wallet account' })).toBeVisible();
      assert.equal(await page.evaluate(() => window.__calls.includes('eth_sendTransaction')), false);
      assert.deepEqual(errors, []);
      await page.close();
      console.log('Old switch failure does not disconnect a new manual session or send a transaction.');
      continue;
    }
    await expect(page.getByRole('heading', { name: 'Connect a Wallet' })).toBeVisible();
    await expect(page.getByText(message, { exact: true }).first()).toBeVisible();
    await expect.poll(() => page.evaluate(async () => (await window.__config()).state.status)).toBe('disconnected');
    assert.equal(await page.evaluate(() => window.__calls.includes('eth_sendTransaction')), false);
    assert.equal(await page.evaluate(async () => (await window.__config()).state.connections.size), 0);
    await expect(page.getByRole('button', { name: 'Connected wallet account' })).toHaveCount(0);
    await page.evaluate(() => window.__emitWalletReconnect());
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(async () => (await window.__config()).state.status), 'disconnected',
      'Extension events must not undo a network-failure disconnect');
    if (scenario === 'disconnect-late') {
      await page.evaluate(() => { window.__switchMode = 'success'; });
      await page.getByRole('button', { name: /OKX Wallet/ }).click();
      await expect.poll(() => page.evaluate(async () => (await window.__config()).state.status)).toBe('connected');
      await page.evaluate(() => window.__finishDisconnect());
      await page.waitForTimeout(300);
      assert.equal(await page.evaluate(async () => (await window.__config()).state.status), 'connected',
        'Late disconnect cleanup must not remove a new manual connection');
    } else {
      // The provider still exposes the account. Persisted disconnect must prevent auto-reconnect.
      await page.reload();
      await expect(page.getByRole('button', { name: /^Connect Wallet$/ }).last()).toBeVisible();
      await expect.poll(() => page.evaluate(async () => (await window.__config()).state.status)).toBe('disconnected');
      await page.evaluate(() => { window.__switchMode = 'success'; });
      await connect();
    }
    await send();
    await expect.poll(() => page.evaluate(() => window.__calls.filter(method => method === 'eth_sendTransaction').length)).toBe(1);
    await expect(page.getByText(/Test signing rejected/).first()).toBeVisible();
    assert.equal(await page.evaluate(async () => (await window.__config()).state.status), 'connected');
    assert.deepEqual(errors, []);
    await page.close();
    console.log(`${scenario}: disconnect, blocked signing, reload and manual reconnect passed (mock wallet only)`);
  }
} finally { await browser.close(); }
