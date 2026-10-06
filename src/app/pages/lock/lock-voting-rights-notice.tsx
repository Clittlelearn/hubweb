import { Vote } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Card } from '../../components/ui/card';
import { OPENHIVE_TOKENOMICS } from '../../data/openhive-parameters';

const lockedGasRewardShare = `${OPENHIVE_TOKENOMICS.LOCKED_GAS_REWARD_SHARE_PCT}%`;

export function LockVotingRightsNotice() {
  return (
    <Card className='border-primary/30 bg-gradient-to-br from-primary/10 via-purple-500/10 to-blue-500/10 p-6'>
      <div className='flex items-start gap-4'>
        <div className='rounded-lg bg-primary/20 p-3'>
          <Vote className='h-6 w-6 text-primary' />
        </div>
        <div className='flex-1'>
          <h3 className='mb-2 flex items-center gap-2'>
            <span>Voting Rights Requirement</span>
            <Badge className='border-primary/30 bg-primary/20 text-primary'>
              Important
            </Badge>
          </h3>
          <p className='text-sm text-muted-foreground'>
            Only locked OHI tokens grant voting rights in governance. Lock
            positions are open-ended: they can be unlocked after{' '}
            {OPENHIVE_TOKENOMICS.MIN_UNLOCK_DAYS} day, and rewards are claimed
            from the treasury based on locked OHI share and the{' '}
            {lockedGasRewardShare} locked-account gas reward share. Unlocked
            OHI tokens have{' '}
            <span className='font-medium text-destructive'>
              no voting rights
            </span>
            .
          </p>
        </div>
      </div>
    </Card>
  );
}
