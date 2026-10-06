import { Clock, CheckCircle2, XCircle, type LucideIcon } from 'lucide-react';
import { toUnitsAmount } from '@/app/lib/format';
import type {
  GovernanceProposalFlat,
  GovernanceProposalItem,
  GovernanceSummary,
  GovernanceTokenInfo,
} from '@/app/types/api-service/governance';

function toSafeNumber(value: string | number | undefined) {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
}

function toTokenNumber(value: string | number | undefined, decimals: number) {
  return toSafeNumber(toUnitsAmount(value ?? '0', decimals));
}

export function getStatusColor(status: string) {
  switch (status) {
    case 'active':
      return 'bg-primary/20 text-primary border-primary/30';
    case 'passed':
      return 'bg-green-500/20 text-green-500 border-green-500/30';
    case 'canceled':
      return 'bg-red-500/20 text-red-500 border-red-500/30';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

export function getStatusIcon(status: string): LucideIcon | null {
  switch (status) {
    case 'active':
      return Clock;
    case 'passed':
      return CheckCircle2;
    case 'canceled':
      return XCircle;
    default:
      return null;
  }
}

export interface NormalizedProposal extends GovernanceTokenInfo {
  id: string;
  proposalTxHash: string;
  title: string;
  description: string;
  status: string;
  statusLabel: string;
  category: string;
  authorAddress: string;
  authorName: string;
  endDate: string;
  votesFor: number;
  votesAgainst: number;
  totalVotes: number;
  forPercentage: number;
  againstPercentage: number;
  canVote: boolean;
  userHasVoted: boolean;
  votedType?: string;
}

export function normalizeProposals(
  list: GovernanceProposalItem[] | undefined,
  tokenDecimals = 18,
): NormalizedProposal[] {
  if (!list?.length) {
    return [];
  }

  return list.map((item) => {
    const proposal = item.proposal;
    const voteProgress = item.voteProgress;
    const forVotes = toTokenNumber(voteProgress?.forVotes, tokenDecimals);
    const againstVotes = toTokenNumber(
      voteProgress?.againstVotes,
      tokenDecimals,
    );
    const totalVotes = toTokenNumber(voteProgress?.totalVotes, tokenDecimals);
    const forPercentage = totalVotes > 0 ? (forVotes / totalVotes) * 100 : 0;
    const againstPercentage =
      totalVotes > 0 ? (againstVotes / totalVotes) * 100 : 0;

    return {
      id: proposal?.proposalId ?? '',
      proposalTxHash: proposal?.proposalTxHash ?? '',
      tokenName: proposal?.tokenName,
      assetType: proposal?.assetType,
      tokenContractAddress: proposal?.tokenContractAddress,
      proposalTransactionHash: proposal?.proposalTransactionHash,
      title: proposal?.title ?? '',
      description: proposal?.summary ?? '',
      status: proposal?.status ?? '',
      statusLabel: proposal?.statusLabel ?? '',
      category: proposal?.category ?? '',
      authorAddress: proposal?.author?.address ?? '',
      authorName: proposal?.author?.displayName ?? '',
      endDate: item.timeline?.endVotingAt
        ? new Date(item.timeline.endVotingAt * 1000).toLocaleDateString()
        : '--',
      votesFor: forVotes,
      votesAgainst: againstVotes,
      totalVotes,
      forPercentage,
      againstPercentage,
      canVote: item.permission?.canVote ?? false,
      userHasVoted: item.permission?.userHasVoted ?? false,
      votedType: item.permission?.userVoteType,
    };
  });
}

export function normalizeFlatProposals(
  list: GovernanceProposalFlat[] | undefined,
): NormalizedProposal[] {
  if (!list?.length) {
    return [];
  }

  return list.map((item) => {
    const votesFor = toSafeNumber(item.yesVotes);
    const votesAgainst = toSafeNumber(item.noVotes);
    const totalVotes = toSafeNumber(item.totalVotes);

    return {
      id: item.id ?? '',
      proposalTxHash: item.proposalHash ?? '',
      tokenName: item.tokenName ?? item.name,
      assetType: item.assetType ?? item.proposalHash,
      tokenContractAddress: item.tokenContractAddress,
      proposalTransactionHash: item.proposalTransactionHash,
      title: item.title || item.name || '',
      description: '',
      status: item.status ?? '',
      statusLabel: item.status ?? '',
      category: item.type ?? '',
      authorAddress: item.proposerAddress ?? '',
      authorName: item.proposerAddress ?? '',
      endDate: item.endTime || '--',
      votesFor,
      votesAgainst,
      totalVotes,
      forPercentage: toSafeNumber(item.yesPercentage),
      againstPercentage: toSafeNumber(item.noPercentage),
      canVote: !item.isEnded && !item.isVoted && item.voteStatusKnown !== false,
      userHasVoted: item.isVoted,
      votedType: item.votedType ?? undefined,
    };
  });
}

export interface MockProposal {
  id: number;
  title: string;
  description: string;
  status: string;
  votesFor: number;
  votesAgainst: number;
  totalVotes: number;
  endDate: string;
  author: string;
  category: string;
}

export function normalizeMockProposals(
  list: MockProposal[],
): NormalizedProposal[] {
  return list.map((p) => {
    const forPercentage =
      p.totalVotes > 0 ? (p.votesFor / p.totalVotes) * 100 : 0;
    const againstPercentage =
      p.totalVotes > 0 ? (p.votesAgainst / p.totalVotes) * 100 : 0;

    return {
      id: String(p.id),
      proposalTxHash: '',
      title: p.title,
      description: p.description,
      status: p.status,
      statusLabel: p.status,
      category: p.category,
      authorAddress: p.author,
      authorName: p.author,
      endDate: p.endDate,
      votesFor: p.votesFor,
      votesAgainst: p.votesAgainst,
      totalVotes: p.totalVotes,
      forPercentage,
      againstPercentage,
      canVote: true,
      userHasVoted: false,
    };
  });
}

export interface GovernanceStats {
  votingPower: string;
  votingPowerSymbol: string;
  votedProposalCount: number;
  canCreateProposal: boolean;
}

export function normalizeGovernanceSummary(
  data?: GovernanceSummary,
  tokenDecimals = 18,
): GovernanceStats {
  return {
    votingPower: toUnitsAmount(data?.votingPower ?? '0', tokenDecimals),
    votingPowerSymbol: data?.votingPowerSymbol ?? '',
    votedProposalCount: data?.votedProposalCount ?? 0,
    canCreateProposal: data?.canCreateProposal ?? false,
  };
}
