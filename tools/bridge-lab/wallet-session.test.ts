import assert from 'node:assert/strict';
import test from 'node:test';
import { ethers, OpenHiveSdk, sendWalletTransactionRequest } from '@openhive/sdk';

const account = '0x755Ccf704E17570b64E247f0794314e4C8E542CA';
const target = '0x00530a843b706eb0647b430a023fdadd4231493f';
const businessTo = '0xefcf7aa81e23912ef883103c6b9692a44d82b742';
const hash = '0x' + 'a'.repeat(64);
function fixture(name = 'MetaMask') {
  const state = { account, chain: 12315, estimates: 0, sends: [] as any[], drift: '', reject: false };
  const provider = { request: async ({ method, params }: any) => {
    if (method === 'eth_accounts') return [state.account];
    if (method === 'eth_chainId') return ethers.toQuantity(state.chain);
    if (method === 'eth_gasPrice') return '0x1';
    if (method === 'eth_estimateGas') {
      state.estimates++;
      if (state.drift === 'account') state.account = businessTo;
      if (state.drift === 'chain') state.chain = 1;
      return '0x5208';
    }
    if (method === 'eth_sendTransaction') {
      state.sends.push(params[0]);
      if (state.reject) throw Object.assign(new Error('Rejected'), { code: 4001 });
      return hash;
    }
    throw new Error('Unexpected method: ' + method);
  } };
  return { state, provider, context: { account, chainId: 12315, walletName: name } };
}
for (const name of ['MetaMask', 'OKX Wallet', 'Rabby']) {
  test(name + ' uses selected provider and preserves raw recipient and JSON business recipient', async () => {
    const { state, provider, context } = fixture(name);
    const data = ethers.hexlify(ethers.toUtf8Bytes(JSON.stringify({ type: 'undelegating', to: businessTo })));
    assert.deepEqual(await sendWalletTransactionRequest(provider, { from: account, to: target, data }, context), { hash });
    assert.equal(state.sends.length, 1);
    const tx = state.sends[0];
    assert.equal(tx.to.toLowerCase(), target);
    assert.equal(tx.data, data);
    assert.equal(tx.from.toLowerCase(), account.toLowerCase());
    assert.equal(tx.chainId, '0x301b');
    assert.equal(tx.value, '0x0');
    assert.equal(tx.gasPrice, name === 'OKX Wallet' ? '0x1' : undefined);
  });
}
for (const drift of ['account', 'chain']) {
  test('rejects ' + drift + ' change during gas estimation without sending', async () => {
    const { state, provider, context } = fixture(); state.drift = drift;
    await assert.rejects(sendWalletTransactionRequest(provider, { to: target }, context), /changed/);
    assert.equal(state.sends.length, 0);
  });
}
test('rejects mismatched from even if it is a valid address', async () => {
  const { state, provider, context } = fixture();
  await assert.rejects(sendWalletTransactionRequest(provider, { from: businessTo, to: target }, context), /from address/);
  assert.equal(state.sends.length, 0);
});
test('wallet rejection is not retried', async () => {
  const { state, provider, context } = fixture(); state.reject = true;
  await assert.rejects(sendWalletTransactionRequest(provider, { to: target }, context), { code: 4001 });
  assert.equal(state.sends.length, 1);
});
test('deployment omits to and preserves nonce/value and explicit EIP1559 fees', async () => {
  const { state, provider, context } = fixture('OKX Wallet');
  await sendWalletTransactionRequest(provider, { data: '0x6000', nonce: 4, value: 9n, type: 2, maxFeePerGas: 4n, maxPriorityFeePerGas: 2n }, context);
  assert.equal(state.sends[0].to, undefined);
  assert.equal(state.sends[0].nonce, '0x4');
  assert.equal(state.sends[0].type, '0x2');
  assert.equal(state.sends[0].gasPrice, undefined);
});
test('business SDK returns hash without waiting on wallet by-hash indexing', async () => {
  const { state, provider, context } = fixture('OKX Wallet');
  const sdk = OpenHiveSdk.create({ provider: new ethers.BrowserProvider(provider), rpcUrl: '', expectedWallet: context });
  const result = await sdk.undelegate({ asset_type: 'OHI', to_addr: businessTo, utxo_hash: hash }, target, account);
  assert.equal(result.hash, hash);
  assert.equal(state.sends.length, 1);
});
