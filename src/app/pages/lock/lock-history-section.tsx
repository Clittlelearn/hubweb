import { ArrowDownRight, Unlock } from 'lucide-react';
import { Card } from '../../components/ui/card';
import type { LockRewardHistoryRow, LockUnlockHistoryRow } from './utils';

export function LockRewardsHistorySection({
  items,
}: {
  items: LockRewardHistoryRow[];
}) {
  if (items.length === 0) {
    return (
      <div>
        <h2 className='mb-6'>Rewards Claim History</h2>
        <LockHistoryEmptyState
          icon='rewards'
          title='No rewards claimed'
          description='Reward claim records will appear here after you claim lock rewards.'
        />
      </div>
    );
  }

  return (
    <div>
      <h2 className='mb-6'>Rewards Claim History</h2>
      <Card className='border-border/50 bg-card p-4 sm:p-6'>
        <div className='space-y-3'>
          {items.map((item, index) => (
            <div
              key={item.id || `${item.txHash}-${item.claimDate}-${index}`}
              className='flex flex-col justify-between gap-2 rounded-lg border border-border/30 bg-secondary/30 p-3 sm:flex-row sm:items-center sm:gap-0 sm:p-4'>
              <div className='flex items-center gap-3 sm:gap-4'>
                <div className='rounded-lg bg-green-500/10 p-2'>
                  <ArrowDownRight className='h-4 w-4 text-green-500 sm:h-5 sm:w-5' />
                </div>
                <div>
                  <p className='text-sm font-medium text-green-500 sm:text-base'>
                    +{item.amount}
                  </p>
                  <p className='text-xs text-muted-foreground sm:text-sm'>
                    Claimed on {item.claimDate}
                  </p>
                </div>
              </div>
              <div className='ml-11 text-left sm:ml-0 sm:text-right'>
                <p className='text-sm font-medium sm:text-base'>
                  {item.validator}
                </p>
                <p className='text-xs text-muted-foreground sm:text-sm'>
                  {formatRewardType(item.rewardType)} reward
                </p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

export function LockUnlockHistorySection({
  items,
}: {
  items: LockUnlockHistoryRow[];
}) {
  if (items.length === 0) {
    return (
      <div>
        <h2 className='mb-6'>Unlock History</h2>
        <LockHistoryEmptyState
          icon='unlock'
          title='No unlock history'
          description='Completed unlock records will appear here after tokens are unlocked.'
        />
      </div>
    );
  }

  return (
    <div>
      <h2 className='mb-6'>Unlock History</h2>
      <Card className='border-border/50 bg-card p-4 sm:p-6'>
        <div className='space-y-3'>
          {items.map((item, index) => (
            <div
              key={item.id || `${item.amount}-${item.unlockDate}-${index}`}
              className='flex flex-col justify-between gap-2 rounded-lg border border-border/30 bg-secondary/30 p-3 sm:flex-row sm:items-center sm:gap-0 sm:p-4'>
              <div className='flex items-center gap-3 sm:gap-4'>
                <div className='rounded-lg bg-primary/10 p-2'>
                  <Unlock className='h-4 w-4 text-primary sm:h-5 sm:w-5' />
                </div>
                <div>
                  <p className='text-sm font-medium sm:text-base'>
                    {item.amount}
                  </p>
                  <p className='text-xs text-muted-foreground sm:text-sm'>
                    Unlocked on {item.unlockDate}
                  </p>
                </div>
              </div>
              <div className='ml-11 text-left sm:ml-0 sm:text-right'>
                <p className='text-sm font-medium sm:text-base'>
                  Held {item.holdingDuration}
                </p>
                <p className='text-xs text-green-500 sm:text-sm'>
                  Total Rewards: {item.totalRewards}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function formatRewardType(rewardType: string) {
  return rewardType
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function LockHistoryEmptyState({
  icon,
  title,
  description,
}: {
  icon: 'rewards' | 'unlock';
  title: string;
  description: string;
}) {
  const Icon = icon === 'rewards' ? ArrowDownRight : Unlock;
  const iconClassName = icon === 'rewards' ? 'text-green-500' : 'text-primary';
  const iconBgClassName =
    icon === 'rewards' ? 'bg-green-500/10' : 'bg-primary/10';

  return (
    <Card className='border-border/50 bg-card p-6'>
      <div className='flex flex-col items-center justify-center py-10 text-center'>
        <div className={`mb-4 rounded-full p-3 ${iconBgClassName}`}>
          <Icon className={`h-6 w-6 ${iconClassName}`} />
        </div>
        <p className='text-sm font-medium'>{title}</p>
        <p className='mt-1 text-xs text-muted-foreground'>{description}</p>
      </div>
    </Card>
  );
}
