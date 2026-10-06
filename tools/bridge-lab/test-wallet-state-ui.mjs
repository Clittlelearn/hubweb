import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium, expect } from '@playwright/test';

const origin = 'http://127.0.0.1:5174';
const account = '0x755Ccf704E17570b64E247f0794314e4C8E542CA';
const other = '0xeb26a104ea1347D4a71fd96f5Cf2F1170ca22BEb';
const contracts = Array.from({ length: 25 }, (_, i) => '0x' + (i + 1).toString(16).padStart(40, '0'));
const ownAsset = '0x' + 'a'.repeat(64);
const globalAsset = '0x' + 'b'.repeat(64);
const output = new URL('test-results/wallet-state/', import.meta.url);
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
let failBalance = false, delayBalance = 0, closed = false;
let balanceReads = 0;
await page.route('**/*', async route => {
  const url = new URL(route.request().url());
  if (url.origin === origin && !url.pathname.startsWith('/api/v1/')) return route.continue();
  assert.equal(route.request().method(), 'GET', 'No live writes');
  let data = { list: [], total: 0, balances: [] };
  if (url.pathname.includes('/balances/')) {
    balanceReads++;
    if (delayBalance) await new Promise(r => setTimeout(r, delayBalance));
    if (failBalance) return route.fulfill({ status: 503, json: { message: 'Indexer temporarily unavailable' } });
    data = { balances: [{ asset_type: 'OHI', balance: url.pathname.toLowerCase().endsWith(account.toLowerCase()) ? '100000000000' : '200000000000' },
      { asset_type: ownAsset, balance: '5000000000' }] };
  }
  if (url.pathname.endsWith('/erc20-balances')) data = { balances: contracts.slice(0, 2).map(contract_address => ({ contract_address, balance: '12300000000' })) };
  if (url.pathname.endsWith('/assets/catalog')) data = { metadata_supported: true, list: [
    { kind: 'proposal', asset_type: ownAsset, name: btoa('Owned Flow'), symbol: btoa('OWN'), is_added: true, is_native_flow_active: true },
    { kind: 'proposal', asset_type: globalAsset, name: btoa('Someone Else'), is_added: false, is_native_flow_active: true },
    ...contracts.map((contract_address, i) => ({ kind: 'erc20', asset_id: contract_address, contract_address, name: 'ERC20 ' + contract_address.slice(0, 8), symbol: 'TOKEN', decimals: 18,
      is_added: i === 0 && url.searchParams.get('address') === account }))] };
  if (url.pathname.endsWith('/metadata')) {
    const index = contracts.indexOf(url.pathname.split('/').at(-2));
    data = { name: 'Token ' + index, symbol: 'T' + index, decimals: 8 };
  }
  if (url.pathname.endsWith('/investments')) {
    const active = { tx_hash: '0x' + 'c'.repeat(64), bonus_addr: other, invest_amount: '100000000000', invest_time: Date.now() * 1000, is_deinvested: closed };
    // Include a closed record even when filtered, to exercise defensive normalization.
    data = { list: [active, { ...active, tx_hash: '0x' + 'd'.repeat(64), is_deinvested: true }], total: closed ? 0 : 1 };
  }
  return route.fulfill({ json: { code: 0, data } });
});
await page.addInitScript(({ account }) => {
  let address = account, chain = '0x7a6a';
  const handlers = new Map();
  window.__walletCalls = [];
  window.__queryClient = async () => {
    const url = performance.getEntriesByType('resource').map(item => item.name)
      .find(name => new URL(name).pathname === '/src/app/lib/wagmi.ts');
    return (await import(url || '/src/app/lib/wagmi.ts')).wagmiQueryClient;
  };
  window.__rejectSwitch = false;
  window.__setAccount = value => { address = value; (handlers.get('accountsChanged') || []).forEach(fn => fn([value])); };
  Object.defineProperty(window, 'ethereum', { value: { isMetaMask: true,
    on(event, fn) { handlers.set(event, [...(handlers.get(event) || []), fn]); },
    removeListener(event, fn) { handlers.set(event, (handlers.get(event) || []).filter(v => v !== fn)); },
    async request({ method, params }) {
      window.__walletCalls.push(method);
      if (method === 'eth_chainId') return chain;
      if (['eth_accounts', 'eth_requestAccounts'].includes(method)) return [address];
      if (['wallet_getPermissions', 'wallet_requestPermissions'].includes(method)) return [{ parentCapability: 'eth_accounts' }];
      if (method === 'wallet_switchEthereumChain') {
        if (window.__rejectSwitch) throw Object.assign(new Error('User rejected'), { code: 4001 });
        chain = params[0].chainId;
        (handlers.get('chainChanged') || []).forEach(fn => fn(chain)); return null;
      }
      throw new Error('Signing forbidden: ' + method);
    } } });
}, { account });
const cachedTokens = () => page.evaluate(async () => {
  const wagmiQueryClient = await window.__queryClient();
  return wagmiQueryClient.getQueriesData({ queryKey: ['wallet-tokens'] }).map(([key, data]) => ({ key, data }));
});
try {
  await page.goto(origin + '/wallet');
  await page.getByRole('button', { name: /^Connect Wallet$/ }).last().click();
  await page.getByRole('button', { name: /Browser Wallet/ }).click();
  await expect(page.getByText('Owned Flow', { exact: true })).toBeVisible();
  await expect(page.getByText('Someone Else', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Token 0', { exact: true })).toBeVisible();
  await expect(page.getByText('Token 1', { exact: true })).toHaveCount(0);
  assert.equal(balanceReads, 1, 'Provider and wallet share the same balance request');

  await page.getByRole('button', { name: 'Add Token', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Add T19', exact: true })).toBeVisible();
  const search = page.getByPlaceholder(/Search/i);
  await search.fill('token 24');
  await expect(page.getByRole('button', { name: 'Add T24', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add T19', exact: true })).toHaveCount(0);
  await search.fill(contracts[20]);
  await expect(page.getByRole('button', { name: 'Add T20', exact: true })).toBeVisible();
  await search.fill('no matching asset');
  await expect(page.getByText('No tokens found.', { exact: true })).toBeVisible();
  await search.fill('T24');
  await expect(page.getByRole('button', { name: 'Add T24', exact: true })).toBeVisible();
  await page.screenshot({ path: new URL('add-token-desktop.png', output).pathname, fullPage: true });

  // Restore from a successful persisted snapshot before a slow refresh returns.
  await page.waitForTimeout(400);
  delayBalance = 3000;
  await page.reload();
  await expect(page.getByText('Owned Flow', { exact: true })).toBeVisible({ timeout: 2000 });
  await page.waitForTimeout(3300);
  delayBalance = 0;
  failBalance = true;
  await page.evaluate(async () => {
    const wagmiQueryClient = await window.__queryClient();
    await wagmiQueryClient.invalidateQueries({ queryKey: ['wallet-tokens'] });
  });
  await expect(page.getByRole('alert')).toContainText('Showing the last successful balance');
  assert.equal((await cachedTokens()).find(row => row.key.includes(account)).data.list[0].balance, '100000000000');
  failBalance = false;
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.evaluate(other => window.__setAccount(other), other);
  await expect.poll(async () => (await cachedTokens()).find(row => row.key.includes(other))?.data?.list[0]?.balance).toBe('200000000000');
  await expect(page.getByText('Token 0', { exact: true })).toHaveCount(0);

  // Check network switching without any live signing.
  const switchResult = await page.evaluate(async other => {
    const { switchWalletForTransaction } = await import('/src/app/lib/wallet-network.ts');
    const { getNetworkByKey } = await import('/src/app/lib/wallet.ts');
    await switchWalletForTransaction(window.ethereum, getNetworkByKey('devnet'), other);
    return window.__walletCalls;
  }, other);
  assert.ok(switchResult.includes('wallet_switchEthereumChain'));
  assert.ok(!switchResult.includes('eth_sendTransaction'));
  const rejected = await page.evaluate(async other => {
    const { switchWalletForTransaction } = await import('/src/app/lib/wallet-network.ts');
    const { getNetworkByKey } = await import('/src/app/lib/wallet.ts');
    window.__rejectSwitch = true;
    try { await switchWalletForTransaction(window.ethereum, getNetworkByKey('testnet'), other); return false; }
    catch { return true; }
  }, other);
  assert.equal(rejected, true);
  const networkGuards = await page.evaluate(async ({ account, other }) => {
    const { switchWalletForTransaction } = await import('/src/app/lib/wallet-network.ts');
    const { getNetworkByKey } = await import('/src/app/lib/wallet.ts');
    let chain = '0x7a6a', added = false, addedDecimals;
    const calls = [];
    const provider = { async request({ method, params }) {
      calls.push(method);
      if (method === 'eth_chainId') return chain;
      if (method === 'eth_accounts') return [other];
      if (method === 'wallet_addEthereumChain') { added = true; addedDecimals = params[0].nativeCurrency.decimals; return null; }
      if (method === 'wallet_switchEthereumChain') {
        if (!added) throw Object.assign(new Error('Unknown chain'), { code: 4902 });
        chain = params[0].chainId; return null;
      }
      throw new Error('Signing forbidden');
    } };
    await switchWalletForTransaction(provider, getNetworkByKey('devnet'), other);
    let accountRejected = false;
    try { await switchWalletForTransaction(provider, getNetworkByKey('devnet'), account); } catch { accountRejected = true; }
    return { added, addedDecimals, accountRejected, calls };
  }, { account, other });
  assert.equal(networkGuards.added, true);
  assert.equal(networkGuards.addedDecimals, 18);
  assert.equal(networkGuards.accountRejected, true);
  assert.ok(!networkGuards.calls.includes('eth_sendTransaction'));

  await page.goto(origin + '/delegate');
  const result = await page.evaluate(async account => {
    const { ApiService } = await import('/src/app/apis/api-service.ts');
    return new ApiService(location.origin, '/api/v1').delegatePositions({ address: account, chainId: 12315, pageNum: 1, pageSize: 20 });
  }, account);
  assert.equal(result.list.length, 1);
  assert.equal(result.summary.totalDelegated, '100000000000');
  closed = true;
  await page.evaluate(async () => {
    const wagmiQueryClient = await window.__queryClient();
    await wagmiQueryClient.invalidateQueries({ queryKey: ['delegate-positions'] });
  });
  await expect(page.getByText('No active delegation positions yet.')).toBeVisible();
  await page.goto(origin + '/wallet');
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(page.getByText('Owned Flow', { exact: true })).toBeVisible();
    await page.waitForTimeout(800);
    await page.screenshot({ path: new URL('wallet-' + width + '.png', output).pathname, fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  }
  assert.deepEqual(errors, []);
  console.log('PASS wallet scope, metadata, search, reload cache, failed refresh, account switch, network switch/rejection and closed delegation. Mocked API/wallet; no transactions.');
} finally { await browser.close(); }
