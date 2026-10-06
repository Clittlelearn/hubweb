import { ethers } from 'ethers';
import { OpenHiveSdk } from '@openhive/sdk';
import { OPENHIVE_ASSET_DECIMALS } from '../constants/assets';
import { FLOW_TRANSFER_ADDRESS } from '../constants/addresses';

export async function buildFlowTransferTransaction({
  from, to, amount, assetType,
}: { from: string; to: string; amount: string; assetType?: string }) {
  // Keep variable-length HiveX hashes intact; do not replace them with an ERC20 address.
  const asset = assetType?.trim().replace(/^0x/i, '');
  if (!asset || !/^[0-9a-f]{1,64}$/i.test(asset)) {
    throw new Error('Flow asset proposal transaction hash is missing or invalid.');
  }
  if (!ethers.isAddress(from) || !ethers.isAddress(to)) {
    throw new Error('Enter a valid wallet address.');
  }
  let rawAmount: bigint;
  try {
    rawAmount = ethers.parseUnits(amount, OPENHIVE_ASSET_DECIMALS);
  } catch {
    throw new Error('Enter a valid Flow amount with at most 8 decimal places.');
  }
  if (rawAmount <= 0n) throw new Error('Amount must be greater than 0.');
  // eth_rpc.cpp scales raw ETH value down by 10^10 for every native asset.
  // Its destination table stores int64 amounts, regardless of ERC20 decimals.
  if (rawAmount > (1n << 63n) - 1n) throw new Error('Flow transfer amount is too large.');
  const transaction = await OpenHiveSdk.create().transfer({
    asset_type: `0x${asset.toLowerCase()}`,
    value: rawAmount * 10n ** BigInt(18 - OPENHIVE_ASSET_DECIMALS),
    gas_asset: { addr: from, asset_type: 'OHI' },
  }, to, from);
  // MetaMask can reject calldata addressed to any account it manages, not just
  // the sender. HiveX routes this JSON transfer to its business `to` instead.
  return { ...transaction, to: FLOW_TRANSFER_ADDRESS };
}
