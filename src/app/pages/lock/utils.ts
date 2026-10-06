import { Gift, Lock, Unlock, Vote, type LucideIcon } from 'lucide-react';
import {
  formatDate,
  formatUnitsDisplayAmount,
  restoreFormattedAmount,
  shortAddress,
  toUnitsNumber,
} from '@/app/lib/format';
import { OPENHIVE_TOKENOMICS } from '@/app/data/openhive-parameters';
import { OPENHIVE_ASSET_DECIMALS } from '@/app/constants/assets';
import type {
  LockNetworkOverview,
  LockPageResult,
  LockPositionItem,
  LockRewardsHistoryItem,
  LockUnlockHistoryItem,
  LockUserOverview,
  LockUserSummaryResult,
} from '@/app/types/api-service/lock';

export interface ActiveLock {
  id: string;
  lockTxHash: string;
  lockAssetType: string;
  rewardAssetType: string;
  amount: string;
  startDate: string;
  unlockAvailableAt: string;
  daysLocked: string;
  votingPower: string;
  status: string;
  rewards: string;
}

export interface LockRewardHistoryRow {
  id: string;
  amount: string;
  claimDate: string;
  validator: string;
  rewardType: string;
  txHash: string;
}

export interface LockUnlockHistoryRow {
  id: string;
  amount: string;
  unlockDate: string;
  holdingDuration: string;
  totalRewards: string;
}

export interface LockTotals {
  totalLocked: number;
  totalVotingPower: number;
  totalRewards: number;
  claimableRewards: number;
  readyToUnlock: number;
}

export interface LockStatItem {
  icon: LucideIcon;
  label: string;
  value: string;
  unit: string;
  gradient: string;
  border: string;
  iconBg: string;
  iconColor: string;
  valueColor: string;
}

export interface LockStatOptions {
  lockedSymbol: string;
  votingPowerSymbol: string;
  rewardSymbol: string;
  rewardLabel?: string;
}

export interface LockSymbols {
  assetSymbol: string;
  lockedSymbol: string;
  rewardSymbol: string;
  votingPowerSymbol: string;
  availableBalanceSymbol: string;
}

export function parseDisplayNumber(value: string) {
  const amountText =
    value.match(/[+-]?(?:\d[\d,]*\.?\d*|\.\d+)(?:[KMBT])?/i)?.[0] ?? '0';
  const parsed = Number(restoreFormattedAmount(amountText));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatTokenAmount(
  value: string | number | undefined,
  symbol: string | undefined,
  unitDecimals = OPENHIVE_ASSET_DECIMALS,
  displayDecimals = 2,
) {
  return `${formatUnitsDisplayAmount(
    value ?? '0',
    unitDecimals,
    displayDecimals,
  )} ${symbol || 'OHI'}`;
}

function toTimestampMs(value: number | undefined) {
  if (!value) {
    return null;
  }

  return value < 1_000_000_000_000 ? value * 1000 : value;
}

function getUnlockAvailableAt(startedAt: number | undefined) {
  const startedAtMs = toTimestampMs(startedAt);
  if (!startedAtMs) {
    return '--';
  }

  return formatDate(
    startedAtMs + OPENHIVE_TOKENOMICS.MIN_UNLOCK_DAYS * 24 * 60 * 60 * 1000,
    'YYYY-MM-DD',
  );
}

function isUnlockAvailable(startedAt: number | undefined) {
  const startedAtMs = toTimestampMs(startedAt);
  if (!startedAtMs) {
    return false;
  }

  return (
    startedAtMs + OPENHIVE_TOKENOMICS.MIN_UNLOCK_DAYS * 24 * 60 * 60 * 1000 <=
    Date.now()
  );
}

function getHoldingDuration(
  startedAt: number | undefined,
  endedAt?: number | undefined,
) {
  const startedAtMs = toTimestampMs(startedAt);
  if (!startedAtMs) {
    return '--';
  }

  const endedAtMs = toTimestampMs(endedAt) ?? Date.now();
  const days = Math.max(
    0,
    Math.floor((endedAtMs - startedAtMs) / (24 * 60 * 60 * 1000)),
  );

  return `${days} day${days === 1 ? '' : 's'}`;
}

export function getLockTotalsFromLocks(locks: ActiveLock[]): LockTotals {
  return locks.reduce(
    (totals, lock) => {
      const rewards = parseDisplayNumber(lock.rewards);

      return {
        totalLocked: totals.totalLocked + parseDisplayNumber(lock.amount),
        totalVotingPower:
          totals.totalVotingPower + parseDisplayNumber(lock.votingPower),
        totalRewards: totals.totalRewards + rewards,
        claimableRewards: totals.claimableRewards + (rewards > 0 ? 1 : 0),
        readyToUnlock:
          totals.readyToUnlock + (lock.status === 'unlockable' ? 1 : 0),
      };
    },
    {
      totalLocked: 0,
      totalVotingPower: 0,
      totalRewards: 0,
      claimableRewards: 0,
      readyToUnlock: 0,
    },
  );
}

export function normalizeLockTotals(
  userOverview: LockUserOverview | undefined,
  fallbackLocks: ActiveLock[],
  decimals = OPENHIVE_ASSET_DECIMALS,
): LockTotals {
  if (!userOverview) {
    return getLockTotalsFromLocks(fallbackLocks);
  }

  return {
    totalLocked: toUnitsNumber(userOverview.totalLockedAmount, decimals),
    totalVotingPower: toUnitsNumber(userOverview.totalVotingPower, decimals),
    totalRewards: toUnitsNumber(userOverview.claimableRewardAmount, decimals),
    claimableRewards: userOverview.claimableLockCount ?? 0,
    readyToUnlock: userOverview.readyToUnlockCount ?? 0,
  };
}

export function normalizeNetworkLockTotals(
  networkOverview: LockNetworkOverview | undefined,
  decimals = OPENHIVE_ASSET_DECIMALS,
): LockTotals {
  return {
    totalLocked: toUnitsNumber(networkOverview?.totalLockedAmount, decimals),
    totalVotingPower: toUnitsNumber(networkOverview?.totalVotingPower, decimals),
    totalRewards: toUnitsNumber(networkOverview?.totalRewardAmount, decimals),
    claimableRewards: networkOverview?.activeLockCount ?? 0,
    readyToUnlock: networkOverview?.readyToUnlockCount ?? 0,
  };
}

export function resolveLockSymbols({
  lockPageData,
  lockUserSummaryData,
}: {
  lockPageData?: LockPageResult | null;
  lockUserSummaryData?: LockUserSummaryResult | null;
}): LockSymbols {
  const userOverview = lockUserSummaryData?.userOverview;
  const networkOverview = lockPageData?.networkOverview;
  const assetSymbol =
    lockUserSummaryData?.lockAsset?.symbol ||
    lockPageData?.lockAsset?.symbol ||
    'OHI';

  return {
    assetSymbol,
    lockedSymbol:
      userOverview?.lockedSymbol || networkOverview?.lockedSymbol || assetSymbol,
    rewardSymbol:
      userOverview?.rewardSymbol || networkOverview?.rewardSymbol || assetSymbol,
    votingPowerSymbol:
      userOverview?.votingPowerSymbol ||
      networkOverview?.votingPowerSymbol ||
      'OHI',
    availableBalanceSymbol: userOverview?.availableBalanceSymbol || assetSymbol,
  };
}

export function getLockStats(
  totals: LockTotals,
  options: LockStatOptions = {
    lockedSymbol: 'OHI',
    votingPowerSymbol: 'OHI',
    rewardSymbol: 'OHI',
  },
): LockStatItem[] {
  return [
    {
      icon: Lock,
      label: 'Total Locked',
      value: totals.totalLocked.toLocaleString(),
      unit: options.lockedSymbol,
      gradient: 'from-primary/10 to-purple-500/10',
      border: 'border-primary/30',
      iconBg: 'bg-primary/10',
      iconColor: 'text-primary',
      valueColor: 'text-primary',
    },
    {
      icon: Vote,
      label: 'Voting Power',
      value: totals.totalVotingPower.toLocaleString(),
      unit: options.votingPowerSymbol || 'OHI',
      gradient: 'from-purple-500/10 to-blue-500/10',
      border: 'border-purple-500/30',
      iconBg: 'bg-purple-500/10',
      iconColor: 'text-purple-400',
      valueColor: 'text-purple-400',
    },
    {
      icon: Gift,
      label: options.rewardLabel || 'Claimable Rewards',
      value: totals.totalRewards.toLocaleString(),
      unit: options.rewardSymbol,
      gradient: 'from-green-500/10 to-emerald-500/10',
      border: 'border-green-500/30',
      iconBg: 'bg-green-500/10',
      iconColor: 'text-green-500',
      valueColor: 'text-green-500',
    },
    {
      icon: Unlock,
      label: 'Ready to Unlock',
      value: String(totals.readyToUnlock),
      unit: `${totals.readyToUnlock === 1 ? 'Active Lock' : 'Active Locks'}`,
      gradient: 'from-yellow-500/10 to-orange-500/10',
      border: 'border-yellow-500/30',
      iconBg: 'bg-yellow-500/10',
      iconColor: 'text-yellow-500',
      valueColor: 'text-yellow-500',
    },
  ];
}

export function normalizeLockPositions(
  list: LockPositionItem[] | undefined,
): ActiveLock[] {
  if (!list?.length) {
    return [];
  }

  return list.map((item, index) => {
    const canUnlock =
      item.canUnlock ||
      item.status === 'unlockable' ||
      isUnlockAvailable(item.startedAt);
    const lockSymbol = item.lockToken?.symbol || 'OHI';
    const rewardSymbol = item.rewardToken?.symbol || 'OHI';

    return {
      id: item.lockId || String(index + 1),
      lockTxHash: item.lockTxHash || item.lockId || '',
      lockAssetType: item.lockToken?.assetType || 'OHI',
      rewardAssetType: item.rewardToken?.assetType || 'OHI',
      amount: formatTokenAmount(
        item.lockToken?.amount,
        lockSymbol,
        item.lockToken?.decimals ?? OPENHIVE_ASSET_DECIMALS,
      ),
      startDate: item.startedAt
        ? formatDate(
            toTimestampMs(item.startedAt) ?? item.startedAt,
            'YYYY-MM-DD',
          )
        : '--',
      unlockAvailableAt: getUnlockAvailableAt(item.startedAt),
      daysLocked: getHoldingDuration(item.startedAt),
      votingPower: formatUnitsDisplayAmount(
        item.votingPower,
        item.lockToken?.decimals ?? OPENHIVE_ASSET_DECIMALS,
      ),
      status: canUnlock ? 'unlockable' : item.status || 'locked',
      rewards: formatTokenAmount(
        item.rewardToken?.amount,
        rewardSymbol,
        item.rewardToken?.decimals ?? OPENHIVE_ASSET_DECIMALS,
      ),
    };
  });
}

export function normalizeLockRewardsHistory(
  list: LockRewardsHistoryItem[] | undefined,
): LockRewardHistoryRow[] {
  if (!list?.length) {
    return [];
  }

  return list.map((item, index) => {
    const validatorAddress =
      item.validator?.address || item.validator?.validatorId || '';

    return {
      id: item.rewardId || `${item.txHash}-${index}`,
      amount: formatTokenAmount(
        item.rewardToken?.amount,
        item.rewardToken?.symbol,
        item.rewardToken?.decimals ?? OPENHIVE_ASSET_DECIMALS,
      ),
      claimDate: item.timestampMs
        ? formatDate(
            toTimestampMs(item.timestampMs) ?? item.timestampMs,
            'YYYY-MM-DD',
          )
        : '--',
      validator:
        item.validator?.name?.trim() || shortAddress(validatorAddress) || '--',
      rewardType: item.rewardType || 'reward',
      txHash: item.txHash || '',
    };
  });
}

export function normalizeLockUnlockHistory(
  list: LockUnlockHistoryItem[] | undefined,
): LockUnlockHistoryRow[] {
  if (!list?.length) {
    return [];
  }

  return list.map((item, index) => ({
    id: item.unlockHistoryId || `${item.lockId}-${index}`,
    amount: formatTokenAmount(
      item.lockToken?.amount,
      item.lockToken?.symbol,
      item.lockToken?.decimals ?? OPENHIVE_ASSET_DECIMALS,
    ),
    unlockDate: item.unlockedAt
      ? formatDate(
          toTimestampMs(item.unlockedAt) ?? item.unlockedAt,
          'YYYY-MM-DD',
        )
      : '--',
    holdingDuration: getHoldingDuration(item.startedAt, item.unlockedAt),
    totalRewards: formatTokenAmount(
      item.rewardToken?.amount,
      item.rewardToken?.symbol,
      item.rewardToken?.decimals ?? OPENHIVE_ASSET_DECIMALS,
    ),
  }));
}

export function formatAvailableBalance(
  value: string | undefined,
  symbol: string | undefined,
  decimals = OPENHIVE_ASSET_DECIMALS,
) {
  return formatTokenAmount(value, symbol, decimals);
}

export function getVotingPowerAmount(lockAmount: string) {
  const amount = Number(lockAmount);

  if (!Number.isFinite(amount) || amount <= 0) {
    return 0;
  }

  return amount;
}

export function formatVotingPower(value: number) {
  return value > 0 ? value.toLocaleString() : '0';
}

export function formatActiveLockCount(count: number) {
  return `${count} active lock${count === 1 ? '' : 's'}`;
}

export function waitForMockTransaction() {
  return new Promise((resolve) => {
    setTimeout(resolve, 2000);
  });
}
