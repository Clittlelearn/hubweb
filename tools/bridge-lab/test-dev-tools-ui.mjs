import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';
import { AbiCoder, getAddress, toUtf8String } from 'ethers';

// UI isolation tests. The signing client is stubbed; no keys or chain writes.
const root = path.dirname(fileURLToPath(import.meta.url));
const output = path.join(root, 'test-results/dev-tools-independent');
fs.mkdirSync(output, { recursive: true });
const origin = process.env.BRIDGE_UI_URL || 'http://127.0.0.1:5174';
const storageKey = 'openhive.native-flow-test.workflow.v1';
const genesis = '0x755Ccf704E17570b64E247f0794314e4C8E542CA';
const holder = '0xeb26a104ea1347D4a71fd96f5Cf2F1170ca22BEb';
const token = '0x5af1bf521e0576502897a9a7e8ee11fcd5157082';
const votedProposal = `0x${'7'.repeat(64)}`;
const deployed = '0x4444444444444444444444444444444444444444';
const mockClient = `
  globalThis.__devRequests = [];
  globalThis.__devCode = '0x6000';
  export const describeError = error => error.message;
  export const walletForGenesis = (key, expectedAddress) => {
    if (key !== 'fixture-genesis') throw new Error('Signer does not match genesis account');
    return { address: expectedAddress };
  };
  export const jsonRpc = async (url, method, params) => {
    if (method !== 'eth_getCode') throw new Error('Unexpected RPC: ' + method);
    return globalThis.__devCode;
  };
  export const waitForEthTransaction = async () => { throw new Error('Not used by isolated test'); };
  export const sendSignedTransaction = async args => {
    walletForGenesis(args.privateKey, args.expectedAddress);
    const n = globalThis.__devRequests.length + 1;
    globalThis.__devRequests.push({ expectedAddress: args.expectedAddress, chainId: args.chainId,
      rpcUrl: args.rpcUrl, to: args.to, data: args.data });
    const localHash = '0x' + (100 + n).toString(16).padStart(64, '0');
    const rpcHash = '0x' + (200 + n).toString(16).padStart(64, '0');
    args.onSubmitted?.({ localHash, rpcHash });
    args.onProgress?.({ attempt: 1, receiptFound: false, transactionFound: false });
    await new Promise(resolve => setTimeout(resolve, 200));
    if (globalThis.__devFail) throw new Error('Fixture confirmation timeout');
    return { localHash, rpcHash, nonce: n, confirmation: { receipt: { contractAddress: '${deployed}' } } };
  };
`;
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
const page = await context.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
const blockedWrites = [];
page.on('pageerror', error => errors.push(error.message));
await page.route('**/*', interception => {
  const request = interception.request();
  const url = new URL(request.url());
  if (request.method() === 'POST') { blockedWrites.push(url.href); return interception.abort(); }
  if (url.origin !== origin) return interception.abort();
  if (url.pathname === '/contracts/LockableToken5.bin') return interception.fulfill({ body: '6000' });
  if (url.pathname === '/src/app/lib/hivex-eth-client.ts') return interception.fulfill({ contentType: 'application/javascript', body: mockClient });
  return interception.continue();
});
const tab = name => page.getByRole('tab', { name, exact: true });
const field = name => page.getByLabel(name, { exact: true });
const panel = () => page.getByRole('tabpanel');
const snapshot = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
const requests = () => page.evaluate(() => globalThis.__devRequests);
async function successful() {
  await expect(panel().getByRole('region', { name: 'Transaction result' }).getByRole('status')).toContainText(/confirmed|deployed/);
}
try {
  await page.goto(`${origin}/dev-tools/native-flow`);
  await expect(tab('Proposal')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('button', { name: 'Run All Steps' })).toHaveCount(0);
  await expect(field('Genesis account')).toHaveValue(genesis);
  await expect(field('Genesis account')).toHaveAttribute('readonly', '');
  await field('Test signer private key (tab session)').fill('wrong-account');
  await expect(page.getByRole('button', { name: 'Create proposal', exact: true })).toBeDisabled();
  await field('Test signer private key (tab session)').fill('fixture-genesis');

  // Vote works first, without deployment, a contract address, or proposal form values.
  await tab('Vote').click();
  await field('Proposal hash').fill(votedProposal);
  await expect(field('Voter')).toHaveValue(genesis);
  await page.getByRole('button', { name: 'Submit approval', exact: true }).click();
  await successful();
  let calls = await requests();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].expectedAddress, genesis);
  const vote = JSON.parse(toUtf8String(calls[0].data));
  assert.equal(vote.type, 'vote');
  assert.equal(vote.vote_hash, votedProposal);
  assert.equal(vote.to, genesis);
  assert.equal(vote.gas_asset.addr, genesis);

  await tab('Proposal').click();
  await field('ERC20 contract address').fill(token);
  await field('Asset name').fill('HBR');
  await page.evaluate(() => { globalThis.__devCode = '0x'; });
  await page.getByRole('button', { name: 'Create proposal', exact: true }).click();
  await expect(panel().getByRole('alert')).toContainText('No contract code');
  assert.equal((await requests()).length, 1);
  await page.evaluate(() => { globalThis.__devCode = '0x6000'; });
  await page.getByRole('button', { name: 'Create proposal', exact: true }).click();
  await successful();
  calls = await requests();
  assert.equal(calls.length, 2);
  const proposal = JSON.parse(toUtf8String(calls[1].data));
  assert.equal(proposal.type, 'proposal');
  assert.equal(proposal.contract_addr, getAddress(token));
  assert.equal(proposal.asset_name, 'HBR');
  assert.equal(proposal.cross_chain_tx_type, 0);
  assert.equal(proposal.peer_chain_token_addr, token.slice(2).padStart(64, '0'));
  assert.equal(proposal.to, genesis);
  assert.equal(calls[1].expectedAddress, genesis);
  assert.equal(calls[1].to.toLowerCase(), '0x000000000000000000000000000000000000dead');
  assert.ok(!Object.hasOwn(proposal, 'amount'));
  assert.equal((await snapshot()).proposalHash, votedProposal, 'Proposal must not overwrite vote input');
  const proposalResult = (await snapshot()).proposalStage.hash;
  await panel().getByRole('button', { name: 'Copy Proposal ID', exact: true }).click();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), proposalResult);

  await tab('ERC20').click();
  await field('Token name').fill('Independent Token');
  await field('Symbol').fill('SEP');
  await field('Initial supply').fill('25');
  await expect(field('Initial holder')).toBeEditable();
  await expect(field('Initial holder')).toHaveValue(genesis);
  for (const invalid of ['', 'not-an-address', '0x0000000000000000000000000000000000000000', holder.replace('D4', 'd4')]) {
    await field('Initial holder').fill(invalid);
    await expect(field('Initial holder')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByRole('button', { name: 'Deploy ERC20', exact: true })).toBeDisabled();
    assert.equal((await requests()).length, 2);
  }
  await field('Initial holder').fill(` ${holder.toLowerCase()} `);
  await page.getByRole('button', { name: 'Deploy ERC20', exact: true }).click();
  await expect(field('Initial holder')).toBeDisabled();
  await successful();
  calls = await requests();
  assert.equal(calls.length, 3, 'Deployment must not also propose or vote');
  assert.equal(calls[2].to, undefined);
  const args = AbiCoder.defaultAbiCoder().decode(
    ['string', 'string', 'uint8', 'uint256', 'string', 'address', 'address'], `0x${calls[2].data.slice(6)}`);
  assert.equal(args[0], 'Independent Token');
  assert.equal(args[1], 'SEP');
  assert.equal(args[3], 2500000000n);
  assert.equal(args[5], holder);
  assert.equal(calls[2].expectedAddress, genesis, 'Holder does not change the deployment signer');
  let saved = await snapshot();
  assert.equal(saved.deployedContractAddress, deployed);
  assert.equal(saved.contractAddress, token, 'Deployment must not overwrite proposal target');
  assert.equal(saved.proposalAssetName, 'HBR', 'Deployment symbol must not change proposal name');
  assert.equal(saved.proposalHash, votedProposal);
  assert.equal(saved.proposalStage.hash, proposalResult);
  assert.ok(!Object.hasOwn(saved, 'privateKey'));
  assert.equal(saved.initialHolder.trim(), holder.toLowerCase());
  await page.reload();
  await expect(tab('ERC20')).toHaveAttribute('aria-selected', 'true');
  await expect(field('Initial holder')).toHaveValue(` ${holder.toLowerCase()} `);
  await expect(panel().getByText(deployed, { exact: true })).toBeVisible();
  await tab('Proposal').click();
  await expect(field('ERC20 contract address')).toHaveValue(token);
  await expect(field('Asset name')).toHaveValue('HBR');
  await tab('Vote').click();
  await expect(field('Proposal hash')).toHaveValue(votedProposal);

  // A failed confirmation keeps submitted hashes, and refresh never resends.
  await page.evaluate(() => { globalThis.__devFail = true; });
  await page.getByRole('button', { name: 'Submit approval', exact: true }).click();
  await expect(panel().getByRole('alert')).toContainText('Fixture confirmation timeout');
  saved = await snapshot();
  assert.ok(saved.voteStage.hash && saved.voteStage.localHash);
  await page.reload();
  await expect(panel().getByRole('alert')).toContainText('Fixture confirmation timeout');
  assert.equal((await requests()).length, 0);
  for (const [name, width, height] of [['desktop', 1440, 1000], ['mobile', 390, 844]]) {
    await page.setViewportSize({ width, height });
    for (const tool of ['Proposal', 'Vote', 'ERC20']) {
      await tab(tool).click();
      await page.screenshot({ path: path.join(output, `${name}-${tool.toLowerCase()}.png`), fullPage: true });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${name}/${tool} overflow`);
    }
  }
  await tab('Proposal').focus();
  await page.keyboard.press('ArrowRight');
  await expect(tab('Vote')).toHaveAttribute('aria-selected', 'true');
  // Migrate previous persisted fields and retain pending hashes without resending.
  await page.evaluate(({ key, token, votedProposal }) => {
    localStorage.setItem(key, JSON.stringify({ tokenSymbol: 'OLD', contractAddress: token, proposalHash: votedProposal,
      proposalStage: { status: 'running', hash: votedProposal, localHash: votedProposal } }));
  }, { key: storageKey, token, votedProposal });
  await page.reload();
  await expect(field('Asset name')).toHaveValue('OLD');
  await expect(field('ERC20 contract address')).toHaveValue(token);
  await expect(panel().getByRole('alert')).toContainText('Page refreshed');
  assert.equal((await snapshot()).proposalStage.hash, votedProposal);
  assert.equal((await requests()).length, 0);
  await tab('ERC20').click();
  await expect(field('Initial holder')).toHaveValue(genesis);
  assert.deepEqual(errors, []);
  assert.deepEqual(blockedWrites, []);
  console.log('PASS: independent vote/proposal/deploy, editable holder encoded in constructor, address validation, fixed genesis signer, persistence/migration, hash retention and desktop/mobile tabs. Mocked signing only; no chain transactions.');
} catch (error) {
  console.error({ pageErrors: errors, body: (await page.locator('body').innerText()).slice(-4000) });
  await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true });
  throw error;
} finally { await browser.close(); }
