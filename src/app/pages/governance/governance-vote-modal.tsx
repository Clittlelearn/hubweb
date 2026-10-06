import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { TransactionModal } from '../../components/transaction-modal';
import type { NormalizedProposal } from './utils';

type TransactionConfirmResult = void | string | { hash?: string | null };

export function GovernanceVoteModal({
  isOpen,
  onClose,
  proposal,
  voteType,
  votingPower,
  votingPowerSymbol,
  onConfirm,
}: {
  isOpen: boolean;
  onClose: () => void;
  proposal: NormalizedProposal | null;
  voteType: 'for' | 'against' | null;
  votingPower: string;
  votingPowerSymbol: string;
  onConfirm: () => Promise<TransactionConfirmResult>;
}) {
  if (!proposal || !voteType) return null;

  return (
    <TransactionModal
      isOpen={isOpen}
      onClose={onClose}
      title={
        voteType === 'for' ? 'Vote For Proposal' : 'Vote Against Proposal'
      }
      confirmText={
        voteType === 'for' ? 'Confirm Vote For' : 'Confirm Vote Against'
      }
      onConfirm={onConfirm}
    >
      <div className="space-y-4">
        <div className="p-4 rounded-lg bg-secondary/30 border border-border/30">
          <p className="text-sm font-medium mb-1">{proposal.title}</p>
          <p className="text-xs text-muted-foreground">
            {proposal.description}
          </p>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Your Vote</p>
          <div
            className={`flex items-center gap-2 font-medium ${
              voteType === 'for' ? 'text-green-500' : 'text-red-500'
            }`}
          >
            {voteType === 'for' ? (
              <ThumbsUp className="w-4 h-4" />
            ) : (
              <ThumbsDown className="w-4 h-4" />
            )}
            <span>{voteType === 'for' ? 'For' : 'Against'}</span>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Your Voting Power</p>
          <p className="font-medium">
            {Number(votingPower).toLocaleString()} {votingPowerSymbol}
          </p>
        </div>
        <div
          className={`p-4 rounded-lg border ${
            voteType === 'for'
              ? 'bg-green-500/10 border-green-500/20'
              : 'bg-red-500/10 border-red-500/20'
          }`}
        >
          <p className="text-sm text-muted-foreground mb-1">Proposal Status</p>
          <p className="text-sm font-medium">
            {voteType === 'for'
              ? 'This vote will support the proposal'
              : 'This vote will oppose the proposal'}
          </p>
        </div>
      </div>
    </TransactionModal>
  );
}
