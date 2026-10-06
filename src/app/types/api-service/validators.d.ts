import type { ChainAndAddressParams, ChainIdParams } from './common';
import type { NumericString } from './dashboard';

export interface ValidatorsDataParams {
  chainId: number;
}

export interface ValidatorsNetworkStats {
  activeValidatorCount: number;
  totalStaked: NumericString;
  totalStakedSymbol: string;
  totalStakedCurrency: string;
  /** @deprecated legacy field kept for backward-compatible normalization */
  totalStakedUsd?: NumericString;
  networkUptimePct: NumericString;
  avgValidatorApyPct: NumericString;
}

export interface ValidatorsStakedToken {
  tokenId: string;
  name: string;
  symbol: string;
  logoUrl: string;
  totalStakedAmount: NumericString;
  totalStakedUsd: NumericString;
  decimals: number;
  contractAddress: string;
  assetType: string;
  validatorCount: number;
  delegatorCount: number;
}

export interface TopValidatorItem {
  validatorId: string;
  name: string;
  address: string;
  logoUrl: string;
  status: string;
  description: string;
  delegatorCount: number;
  commissionRatePct: NumericString;
  apyPct: NumericString;
  totalStakedUsd: NumericString;
  totalStakedCurrency: string;
  performancePct: NumericString;
  uptimePct: NumericString;
}

export interface ValidatorsDataResults {
  networkStats: ValidatorsNetworkStats;
  stakedTokens: ValidatorsStakedToken[];
  topValidators: StakingValidatorItem[];
}

export interface StakingValidatorsParams {
  chainId: number;
  status: 'all' | 'active' | 'inactive';
  pageNum: number;
  pageSize: number;
  keyword?: string;
}

export interface StakingSupportedStakeToken {
  tokenId: string;
  symbol: string;
  assetType: string;
  logoUrl: string;
}

export interface StakingValidatorItem extends TopValidatorItem {
  rank: number;
  operatorAddress: string | null;
  website: string;
  identityName: string;
  identityVerified: boolean;
  selfStake: NumericString;
  selfStakeCurrency: string;
  totalStaked: NumericString;
  supportedStakeTokens: StakingSupportedStakeToken[];
  stakeTokenCount: number;
  delegatorRewardsUsd24h: NumericString;
  slashCount30d: number;
  proposedBlockCount24h: number;
  online: boolean;
  lastActiveAt: number;
  version: string;
  updatedAt: number;
  canStake: boolean;
}

export interface StakingValidatorsResult {
  list: StakingValidatorItem[];
  pageNum: number;
  pageSize: number;
  total: number;
}

export interface StakeableTokenItem {
  tokenId: string;
  name: string;
  symbol: string;
  logoUrl: string;
  balance: NumericString;
  decimals: number;
  contractAddress: string;
  assetType: string;
}

export interface StakeableTokensResult {
  list: StakeableTokenItem[];
}

export interface StakedTokenItem {
  tokenId: string;
  name: string;
  symbol: string;
  logoUrl: string;
  totalStakedAmount: NumericString;
  totalStakedUsd: NumericString;
  decimals: number;
  contractAddress: string;
  assetType: string;
  positionCount: number;
}

export interface StakedTokensResult {
  list: StakedTokenItem[];
}

export interface PositionValidatorInfo {
  validatorId: string;
  name: string;
  address: string;
  logoUrl: string;
  status: string;
  description: string;
  delegatorCount: number;
  commissionRatePct: NumericString;
  apyPct: NumericString;
  performancePct: NumericString;
  uptimePct: NumericString;
}

export interface PositionTokenInfo {
  tokenId: string;
  name: string;
  symbol: string;
  logoUrl: string;
  decimals: number;
  contractAddress: string;
  assetType: string;
  amount: NumericString;
}

export interface StakingPositionItem {
  positionId: string;
  validator: PositionValidatorInfo;
  stakeInfo: PositionTokenInfo;
  rewardInfo: PositionTokenInfo;
  apyPct: NumericString;
  stakedAt: number;
  stakeTxHash: string;
  lockPeriodDays: number;
  progressPct: number;
  canUnstake: boolean;
}

export interface StakingPositionsResult {
  list: StakingPositionItem[];
}

export interface RewardsHistoryItem {
  rewardHistoryId: string;
  positionId: string;
  validator: PositionValidatorInfo;
  stakeToken: PositionTokenInfo;
  claimToken: PositionTokenInfo;
  stakeStartedAt: number;
  claimAddress: string;
  apyPct: NumericString;
  claimedAt: number;
  txHash: string;
}

export interface StakingRewardsHistoryParams {
  chainId: number;
  address: string;
  pageNum: number;
  pageSize: number;
}

export interface StakingRewardsHistoryResult {
  list: RewardsHistoryItem[];
  pageNum: number;
  pageSize: number;
  total: number;
}

export type ValidatorsDataResult = ValidatorsDataResults;

// §4.3 GET /staking/validators/:validatorId
export interface StakingValidatorDetailParams extends ChainIdParams {
  address?: string;
}

export type StakingValidatorDetailResult = StakingValidatorItem;

// §4.4 GET /staking/stake-info
export interface StakingStakeInfoParams extends ChainAndAddressParams {}

export interface StakeInfoSupportedToken {
  tokenId: string;
  symbol: string;
  assetType: string;
  logoUrl: string;
}

export interface StakeInfoDetail {
  selfStake: NumericString;
  selfStakeSymbol: string;
  commission: NumericString;
  apyPct: NumericString;
  rank: number;
  supportedTokens: StakeInfoSupportedToken[];
}

export interface StakeInfoSummary {
  totalSelfStake: NumericString;
  totalSelfStakeSymbol: string;
  totalRewards: NumericString;
  totalRewardsSymbol: string;
}

export interface StakingStakeInfoResult {
  isValidator: boolean;
  message?: string;
  stakeInfo: StakeInfoDetail | null;
  summary: StakeInfoSummary;
}
