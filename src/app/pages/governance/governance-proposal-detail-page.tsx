import { motion } from 'motion/react';
import { useMemo } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  ExternalLink,
  ThumbsDown,
  ThumbsUp,
  Users,
} from 'lucide-react';
import { Link, useParams } from 'react-router';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Progress } from '../../components/ui/progress';
import { ConnectWalletPrompt } from '../../components/connect-wallet-prompt';
import { useApiService } from '@/app/hooks/use-app-apis';
import { useFetchData } from '@/app/hooks/use-fetch-data';
import { formatAmount, formatDate, shortAddress } from '@/app/lib/format';
import type {
  GovernanceProposalDetailResult,
  GovernanceProposalStructuredDetailResult,
} from '@/app/types/api-service/governance';
import { useWallet } from '../../providers/wallet-provider';
import { GovernanceVoteModal } from './governance-vote-modal';
import { GovernanceTokenDetails } from './governance-token-details';
import { useGovernancePageState } from './use-governance-page-state';
import {
  getStatusColor,
  getStatusIcon,
  normalizeGovernanceSummary,
  type NormalizedProposal,
} from './utils';

function toMilliseconds(timestamp?: number) {
  if (!timestamp) {
    return 0;
  }

  return timestamp < 1_000_000_000_000 ? timestamp * 1000 : timestamp;
}

function formatTimestamp(timestamp?: number) {
  const timestampInMilliseconds = toMilliseconds(timestamp);
  return timestampInMilliseconds ? formatDate(timestampInMilliseconds) : '--';
}

function toSafeNumber(value: string | number | undefined) {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
}

function toSafePercentage(value: number) {
  return Number.isFinite(value) ? Math.min(Math.max(value, 0), 100) : 0;
}

function isStructuredDetail(
  detail: GovernanceProposalDetailResult,
): detail is GovernanceProposalStructuredDetailResult {
  return 'proposal' in detail && Boolean(detail.proposal);
}

function getVoteLabel(voteType: string) {
  const normalizedType = voteType.toLowerCase();
  return normalizedType === 'yes' ||
    normalizedType === 'for' ||
    normalizedType === '1'
    ? 'For'
    : 'Against';
}

function normalizeDetailForVoting(
  detail: GovernanceProposalDetailResult,
  address: string,
): NormalizedProposal {
  const structured = isStructuredDetail(detail);
  const proposal = structured ? detail.proposal : null;
  const timeline = structured ? detail.timeline : null;
  const voteProgress = structured ? detail.voteProgress : null;
  const permission = structured ? detail.permission : null;
  const flatUserVote = structured
    ? undefined
    : detail.votes?.find(
        (vote) => vote.voter.toLowerCase() === address.toLowerCase(),
      );
  const status = (structured ? proposal.status : detail.status).toLowerCase();
  const endVotingAt = structured
    ? timeline?.endVotingAt
    : (detail.votingEndsAt ?? detail.endTime);
  const votingHasEnded =
    Boolean(endVotingAt) && toMilliseconds(endVotingAt) <= Date.now();
  const userHasVoted = structured
    ? (permission?.userHasVoted ?? false)
    : (detail.isVoted ?? Boolean(flatUserVote));
  const votesFor = toSafeNumber(
    structured ? voteProgress?.forVotes : detail.yesVotes,
  );
  const votesAgainst = toSafeNumber(
    structured ? voteProgress?.againstVotes : detail.noVotes,
  );
  const totalVotes = toSafeNumber(
    structured ? voteProgress?.totalVotes : detail.totalVotes,
  );

  return {
    id: structured ? proposal.proposalId : detail.proposalId,
    proposalTxHash: structured ? proposal.proposalTxHash : detail.hash,
    tokenName: structured ? proposal.tokenName : detail.tokenName,
    assetType: structured ? proposal.assetType : (detail.assetType ?? detail.hash),
    tokenContractAddress: structured ? proposal.tokenContractAddress : detail.tokenContractAddress,
    proposalTransactionHash: structured ? proposal.proposalTransactionHash : detail.proposalTransactionHash,
    title: structured ? proposal.title : detail.title,
    description: structured
      ? proposal.description || proposal.summary
      : detail.description || detail.summary || '',
    status,
    statusLabel: structured ? proposal.statusLabel : detail.status,
    category: structured ? proposal.category : detail.type,
    authorAddress: structured
      ? (proposal.author?.address ?? '')
      : (detail.proposerAddress ?? ''),
    authorName: structured ? (proposal.author?.displayName ?? '') : '',
    endDate: formatTimestamp(endVotingAt),
    votesFor,
    votesAgainst,
    totalVotes,
    forPercentage: totalVotes > 0 ? (votesFor / totalVotes) * 100 : 0,
    againstPercentage: totalVotes > 0 ? (votesAgainst / totalVotes) * 100 : 0,
    canVote:
      !userHasVoted &&
      (structured || detail.voteStatusKnown !== false) &&
      !votingHasEnded &&
      (permission?.canVote ?? status === 'active'),
    userHasVoted,
    votedType: structured ? permission?.userVoteType : (detail.votedType ?? flatUserVote?.voteType),
  };
}

export default function GovernanceProposalDetailPage() {
  const { proposalId = '' } = useParams();
  const { address, connected, currentNetwork } = useWallet();
  const apiService = useApiService();
  const targetChainId = currentNetwork.chainId;

  const {
    rawData: detail,
    isPending,
    error,
  } = useFetchData({
    queryKey: ['governance-proposal-detail', currentNetwork.key, proposalId, address],
    queryFn: (params) =>
      apiService.governanceProposalDetail(proposalId, params),
    params: {
      chainId: targetChainId,
      address,
    },
    enabled: Boolean(proposalId),
  });

  const { rawData: governancePageData, isPending: isGovernancePagePending } =
    useFetchData({
      queryKey: ['governance-page', currentNetwork.key, targetChainId, address],
      queryFn: (params) => apiService.governanceData(params),
      params: {
        chainId: targetChainId,
        address,
      },
      enabled: true,
    });

  const votingStats = useMemo(
    () =>
      normalizeGovernanceSummary(
        governancePageData?.summary,
        currentNetwork.nativeCurrency.decimals,
      ),
    [currentNetwork.nativeCurrency.decimals, governancePageData?.summary],
  );

  const votingProposal = useMemo(
    () => (detail ? normalizeDetailForVoting(detail, address) : null),
    [address, detail],
  );

  const governanceState = useGovernancePageState({
    proposals: votingProposal ? [votingProposal] : [],
    votingPower: votingStats.votingPower,
  });

  if (isPending) {
    return (
      <Card className='border-border/50 bg-card p-8 text-center text-sm text-muted-foreground'>
        Loading proposal details...
      </Card>
    );
  }

  if (error || !detail) {
    return (
      <div className='space-y-6'>
        <Link
          to='/governance'
          className='inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground'>
          <ArrowLeft className='h-4 w-4' />
          Back to Governance
        </Link>
        <Card className='border-red-500/30 bg-red-500/5 p-8 text-center'>
          <p className='font-medium'>Unable to load this proposal</p>
          <p className='mt-2 text-sm text-muted-foreground'>
            {error?.message || 'The proposal could not be found.'}
          </p>
        </Card>
      </div>
    );
  }

  const hasStructuredDetail = isStructuredDetail(detail);
  const proposal = hasStructuredDetail
    ? detail.proposal
    : {
        proposalId: detail.proposalId,
        proposalTxHash: detail.hash,
        title: detail.title,
        summary: detail.summary ?? '',
        description: detail.description ?? '',
        category: detail.type,
        status: detail.status,
        statusLabel: detail.status,
        proposalType: detail.type,
        discussionUrl: undefined,
        author: {
          address: detail.proposerAddress ?? '',
          displayName: '',
        },
      };
  const timeline = hasStructuredDetail
    ? detail.timeline
    : {
        createdAt: detail.createdAt,
        startVotingAt: detail.startTime,
        endVotingAt: detail.votingEndsAt ?? detail.endTime,
        timeLeftSeconds: 0,
      };
  const voteProgress = hasStructuredDetail
    ? detail.voteProgress
    : {
        forVotes: detail.yesVotes,
        againstVotes: detail.noVotes,
        abstainVotes: 0,
        totalVotes: detail.totalVotes,
        quorumReached: undefined,
      };
  const permission = hasStructuredDetail ? detail.permission : null;
  const executionActions = hasStructuredDetail
    ? (detail.execution?.actions ?? [])
    : [];
  const voteRecords = hasStructuredDetail ? [] : (detail.votes ?? []);
  const votesFor = toSafeNumber(voteProgress?.forVotes);
  const votesAgainst = toSafeNumber(voteProgress?.againstVotes);
  const abstainVotes = toSafeNumber(voteProgress?.abstainVotes);
  const totalVotes = toSafeNumber(voteProgress?.totalVotes);
  const forPercentage = toSafePercentage(
    totalVotes > 0 ? (votesFor / totalVotes) * 100 : 0,
  );
  const againstPercentage = toSafePercentage(
    totalVotes > 0 ? (votesAgainst / totalVotes) * 100 : 0,
  );
  const StatusIcon = getStatusIcon(proposal.status ?? '');
  const discussionUrl =
    proposal.discussionUrl && /^https?:\/\//i.test(proposal.discussionUrl)
      ? proposal.discussionUrl
      : null;
  const authorLabel =
    proposal.author?.displayName ||
    shortAddress(proposal.author?.address ?? '');
  const userVoteType = votingProposal?.votedType?.toLowerCase();
  const userVotedFor =
    userVoteType === 'yes' || userVoteType === 'for' || userVoteType === '1';
  const userVotedAgainst =
    userVoteType === 'no' || userVoteType === 'against' || userVoteType === '0';
  const userVoteLabel = userVotedFor
    ? 'Voted For'
    : userVotedAgainst
      ? 'Voted Against'
      : null;
  const voteStatusContainerClassName = userVotedFor
    ? 'border-green-500/30 bg-green-500/10'
    : userVotedAgainst
      ? 'border-red-500/30 bg-red-500/10'
      : 'border-primary/30 bg-primary/10';
  const voteStatusAccentClassName = userVotedFor
    ? 'text-green-500'
    : userVotedAgainst
      ? 'text-red-500'
      : 'text-primary';

  const stats = [
    {
      label: 'Total Votes',
      value: formatAmount(totalVotes, 2),
      icon: Users,
    },
    {
      label: 'Voting Ends',
      value: formatTimestamp(timeline?.endVotingAt),
      icon: Clock3,
    },
    {
      label: 'Quorum',
      value:
        typeof voteProgress?.quorumReached === 'boolean'
          ? voteProgress.quorumReached
            ? 'Reached'
            : 'Not reached'
          : '--',
      icon: CheckCircle2,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className='space-y-8'>
      <Link
        to='/governance'
        className='inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground'>
        <ArrowLeft className='h-4 w-4' />
        Back to Governance
      </Link>

      <div className='space-y-4'>
        <div className='flex flex-wrap items-center gap-3'>
          <Badge className={getStatusColor(proposal.status ?? '')}>
            {StatusIcon && <StatusIcon className='h-4 w-4' />}
            <span className='ml-1 capitalize'>
              {proposal.statusLabel || proposal.status || 'Unknown'}
            </span>
          </Badge>
          {proposal.category ? (
            <Badge variant='outline'>{proposal.category}</Badge>
          ) : null}
        </div>

        <div>
          <h1 className='break-words text-2xl font-bold sm:text-3xl md:text-4xl'>
            {proposal.title || 'Proposal'}
          </h1>
          <p className='mt-3 text-sm leading-6 text-muted-foreground sm:text-base'>
            {proposal.description || proposal.summary || 'No description.'}
          </p>
        </div>

        <div className='flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground'>
          {authorLabel ? (
            <span>
              Proposed by{' '}
              <span className='font-mono text-foreground'>{authorLabel}</span>
            </span>
          ) : null}
          <span className='font-mono'>
            ID: {shortAddress(proposal.proposalId)}
          </span>
          {discussionUrl ? (
            <a
              href={discussionUrl}
              target='_blank'
              rel='noreferrer'
              className='inline-flex items-center gap-1 text-primary hover:underline'>
              Discussion
              <ExternalLink className='h-3.5 w-3.5' />
            </a>
          ) : null}
        </div>
      </div>

      <GovernanceTokenDetails info={votingProposal!} />

      <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
        {stats.map(({ label, value, icon: Icon }) => (
          <Card key={label} className='border-border/50 bg-card p-5'>
            <div className='mb-3 flex items-center gap-2 text-sm text-muted-foreground'>
              <Icon className='h-4 w-4' />
              {label}
            </div>
            <p className='font-semibold'>{value}</p>
          </Card>
        ))}
      </div>

      {connected && votingProposal?.userHasVoted ? (
        <div
          className={`flex flex-col gap-3 rounded-lg border px-5 py-4 sm:flex-row sm:items-center sm:justify-between ${voteStatusContainerClassName}`}>
          <div className='flex items-center gap-3'>
            <CheckCircle2
              className={`h-5 w-5 shrink-0 ${voteStatusAccentClassName}`}
            />
            <div>
              <p className='text-sm font-medium'>Vote submitted</p>
              <p className='text-xs text-muted-foreground'>
                Your vote has been recorded for this proposal.
              </p>
            </div>
          </div>
          {userVoteLabel ? (
            <Badge
              variant='outline'
              className={`w-fit shrink-0 ${voteStatusAccentClassName}`}>
              {userVoteLabel}
            </Badge>
          ) : null}
        </div>
      ) : (
        <Card className='border-primary/30 bg-gradient-to-br from-primary/10 to-purple-500/10 p-6'>
          <div className='mb-5'>
            <h2 className='text-lg font-semibold'>Cast Your Vote</h2>
            <p className='mt-1 text-sm text-muted-foreground'>
              {connected
                ? `Your voting power: ${
                    isGovernancePagePending
                      ? 'Loading...'
                      : `${Number(votingStats.votingPower).toLocaleString()} ${
                          votingStats.votingPowerSymbol
                        }`
                  }`
                : 'Connect your wallet to vote on this proposal.'}
            </p>
          </div>

          {!connected ? (
            <ConnectWalletPrompt
              variant='inline'
              message='Connect your wallet to vote on this proposal.'
            />
          ) : votingProposal?.status === 'active' && votingProposal.canVote ? (
            <div className='flex flex-col gap-3 sm:flex-row'>
              <Button
                className='flex-1 bg-green-500 hover:bg-green-600'
                onClick={() =>
                  governanceState.openVoteModal(votingProposal.id, 'for')
                }>
                <ThumbsUp className='h-4 w-4' />
                Vote For
              </Button>
              <Button
                variant='destructive'
                className='flex-1'
                onClick={() =>
                  governanceState.openVoteModal(votingProposal.id, 'against')
                }>
                <ThumbsDown className='h-4 w-4' />
                Vote Against
              </Button>
            </div>
          ) : (
            <p className='rounded-lg border border-border/50 bg-card/50 px-4 py-3 text-sm text-muted-foreground'>
              Voting is no longer available for this proposal.
            </p>
          )}
        </Card>
      )}

      <Card className='space-y-6 border-border/50 bg-card p-6'>
        <h2 className='text-lg font-semibold'>Voting Progress</h2>

        <div className='space-y-3'>
          <div className='flex items-center justify-between gap-4 text-sm'>
            <div className='flex items-center gap-2 text-muted-foreground'>
              <ThumbsUp className='h-4 w-4 text-green-500' />
              For
            </div>
            <div className='flex items-center gap-3'>
              <span>{formatAmount(votesFor, 2)}</span>
              <span className='font-bold text-green-500'>
                {forPercentage.toFixed(1)}%
              </span>
            </div>
          </div>
          <Progress
            value={forPercentage}
            className='h-2 bg-secondary'
            indicatorClassName='bg-green-500'
          />
        </div>

        <div className='space-y-3'>
          <div className='flex items-center justify-between gap-4 text-sm'>
            <div className='flex items-center gap-2 text-muted-foreground'>
              <ThumbsDown className='h-4 w-4 text-red-500' />
              Against
            </div>
            <div className='flex items-center gap-3'>
              <span>{formatAmount(votesAgainst, 2)}</span>
              <span className='font-bold text-red-500'>
                {againstPercentage.toFixed(1)}%
              </span>
            </div>
          </div>
          <Progress
            value={againstPercentage}
            className='h-2 bg-secondary'
            indicatorClassName='bg-red-500'
          />
        </div>

        {abstainVotes > 0 ? (
          <p className='text-sm text-muted-foreground'>
            Abstain: {formatAmount(abstainVotes, 2)}
          </p>
        ) : null}

        {permission?.userHasVoted ? (
          <div className='rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm'>
            Your vote has been recorded
            {permission.userVoteType ? ` (${permission.userVoteType})` : ''}.
          </div>
        ) : null}
      </Card>

      <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
        <Card className='border-border/50 bg-card p-6'>
          <h2 className='mb-5 text-lg font-semibold'>Timeline</h2>
          <dl className='space-y-4 text-sm'>
            <div className='flex justify-between gap-4'>
              <dt className='text-muted-foreground'>Created</dt>
              <dd>{formatTimestamp(timeline?.createdAt)}</dd>
            </div>
            <div className='flex justify-between gap-4'>
              <dt className='text-muted-foreground'>Voting started</dt>
              <dd>{formatTimestamp(timeline?.startVotingAt)}</dd>
            </div>
            <div className='flex justify-between gap-4'>
              <dt className='text-muted-foreground'>Voting ends</dt>
              <dd>{formatTimestamp(timeline?.endVotingAt)}</dd>
            </div>
            {timeline?.executedAt ? (
              <div className='flex justify-between gap-4'>
                <dt className='text-muted-foreground'>Executed</dt>
                <dd>{formatTimestamp(timeline.executedAt)}</dd>
              </div>
            ) : null}
          </dl>
        </Card>

        <Card className='border-border/50 bg-card p-6'>
          <h2 className='mb-5 text-lg font-semibold'>
            {hasStructuredDetail ? 'Execution' : 'Recent Votes'}
          </h2>
          {!hasStructuredDetail && voteRecords.length ? (
            <div className='space-y-4'>
              {voteRecords.map((vote) => (
                <div
                  key={`${vote.txHash}-${vote.timestamp}`}
                  className='flex items-center justify-between gap-4 rounded-lg border border-border/50 p-4 text-sm'>
                  <div>
                    <p className='font-medium'>{getVoteLabel(vote.voteType)}</p>
                    <p className='mt-1 font-mono text-xs text-muted-foreground'>
                      {shortAddress(vote.voter)}
                    </p>
                  </div>
                  <div className='text-right'>
                    <p>{formatAmount(toSafeNumber(vote.voteAmount), 2)}</p>
                    <p className='mt-1 text-xs text-muted-foreground'>
                      {formatTimestamp(vote.timestamp)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : hasStructuredDetail && executionActions.length ? (
            <div className='space-y-4'>
              {executionActions.map((action) => (
                <div
                  key={action.actionIndex}
                  className='rounded-lg border border-border/50 p-4 text-sm'>
                  <p className='mb-2 font-medium'>
                    Action {action.actionIndex + 1}
                  </p>
                  <p className='break-all font-mono text-xs text-muted-foreground'>
                    {action.signature || 'Contract call'} →{' '}
                    {action.targetAddress}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className='text-sm text-muted-foreground'>
              {hasStructuredDetail
                ? 'This proposal has no execution actions.'
                : 'This proposal has no voting records.'}
            </p>
          )}
        </Card>
      </div>

      <GovernanceVoteModal
        isOpen={governanceState.isVoteModalOpen}
        onClose={governanceState.closeVoteModal}
        proposal={governanceState.selectedProposal}
        voteType={governanceState.voteType}
        votingPower={votingStats.votingPower}
        votingPowerSymbol={votingStats.votingPowerSymbol}
        onConfirm={governanceState.confirmVote}
      />
    </motion.div>
  );
}
