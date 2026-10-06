import { PaginationParams } from '@/app/apis';
import { ChainIdParams, PaginatedResult } from './common';

export interface GovernancePageParams extends ChainIdParams {
  address?: string;
}

export interface GovernanceProposalsParams
  extends ChainIdParams, PaginationParams {
  address?: string;
  status?: string;
  userVoted?: boolean;
  category?: string;
  keyword?: string;
  sortBy?: string;
  sortOrder?: string;
}

export interface GovernanceProposalDetailParams extends ChainIdParams {
  address?: string;
}

export interface GovernanceProposalVotesParams
  extends ChainIdParams, PaginationParams {
  voteType?: string;
}

export interface GovernanceSummary {
  votingPower: string;
  votingPowerSymbol: string;
  votedProposalCount: number;
  activeProposalCount: number;
  passedProposalCount: number;
  rejectedProposalCount: number;
  canCreateProposal: boolean;
  proposalThreshold: string;
}

export interface GovernanceAuthor {
  address: string;
  displayName: string;
}

export interface GovernanceTokenInfo {
  tokenName?: string;
  assetType?: string;
  tokenContractAddress?: string;
  proposalTransactionHash?: string;
}

export interface GovernanceProposalBase extends GovernanceTokenInfo {
  proposalId: string;
  title: string;
  summary: string;
  category: string;
  status: string;
  statusLabel: string;
  proposalType: string;
  proposalTxHash: string;
  discussionUrl?: string;
  author: GovernanceAuthor;
}

export interface GovernanceProposalTimeline {
  createdAt: number;
  startVotingAt: number;
  endVotingAt: number;
  executedAt?: number;
  queuedAt?: number;
  canceledAt?: number;
  timeLeftSeconds: number;
}

export interface GovernanceVoteProgress {
  forVotes: string;
  againstVotes: string;
  abstainVotes: string;
  totalVotes: string;
  quorumThreshold: string;
  quorumReached: boolean;
  forPct: string;
  againstPct: string;
  turnoutPct: string;
}

export interface GovernancePermission {
  canVote: boolean;
  canExecute?: boolean;
  canCancel?: boolean;
  userHasVoted: boolean;
  userVoteType: string;
  userVoteAmount: string;
}

export interface GovernanceProposalItem {
  proposal: GovernanceProposalBase;
  timeline: GovernanceProposalTimeline;
  voteProgress: GovernanceVoteProgress;
  permission: GovernancePermission;
}

export interface GovernancePageResult {
  summary: GovernanceSummary;
  recentProposals: GovernanceProposalItem[];
}

export interface GovernanceFilterOptions {
  statusOptions: string[];
  categoryOptions: string[];
}

// §7.2 GET /governance/proposals — flat proposal shape
export interface GovernanceProposalFlat extends GovernanceTokenInfo {
  id: string;
  proposalHash: string;
  title: string;
  name: string;
  type: string;
  isRevoke: boolean;
  proposerAddress: string;
  revokerAddress: string | null;
  originalProposalHash: string | null;
  totalVotes: number;
  yesVotes: number;
  noVotes: number;
  yesPercentage: number;
  noPercentage: number;
  endTime: string;
  status: string;
  revokeBeginTime: string | null;
  isEnded: boolean;
  isVoted: boolean;
  voteStatusKnown?: boolean;
  votedType: string | null;
}

export interface GovernanceProposalsResult {
  proposals: GovernanceProposalFlat[];
}

export interface GovernanceExecutionAction {
  actionIndex: number;
  targetAddress: string;
  value: string;
  signature: string;
  calldata: string;
}

export interface GovernanceExecution {
  targetCount: number;
  actions: GovernanceExecutionAction[];
}

export interface GovernanceProposalStructuredDetailResult {
  proposal: GovernanceProposalBase & {
    description: string;
    snapshotBlockNumber: number;
  };
  timeline: GovernanceProposalTimeline;
  voteProgress: GovernanceVoteProgress;
  permission: GovernancePermission;
  execution: GovernanceExecution;
}

export interface GovernanceProposalDetailVote {
  txHash: string;
  voter: string;
  voteType: string;
  voteAmount: string;
  timestamp: number;
}

// Current backend response shape. Keep the structured result above in the
// union so the UI remains compatible with the documented future response.
export interface GovernanceProposalFlatDetailResult extends GovernanceTokenInfo {
  proposalId: string;
  hash: string;
  type: string;
  title: string;
  summary?: string;
  description?: string;
  status: string;
  proposerAddress?: string;
  totalVotes: string | number;
  yesVotes: string | number;
  noVotes: string | number;
  startTime: number;
  endTime: number;
  votingEndsAt?: number;
  createdAt: number;
  votes?: GovernanceProposalDetailVote[];
  isVoted?: boolean;
  votedType?: string | null;
  voteStatusKnown?: boolean;
}

export type GovernanceProposalDetailResult =
  | GovernanceProposalStructuredDetailResult
  | GovernanceProposalFlatDetailResult;

export interface GovernanceVoteItem {
  voteId: string;
  voterAddress: string;
  voteType: string;
  voteAmount: string;
  votedAt: number;
  txHash: string;
}

export type GovernanceProposalVotesResult = PaginatedResult<GovernanceVoteItem>;
