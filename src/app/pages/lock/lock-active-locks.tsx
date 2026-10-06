import { AlertCircle, Clock, Lock, Unlock, Vote } from 'lucide-react';
import { motion } from 'motion/react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { OPENHIVE_TOKENOMICS } from '../../data/openhive-parameters';
import type { ActiveLock } from './utils';

export function LockActiveLocks({
  locks,
  onUnlock,
}: {
  locks: ActiveLock[];
  onUnlock: (lockIndex: number) => void;
}) {
  if (locks.length === 0) {
    return (
      <div>
        <h2 className='mb-6'>Active Locks</h2>
        <Card className='border-border/50 bg-card p-6'>
          <div className='flex flex-col items-center justify-center py-10 text-center'>
            <div className='mb-4 rounded-full bg-primary/10 p-3'>
              <Lock className='h-6 w-6 text-primary' />
            </div>
            <p className='text-sm font-medium'>No active locks</p>
            <p className='mt-1 text-xs text-muted-foreground'>
              Your active OHI locks will appear here after you lock tokens.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <h2 className='mb-6'>Active Locks</h2>
      <div className='space-y-4'>
        {locks.map((lock, index) => (
          <LockPositionCard
            key={lock.id}
            lock={lock}
            index={index}
            onUnlock={onUnlock}
          />
        ))}
      </div>
    </div>
  );
}

function LockPositionCard({
  lock,
  index,
  onUnlock,
}: {
  lock: ActiveLock;
  index: number;
  onUnlock: (lockIndex: number) => void;
}) {
  const isUnlockable = lock.status === 'unlockable';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}>
      <Card
        className={`p-4 sm:p-6 ${
          isUnlockable
            ? 'border-green-500/30 bg-green-500/5'
            : 'border-border/50 bg-card'
        }`}>
        <div className='space-y-4'>
          <div className='flex flex-col justify-between gap-3 sm:flex-row sm:items-start'>
            <div className='min-w-0 flex-1'>
              <div className='mb-2 flex flex-wrap items-center gap-2'>
                <h3 className='text-base font-bold sm:text-xl'>
                  {lock.amount}
                </h3>
                <Badge className='border-primary/30 bg-primary/20 text-primary'>
                  <Vote className='mr-1 h-3 w-3' />
                  Open-ended
                </Badge>
                <Badge className='border-green-500/30 bg-green-500/20 text-green-500'>
                  Treasury Rewards
                </Badge>
                {isUnlockable && (
                  <Badge className='border-yellow-500/30 bg-yellow-500/20 text-yellow-500'>
                    <Unlock className='mr-1 h-3 w-3' />
                    Ready
                  </Badge>
                )}
              </div>
              <p className='text-sm text-muted-foreground'>
                Unlock is available after {OPENHIVE_TOKENOMICS.MIN_UNLOCK_DAYS}{' '}
                day. Keeping it locked keeps voting rights active.
              </p>
            </div>

            {isUnlockable ? (
              <Button
                className='w-full shrink-0 bg-primary hover:bg-primary/90 sm:w-auto'
                onClick={() => onUnlock(index)}>
                <Unlock className='mr-2 h-4 w-4' />
                Unlock
              </Button>
            ) : (
              <Button
                variant='outline'
                className='w-full shrink-0 border-border/30 text-muted-foreground sm:w-auto'
                disabled>
                <Clock className='mr-2 h-4 w-4' />
                Locked
              </Button>
            )}
          </div>

          <div className='grid grid-cols-2 gap-4 text-sm sm:grid-cols-3 md:grid-cols-5'>
            <LockDetail label='Start Date' value={lock.startDate} />
            <LockDetail
              label='Unlock Available'
              value={lock.unlockAvailableAt}
            />
            <LockDetail label='Days Locked' value={lock.daysLocked} />
            <LockDetail
              label='Voting Power'
              value={lock.votingPower}
              valueClassName='text-primary'
            />
            <LockDetail
              label='Rewards Earned'
              value={lock.rewards}
              valueClassName='text-green-500'
            />
          </div>

          {lock.status === 'locked' && (
            <div className='flex items-start gap-2 rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3'>
              <AlertCircle className='mt-0.5 h-4 w-4 flex-shrink-0 text-yellow-500' />
              <p className='text-xs text-muted-foreground'>
                This lock has no fixed end date. It can be unlocked after{' '}
                {OPENHIVE_TOKENOMICS.MIN_UNLOCK_DAYS} day, and treasury rewards
                are claimed separately while the position remains locked.
              </p>
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}

function LockDetail({
  label,
  value,
  valueClassName = '',
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div>
      <p className='mb-1 text-muted-foreground'>{label}</p>
      <p className={`font-medium ${valueClassName}`}>{value}</p>
    </div>
  );
}
