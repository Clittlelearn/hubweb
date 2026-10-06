import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const origin = process.env.HUB_TEST_ORIGIN || 'http://127.0.0.1:5174';
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.route('**/*', route => {
    const request = route.request();
    if (request.method() === 'GET' && new URL(request.url()).origin === origin) return route.continue();
    return route.abort('blockedbyclient');
  });
  await page.goto(origin);
  const results = await page.evaluate(async () => {
    const { prepareOkxTransfer } = await import('/src/app/lib/okx-transfer.ts');
    const address = '0x755ccf704e17570b64e247f0794314e4c8e542ca';
    const transaction = { to: '0x198d70a866b975618b3b23ed3d7e9388acade7e3', value: 100n, data: '0x12345678' };
    const results = {};
    for (const mode of ['ok', 'metamask', 'bsc', 'invalid-price', 'zero-price', 'revert', 'zero-gas', 'wrong-chain', 'changed-account']) {
      const calls = [];
      let accountReads = 0;
      const signer = {
        address,
        provider: { async send(method) {
          calls.push(method);
          if (method === 'eth_chainId') return mode === 'wrong-chain' ? '0x1' : '0x301b';
          if (method === 'eth_accounts') {
            accountReads++;
            return [mode === 'changed-account' && accountReads > 1 ? transaction.to : address];
          }
          if (method === 'eth_gasPrice') return mode === 'invalid-price' ? 'bad' : mode === 'zero-price' ? '0x0' : '0x1';
          throw new Error('Unexpected request: ' + method);
        } },
        async estimateGas(tx) {
          calls.push('estimateGas');
          if (mode === 'revert') throw new Error('Execution reverted');
          if (tx.data !== transaction.data || tx.value !== transaction.value || tx.to !== transaction.to) throw new Error('Payload changed');
          return mode === 'zero-gas' ? 0n : 500000n;
        },
      };
      try {
        const prepared = await prepareOkxTransfer(signer, transaction, mode === 'metamask' ? 'MetaMask' : 'OKX Wallet', mode === 'bsc' ? 31338 : 12315);
        results[mode] = { unchanged: prepared === transaction, request: JSON.parse(JSON.stringify(prepared, (_, v) => typeof v === 'bigint' ? v.toString() : v)), calls };
      } catch (error) { results[mode] = { error: error.message, calls }; }
    }
    return results;
  });
  assert.equal(results.ok.request.gasPrice, '1');
  assert.equal(results.ok.request.gasLimit, '500000');
  assert.equal(results.ok.request.type, 0);
  assert.equal(results.ok.request.data, '0x12345678');
  for (const mode of ['metamask', 'bsc']) {
    assert.equal(results[mode].unchanged, true);
    assert.deepEqual(results[mode].calls, []);
  }
  for (const mode of ['invalid-price', 'zero-price', 'revert', 'zero-gas', 'wrong-chain', 'changed-account']) assert.ok(results[mode].error, mode);
  for (const result of Object.values(results)) assert.ok(!result.calls.includes('eth_sendTransaction'));
  console.log('OKX transfer preparation: explicit fees, payload preservation, wallet/chain isolation and failure guards passed. No transactions sent.');
} finally { await browser.close(); }
