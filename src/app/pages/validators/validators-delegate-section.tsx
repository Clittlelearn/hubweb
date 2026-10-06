import { TransactionModal } from '../../components/transaction-modal';
import type { TokenInfo } from '../../types/common';
import { ValidatorsDelegatePanel } from './validators-delegate-panel';
import type { ValidatorListItem } from './validators-types';
import type { GetValidatorTokenKey } from './use-validators-page-state';

interface ValidatorsDelegateSectionProps {
  validators: ValidatorListItem[];
  availableTokens: TokenInfo[];
  selectedValidatorId: number | null;
  selectedTokenKey: string;
  selectedToken: TokenInfo | null;
  selectedValidator: ValidatorListItem | null;
  delegateAmount: string;
  delegateError: string;
  isDelegateModalOpen: boolean;
  onCloseDelegateModal: () => void;
  onConfirmDelegate: () => Promise<void | string | { hash?: string | null }>;
  onOpenDelegate: () => void;
  onSelectToken: (tokenKey: string) => void;
  onSelectValidator: (validatorId: number | null) => void;
  onDelegateAmountChange: (value: string) => void;
  getTokenKey: GetValidatorTokenKey;
}

export function ValidatorsDelegateSection({
  validators,
  availableTokens,
  selectedValidatorId,
  selectedTokenKey,
  selectedToken,
  selectedValidator,
  delegateAmount,
  delegateError,
  isDelegateModalOpen,
  onCloseDelegateModal,
  onConfirmDelegate,
  onOpenDelegate,
  onSelectToken,
  onSelectValidator,
  onDelegateAmountChange,
  getTokenKey,
}: ValidatorsDelegateSectionProps) {
  return (
    <>
      <ValidatorsDelegatePanel
        validators={validators}
        availableTokens={availableTokens}
        selectedValidatorId={selectedValidatorId}
        selectedTokenKey={selectedTokenKey}
        selectedToken={selectedToken}
        selectedValidator={selectedValidator}
        delegateAmount={delegateAmount}
        delegateError={delegateError}
        onSelectValidator={onSelectValidator}
        onSelectToken={onSelectToken}
        onDelegateAmountChange={onDelegateAmountChange}
        onOpenDelegate={onOpenDelegate}
        getTokenKey={getTokenKey}
      />

      <TransactionModal
        isOpen={isDelegateModalOpen}
        onClose={onCloseDelegateModal}
        title='Delegate Tokens'
        confirmText='Confirm Delegate'
        onConfirm={onConfirmDelegate}>
        <div className='space-y-4'>
          <div className='flex items-center justify-between'>
            <p className='text-sm text-muted-foreground'>Validator</p>
            <p className='font-medium'>{selectedValidator?.name || '-'}</p>
          </div>
          <div className='flex items-center justify-between'>
            <p className='text-sm text-muted-foreground'>Delegate Token</p>
            <p className='font-medium'>{selectedToken?.symbol || '-'}</p>
          </div>
          <div className='flex items-center justify-between'>
            <p className='text-sm text-muted-foreground'>Amount to Delegate</p>
            <p className='font-medium'>
              {delegateAmount || '0'} {selectedToken?.symbol || ''}
            </p>
          </div>
          <div className='flex items-center justify-between'>
            <p className='text-sm text-muted-foreground'>Estimated APY</p>
            <p className='font-medium text-green-500'>
              {selectedValidator?.apy || '-'}
            </p>
          </div>
          <div className='rounded-lg border border-primary/20 bg-primary/10 p-4'>
            <p className='mb-1 text-sm text-muted-foreground'>Notice</p>
            <p className='text-sm text-foreground'>
              Confirming here will submit an on-chain delegation transaction
              through your connected wallet.
            </p>
          </div>
        </div>
      </TransactionModal>
    </>
  );
}
