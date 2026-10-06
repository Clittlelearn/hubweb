import { CheckCircle2, Shield, TrendingUp, Users } from 'lucide-react';
import { compareRawTokenBalances } from '@/app/lib/token-balance-sort';
import {
  formatAmount,
  formatDate,
  formatExpandedAmount,
  formatUnitsDisplayAmount,
  toUnitsAmount,
} from '@/app/lib/format';
import type {
  ValidatorsNetworkStats,
} from '@/app/types/api-service/validators';
import type {
  DelegatePageNetworkStats,
  DelegatePositionItem,
  DelegateRewardItem,
  DelegateTokenItem,
  DelegateValidatorItem,
} from '@/app/types/api-service/delegate';
import type {
  ValidatorListItem,
  ValidatorDelegateRecord,
  ValidatorRewardRecord,
  ValidatorStatItem,
} from './validators-types';
import type { TokenInfo } from '../../types/common';
import { OPENHIVE_ASSET_DECIMALS } from '@/app/constants/assets';

function toSafeNumber(value: string | number | undefined) {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
}

function formatDelegatedTokenAmount(
  value: string | number | undefined,
  decimals = OPENHIVE_ASSET_DECIMALS,
) {
  // investment_records uses DECIMAL(36,18), so integral on-chain values are
  // returned as strings such as "1450000000000000000000.000000000000000000".
  // ethers.formatUnits accepts an integer raw-unit string only.
  const rawValue = String(value ?? '0').trim();
  const integerValue =
    rawValue.match(/^([+-]?\d+)\.0+$/)?.[1] ?? rawValue;

  return formatExpandedAmount(
    toUnitsAmount(integerValue, decimals),
    OPENHIVE_ASSET_DECIMALS,
  );
}

function formatPercent(value: string | number | undefined, decimals = 2) {
  const num = toSafeNumber(value);
  const fixed = num.toFixed(decimals).replace(/\.?0+$/, '');
  return `${fixed}%`;
}

function normalizeValidatorStatus(status: string | undefined, uptimePct: number) {
  const lower = String(status ?? '').toLowerCase();
  if (lower === 'active' || lower === 'warning' || lower === 'inactive') {
    return lower;
  }

  if (uptimePct >= 99) {
    return 'active';
  }
  if (uptimePct >= 97) {
    return 'warning';
  }
  return 'inactive';
}

function deriveUptimeStatus(uptimePct: number) {
  if (uptimePct >= 99.9) {
    return 'Excellent';
  }
  if (uptimePct >= 99) {
    return 'Good';
  }
  if (uptimePct >= 97) {
    return 'Fair';
  }
  return 'Needs Attention';
}

function parseValidatorId(value: string | number | undefined, index: number) {
  const raw = String(value ?? '');
  const numeric = Number(raw);
  if (Number.isInteger(numeric) && numeric > 0) {
    return numeric;
  }
  const firstDigits = raw.match(/\d+/)?.[0];
  if (firstDigits) {
    return Number(firstDigits);
  }
  return index + 1;
}

function isDelegatePageNetworkStats(
  data?: ValidatorsNetworkStats | DelegatePageNetworkStats,
): data is DelegatePageNetworkStats {
  return Boolean(data && 'totalDelegated' in data);
}

export function generateValidatorsStats(
  data?: ValidatorsNetworkStats | DelegatePageNetworkStats,
  topValidators?: DelegateValidatorItem[],
  tokenDecimals = OPENHIVE_ASSET_DECIMALS,
): ValidatorStatItem[] {
  const isDelegatePage = isDelegatePageNetworkStats(data);

  const activeValidatorCount = data?.activeValidatorCount ?? 0;
  const totalStaked = isDelegatePage
    ? data.totalDelegated
    : (data?.totalStaked ?? data?.totalStakedUsd ?? '0');
  const totalStakedCurrency = isDelegatePage
    ? data.totalDelegatedSymbol
    : (data?.totalStakedSymbol ?? data?.totalStakedCurrency ?? 'OHI');

  let networkUptimePct = toSafeNumber(
    isDelegatePage ? undefined : data?.networkUptimePct,
  );
  let avgValidatorApyPct: string | number = isDelegatePage
    ? '0'
    : (data?.avgValidatorApyPct ?? '0');

  if (isDelegatePage && topValidators?.length) {
    const totalUptime = topValidators.reduce(
      (sum, item) => sum + toSafeNumber(item.uptimePct),
      0,
    );
    const totalApy = topValidators.reduce(
      (sum, item) => sum + toSafeNumber(item.apyPct),
      0,
    );
    networkUptimePct = totalUptime / topValidators.length;
    avgValidatorApyPct = String(totalApy / topValidators.length);
  }

  const totalDelegatedValue = isDelegatePage
    ? formatUnitsDisplayAmount(totalStaked, tokenDecimals, 2)
    : formatAmount(totalStaked, 2);

  return [
    {
      label: 'Active Validators',
      value: formatAmount(String(activeValidatorCount), 0),
      icon: Shield,
      gradient: 'from-primary/15 via-primary/5 to-purple-500/15',
      border: 'border-primary/30',
      valueColor: 'text-primary',
      iconBg: 'bg-primary/15 text-primary',
      glowColor: 'bg-primary/20',
      dotColor: 'bg-primary',
    },
    {
      label: 'Total Delegated',
      value: totalDelegatedValue,
      currency: totalStakedCurrency,
      icon: TrendingUp,
      gradient: 'from-purple-500/15 via-purple-500/5 to-blue-500/15',
      border: 'border-purple-500/30',
      valueColor: 'text-purple-400',
      iconBg: 'bg-purple-500/15 text-purple-400',
      glowColor: 'bg-purple-500/20',
      dotColor: 'bg-purple-400',
    },
    {
      label: 'Network Uptime',
      value: formatPercent(networkUptimePct, 2),
      status: deriveUptimeStatus(networkUptimePct),
      icon: CheckCircle2,
      gradient: 'from-green-500/15 via-green-500/5 to-emerald-500/15',
      border: 'border-green-500/30',
      valueColor: 'text-green-500',
      iconBg: 'bg-green-500/15 text-green-500',
      glowColor: 'bg-green-500/20',
      dotColor: 'bg-green-500',
    },
    {
      label: 'Avg. Validator APY',
      value: formatPercent(avgValidatorApyPct, 2),
      icon: Users,
      gradient: 'from-blue-500/15 via-blue-500/5 to-cyan-500/15',
      border: 'border-blue-500/30',
      valueColor: 'text-blue-400',
      iconBg: 'bg-blue-500/15 text-blue-400',
      glowColor: 'bg-blue-500/20',
      dotColor: 'bg-blue-400',
    },
  ];
}

export function generateTopValidators(
  list?: DelegateValidatorItem[],
  tokenDecimals = OPENHIVE_ASSET_DECIMALS,
): ValidatorListItem[] {
  if (!list?.length) {
    return [];
  }

  return list.map((item, index) => {
    const uptimePct = toSafeNumber(item.uptimePct);

    return {
      id: parseValidatorId(item.validatorId, index),
      name: item.name || `Validator ${index + 1}`,
      address: item.address || '--',
      totalDelegated: `${formatDelegatedTokenAmount(item.totalStaked ?? '0', tokenDecimals)} OHI`,
      commission: formatPercent(item.commissionRatePct, 2),
      apy: formatPercent(item.apyPct, 2),
      uptime: Number(uptimePct.toFixed(2)),
      delegators: item.delegatorCount ?? 0,
      status: normalizeValidatorStatus(item.status, uptimePct),
      performance: Number(toSafeNumber(item.performancePct).toFixed(2)),
      description: item.description || 'No description available.',
    };
  });
}

export function generateDelegateValidators(
  list?: DelegateValidatorItem[],
  tokenDecimals = OPENHIVE_ASSET_DECIMALS,
): ValidatorListItem[] {
  if (!list?.length) {
    return [];
  }

  return list.map((item, index) => {
    const uptimePct = toSafeNumber(item.uptimePct);

    return {
      id: parseValidatorId(item.validatorId, index),
      name: item.name || `Validator ${index + 1}`,
      address: item.address || '--',
      totalDelegated: `${formatDelegatedTokenAmount(item.totalStaked ?? '0', tokenDecimals)} OHI`,
      commission: formatPercent(item.commissionRatePct, 2),
      apy: formatPercent(item.apyPct, 2),
      uptime: Number(uptimePct.toFixed(2)),
      delegators: item.delegatorCount ?? 0,
      status: normalizeValidatorStatus(item.status, uptimePct),
      performance: Number(toSafeNumber(item.performancePct).toFixed(2)),
      description: item.description || 'No description available.',
    };
  });
}

export function generateDelegateTokens(
  list: DelegateTokenItem[] | undefined,
  address: string,
): TokenInfo[] {
  if (!list?.length) {
    return [];
  }

  return list
    .filter(
      (item) =>
        Boolean(item.assetType),
    )
    .sort(compareRawTokenBalances)
    .map((item) => ({
      isNative: false,
      balance: formatUnitsDisplayAmount(
        item.balance ?? '0',
        item.decimals ?? 0,
        6,
      ),
      decimals: item.decimals ?? 0,
      symbol: item.symbol,
      name: item.name,
      contractAddress: item.contractAddress ?? '',
      assetType: item.assetType ?? '',
      deployHash: item.tokenId || item.contractAddress || item.assetType || '',
      isFlow: true,
      logo: item.logoUrl || '',
      ownerAddress: address,
    }));
}

export function generateDelegateRecords(
  list: DelegatePositionItem[] | undefined,
): ValidatorDelegateRecord[] {
  if (!list?.length) {
    return [];
  }

  return list.map((item, index) => ({
    validatorId: parseValidatorId(item.validator?.validatorId, index),
    validatorName: item.validator?.name || `Validator ${index + 1}`,
    validatorAddress: item.validator?.address || '--',
    tokenName: item.delegateToken?.name || 'Unknown Token',
    tokenSymbol: item.delegateToken?.symbol || '--',
    tokenLogo: item.delegateToken?.logoUrl || '',
    tokenAssetType: item.delegateToken?.assetType || '',
    amount: formatDelegatedTokenAmount(
      item.delegateToken?.amount ?? '0',
      item.delegateToken?.decimals ?? OPENHIVE_ASSET_DECIMALS,
    ),
    apy: formatPercent(item.validator?.apyPct ?? '0', 2),
    startedAt: item.delegatedAt
      ? formatDate(item.delegatedAt, 'YYYY-MM-DD')
      : '--',
    txHash: item.delegateTxHash || '--',
    canUndelegate: true,
  }));
}

export function getLatestRewardClaimDate(
  list: DelegateRewardItem[] | undefined,
): string | null {
  if (!list?.length) {
    return null;
  }

  const latestTs = Math.max(...list.map((item) => item.claimedAt || 0));
  if (!latestTs) {
    return null;
  }

  return formatDate(latestTs, 'YYYY-MM-DD');
}

export function generateDelegateRewardRecords(
  list: DelegateRewardItem[] | undefined,
): ValidatorRewardRecord[] {
  if (!list?.length) {
    return [];
  }

  return list.map((item, index) => {
    const rewardToken = item.rewardToken || item.claimToken;

    return {
      id:
        item.rewardId ||
        item.rewardHistoryId ||
        `${item.positionId}-${index}`,
      amount: formatUnitsDisplayAmount(
        rewardToken?.amount ?? '0',
        rewardToken?.decimals ?? 0,
        6,
      ),
      tokenSymbol: rewardToken?.symbol || '--',
      claimedAt: item.claimedAt
        ? formatDate(item.claimedAt, 'YYYY-MM-DD HH:mm:ss')
        : '--',
      txHash: item.txHash || '--',
    };
  });
}
