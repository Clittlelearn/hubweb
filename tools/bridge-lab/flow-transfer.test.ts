import assert from 'node:assert/strict';
import test from 'node:test';
import { ethers } from 'ethers';
import { buildFlowTransferTransaction } from '../../src/app/lib/flow-transfer';
import { sendWalletTransactionRequest } from '../../packages/sdk/src/wallet-session';
import { buildTransaction } from '../../packages/sdk/src/message';
import { FLOW_TRANSFER_ADDRESS } from '../../src/app/constants/addresses';

const from = '0x755Ccf704E17570b64E247f0794314e4C8E542CA';
const to = '0xeb26a104ea1347D4a71fd96f5Cf2F1170ca22BEb';
const assetType = '0x' + 'a'.repeat(64);
const build = (amount: string, asset = assetType) =>
  buildFlowTransferTransaction({ from, to, amount, assetType: asset });

test('Flow uses proposal asset hash, business to and raw ETH value without JSON amount', async () => {
  const tx = await build('10000.12345678');
  assert.equal(tx.to, FLOW_TRANSFER_ADDRESS);
  assert.equal(tx.from, from);
  assert.equal(tx.value, 1000012345678n * 10n ** 10n);
  assert.deepEqual(JSON.parse(ethers.toUtf8String(tx.data!)), {
    type: 'tx', asset_type: assetType, to,
    is_find_utxo: false, sponsor_gas: false, encoded_info: '',
    gas_asset: { addr: from, asset_type: 'OHI' },
  });
});

test('smallest native unit and large precise amounts round-trip through node scaling', async () => {
  for (const amount of ['0.00000001', '1000', '90071992.54740993', '92233720368.54775807']) {
    const tx = await build(amount);
    assert.equal(BigInt(tx.value!) / 10n ** 10n, ethers.parseUnits(amount, 8));
  }
});

test('rejects truncation, overflow, invalid and nonpositive amounts', async () => {
  for (const amount of ['0.000000001', '-1', '0', 'NaN', 'Infinity', '1e3', '92233720368.54775808']) {
    await assert.rejects(build(amount));
  }
});

test('missing or invalid proposal hash never falls back to OHI or contract transfer', async () => {
  for (const asset of ['', 'OHI', 'not-a-hash', '0x' + 'a'.repeat(65)]) {
    await assert.rejects(build('1', asset), /proposal transaction hash/);
  }
  await assert.rejects(buildFlowTransferTransaction({ from, to, amount: '1' }), /proposal transaction hash/);
});

test('does not pad shorter HiveX hashes and accepts hashes without 0x', async () => {
  const tx = await build('1', 'A'.repeat(63));
  assert.equal(JSON.parse(ethers.toUtf8String(tx.data!)).asset_type, '0x' + 'a'.repeat(63));
});

test('SDK OHI custom transfer still uses the same payload and raw value', () => {
  const tx = buildTransaction({ asset_type: 'OHI', value: 10n ** 18n }, to, from);
  const data = JSON.parse(ethers.toUtf8String(tx.data!));
  assert.equal(data.asset_type, 'OHI');
  assert.equal(data.to, to);
  assert.equal(tx.value, 10n ** 18n);
  assert.equal('amount' in data, false);
});

for (const walletName of ['MetaMask', 'OKX Wallet', 'Rabby Wallet']) {
  test(`Flow uses the existing ${walletName} signing path`, async () => {
    const sent: any[] = [];
    const tx = await build('12.5');
    const hash = '0x' + 'b'.repeat(64);
    const provider = { async request({ method, params }: { method: string; params?: any[] }) {
      if (method === 'eth_accounts') return [from];
      if (method === 'eth_chainId') return '0x301b';
      if (method === 'eth_gasPrice') return '0x4';
      if (method === 'eth_estimateGas') return '0x7a120';
      if (method === 'eth_sendTransaction') {
        const request = params![0];
        if (request.data !== '0x' && [from, to].some(
          address => address.toLowerCase() === request.to?.toLowerCase(),
        )) throw new Error('External transactions to internal accounts cannot include data');
        sent.push(request);
        return hash;
      }
      throw new Error('Unexpected method: ' + method);
    } };
    assert.deepEqual(await sendWalletTransactionRequest(provider, tx,
      { account: from, chainId: 12315, walletName }), { hash });
    assert.equal(sent.length, 1);
    assert.equal(sent[0].value, ethers.toQuantity(ethers.parseUnits('12.5', 18)));
    assert.equal(JSON.parse(ethers.toUtf8String(sent[0].data)).asset_type, assetType);
    assert.equal(sent[0].to, ethers.getAddress(FLOW_TRANSFER_ADDRESS));
    assert.equal(JSON.parse(ethers.toUtf8String(sent[0].data)).to, to);
  });
}

test('Flow self-transfer keeps business recipient but separates the raw wallet target', async () => {
  const tx = await buildFlowTransferTransaction({ from, to: from, amount: '1', assetType });
  assert.notEqual(String(tx.to).toLowerCase(), from.toLowerCase());
  assert.equal(tx.to, FLOW_TRANSFER_ADDRESS);
  assert.equal(JSON.parse(ethers.toUtf8String(tx.data!)).to, from);
  assert.equal(tx.value, 10n ** 18n);
});
