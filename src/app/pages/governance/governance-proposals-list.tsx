import { FileQuestion } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { GovernanceProposalCard } from './governance-proposal-card';
import type { NormalizedProposal } from './utils';

export function GovernanceProposalsList({
  proposals,
  connected,
  onVote,
}: {
  proposals: NormalizedProposal[];
  connected: boolean;
  onVote: (proposalId: string, type: 'for' | 'against') => void;
}) {
  if (proposals.length === 0) {
    return (
      <Card className="p-6 bg-card border-border/50">
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="p-3 rounded-full bg-primary/10 mb-4">
            <FileQuestion className="w-6 h-6 text-primary" />
          </div>
          <p className="text-sm font-medium">No proposals found</p>
          <p className="text-xs text-muted-foreground mt-1">
            There are no governance proposals to display at the moment.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {proposals.map((proposal, index) => (
        <GovernanceProposalCard
          key={proposal.id}
          proposal={proposal}
          index={index}
          connected={connected}
          onVote={onVote}
        />
      ))}
    </div>
  );
}
