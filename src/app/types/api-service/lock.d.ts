import { PaginationParams } from '@/app/apis';
import { ChainAndAddressParams, ChainIdParams, PaginatedResult } from './common';

export interface LockHistoryParams
  extends ChainAndAddressParams, PaginationParams {}

export interface LockAssetInfo {
  name: string;
  symbol: string;
  logoUrl: string;
  decimals: number;
  contractAddress: string;
  assetType: string;
}

export interface LockNetworkOverview {
  totalLockedAmount: string;
  lockedSymbol: string;
  totalLockedUsd: string;
  lockedCurrency: string;
  totalVotingPower: string;
  votingPowerSymbol: string;
  totalRewardAmount: string;
  rewardSymbol: string;
  activeLockCount: number;
  readyToUnlockCount: number;
  totalUnlockedAmount24h: string;
  totalUnlockedUsd24h: string;
}

export interface LockPageResult {
  networkOverview: LockNetworkOverview;
  lockAsset: LockAssetInfo;
}

export interface LockUserOverview {
  availableBalance: string;
  availableBalanceSymbol: string;
  totalLockedAmount: string;
  totalLockedUsd: string;
  lockedSymbol: string;
  totalVotingPower: string;
  votingPowerSymbol: string;
  claimableRewardAmount: string;
  rewardSymbol: string;
  readyToUnlockCount: number;
  claimableLockCount: number;
}

export interface LockUserSummaryResult {
  lockAsset: LockAssetInfo;
  userOverview: LockUserOverview;
}

export interface LockPeriodInfo {
  periodId: number;
  label: string;
  durationDays: number;
  aprPct?: string;
  multiplier?: string;
  bonusPct?: string;
}

export interface LockTokenInfo {
  name: string;
  symbol: string;
  logoUrl: string;
  decimals: number;
  contractAddress: string;
  assetType: string;
  amount: string;
}

export interface LockRewardTokenInfo
  extends Omit<LockTokenInfo, 'contractAddress'> {
  tokenId: string;
  contractAddress?: string;
}

export interface LockRewardValidatorInfo {
  validatorId: string;
  name: string;
  address: string;
  logoUrl: string;
}

export interface LockPositionItem {
  lockId: string;
  lockToken: LockTokenInfo;
  rewardToken: LockTokenInfo;
  period?: LockPeriodInfo;
  votingPower: string;
  status: string;
  startedAt: number;
  endsAt?: number;
  progressPct?: number;
  lockTxHash: string;
  unlockTxHash: string;
  canUnlock: boolean;
  canClaimRewards: boolean;
  canEarlyUnlock: boolean;
}

export interface LockPositionsResult {
  list: LockPositionItem[];
}

export interface LockRewardsHistoryItem {
  rewardId: string;
  validator: LockRewardValidatorInfo;
  rewardToken: LockRewardTokenInfo;
  rewardType: string;
  txHash: string;
  timestampMs: number;
}

export type LockRewardsHistoryResult = PaginatedResult<LockRewardsHistoryItem>;

export interface LockUnlockHistoryItem {
  unlockHistoryId: string;
  lockId: string;
  lockToken: LockTokenInfo;
  rewardToken: LockTokenInfo;
  period?: LockPeriodInfo;
  startedAt: number;
  unlockedAt: number;
  unlockTxHash: string;
}

export type LockUnlockHistoryResult = PaginatedResult<LockUnlockHistoryItem>;
