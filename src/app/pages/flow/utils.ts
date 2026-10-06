import {
  ArrowDownToLine,
  ArrowRightLeft,
  ArrowUpFromLine,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import {
  formatAmount,
  formatDate,
  formatUnitsDisplayAmount,
  shortAddress,
  toUnitsAmount,
} from '../../lib/format';
import type {
  FlowAssetInfo,
  FlowAssetItem,
  FlowHistoryItem,
  FlowStats,
} from '../../types/api-service/flow';

export interface FlowAssetOption {
  assetId: string;
  assetType: string;
  contractAddress: string;
  decimals: number;
  assetDecimals: number;
  exchangeRate: string;
  symbol: string;
  name: string;
  assetName: string;
  logo: string;
  erc20Balance: string | null;
  flowBalance: string | null;
  canFlowIn: boolean;
  canFlowOut: boolean;
}

export interface FlowHistoryRow {
  id: string;
  type: 'in' | 'out';
  asset: string;
  amount: string;
  timestamp: string;
  status: string;
  txHash: string;
}

export interface FlowStatItem {
  label: string;
  value: string;
  unit: string;
  icon: LucideIcon;
  gradient: string;
  border: string;
  valueColor: string;
  iconBg: string;
  glowColor: string;
  dotColor: string;
}

function toSafeNumber(value: string | number | undefined) {
  const result = Number(value === '' || value === undefined ? 0 : value);
  return Number.isFinite(result) ? result : 0;
}

function formatDisplayAmount(value: string | number | undefined, decimals = 2) {
  const normalizedValue = value === '' || value === undefined ? 0 : value;

  try {
    return formatAmount(String(normalizedValue), decimals);
  } catch {
    return '0';
  }
}

function formatSignedUnitsAmount(
  value: string | number | undefined,
  decimals: number,
) {
  const unitsAmount = toUnitsAmount(value ?? '0', decimals);
  const numericValue = toSafeNumber(unitsAmount);
  const prefix = numericValue > 0 ? '+' : '';
  return `${prefix}${formatDisplayAmount(unitsAmount)}`;
}

function normalizeStatus(status: string | undefined) {
  return status || 'pending';
}

function normalizeAsset(item: FlowAssetInfo | FlowAssetItem): FlowAssetOption {
  const userAsset = item as FlowAssetItem;
  const decimals = item.decimals ?? 18;
  const assetDecimals = item.assetDecimals ?? item.decimals ?? 18;

  return {
    assetId: item.assetId || item.assetType || item.contractAddress,
    assetType: item.assetType || '',
    contractAddress: item.contractAddress || '',
    decimals,
    assetDecimals,
    exchangeRate: item.exchangeRate || '1',
    symbol: item.symbol || item.name || item.assetName || '--',
    name: item.name || item.symbol || item.assetName || '--',
    assetName: item.assetName || item.name || item.symbol || '--',
    logo: item.logoUrl || '',
    erc20Balance:
      userAsset.erc20Balance === undefined
        ? null
        : toUnitsAmount(userAsset.erc20Balance, decimals),
    flowBalance:
      userAsset.flowBalance === undefined
        ? null
        : toUnitsAmount(userAsset.flowBalance, assetDecimals),
    canFlowIn: userAsset.canFlowIn ?? item.isEnabled ?? true,
    canFlowOut: userAsset.canFlowOut ?? item.isEnabled ?? true,
  };
}

export function normalizeFlowAssets(
  list: Array<FlowAssetInfo | FlowAssetItem> | undefined,
) {
  if (!list?.length) {
    return [];
  }

  return list.filter((item) => item.isEnabled !== false).map(normalizeAsset);
}

export function normalizeFlowHistory(
  list: FlowHistoryItem[] | undefined,
): FlowHistoryRow[] {
  if (!list?.length) {
    return [];
  }

  return list.map((item, index) => {
    const txHash = item.tx?.txHash || '--';
    const amountDecimals =
      item.direction === 'out'
        ? (item.asset?.assetDecimals ?? item.asset?.decimals ?? 18)
        : (item.asset?.decimals ?? item.asset?.assetDecimals ?? 18);

    return {
      id: item.flowId || `${txHash}-${index}`,
      type: item.direction === 'out' ? 'out' : 'in',
      asset:
        item.amountInfo?.displaySymbol ||
        item.asset?.symbol ||
        item.asset?.assetName ||
        '--',
      amount: formatUnitsDisplayAmount(
        item.amountInfo?.displayAmount ??
          item.amountInfo?.erc20Amount ??
          item.amountInfo?.flowAmount ??
          '0',
        amountDecimals,
        6,
      ),
      timestamp: item.timeline?.submittedAt
        ? formatDate(item.timeline.submittedAt, 'YYYY-MM-DD HH:mm')
        : '--',
      status: normalizeStatus(item.status),
      txHash: txHash.startsWith('0x') ? shortAddress(txHash) : txHash,
    };
  });
}

export function generateFlowStats(
  data?: FlowStats,
  decimals = 18,
): FlowStatItem[] {
  const netFlow = toSafeNumber(toUnitsAmount(data?.netFlow ?? '0', decimals));

  return [
    {
      label: 'Total Flow In',
      value: formatUnitsDisplayAmount(data?.totalFlowIn ?? '0', decimals, 2),
      unit: 'ERC20 -> Native',
      icon: ArrowDownToLine,
      gradient: 'from-green-500/15 via-green-500/5 to-emerald-500/15',
      border: 'border-green-500/30',
      valueColor: 'text-green-500',
      iconBg: 'bg-green-500/15 text-green-500',
      glowColor: 'bg-green-500/20',
      dotColor: 'bg-green-500',
    },
    {
      label: 'Total Flow Out',
      value: formatUnitsDisplayAmount(data?.totalFlowOut ?? '0', decimals, 2),
      unit: 'Native -> ERC20',
      icon: ArrowUpFromLine,
      gradient: 'from-red-500/15 via-red-500/5 to-orange-500/15',
      border: 'border-red-500/30',
      valueColor: 'text-red-500',
      iconBg: 'bg-red-500/15 text-red-500',
      glowColor: 'bg-red-500/20',
      dotColor: 'bg-red-500',
    },
    {
      label: 'Net Flow',
      value: formatSignedUnitsAmount(data?.netFlow, decimals),
      unit: netFlow >= 0 ? 'Net Inbound' : 'Net Outbound',
      icon: TrendingUp,
      gradient: 'from-primary/15 via-primary/5 to-purple-500/15',
      border: 'border-primary/30',
      valueColor: netFlow >= 0 ? 'text-primary' : 'text-red-500',
      iconBg:
        netFlow >= 0
          ? 'bg-primary/15 text-primary'
          : 'bg-red-500/15 text-red-500',
      glowColor: netFlow >= 0 ? 'bg-primary/20' : 'bg-red-500/20',
      dotColor: netFlow >= 0 ? 'bg-primary' : 'bg-red-500',
    },
    {
      label: 'Flowable Assets',
      value: String(data?.flowableAssetCount ?? 0),
      unit: 'Excluding OHI',
      icon: ArrowRightLeft,
      gradient: 'from-purple-500/15 via-purple-500/5 to-blue-500/15',
      border: 'border-purple-500/30',
      valueColor: 'text-purple-400',
      iconBg: 'bg-purple-500/15 text-purple-400',
      glowColor: 'bg-purple-500/20',
      dotColor: 'bg-purple-400',
    },
  ];
}
