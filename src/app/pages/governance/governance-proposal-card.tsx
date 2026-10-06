import { motion } from 'motion/react';
import { useMemo } from 'react';
import { Link } from 'react-router';
import {
  ArrowUpRight,
  CheckCircle2,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Progress } from '../../components/ui/progress';
import { getStatusColor, getStatusIcon } from './utils';
import type { NormalizedProposal } from './utils';
import { GovernanceTokenDetails } from './governance-token-details';

export function GovernanceProposalCard({
  proposal,
  index,
  connected,
  onVote,
}: {
  proposal: NormalizedProposal;
  index: number;
  connected: boolean;
  onVote: (proposalId: string, type: 'for' | 'against') => void;
}) {
  const StatusIcon = getStatusIcon(proposal.status);

  const actionBar = useMemo(() => {
    if (!connected) {
      return null;
    }

    if (proposal.userHasVoted) {
      const votedType = proposal.votedType?.toLowerCase();
      const votedFor =
        votedType === 'yes' || votedType === 'for' || votedType === '1';
      const votedAgainst =
        votedType === 'no' || votedType === 'against' || votedType === '0';
      const voteLabel = votedFor
        ? 'Voted For'
        : votedAgainst
          ? 'Voted Against'
          : null;
      const containerClassName = votedFor
        ? 'border-green-500/30 bg-green-500/10'
        : votedAgainst
          ? 'border-red-500/30 bg-red-500/10'
          : 'border-primary/30 bg-primary/10';
      const accentClassName = votedFor
        ? 'text-green-500'
        : votedAgainst
          ? 'text-red-500'
          : 'text-primary';

      return (
        <div
          className={`flex flex-col gap-3 rounded-lg border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${containerClassName}`}>
          <div className='flex items-center gap-3'>
            <CheckCircle2 className={`h-5 w-5 shrink-0 ${accentClassName}`} />
            <div>
              <p className='text-sm font-medium'>Vote submitted</p>
              <p className='text-xs text-muted-foreground'>
                Your vote has been recorded for this proposal.
              </p>
            </div>
          </div>
          {voteLabel && (
            <Badge
              variant='outline'
              className={`w-fit shrink-0 ${accentClassName}`}>
              {voteLabel}
            </Badge>
          )}
        </div>
      );
    }

    if (proposal.status === 'active' && proposal.canVote) {
      return (
        <div className='flex gap-3 pt-2'>
          <Button
            className='flex-1 bg-green-500 hover:bg-green-600'
            onClick={() => onVote(proposal.id, 'for')}>
            <ThumbsUp className='w-4 h-4 mr-2' />
            Vote For
          </Button>
          <Button
            variant='destructive'
            className='flex-1'
            onClick={() => onVote(proposal.id, 'against')}>
            <ThumbsDown className='w-4 h-4 mr-2' />
            Vote Against
          </Button>
        </div>
      );
    }

    return null;
  }, [connected, onVote, proposal]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}>
      <Card className='p-6 bg-card border-border/50 hover:border-primary/50 transition-colors'>
        <div className='space-y-4'>
          <div className='flex items-start justify-between gap-4'>
            <div className='min-w-0 flex-1'>
              <div className='flex flex-wrap items-center gap-3 mb-2'>
                <Badge className={getStatusColor(proposal.status)}>
                  {StatusIcon && <StatusIcon className='w-4 h-4' />}
                  <span className='ml-1 capitalize'>
                    {proposal.statusLabel || proposal.status}
                  </span>
                </Badge>
                <Badge variant='outline' className='text-xs'>
                  {proposal.category}
                </Badge>
              </div>
              <h3 className='break-words text-xl mb-2'>{proposal.title}</h3>
              <p className='text-muted-foreground text-sm'>
                {proposal.description}
              </p>
            </div>
            <Button asChild variant='outline' size='sm' className='shrink-0'>
              <Link to={`/governance/${encodeURIComponent(proposal.id)}`}>
                Details
                <ArrowUpRight className='h-4 w-4' />
              </Link>
            </Button>
          </div>

          <GovernanceTokenDetails info={proposal} />

          <div className='grid grid-cols-1 md:grid-cols-3 gap-4 text-sm'>
            <div>
              <p className='text-muted-foreground mb-1'>Proposed by</p>
              <p className='break-all font-mono font-medium'>
                {proposal.authorName || proposal.authorAddress}
              </p>
            </div>
            <div>
              <p className='text-muted-foreground mb-1'>Total Votes</p>
              <p className='font-medium'>
                {proposal.totalVotes.toLocaleString()}
              </p>
            </div>
            <div>
              <p className='text-muted-foreground mb-1'>Ends on</p>
              <p className='font-medium'>{proposal.endDate}</p>
            </div>
          </div>

          <div className='space-y-3'>
            <div className='space-y-2'>
              <div className='flex items-center justify-between text-sm'>
                <div className='flex items-center gap-2'>
                  <ThumbsUp className='w-4 h-4 text-green-500' />
                  <span className='text-muted-foreground'>For</span>
                </div>
                <div className='flex items-center gap-3'>
                  <span className='font-medium'>
                    {proposal.votesFor.toLocaleString()}
                  </span>
                  <span className='text-green-500 font-bold'>
                    {proposal.forPercentage.toFixed(1)}%
                  </span>
                </div>
              </div>
              <Progress
                value={proposal.forPercentage}
                className='h-2 bg-secondary'
                indicatorClassName='bg-green-500'
              />
            </div>

            <div className='space-y-2'>
              <div className='flex items-center justify-between text-sm'>
                <div className='flex items-center gap-2'>
                  <ThumbsDown className='w-4 h-4 text-red-500' />
                  <span className='text-muted-foreground'>Against</span>
                </div>
                <div className='flex items-center gap-3'>
                  <span className='font-medium'>
                    {proposal.votesAgainst.toLocaleString()}
                  </span>
                  <span className='text-red-500 font-bold'>
                    {proposal.againstPercentage.toFixed(1)}%
                  </span>
                </div>
              </div>
              <Progress
                value={proposal.againstPercentage}
                className='h-2 bg-secondary'
                indicatorClassName='bg-red-500'
              />
            </div>
          </div>

          {actionBar}
        </div>
      </Card>
    </motion.div>
  );
}
