import { Clock, Gift, Lock, Vote, type LucideIcon } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { OPENHIVE_TOKENOMICS } from '../../data/openhive-parameters';
import { formatVotingPower } from './utils';

export function LockFormCard({
  lockAmount,
  lockVotingPower,
  availableBalance,
  tokenSymbol,
  onAmountChange,
  onOpenConfirm,
}: {
  lockAmount: string;
  lockVotingPower: number;
  availableBalance: string;
  tokenSymbol: string;
  onAmountChange: (value: string) => void;
  onOpenConfirm: () => void;
}) {
  const parsedLockAmount = Number(lockAmount || 0);
  const minLockAmount = OPENHIVE_TOKENOMICS.OHI_MIN_LOCK_AMOUNT;
  const canSubmit = Boolean(lockAmount && parsedLockAmount >= minLockAmount);

  return (
    <Card className='border-border/50 bg-card p-6 lg:col-span-2'>
      <div className='space-y-6'>
        <div>
          <label className='mb-2 block text-sm text-muted-foreground'>
            Amount to Lock
          </label>
          <Input
            type='number'
            placeholder='0.00'
            min={minLockAmount}
            value={lockAmount}
            onChange={(event) => onAmountChange(event.target.value)}
            className='h-14 border-border/30 bg-secondary/30 text-2xl'
          />
          <div className='mt-2 flex items-center justify-between text-sm'>
            <span className='text-muted-foreground'>Available Balance</span>
            <span className='font-medium'>{availableBalance}</span>
          </div>
          <p className='mt-1 text-xs text-muted-foreground'>
            Minimum lock: {minLockAmount} {tokenSymbol}. There is no maximum
            lock cap.
          </p>
        </div>

        <div className='grid gap-3 sm:grid-cols-3'>
          <LockRuleItem
            icon={Clock}
            label='Unlock Rule'
            value={`After ${OPENHIVE_TOKENOMICS.MIN_UNLOCK_DAYS} day`}
          />
          <LockRuleItem icon={Vote} label='Voting Power' value='1:1 OHI' />
          <LockRuleItem icon={Gift} label='Rewards' value='Treasury claim' />
        </div>

        {lockAmount ? (
          <div className='rounded-lg border border-primary/20 bg-primary/10 p-4'>
            <h4 className='mb-3 text-sm font-medium'>Lock Summary</h4>
            <div className='space-y-2 text-sm'>
              <div className='flex justify-between'>
                <span className='text-muted-foreground'>Lock Amount</span>
                <span className='font-medium'>
                  {lockAmount} {tokenSymbol}
                </span>
              </div>
              <div className='flex justify-between'>
                <span className='text-muted-foreground'>Lock Duration</span>
                <span className='font-medium'>Open-ended</span>
              </div>
              <div className='flex justify-between'>
                <span className='text-muted-foreground'>Unlock Available</span>
                <span className='font-medium'>
                  After {OPENHIVE_TOKENOMICS.MIN_UNLOCK_DAYS} day
                </span>
              </div>
              <div className='flex justify-between'>
                <span className='text-muted-foreground'>Reward Source</span>
                <span className='font-medium text-green-500'>Treasury</span>
              </div>
              <div className='flex justify-between border-t border-border/30 pt-2'>
                <span className='text-muted-foreground'>
                  Total Voting Power
                </span>
                <span className='text-base font-bold text-primary'>
                  {formatVotingPower(lockVotingPower)}
                </span>
              </div>
            </div>
          </div>
        ) : null}

        <Button
          className='h-12 w-full bg-primary hover:bg-primary/90'
          disabled={!canSubmit}
          onClick={onOpenConfirm}>
          <Lock className='mr-2 h-4 w-4' />
          Lock {tokenSymbol} Tokens
        </Button>
      </div>
    </Card>
  );
}

function LockRuleItem({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className='rounded-lg border border-border/30 bg-secondary/20 p-3'>
      <Icon className='mb-2 h-4 w-4 text-primary' />
      <p className='text-xs text-muted-foreground'>{label}</p>
      <p className='mt-1 text-sm font-medium'>{value}</p>
    </div>
  );
}
