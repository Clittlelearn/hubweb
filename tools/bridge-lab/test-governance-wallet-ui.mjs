import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium, expect } from '@playwright/test';

const origin = 'http://127.0.0.1:5174';
const voter = '0x755Ccf704E17570b64E247f0794314e4C8E542CA';
const other = '0xeb26a104ea1347D4a71fd96f5Cf2F1170ca22BEb';
const asset = '0x' + 'a'.repeat(64);
const txHash = '0x' + 'b'.repeat(64);
const proposal = { asset, tx_hash: txHash, address: voter, is_revoked: false, tx_info: {
  name: btoa('TEST VOTE'), title: btoa('Wallet Vote State'), beginTime: Date.now() - 3600000,
  endTime: Date.now() + 172800000, minVoteNum: 1, tokenContractAddr: '0x' + 'c'.repeat(40),
} };
const output = new URL('test-results/governance-wallet/', import.meta.url);
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
const addressReads = [];
let voteType = 1;
let voteLookupFails = false;
page.on('pageerror', error => errors.push(error.message));
await page.route('**/*', async route => {
  const request = route.request();
  const url = new URL(request.url());
  if (url.origin === origin && request.method() === 'GET' && !url.pathname.startsWith('/api/v1/')) return route.continue();
  assert.equal(request.method(), 'GET', 'no transaction or RPC write requests');
  let data = { list: [], total: 0, balances: [] };
  if (url.pathname.endsWith('/proposals')) data = { list: [proposal], total: 1 };
  if (url.pathname.endsWith('/votes')) {
    const address = url.searchParams.get('address');
    if (address) addressReads.push(address);
    if (address && voteLookupFails) return route.fulfill({ status: 503, json: { code: 503 } });
    // Deliberately omit the vote from the first totals page. The account query is authoritative.
    data = address?.toLowerCase() === voter.toLowerCase() ? { total: 1, list: [{
      address: voter.slice(2).toLowerCase(), proposal_hash: asset, vote_type: voteType, vote_number: '1', tx_hash: '0x' + 'd'.repeat(64),
    }] } : { list: [], total: 0 };
  }
  return route.fulfill({ json: { code: 0, data } });
});
await page.addInitScript(({ voter }) => {
  let account = voter;
  let chainId = '0x301b';
  const handlers = new Map();
  const emit = (event, value) => (handlers.get(event) || []).forEach(fn => fn(value));
  window.__setAccount = value => { account = value; emit('accountsChanged', [value]); };
  window.__setChain = value => { chainId = value; emit('chainChanged', value); };
  const provider = { isMetaMask: true,
    on(event, fn) { handlers.set(event, [...(handlers.get(event) || []), fn]); },
    removeListener(event, fn) { handlers.set(event, (handlers.get(event) || []).filter(item => item !== fn)); },
    async request({ method }) {
      if (method === 'eth_chainId') return chainId;
      if (['eth_accounts', 'eth_requestAccounts'].includes(method)) return [account];
      if (['wallet_getPermissions', 'wallet_requestPermissions'].includes(method)) return [{ parentCapability: 'eth_accounts' }];
      throw new Error('Wallet signing forbidden in this test: ' + method);
    },
  };
  Object.defineProperty(window, 'ethereum', { value: provider });
}, { voter });

async function screenshots(prefix) {
  for (const [name, width, height] of [['wide', 1920, 1100], ['desktop', 1440, 1100], ['mobile', 390, 844], ['small', 320, 780]]) {
    await page.setViewportSize({ width, height });
    await page.screenshot({ path: new URL(prefix + '-' + name + '.png', output).pathname, fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, prefix + ' ' + name + ' overflow');
    const logo = await page.locator('header a').first().boundingBox();
    const accountButton = await page.getByRole('button', { name: 'Connected wallet account', exact: true }).boundingBox();
    assert.ok(logo.x + logo.width <= accountButton.x, 'brand and account must not overlap');
    if (width >= 1536) {
      const nav = await page.locator('header nav').boundingBox();
      const network = await page.getByRole('button', { name: /^Wallet network:/ }).boundingBox();
      assert.ok(nav.x + nav.width <= network.x, 'header navigation must not overlap network');
    }
  }
}

try {
  await page.goto(origin + '/governance');
  await page.getByRole('button', { name: /^Connect Wallet$/i }).last().click();
  await page.getByRole('button', { name: /Browser Wallet/ }).click();
  await expect(page.getByText('Voted For', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Vote (For|Against)$/ })).toHaveCount(0);
  assert.ok(addressReads.some(address => address.toLowerCase() === voter.toLowerCase()));
  await page.getByRole('link', { name: 'Details', exact: true }).click();
  await expect(page.getByText('Vote submitted', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Vote (For|Against)$/ })).toHaveCount(0);
  await page.evaluate(other => window.__setAccount(other), other);
  await expect(page.getByRole('button', { name: 'Vote For', exact: true })).toBeVisible();
  await page.evaluate(voter => window.__setAccount(voter), voter);
  await expect(page.getByText('Vote submitted', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Vote (For|Against)$/ })).toHaveCount(0);
  voteType = 0;
  await page.goto(origin + '/governance');
  await expect(page.getByText('Voted Against', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Voted Against', { exact: true })).toBeVisible();
  await page.evaluate(other => window.__setAccount(other), other);
  await expect(page.getByRole('button', { name: 'Vote For', exact: true })).toBeVisible();
  voteLookupFails = true;
  await page.evaluate(voter => window.__setAccount(voter), voter);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Wallet Vote State', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Vote (For|Against)$/ })).toHaveCount(0);
  voteLookupFails = false;
  await page.reload();
  await expect(page.getByText('Voted Against', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Connected wallet account', exact: true }).click();
  const menu = page.getByLabel('Connected wallet menu');
  await expect(menu).toContainText('Connected Wallet');
  await expect(menu).not.toContainText(/OHI|balance/i);
  await expect(menu.getByRole('button', { name: 'Disconnect Wallet' })).toBeVisible();
  await page.getByRole('button', { name: 'Connected wallet account', exact: true }).click();
  await screenshots('governance');
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto(origin + '/bridge?view=deploy');
  await expect(page.getByRole('button', { name: 'Wallet network: OpenHive Devnet', exact: true })).toBeVisible();
  await page.evaluate(() => window.__setChain('0x7a6a'));
  await expect(page.getByRole('button', { name: 'Wallet network: Local BSC', exact: true })).toBeVisible();
  await screenshots('bridge-network');
  await expect(page.getByLabel('Wallet network', { exact: true })).toContainText('Local BSC (31338)');
  await page.evaluate(() => window.__setChain('0x270f'));
  await expect(page.getByLabel('Wallet network', { exact: true })).toContainText('Chain 9999');
  assert.deepEqual(errors, []);
  console.log('PASS: per-wallet votes (For/Against), list/detail/account switch/reload, lookup failure hides voting, actual network on Bridge desktop/mobile, unknown chain fallback, no balance in wallet menu, no signing.');
} finally { await browser.close(); }
