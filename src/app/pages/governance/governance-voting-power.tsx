import { Card } from '../../components/ui/card';
import { Text } from '../../components/ui/text';

export function GovernanceVotingPower({
  votingPower,
  votingPowerSymbol,
  votedProposalCount,
  loading,
}: {
  votingPower: string;
  votingPowerSymbol: string;
  votedProposalCount: number;
  loading?: boolean;
}) {
  return (
    <Card className='p-6 bg-gradient-to-br from-primary/10 to-purple-500/10 border-primary/30'>
      <div className='flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4'>
        <div>
          <p className='text-sm text-muted-foreground mb-2'>
            Your Voting Power
          </p>
          <p className='text-2xl sm:text-4xl font-bold text-primary'>
            <Text loading={loading} skeletonWidth='8rem'>
              {Number(votingPower).toLocaleString()} {votingPowerSymbol}
            </Text>
          </p>
          <p className='text-sm text-muted-foreground mt-2'>
            Based on locked OHI voting power
          </p>
        </div>
        <div className='text-right'>
          <div className='p-4 rounded-lg bg-card/50 border border-border/30'>
            <p className='text-sm text-muted-foreground mb-1'>
              Proposals Voted
            </p>
            <p className='text-2xl font-bold'>
              <Text loading={loading} skeletonWidth='3rem'>
                {votedProposalCount}
              </Text>
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}
