import { TransactionModal } from '../../components/transaction-modal';
import { OPENHIVE_TOKENOMICS } from '../../data/openhive-parameters';
import type { ActiveLock } from './utils';
import {
  formatActiveLockCount,
  formatVotingPower,
} from './utils';

type TransactionConfirmResult = void | string | { hash?: string | null };

export function LockTransactionModals({
  lockAmount,
  selectedLock,
  lockVotingPower,
  totalRewards,
  claimableRewards,
  tokenSymbol,
  rewardSymbol,
  isLockModalOpen,
  isUnlockModalOpen,
  isClaimModalOpen,
  onCloseLock,
  onCloseUnlock,
  onCloseClaim,
  onConfirmLock,
  onConfirmUnlock,
  onConfirmClaim,
}: {
  lockAmount: string;
  selectedLock: ActiveLock | null;
  lockVotingPower: number;
  totalRewards: number;
  claimableRewards: number;
  tokenSymbol: string;
  rewardSymbol: string;
  isLockModalOpen: boolean;
  isUnlockModalOpen: boolean;
  isClaimModalOpen: boolean;
  onCloseLock: () => void;
  onCloseUnlock: () => void;
  onCloseClaim: () => void;
  onConfirmLock: () => Promise<TransactionConfirmResult>;
  onConfirmUnlock: () => Promise<TransactionConfirmResult>;
  onConfirmClaim: () => Promise<TransactionConfirmResult>;
}) {
  return (
    <>
      <TransactionModal
        isOpen={isLockModalOpen}
        onClose={onCloseLock}
        title={`Lock ${tokenSymbol} Tokens`}
        confirmText='Confirm Lock'
        onConfirm={onConfirmLock}>
        <div className='space-y-4'>
          <div className='flex items-center justify-between'>
            <p className='text-sm text-muted-foreground'>Amount to Lock</p>
            <p className='font-medium'>
              {lockAmount} {tokenSymbol}
            </p>
          </div>
          <div className='flex items-center justify-between'>
            <p className='text-sm text-muted-foreground'>Lock Duration</p>
            <p className='font-medium'>Open-ended</p>
          </div>
          <div className='flex items-center justify-between'>
            <p className='text-sm text-muted-foreground'>Unlock Available</p>
            <p className='font-medium'>
              After {OPENHIVE_TOKENOMICS.MIN_UNLOCK_DAYS} day
            </p>
          </div>
          <div className='flex items-center justify-between'>
            <p className='text-sm text-muted-foreground'>Reward Source</p>
            <p className='font-medium text-green-500'>Treasury claim</p>
          </div>
          <div className='rounded-lg border border-primary/20 bg-primary/10 p-4'>
            <p className='mb-1 text-sm text-muted-foreground'>
              Total Voting Power
            </p>
            <p className='text-2xl font-bold text-primary'>
              {formatVotingPower(lockVotingPower)}
            </p>
          </div>
        </div>
      </TransactionModal>

      <TransactionModal
        isOpen={isUnlockModalOpen}
        onClose={onCloseUnlock}
        title='Unlock Tokens'
        confirmText='Confirm Unlock'
        onConfirm={onConfirmUnlock}>
        <div className='space-y-4'>
          {selectedLock && (
            <>
              <div className='flex items-center justify-between'>
                <p className='text-sm text-muted-foreground'>
                  Amount to Unlock
                </p>
                <p className='font-medium'>{selectedLock.amount}</p>
              </div>
              <div className='flex items-center justify-between'>
                <p className='text-sm text-muted-foreground'>Voting Power</p>
                <p className='font-medium text-primary'>
                  {selectedLock.votingPower}
                </p>
              </div>
              <div className='flex items-center justify-between'>
                <p className='text-sm text-muted-foreground'>
                  Claimable Treasury Rewards
                </p>
                <p className='font-medium text-green-500'>
                  {selectedLock.rewards}
                </p>
              </div>
              <div className='rounded-lg border border-green-500/20 bg-green-500/10 p-4'>
                <p className='mb-1 text-sm text-muted-foreground'>
                  Total to Receive
                </p>
                <p className='text-xl font-bold text-green-500'>
                  {selectedLock.amount}
                </p>
                <p className='mt-1 text-xs text-muted-foreground'>
                  Rewards are claimed from the treasury separately.
                </p>
              </div>
            </>
          )}
        </div>
      </TransactionModal>

      <TransactionModal
        isOpen={isClaimModalOpen}
        onClose={onCloseClaim}
        title='Claim Treasury Rewards'
        confirmText='Confirm Claim'
        onConfirm={onConfirmClaim}>
        <div className='space-y-4'>
          <div className='flex items-center justify-between'>
            <p className='text-sm text-muted-foreground'>Total Rewards</p>
            <p className='font-medium text-green-500'>
              {totalRewards.toLocaleString()} {rewardSymbol}
            </p>
          </div>
          <div className='flex items-center justify-between'>
            <p className='text-sm text-muted-foreground'>From Locks</p>
            <p className='font-medium'>
              {formatActiveLockCount(claimableRewards)}
            </p>
          </div>
          <div className='rounded-lg border border-green-500/20 bg-green-500/10 p-4'>
            <p className='mb-1 text-sm text-muted-foreground'>Reward Source</p>
            <p className='text-lg font-bold text-green-500'>Treasury</p>
            <p className='mt-1 text-xs text-muted-foreground'>
              Rewards are not tied to fixed lock periods.
            </p>
          </div>
        </div>
      </TransactionModal>
    </>
  );
}
