import { formatAmount, formatDate, formatUnitsDisplayAmount } from '@/app/lib/format';
import { OPENHIVE_ASSET_DECIMALS } from '@/app/constants/assets';
import type {
  DelegateHistoryItem,
  DelegatePositionItem,
  DelegatePositionsSummary,
} from '@/app/types/api-service/delegate';

function toSafeNumber(value: string | number | undefined) {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
}

export interface DelegateSummaryStat {
  label: string;
  value: string;
  suffix?: string;
}

export function normalizeDelegateSummary(
  summary: DelegatePositionsSummary | undefined,
): DelegateSummaryStat[] {
  const totalDelegated = summary?.totalDelegated ?? '0';
  const totalDelegatedSymbol = summary?.totalDelegatedSymbol ?? 'OHI';
  const totalRewards = summary?.totalRewards ?? '0';
  const totalRewardsSymbol = summary?.totalRewardsSymbol ?? 'OHI';

  return [
    {
      label: 'Total Delegated',
      value: formatUnitsDisplayAmount(
        totalDelegated,
        OPENHIVE_ASSET_DECIMALS,
        8,
      ),
      suffix: totalDelegatedSymbol,
    },
    {
      label: 'Positions',
      value: String(summary?.positionCount ?? 0),
    },
    {
      label: 'Validators',
      value: String(summary?.validatorCount ?? 0),
    },
    {
      label: 'Total Rewards',
      value: formatUnitsDisplayAmount(
        totalRewards,
        OPENHIVE_ASSET_DECIMALS,
        8,
      ),
      suffix: totalRewardsSymbol,
    },
  ];
}

export interface DelegatePositionView {
  positionId: string;
  validatorName: string;
  validatorAddress: string;
  tokenSymbol: string;
  amount: string;
  rewardAmount: string;
  rewardSymbol: string;
  apy: string;
  delegatedAt: string;
  txHash: string;
}

export function normalizeDelegatePositions(
  list: DelegatePositionItem[] | undefined,
): DelegatePositionView[] {
  if (!list?.length) {
    return [];
  }

  return list.map((item) => ({
    positionId: item.positionId,
    validatorName: item.validator?.name || '--',
    validatorAddress: item.validator?.address || '--',
    tokenSymbol: item.delegateToken?.symbol || '--',
    amount: formatUnitsDisplayAmount(
      item.delegateToken?.amount ?? '0',
      item.delegateToken?.decimals ?? 0,
      6,
    ),
    rewardAmount: formatAmount(item.rewardAmount ?? '0', 4),
    rewardSymbol: item.rewardSymbol || 'OHI',
    apy: `${toSafeNumber(item.validator?.apyPct).toFixed(2)}%`,
    delegatedAt: item.delegatedAt
      ? formatDate(item.delegatedAt, 'YYYY-MM-DD')
      : '--',
    txHash: item.delegateTxHash || '--',
  }));
}

export interface DelegateHistoryView {
  id: string;
  hash: string;
  typeLabel: string;
  amount: string;
  validatorName: string;
  timestamp: string;
}

export function normalizeDelegateHistory(
  list: DelegateHistoryItem[] | undefined,
): DelegateHistoryView[] {
  if (!list?.length) {
    return [];
  }

  return list.map((item) => ({
    id: item.id,
    hash: item.hash,
    typeLabel: item.type === '5' ? 'Undelegate' : 'Delegate',
    amount: formatAmount(item.amount ?? '0', 4),
    validatorName: item.validatorName || item.validatorAddress || '--',
    timestamp: item.timestamp ? formatDate(item.timestamp, 'YYYY-MM-DD HH:mm') : '--',
  }));
}
