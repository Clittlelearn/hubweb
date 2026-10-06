import { ethers } from 'ethers';
import { bridgeRpc, readConfirmedReceipt, routeEnds, ROUTER_ABI, type BridgeRoute, type BridgeRecord } from './bridge-client';

export const BRIDGE_SUBMISSIONS_KEY = 'hub.bridge.submissions.v1';
export interface BridgeSubmission {
  id: string; account: string; phase: 'approval-reset' | 'approval' | 'transfer';
  route: BridgeRoute; sourceKey: string; to: string; data: string; value: string;
  state: 'awaiting-wallet' | 'submitted' | 'confirmed' | 'tracked' | 'rejected';
  createdAt: number; hash?: string; nonce?: string;
}

export function readBridgeSubmissions(): BridgeSubmission[] {
  const raw = localStorage.getItem(BRIDGE_SUBMISSIONS_KEY);
  if (!raw) return [];
  const value = JSON.parse(raw);
  if (!Array.isArray(value) || value.some(item => !item.id || !ethers.isAddress(item.account) || !item.route?.endpoints)) {
    throw new Error('Saved bridge submissions are invalid. Preserve browser data before continuing.');
  }
  return value;
}

export function saveBridgeSubmission(submission: BridgeSubmission) {
  const current = readBridgeSubmissions();
  const next = [submission, ...current.filter(item => item.id !== submission.id)];
  localStorage.setItem(BRIDGE_SUBMISSIONS_KEY, JSON.stringify(next));
  return next;
}

export async function recoverBridgeTransfer(route: BridgeRoute, sourceKey: string, account: string, hash: string): Promise<BridgeRecord> {
  if (!ethers.isHexString(hash, 32)) throw new Error('Enter a 32-byte source transaction hash.');
  const { source, target } = routeEnds(route, sourceKey);
  const tx = await bridgeRpc(source, 'eth_getTransactionByHash', [hash]);
  if (!tx || tx.from?.toLowerCase() !== account.toLowerCase() || tx.to?.toLowerCase() !== source.router.toLowerCase()) {
    throw new Error('Transaction does not match this wallet and source Router.');
  }
  const decoded = ROUTER_ABI.parseTransaction({ data: tx.input ?? tx.data });
  if (decoded?.name !== 'transferRemote' || Number(decoded.args[0]) !== target.domain || decoded.args[2] <= 0n ||
    !/^0x0{24}[0-9a-f]{40}$/i.test(decoded.args[1])) throw new Error('Transaction is not a supported transfer on this bridge route.');
  const recipient = ethers.getAddress('0x' + decoded.args[1].slice(-40));
  if (recipient === ethers.ZeroAddress) throw new Error('Transaction recipient is zero.');
  const receipt = await readConfirmedReceipt(source, hash);
  if (!receipt) throw new Error('Source transaction is not confirmed yet. Keep the hash and check again.');
  if (BigInt(receipt.status) !== 1n) throw new Error('Source transaction reverted.');
  const block = await bridgeRpc(source, 'eth_getBlockByNumber', [receipt.blockNumber, false]);
  if (block?.hash?.toLowerCase() !== receipt.blockHash.toLowerCase()) throw new Error('Source transaction is not canonical.');
  return { id: `${source.chainId}:${hash}`, account, recipient, amount: ethers.formatUnits(decoded.args[2], route.decimals),
    rawAmount: decoded.args[2].toString(), createdAt: Number(BigInt(block.timestamp)) * 1000,
    sourceHash: hash, destinationStartBlock: target.deploymentBlock, stage: 'source-pending', route, sourceKey };
}

export async function reconcileBridgeSubmission(submission: BridgeSubmission, hash: string) {
  if (!ethers.isHexString(hash, 32)) throw new Error('Enter a 32-byte transaction hash.');
  if (submission.hash && submission.hash.toLowerCase() !== hash.toLowerCase()) throw new Error('Use the saved transaction hash for this request.');
  const { source } = routeEnds(submission.route, submission.sourceKey);
  const tx = await bridgeRpc(source, 'eth_getTransactionByHash', [hash]);
  if (!tx || tx.from?.toLowerCase() !== submission.account.toLowerCase() || tx.to?.toLowerCase() !== submission.to.toLowerCase() ||
    (tx.input ?? tx.data)?.toLowerCase() !== submission.data.toLowerCase() || BigInt(tx.value ?? -1) !== BigInt(submission.value) ||
    (submission.nonce !== undefined && BigInt(tx.nonce ?? -1) !== BigInt(submission.nonce))) {
    throw new Error('Transaction does not match the saved wallet request.');
  }
  const receipt = await readConfirmedReceipt(source, hash);
  if (!receipt) throw new Error('Transaction confirmation is still pending.');
  const block = await bridgeRpc(source, 'eth_getBlockByNumber', [receipt.blockNumber, false]);
  if (block?.hash?.toLowerCase() !== receipt.blockHash.toLowerCase()) throw new Error('Transaction is not canonical.');
  return { ...submission, hash, state: BigInt(receipt.status) === 1n ? 'confirmed' as const : 'rejected' as const };
}
