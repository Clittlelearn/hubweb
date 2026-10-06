import { Gift } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { OPENHIVE_TOKENOMICS } from '../../data/openhive-parameters';
// import { formatActiveLockCount } from './utils';

export function LockClaimRewardsCard({
  claimableRewards,
  rewardSymbol,
  isCanClaim,
  onClaim,
}: {
  totalRewards: number;
  claimableRewards: string;
  rewardSymbol: string;
  isCanClaim: boolean;
  onClaim: () => void;
}) {
  // if (totalRewards <= 0) {
  //   return null;
  // }

  return (
    <Card className='border-green-500/30 bg-gradient-to-r from-green-500/10 to-emerald-500/10 p-6'>
      <div className='flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center'>
        <div className='flex items-center gap-4'>
          <div className='rounded-lg bg-green-500/20 p-3'>
            <Gift className='h-6 w-6 text-green-500' />
          </div>
          <div>
            <h3 className='mb-1'>Treasury Rewards Available</h3>
            <p className='text-xl font-bold text-green-500 sm:text-2xl'>
              {claimableRewards.toLocaleString()} {rewardSymbol}
            </p>
            {/* <p className='mt-1 text-sm text-muted-foreground'>
              From {formatActiveLockCount(Number(claimableRewards))}
            </p> */}
            <p className='mt-1 text-xs text-muted-foreground'>
              Rewards can be claimed after {OPENHIVE_TOKENOMICS.MIN_CLAIM_HOURS}{' '}
              hours.
            </p>
          </div>
        </div>
        <Button
          className='h-12 w-full bg-green-500 px-8 hover:bg-green-600 sm:w-auto'
          disabled={!isCanClaim}
          onClick={onClaim}>
          <Gift className='mr-2 h-4 w-4' />
          Claim Treasury Rewards
        </Button>
      </div>
    </Card>
  );
}
