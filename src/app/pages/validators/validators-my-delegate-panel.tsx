import { useMemo, useState } from 'react';
import { ChevronDown, Clock, Gift, Lock, Unlock } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { CopyButton } from '../../components/copy-button';
import { TokenIcon } from '../../components/token-icon';
import { formatAmount, shortAddress } from '../../lib/format';
import type {
  ValidatorDelegateRecord,
  ValidatorRewardRecord,
} from './validators-types';
import { useWallet } from '@/app/providers/wallet-provider';

interface ValidatorsMyDelegatePanelProps {
  delegate: ValidatorDelegateRecord;
  onUndelegate: () => void;
  onClaimRewards: () => void;
  rewardsAmount?: string;
  rewardsSymbol?: string;
  rewardRecords: ValidatorRewardRecord[];
  isCanClaim: boolean;
  totalRewardAmount: string;
}

export function ValidatorsMyDelegatePanel({
  delegate,
  onUndelegate,
  onClaimRewards,
  rewardsAmount,
  rewardsSymbol,
  rewardRecords,
  isCanClaim,
  totalRewardAmount,
}: ValidatorsMyDelegatePanelProps) {
  const [rewardsExpanded, setRewardsExpanded] = useState(false);
  const { address, walletConnected } = useWallet();
  const rewardsRecordCount = delegate.rewardsCount ?? rewardRecords.length;

  const isValidatorOwner = useMemo(() => {
    return delegate.validatorAddress.toLowerCase() === address.toLowerCase();
  }, [delegate, address]);

  return (
    <Card className='border-border/50 bg-card md:p-6 p-4'>
      <div className='mb-6 flex items-center gap-3'>
        <div className='rounded-lg bg-primary/10 p-2'>
          <Lock className='h-5 w-5 text-primary' />
        </div>
        <div>
          <h3>My Delegations</h3>
          <p className='mt-1 text-sm text-muted-foreground'>
            This account currently has one active validator delegation.
          </p>
        </div>
      </div>

      <div className='space-y-6'>
        <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
          <div className='flex items-start gap-4'>
            <TokenIcon
              src={delegate.tokenLogo}
              alt={delegate.tokenName}
              fallback={delegate.tokenSymbol}
              className='h-12 w-12'
            />
            <div>
              <div className='mb-2 flex items-center gap-3'>
                <h3 className='text-xl'>{delegate.validatorName}</h3>
                <Badge className='border-primary/30 bg-primary/20 text-primary'>
                  APY {delegate.apy}
                </Badge>
              </div>
              <div className='flex items-center gap-2'>
                <p className='truncate font-mono text-sm text-muted-foreground'>
                  {shortAddress(delegate.validatorAddress)}
                </p>
                <CopyButton
                  value={delegate.validatorAddress}
                  label='Validator address'
                  className='shrink-0 rounded-md p-1 hover:bg-secondary'
                />
              </div>
            </div>
          </div>
          <div className='rounded-lg border border-primary/20 bg-primary/10 px-4 py-3 text-right'>
            <p className='text-sm text-muted-foreground'>Delegated Token</p>
            <p className='text-lg font-bold text-primary'>
              {delegate.amount} {delegate.tokenSymbol}
            </p>
            <Button
              variant='outline'
              className='mt-3 border-primary/30'
              disabled={!walletConnected || !delegate.canUndelegate}
              onClick={onUndelegate}>
              <Unlock className='h-4 w-4' />
              Undelegate
            </Button>
          </div>
        </div>

        <div className='grid gap-4 md:grid-cols-3'>
          <div className='rounded-lg border border-border/30 bg-secondary/20 p-4'>
            <p className='mb-1 text-sm text-muted-foreground'>Delegate Token</p>
            <p className='font-medium'>{delegate.tokenName}</p>
          </div>
          <div className='rounded-lg border border-border/30 bg-secondary/20 p-4'>
            <p className='mb-1 text-sm text-muted-foreground'>Started At</p>
            <p className='flex items-center gap-2 font-medium'>
              <Clock className='h-4 w-4 text-muted-foreground' />
              {delegate.startedAt}
            </p>
          </div>
          <div className='rounded-lg border border-border/30 bg-secondary/20 p-4'>
            <p className='mb-1 text-sm text-muted-foreground'>
              Delegate Tx Hash
            </p>
            <p className='font-mono font-medium'>
              {shortAddress(delegate.txHash)}
            </p>
          </div>
        </div>

        <div className='flex flex-col gap-4 rounded-lg border border-green-500/30 bg-gradient-to-r from-green-500/10 to-emerald-500/10 p-4 sm:flex-row sm:items-center sm:justify-between'>
          <div className='flex items-center gap-3'>
            <div className='rounded-lg bg-green-500/20 p-2'>
              <Gift className='h-5 w-5 text-green-500' />
            </div>
            <div>
              <p className='text-sm text-muted-foreground'>Treasury Rewards</p>
              <p className='text-lg font-bold text-green-500'>
                {rewardsAmount || '0'} {rewardsSymbol || delegate.tokenSymbol}
              </p>
            </div>
          </div>
          {isValidatorOwner ? (
            <Button
              className='bg-green-500 hover:bg-green-600'
              disabled={!walletConnected || !isCanClaim}
              onClick={onClaimRewards}>
              <Gift className='h-4 w-4' />
              Claim Rewards
            </Button>
          ) : (
            <div className='flex max-w-sm items-start gap-2.5 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2.5'>
              <Lock className='mt-0.5 h-4 w-4 shrink-0 text-amber-400' />
              <div>
                <p className='text-sm font-medium text-amber-300'>
                  Validator owner only
                </p>
                <p className='mt-0.5 text-xs leading-5 text-muted-foreground'>
                  Only the validator owner can initiate a reward claim.
                </p>
              </div>
            </div>
          )}
        </div>

        {rewardRecords.length > 0 ? (
          <div className='overflow-hidden rounded-lg border border-blue-500/20 bg-blue-500/10 text-sm'>
            <button
              type='button'
              className='flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-blue-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50'
              aria-expanded={rewardsExpanded}
              aria-controls='validator-reward-records'
              onClick={() => setRewardsExpanded((expanded) => !expanded)}>
              <span className='min-w-0 flex-1'>
                <span className='block font-medium text-foreground'>
                  Reward History
                </span>
                <span className='mt-1 block text-xs text-muted-foreground'>
                  {rewardsRecordCount}{' '}
                  {rewardsRecordCount === 1 ? 'record' : 'records'}
                  {delegate.latestRewardClaimAt
                    ? ` · Last claimed ${delegate.latestRewardClaimAt}`
                    : ''}
                </span>
              </span>
              <span className='shrink-0 text-right'>
                <span className='block text-xs text-muted-foreground'>
                  Total Rewards
                </span>
                <span className='mt-1 block font-medium text-green-500'>
                  {formatAmount(totalRewardAmount || '0')}&nbsp;
                  {rewardsSymbol || delegate.tokenSymbol}
                </span>
              </span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                  rewardsExpanded ? 'rotate-180' : ''
                }`}
              />
            </button>

            {rewardsExpanded ? (
              <div
                id='validator-reward-records'
                className='space-y-2 border-t border-blue-500/20 p-4'>
                {rewardRecords.map((record) => (
                  <div
                    key={record.id}
                    className='flex flex-col justify-between gap-2 rounded-lg border border-border/30 bg-background/40 p-3 sm:flex-row sm:items-center'>
                    <div>
                      <p className='font-medium text-green-500'>
                        +{record.amount} {record.tokenSymbol}
                      </p>
                      <p className='mt-1 text-xs text-muted-foreground'>
                        Claimed on {record.claimedAt}
                      </p>
                    </div>
                    <div className='sm:text-right'>
                      <p className='font-mono font-medium'>
                        {shortAddress(record.txHash)}
                      </p>
                      <p className='mt-1 text-xs text-muted-foreground'>
                        Claim Tx Hash
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
