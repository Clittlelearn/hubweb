import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import { ethers } from 'ethers';

const origin = process.env.HUB_TEST_ORIGIN || 'http://127.0.0.1:5174';
const account = '0x755Ccf704E17570b64E247f0794314e4C8E542CA';
const recipient = '0xeb26a104ea1347D4a71fd96f5Cf2F1170ca22BEb';
const asset = '0x' + 'a'.repeat(63), contract = '0x' + 'b'.repeat(40);
const hash = '0x' + 'c'.repeat(64);
const rawFlowTarget = '0x00530a843B706Eb0647b430a023FdAdD4231493f';
const browser = await chromium.launch();
try {
  for (const [symbol, label, to] of [
    ['FLOW', 'Flow Test', recipient], ['FLOW', 'Flow Test', account],
    ['OHI', 'HiveX', recipient], ['ERC', 'ERC Test', recipient],
  ]) {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/*', route => {
      const req = route.request(), url = new URL(req.url());
      // No requests to a real node and no real signing/broadcasting.
      if (req.method() !== 'GET') return route.abort('blockedbyclient');
      if (url.origin === origin && !url.pathname.startsWith('/api/v1/')) return route.continue();
      let data = { list: [], balances: [], total: 0 };
      if (url.pathname.includes('/balances/')) data = { balances: [
        { asset_type: 'OHI', balance: '1000000000000' },
        { asset_type: asset, balance: '1000000000000' },
      ] };
      if (url.pathname.endsWith('/erc20-balances')) data = { balances: [
        { contract_address: contract, balance: '10000000000' },
      ] };
      if (url.pathname.endsWith('/assets/catalog')) data = { metadata_supported: true, list: [
        { kind: 'proposal', asset_type: asset, name: btoa('Flow Test'), symbol: btoa('FLOW'), is_added: true, is_native_flow_active: true },
        { kind: 'erc20', asset_id: contract, contract_address: contract, name: 'ERC Test', symbol: 'ERC', decimals: 6, is_added: true },
      ] };
      if (url.pathname.endsWith('/metadata')) data = { name: 'ERC Test', symbol: 'ERC', decimals: 6 };
      return route.fulfill({ json: { code: 0, data } });
    });
    await page.addInitScript(({ account, recipient, hash }) => {
      window.__sent = [];
      Object.defineProperty(window, 'ethereum', { value: {
        isMetaMask: true, on() {}, removeListener() {},
        async request({ method, params }) {
          if (method === 'eth_chainId') return '0x301b';
          if (['eth_accounts', 'eth_requestAccounts'].includes(method)) return [account];
          if (['wallet_getPermissions', 'wallet_requestPermissions'].includes(method)) return [{ parentCapability: 'eth_accounts' }];
          if (method === 'eth_estimateGas') return '0x7a120';
          if (method === 'eth_gasPrice') return '0x4';
          if (method === 'eth_sendTransaction') {
            const tx = params[0];
            if (tx.data !== '0x' && [account, recipient].some(
              address => address.toLowerCase() === tx.to?.toLowerCase(),
            )) throw new Error('External transactions to internal accounts cannot include data');
            window.__sent.push(tx);
            return hash;
          }
          throw new Error('Unexpected wallet method: ' + method);
        },
      } });
    }, { account, recipient, hash });
    await page.goto(origin + '/wallet');
    await page.getByRole('button', { name: /^Connect Wallet$/ }).last().click();
    await page.getByRole('button', { name: /Browser Wallet/ }).click();
    await expect(page.getByRole('button', { name: 'Connected wallet account' })).toBeVisible();
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await page.getByRole('button', { name: /Select token/ }).click();
    await page.getByRole('button', { name: new RegExp(`${label}.*${symbol}`) }).click();
    await page.getByPlaceholder('0x...', { exact: true }).fill(to);
    await page.getByPlaceholder('0.00', { exact: true }).fill('12.5');
    await page.getByRole('button', { name: `Send ${symbol}`, exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.__sent.length)).toBe(1);
    const [tx] = await page.evaluate(() => window.__sent);
    assert.equal(tx.from, ethers.getAddress(account));
    if (symbol === 'FLOW') {
      assert.equal(tx.to, ethers.getAddress(rawFlowTarget));
      assert.equal(tx.value, ethers.toQuantity(ethers.parseUnits('12.5', 18)));
      assert.deepEqual(JSON.parse(ethers.toUtf8String(tx.data)), {
        type: 'tx', asset_type: asset, to,
        is_find_utxo: false, sponsor_gas: false, encoded_info: '',
        gas_asset: { addr: account, asset_type: 'OHI' },
      });
    } else if (symbol === 'OHI') {
      assert.equal(tx.to, ethers.getAddress(recipient));
      assert.equal(tx.value, ethers.toQuantity(ethers.parseUnits('12.5', 18)));
      assert.equal(tx.data, '0x');
    } else {
      assert.equal(tx.to, ethers.getAddress(contract));
      assert.equal(tx.value, '0x0');
      const iface = new ethers.Interface(['function transfer(address,uint256)']);
      const args = iface.decodeFunctionData('transfer', tx.data);
      assert.equal(args[0], ethers.getAddress(recipient));
      assert.equal(args[1], ethers.parseUnits('12.5', 6));
    }
    await expect(page.getByText('Transaction sent', { exact: true }).first()).toBeVisible();
    assert.deepEqual(errors, []);
    await page.close();
    console.log(`${symbol}: wallet UI produced the expected signing request. No real transaction sent.`);
  }
} finally { await browser.close(); }
