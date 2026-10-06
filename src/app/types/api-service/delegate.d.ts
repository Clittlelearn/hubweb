import type { PaginationParams } from '@/app/apis';
import type {
  ChainAndAddressParams,
  ChainIdParams,
  PaginatedResult,
} from './common';
import type { NumericString } from './dashboard';

// §5.0 GET /delegate/page
export interface DelegatePageParams extends ChainAndAddressParams {}

export interface DelegatePageNetworkStats {
  activeValidatorCount: number;
  totalDelegatorsCount: number;
  totalDelegated: NumericString;
  totalDelegatedSymbol: string;
}

export interface DelegatePageUserSummary {
  availableBalance: NumericString;
  availableBalanceSymbol: string;
  totalDelegated: NumericString;
  totalDelegatedSymbol: string;
  positionCount: number;
  validatorCount: number;
  totalRewards: NumericString;
  totalRewardsSymbol: string;
}

export interface DelegatePageResult {
  networkStats: DelegatePageNetworkStats;
  delegateTokens: DelegateTokenItem[];
  topValidators: DelegateValidatorItem[];
  userSummary: DelegatePageUserSummary;
}

// §5.1 GET /delegate/validators
export interface DelegateValidatorsParams extends ChainIdParams, PaginationParams {
  status?: 'all' | 'active' | 'inactive';
  keyword?: string;
}

export interface DelegateValidatorItem {
  validatorId: string;
  rank: number;
  name: string;
  address: string;
  logoUrl: string;
  status: string;
  description: string;
  website: string;
  delegatorCount: number;
  commissionRatePct: NumericString;
  apyPct: NumericString;
  totalStaked: NumericString;
  delegatedStake: NumericString;
  selfStake: NumericString;
  performancePct: NumericString;
  uptimePct: NumericString;
  online: boolean;
  lastActiveAt: number | null;
}

export type DelegateValidatorsResult = PaginatedResult<DelegateValidatorItem>;

// §5.2 GET /delegate/tokens
export interface DelegateTokensParams extends ChainIdParams {
  address?: string;
}

export interface DelegateTokenItem {
  tokenId: string;
  name: string;
  symbol: string;
  logoUrl: string;
  contractAddress: string;
  assetType: string;
  decimals: number;
  balance: NumericString;
}

export interface DelegateTokensResult {
  list: DelegateTokenItem[];
}

// §5.3 GET /delegate/delegated-tokens
export interface DelegatedTokensResult {
  list: DelegateTokenItem[];
}

// §5.4 GET /delegate/positions
export interface DelegatePositionValidator {
  validatorId: string;
  name: string;
  address: string;
  logoUrl: string;
  status: string;
  description: string;
  commissionRatePct: NumericString;
  apyPct: NumericString;
  performancePct: NumericString;
  uptimePct: NumericString;
}

export interface DelegatePositionToken {
  tokenId: string;
  name: string;
  symbol: string;
  logoUrl: string;
  decimals: number;
  contractAddress: string;
  assetType: string;
  amount: NumericString;
}

export interface DelegatePositionItem {
  positionId: string;
  validator: DelegatePositionValidator;
  delegateToken: DelegatePositionToken;
  rewardAmount: NumericString;
  rewardSymbol: string;
  delegateTxHash: string;
  delegatedAt: number;
}

export interface DelegatePositionsSummary {
  totalDelegated: NumericString;
  totalDelegatedSymbol: string;
  positionCount: number;
  validatorCount: number;
  totalRewards: NumericString;
  totalRewardsSymbol: string;
}

export interface DelegatePositionsResult
  extends PaginatedResult<DelegatePositionItem> {
  summary: DelegatePositionsSummary;
}

// §5.5 GET /delegate/history
export interface DelegateHistoryParams extends ChainAndAddressParams, PaginationParams {}

export interface DelegateHistoryItem {
  id: string;
  hash: string;
  type: string; // "4" (delegate) | "5" (undelegate)
  fromAddr: string;
  toAddr: string;
  amount: NumericString;
  assetType: string;
  validatorAddress: string;
  validatorName: string;
  timestamp: number;
  blockHeight: string;
}

export type DelegateHistoryResult = PaginatedResult<DelegateHistoryItem>;

// §5.6 GET /delegate/rewards
export interface DelegateRewardsParams extends ChainAndAddressParams, PaginationParams {}

export interface DelegateRewardItem {
  rewardId?: string;
  rewardHistoryId?: string;
  positionId: string;
  validator: DelegatePositionValidator & { delegatorCount?: number };
  delegateToken?: DelegatePositionToken | null;
  stakeToken?: DelegatePositionToken | null;
  rewardToken?: DelegatePositionToken;
  claimToken?: DelegatePositionToken;
  stakeStartedAt?: number;
  claimAddress?: string;
  apyPct?: NumericString;
  claimedAt: number;
  txHash: string;
  txType: string | number;
}

export type DelegateRewardsResult = PaginatedResult<DelegateRewardItem>;
