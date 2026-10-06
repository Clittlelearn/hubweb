import { ethers } from '@openhive/sdk';
import type { TransactionRequest } from 'ethers';
import { FEATURE_ADDRESS } from '../config';
import type { SdkMethod, SdkResult } from '../types';

export function getSuggestedTarget(method: SdkMethod, address: string) {
  if (
    method === 'transfer' ||
    method === 'transaction' ||
    method === 'vote' ||
    method === 'proposal' ||
    method === 'revokeProposal' ||
    method === 'revokeProposalAlias' ||
    method === 'fund' ||
    method === 'treasury'
  ) {
    return address;
  }

  return FEATURE_ADDRESS;
}

export function formatAddress(value: string) {
  try {
    return ethers.getAddress(value);
  } catch {
    return value;
  }
}

export function shortAddress(value: string) {
  return value.length > 12
    ? `${value.slice(0, 6)}...${value.slice(-4)}`
    : value;
}

export function parseChainId(value: unknown) {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'bigint') {
    return Number(value);
  }

  if (typeof value === 'string') {
    return value.startsWith('0x')
      ? Number.parseInt(value, 16)
      : Number.parseInt(value, 10);
  }

  return null;
}

export function toHexChainId(chainId: number) {
  return `0x${chainId.toString(16)}`;
}

export function targetLabel(method: SdkMethod) {
  switch (method) {
    case 'transfer':
    case 'transaction':
      return 'Recipient address';
    case 'delegate':
    case 'delegateAlias':
    case 'undelegate':
    case 'undelegateAlias':
      return 'Validator address';
    case 'stake':
      return 'Stake address';
    case 'unstake':
      return 'Unstake address';
    case 'lock':
    case 'unlock':
      return 'Lock address';
    case 'bonus':
      return 'Bonus address';
    case 'vote':
      return 'Vote address';
    case 'proposal':
      return 'Proposal address';
    case 'revokeProposal':
    case 'revokeProposalAlias':
      return 'Revoke proposal address';
    case 'fund':
      return 'Fund address';
    case 'treasury':
      return 'Treasury address';
    default:
      return assertNever(method);
  }
}

export function usesAssetType(method: SdkMethod) {
  return (
    method === 'transfer' ||
    method === 'transaction' ||
    method === 'stake' ||
    method === 'unstake' ||
    method === 'delegate' ||
    method === 'delegateAlias' ||
    method === 'undelegate' ||
    method === 'undelegateAlias' ||
    method === 'bonus'
  );
}

export function usesRawAmount(method: SdkMethod) {
  return (
    method === 'stake' ||
    method === 'delegate' ||
    method === 'delegateAlias' ||
    method === 'lock'
  );
}

export function usesUtxoHash(method: SdkMethod) {
  return (
    method === 'unstake' ||
    method === 'undelegate' ||
    method === 'undelegateAlias' ||
    method === 'unlock'
  );
}

export function usesVoteHash(method: SdkMethod) {
  return (
    method === 'vote' ||
    method === 'proposal' ||
    method === 'revokeProposal' ||
    method === 'revokeProposalAlias'
  );
}

export function requireAddress(value: string, label: string) {
  const nextValue = requireText(value, label);
  if (!ethers.isAddress(nextValue)) {
    throw new Error(`${label} must be a valid EVM address.`);
  }

  return ethers.getAddress(nextValue);
}

export function requireText(value: string, label: string) {
  const nextValue = value.trim();
  if (!nextValue) {
    throw new Error(`${label} is required.`);
  }

  return nextValue;
}

export function requireRawAmount(value: string) {
  const nextValue = requireText(value, 'Amount raw');
  if (!/^\d+$/.test(nextValue)) {
    throw new Error('Amount raw must be an integer string.');
  }

  return nextValue;
}

export function requireDecimals(value: string) {
  const nextValue = Number(value);
  if (!Number.isInteger(nextValue) || nextValue < 0 || nextValue > 36) {
    throw new Error('Value decimals must be an integer between 0 and 36.');
  }

  return nextValue;
}

export function hasWait(
  value: SdkResult,
): value is SdkResult & { wait: () => Promise<unknown> } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'wait' in value &&
    typeof value.wait === 'function'
  );
}

export function summarizeResult(result: SdkResult, receipt: unknown) {
  const tx = result as TransactionRequest & {
    hash?: string;
    nonce?: number;
    gasLimit?: bigint;
    gasPrice?: bigint;
    maxFeePerGas?: bigint;
    maxPriorityFeePerGas?: bigint;
    chainId?: bigint | number;
  };

  return {
    mode: tx.hash ? 'sent' : 'unsigned',
    hash: tx.hash,
    from: tx.from,
    to: tx.to,
    nonce: tx.nonce,
    chainId: normalizeValue(tx.chainId),
    value: normalizeValue(tx.value),
    gasLimit: normalizeValue(tx.gasLimit),
    gasPrice: normalizeValue(tx.gasPrice),
    maxFeePerGas: normalizeValue(tx.maxFeePerGas),
    maxPriorityFeePerGas: normalizeValue(tx.maxPriorityFeePerGas),
    data: tx.data,
    decodedPayload: decodePayload(tx.data),
    receipt: summarizeReceipt(receipt),
  };
}

export function getErrorCode(errorValue: unknown) {
  if (!errorValue || typeof errorValue !== 'object') {
    return undefined;
  }

  const errorObject = errorValue as {
    code?: number;
    cause?: { code?: number };
    data?: { originalError?: { code?: number } };
  };

  return (
    errorObject.code ??
    errorObject.cause?.code ??
    errorObject.data?.originalError?.code
  );
}

export function isMissingChainError(errorValue: unknown) {
  const code = getErrorCode(errorValue);
  if (code === 4902) {
    return true;
  }

  return /4902|unknown chain|unrecognized chain|not added|missing chain/i.test(
    toErrorMessage(errorValue),
  );
}

export function toErrorMessage(errorValue: unknown) {
  if (errorValue instanceof Error) {
    return errorValue.message;
  }

  if (typeof errorValue === 'string') {
    return errorValue;
  }

  return 'Unknown error';
}

export function assertNever(value: never): never {
  throw new Error(`Unsupported value: ${String(value)}`);
}

function summarizeReceipt(receipt: unknown) {
  if (!receipt || typeof receipt !== 'object') {
    return null;
  }

  const item = receipt as {
    hash?: string;
    blockNumber?: number;
    status?: number;
    gasUsed?: bigint;
  };

  return {
    hash: item.hash,
    blockNumber: item.blockNumber,
    status: item.status,
    gasUsed: normalizeValue(item.gasUsed),
  };
}

function decodePayload(data: TransactionRequest['data']) {
  if (typeof data !== 'string' || !data || data === '0x') {
    return null;
  }

  try {
    return JSON.parse(ethers.toUtf8String(data)) as unknown;
  } catch {
    return null;
  }
}

function normalizeValue(value: unknown) {
  return typeof value === 'bigint' ? value.toString() : value;
}
