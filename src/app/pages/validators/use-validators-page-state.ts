import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ethers } from 'ethers';
import { restoreFormattedAmount } from '@/app/lib/format';
import {
  normalizeOpenHiveError,
  useOpenHiveSdk,
} from '@/app/hooks/use-openhive-sdk';
import { useFeedback } from '@/app/providers/feedback-provider';
import { BONUS_ADDRESS, DELEGAET_ADDRESS } from '@/app/constants/addresses';
import { scheduleTransactionDataRefresh } from '@/app/lib/transaction-refresh';
import { OPENHIVE_VALIDATOR_CONSTRAINTS } from '../../data/openhive-parameters';
import type { TokenInfo } from '../../types/common';
import type {
  ValidatorListItem,
  ValidatorDelegateRecord,
} from './validators-types';

export function getTokenKey(token: TokenInfo) {
  return token.contractAddress || token.assetType || token.symbol;
}

export type GetValidatorTokenKey = typeof getTokenKey;

interface UseValidatorsPageStateOptions {
  availableTokens: TokenInfo[];
  currentDelegate: ValidatorDelegateRecord | null;
  onSelectValidator: (validatorId: number | null) => void;
  rewardAssetType?: string;
  selectedValidatorId: number | null;
  validators: ValidatorListItem[];
}

export function useValidatorsPageState({
  availableTokens,
  currentDelegate,
  onSelectValidator,
  rewardAssetType,
  selectedValidatorId,
  validators,
}: UseValidatorsPageStateOptions) {
  const { address, currentNetwork, getOpenHiveSdk } = useOpenHiveSdk();
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useFeedback();

  const [delegateAmount, setDelegateAmount] = useState('');
  const [selectedTokenKey, setSelectedTokenKey] = useState('');
  const [delegateError, setDelegateError] = useState('');
  const [isDelegateModalOpen, setIsDelegateModalOpen] = useState(false);
  const [isUndelegateModalOpen, setIsUndelegateModalOpen] = useState(false);
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);

  const selectedValidator = useMemo(
    () =>
      validators.find((validator) => validator.id === selectedValidatorId) ??
      null,
    [validators, selectedValidatorId],
  );

  const selectedToken = useMemo(
    () =>
      availableTokens.find(
        (token) => getTokenKey(token) === selectedTokenKey,
      ) ??
      availableTokens[0] ??
      null,
    [availableTokens, selectedTokenKey],
  );

  useEffect(() => {
    if (!availableTokens.length) {
      setSelectedTokenKey('');
      return;
    }

    const hasSelectedToken = availableTokens.some(
      (token) => getTokenKey(token) === selectedTokenKey,
    );

    if (!hasSelectedToken) {
      setSelectedTokenKey(getTokenKey(availableTokens[0]));
    }
  }, [availableTokens, selectedTokenKey]);

  const handleDelegateAmountChange = (value: string) => {
    setDelegateAmount(value);

    if (delegateError) {
      setDelegateError('');
    }
  };

  const handleSelectValidator = (validatorId: number | null) => {
    onSelectValidator(validatorId);

    if (delegateError) {
      setDelegateError('');
    }
  };

  const handleSelectToken = (tokenKey: string) => {
    setSelectedTokenKey(tokenKey);

    if (delegateError) {
      setDelegateError('');
    }
  };

  const openDelegateModal = () => {
    if (!selectedToken) {
      setDelegateError('No flow delegation token is available.');
      return;
    }

    if (!selectedValidator) {
      setDelegateError('Select a validator first.');
      return;
    }

    if (!delegateAmount || parseFloat(delegateAmount) <= 0) {
      setDelegateError('The amount must be greater than 0.');
      return;
    }

    if (
      parseFloat(delegateAmount) <
      OPENHIVE_VALIDATOR_CONSTRAINTS.INVESTOR_MIN_AMOUNT
    ) {
      setDelegateError(
        `Minimum validator investment is ${OPENHIVE_VALIDATOR_CONSTRAINTS.INVESTOR_MIN_AMOUNT.toLocaleString()} tokens.`,
      );
      return;
    }

    if (
      parseFloat(delegateAmount) >
      parseFloat(restoreFormattedAmount(selectedToken.balance || '0'))
    ) {
      setDelegateError('Insufficient balance.');
      return;
    }

    setDelegateError('');
    setIsDelegateModalOpen(true);
  };

  const confirmDelegate = async () => {
    try {
      if (!selectedToken?.assetType) {
        throw new Error('Selected token asset type is missing.');
      }

      if (!selectedValidator?.address) {
        throw new Error('Select a validator first.');
      }

      if (!ethers.isAddress(selectedValidator.address)) {
        throw new Error('Selected validator address is invalid.');
      }

      const openhiveSdk = await getOpenHiveSdk();
      const gasAssetType = currentNetwork.nativeCurrency.symbol;
      const delegateAmountUnits = ethers.parseUnits(
        delegateAmount,
        selectedToken.decimals,
      );

      const response = await openhiveSdk.delegate(
        {
          gas_asset: {
            addr: address,
            asset_type: gasAssetType,
          },
          sponsor_gas: selectedToken.assetType !== gasAssetType,
          asset_type: selectedToken.assetType,
          amount: delegateAmountUnits.toString(),
          delegate_type: '0',
          to_addr: selectedValidator.address
        },
        DELEGAET_ADDRESS,
        address,
      );

      scheduleTransactionDataRefresh(queryClient);
      setDelegateAmount('');
      setDelegateError('');
      showSuccess(
        'Delegate submitted',
        `${delegateAmount} ${selectedToken.symbol} was delegated to ${selectedValidator.name}.`,
      );

      return response.hash;
    } catch (error) {
      const handledError = normalizeOpenHiveError(error);
      setDelegateError(handledError.message);
      showError('Delegate failed', handledError.message);
      throw handledError;
    }
  };

  const openUndelegateModal = () => {
    if (!currentDelegate) {
      showError(
        'Undelegate unavailable',
        'No active delegate position was found.',
      );
      return;
    }

    if (!currentDelegate.canUndelegate) {
      showError(
        'Undelegate unavailable',
        'This delegate position is not available for undelegating yet.',
      );
      return;
    }

    setIsUndelegateModalOpen(true);
  };

  const confirmUndelegate = async () => {
    try {
      if (!currentDelegate) {
        throw new Error('No active delegate position was found.');
      }

      if (!currentDelegate.canUndelegate) {
        throw new Error(
          'This delegate position is not available for undelegating yet.',
        );
      }

      if (!currentDelegate.tokenAssetType) {
        throw new Error('Delegated token asset type is missing.');
      }

      if (!currentDelegate.txHash || currentDelegate.txHash === '--') {
        throw new Error('Delegate transaction hash is missing.');
      }

      if (!ethers.isAddress(currentDelegate.validatorAddress)) {
        throw new Error('Validator address is invalid.');
      }

      const openhiveSdk = await getOpenHiveSdk();
      const gasAssetType = currentNetwork.nativeCurrency.symbol;
      const response = await openhiveSdk.undelegate(
        {
          gas_asset: {
            addr: address,
            asset_type: gasAssetType,
          },
          sponsor_gas: currentDelegate.tokenAssetType !== gasAssetType,
          asset_type: currentDelegate.tokenAssetType,
          utxo_hash: currentDelegate.txHash,
          to_addr: currentDelegate.validatorAddress
        },
        DELEGAET_ADDRESS,
        address,
      );

      scheduleTransactionDataRefresh(queryClient);
      showSuccess(
        'Undelegate submitted',
        `${currentDelegate.amount} ${currentDelegate.tokenSymbol} was undelegated from ${currentDelegate.validatorName}.`,
      );

      return response.hash;
    } catch (error) {
      const handledError = normalizeOpenHiveError(error);
      showError('Undelegate failed', handledError.message);
      throw handledError;
    }
  };

  const confirmClaimRewards = async () => {
    try {
      const claimAssetType =
        rewardAssetType || currentDelegate?.tokenAssetType || '';

      if (!claimAssetType) {
        throw new Error('Reward asset type is missing.');
      }

      const openhiveSdk = await getOpenHiveSdk();
      const response = await openhiveSdk.bonus(
        {
          gas_asset: {
            addr: address,
            asset_type: claimAssetType,
          },
          sponsor_gas: false,
          asset_type: claimAssetType,
          first_choose: false,
        },
        BONUS_ADDRESS,
        address,
      );

      scheduleTransactionDataRefresh(queryClient);
      showSuccess(
        'Rewards claimed',
        'Delegation treasury rewards were claimed.',
      );

      return response.hash;
    } catch (error) {
      const handledError = normalizeOpenHiveError(error);
      showError('Claim failed', handledError.message);
      throw handledError;
    }
  };

  return {
    closeDelegateModal: () => setIsDelegateModalOpen(false),
    closeUndelegateModal: () => setIsUndelegateModalOpen(false),
    closeClaimModal: () => setIsClaimModalOpen(false),
    confirmDelegate,
    confirmUndelegate,
    confirmClaimRewards,
    getTokenKey,
    isDelegateModalOpen,
    isUndelegateModalOpen,
    isClaimModalOpen,
    openDelegateModal,
    openUndelegateModal,
    openClaimModal: () => setIsClaimModalOpen(true),
    selectedToken,
    selectedTokenKey,
    selectedValidator,
    setDelegateAmount: handleDelegateAmountChange,
    setSelectedTokenKey: handleSelectToken,
    setSelectedValidatorId: handleSelectValidator,
    delegateAmount,
    delegateError,
  };
}
