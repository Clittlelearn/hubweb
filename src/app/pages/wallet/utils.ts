import { TokenInfo } from '@/app/types/common';
import { type WalletTransactionRow } from './wallet-transactions-tab';
import { WalletOverviewData } from '@/app/types/api-service/wallet';
import { ethers } from 'ethers';
import { formatExpandedAmount, toUnitsAmount } from '@/app/lib/format';

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown, fallback = '') {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number') {
    return String(value);
  }
  return fallback;
}

function normalizeRawIntegerAmount(value: unknown) {
  const amount = asString(value, '0').trim();
  const integerAmount = amount.match(/^([+-]?\d+)\.0+$/);

  return integerAmount?.[1] ?? amount;
}

function asBoolean(value: unknown) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value === 1;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === '1' || normalized === 'true';
  }

  return false;
}

export function asNumber(value: unknown, fallback = 0) {
  const numeric =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : Number.NaN;

  return Number.isFinite(numeric) ? numeric : fallback;
}

export function toDisplayAmount(value: string, decimals = 18) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return value || '0';
  }
  return formatExpandedAmount(value, decimals);
}

export function toTokenDisplayAmount(
  value: string,
  decimals: number,
  displayDecimals = 18,
) {
  return toDisplayAmount(toUnitsAmount(value, decimals), displayDecimals);
}

export function toTimestampMs(value: unknown) {
  const timestamp = asNumber(value, 0);
  if (!timestamp) {
    return 0;
  }
  return timestamp < 1_000_000_000_000 ? timestamp * 1000 : timestamp;
}

export function formatTimestampLabel(value: unknown) {
  const timestamp = toTimestampMs(value);
  if (!timestamp) {
    return '--';
  }
  return new Date(timestamp).toLocaleString();
}

export function normalizeWalletOverview(
  raw: unknown,
  decimals = 18,
): WalletOverviewData | null {
  const record = asRecord(raw);
  if (!record) {
    return null;
  }

  return {
    totalBalance: toUnitsAmount(
      normalizeRawIntegerAmount(record.totalBalance),
      decimals,
    ),
    balanceSymbol: asString(record.balanceSymbol, 'OHI'),
    tokenCount: asNumber(record.tokenCount, 0),
    txsCount: asNumber(record.txsCount, 0),
  };
}

export function normalizeWalletToken(
  raw: unknown,
  ownerAddress: string,
  fallbackDecimals = 18,
): TokenInfo | null {
  const record = asRecord(raw);
  if (!record) {
    return null;
  }

  
  const contractAddress = asString(record.contractAddress);
  const standard = asString(record.standard);

  const assetType = asString(record.assetType);
  const hasContractAddress =
    Boolean(contractAddress) && contractAddress !== ethers.ZeroAddress;
  const normalizedStandard = standard.trim().toLowerCase();
  // hubsql returns local balances with standard "NATIVE". OHI has no token
  // contract, so it must use the native transfer path instead of ERC20.
  const isNative = assetType === 'OHI' && !hasContractAddress;

  const symbol = asString(record.symbol, asString(record.name, 'TOKEN'));
  const name = asString(record.name, symbol);
  const logo = asString(isNative ? '/token/ohi.svg' : record.logoUrl);
  const balanceRaw = asString(record.balance, '0');
  const decimals = asNumber(record.decimals, fallbackDecimals);
  const normalizedOwner = asString(record.ownerAddress, ownerAddress);
  

  
  const hasAssetType = Boolean(assetType);
  
  const isFlow =
    hasAssetType &&
    !isNative &&
    !hasContractAddress &&
    (normalizedStandard === 'native' || normalizedStandard === 'native token');
  
  return {
    isNative,
    balance: toTokenDisplayAmount(balanceRaw, decimals),
    decimals,
    symbol,
    name,
    contractAddress,
    assetType,
    deployHash: asString(record.deployutxo),
    isFlow,
    logo,
    ownerAddress: normalizedOwner,
    standard: standard || undefined,
  };
}

export function normalizeWalletTransaction(
  raw: unknown,
  fallbackDecimals = 18,
): WalletTransactionRow | null {
  const record = asRecord(raw);
  if (!record) {
    return null;
  }

  const directionRaw = asString(record.direction, 'out').toLowerCase();
  const statusRaw = asString(record.status, 'success').toLowerCase();
  const direction: WalletTransactionRow['direction'] =
    directionRaw === 'in' ? 'in' : 'out';
  const status: WalletTransactionRow['status'] =
    statusRaw === 'pending'
      ? 'pending'
      : statusRaw === 'failed'
        ? 'failed'
        : 'success';
  const counterpartyAddress =
    asString(record.counterpartyAddress) ||
    asString(direction === 'out' ? record.to : record.from);

  const amount = toUnitsAmount(
    asString(record.amount, '0'),
    asNumber(record.decimals, fallbackDecimals),
  );

  return {
    txHash: asString(record.txHash),
    kind: asString(record.kind, asString(record.methodName, 'Transaction')),
    direction,
    status,
    amount: toDisplayAmount(amount),
    hasAmount: asBoolean(record.hasAmount),
    symbol: asString(record.symbol, '--'),
    assetType: asString(record.assetType, 'OHI'),
    blockHeight: asNumber(record.blockNumber, 0),
    rawUtxo: asString(record.rawData, '[]'),
    timestampLabel: formatTimestampLabel(
      record.timestampMs ?? record.tradeTime ?? record.createdAt,
    ),
    counterpartyRole: asString(
      record.counterpartyRole,
      direction === 'out' ? 'To' : 'From',
    ),
    counterpartyAddress: counterpartyAddress || '--',
  };
}
