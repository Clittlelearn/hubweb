import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ethers } from 'ethers';
import { getConnectedBrowserProvider } from '@/app/lib/wallet-session';
import { useConnection } from 'wagmi';
import { OpenHiveSdk } from '@openhive/sdk';
import { useFeedback } from '@/app/providers/feedback-provider';
import { useWallet } from '@/app/providers/wallet-provider';
import { WALLET_NETWORK_RECONNECT_MESSAGE } from '@/app/lib/wallet-network';
import { errorHandling } from '@/app/lib/helper';
import { FUND_ADDRESS, LOCK_ADDRESS } from '@/app/constants/addresses';
import { scheduleTransactionDataRefresh } from '@/app/lib/transaction-refresh';
import type { LockAssetInfo } from '@/app/types/api-service/lock';
import type { ActiveLock } from './utils';
import { getVotingPowerAmount } from './utils';

const DEFAULT_LOCK_TYPE = 0;
interface LockPageStateOptions {
  lockAsset?: LockAssetInfo | null;
  hasExistingLock?: boolean;
}


function normalizeError(error: unknown) {
  if (!(error instanceof Error) && (typeof error !== 'object' || !error)) {
    return new Error(String(error || 'Unknown error'));
  }

  try {
    return errorHandling(error);
  } catch (handledError) {
    return handledError instanceof Error
      ? handledError
      : new Error(String(handledError));
  }
}

export function useLockPageState(
  activeLocks: ActiveLock[],
  {
    hasExistingLock: hasExistingLockOption,
    lockAsset,
  }: LockPageStateOptions = {},
) {
  const {
    walletConnected: connected,
    address,
    currentNetwork,
    ensureWalletNetwork,
  } = useWallet();
  const connection = useConnection();
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useFeedback();

  const [lockAmount, setLockAmount] = useState('');
  const [isLockModalOpen, setIsLockModalOpen] = useState(false);
  const [isUnlockModalOpen, setIsUnlockModalOpen] = useState(false);
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
  const [selectedLockIndex, setSelectedLockIndex] = useState<number | null>(
    null,
  );

  const lockAssetType =
    lockAsset?.assetType || currentNetwork.nativeCurrency.symbol;
  const lockAssetDecimals =
    lockAsset?.decimals ?? currentNetwork.nativeCurrency.decimals;
  const hasExistingLock = hasExistingLockOption ?? activeLocks.length > 0;

  const selectedLock = useMemo(() => {
    if (selectedLockIndex === null) {
      return null;
    }

    return activeLocks[selectedLockIndex] ?? null;
  }, [activeLocks, selectedLockIndex]);

  const lockVotingPower = useMemo(() => {
    return getVotingPowerAmount(lockAmount);
  }, [lockAmount]);

  const getOpenHiveSdk = async () => {
    if (!connected || !connection.connector || !address || address === '0x') {
      throw new Error('Wallet is not connected.');
    }

    const switched = await ensureWalletNetwork();

    if (!switched) {
      throw new Error(WALLET_NETWORK_RECONNECT_MESSAGE);
    }

    const provider = await getConnectedBrowserProvider(
      connection.connector,
      currentNetwork.chainId,
      address,
    );

    return OpenHiveSdk.create({
      provider,
      expectedWallet: { account: address, chainId: currentNetwork.chainId, walletName: connection.connector.name },
      rpcUrl: currentNetwork.service.rpcApi || currentNetwork.rpcs[0],
    });
  };

  const handleTransactionError = (title: string, error: unknown) => {
    const handledError = normalizeError(error);
    showError(title, handledError.message);
    throw handledError;
  };

  const resetLockDraft = () => {
    setLockAmount('');
  };

  const openUnlockModal = (lockIndex: number) => {
    setSelectedLockIndex(lockIndex);
    setIsUnlockModalOpen(true);
  };

  const closeUnlockModal = () => {
    setIsUnlockModalOpen(false);
    setSelectedLockIndex(null);
  };

  const openLockModal = () => {
    if (hasExistingLock) {
      showError(
        'Lock unavailable',
        'This wallet already has an active lock. Unlock the existing position before locking again.',
      );
      return;
    }

    setIsLockModalOpen(true);
  };

  const confirmLock = async () => {
    const amount = Number(lockAmount);

    try {
      if (hasExistingLock) {
        throw new Error(
          'This wallet already has an active lock. Unlock the existing position before locking again.',
        );
      }

      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error('Lock amount must be greater than 0.');
      }

      const openhiveSdk = await getOpenHiveSdk();
      const lockAmountUnits = ethers.parseUnits(lockAmount, lockAssetDecimals);

      const response = await openhiveSdk.lock(
        {
          // gas_asset: {
          //   addr: address,
          //   asset_type: lockAssetType,
          // },
          sponsor_gas: false,
          lock_amount: lockAmountUnits.toString(),
          lock_type: DEFAULT_LOCK_TYPE,
        },
        LOCK_ADDRESS,
        address,
      );

      // The backend/indexer may lag briefly behind the submitted transaction.
      scheduleTransactionDataRefresh(queryClient);
      resetLockDraft();
      showSuccess(
        'Lock submitted',
        `${lockAmount} ${lockAsset?.symbol || lockAssetType} was locked successfully.`,
      );

      return response.hash;
    } catch (error) {
      console.log(error);

      handleTransactionError('Lock failed', error);
    }
  };

  const confirmUnlock = async () => {
    try {
      if (!selectedLock?.lockTxHash) {
        throw new Error('Selected lock is missing its lock transaction hash.');
      }

      const openhiveSdk = await getOpenHiveSdk();
      const assetType = selectedLock.lockAssetType || lockAssetType;
      const response = await openhiveSdk.unlock(
        {
          gas_asset: {
            addr: address,
            asset_type: assetType,
          },
          sponsor_gas: false,
          utxo_hash: selectedLock.lockTxHash,
        },
        LOCK_ADDRESS,
        address,
      );

      scheduleTransactionDataRefresh(queryClient);
      setSelectedLockIndex(null);
      showSuccess('Unlock submitted', `${selectedLock.amount} was unlocked.`);

      return response.hash;
    } catch (error) {
      handleTransactionError('Unlock failed', error);
    }
  };

  const confirmClaim = async () => {
    try {
      const openhiveSdk = await getOpenHiveSdk();
      const rewardAssetType =
        activeLocks.find((lock) => lock.rewardAssetType)?.rewardAssetType ||
        lockAssetType;

      const response = await openhiveSdk.fund(
        {
          gas_asset: {
            addr: address,
            asset_type: rewardAssetType,
          },
          sponsor_gas: false,
        },
        FUND_ADDRESS,
        address,
      );

      scheduleTransactionDataRefresh(queryClient);
      showSuccess('Rewards claimed', 'Treasury rewards were claimed.');

      return response.hash;
    } catch (error) {
      handleTransactionError('Claim failed', error);
    }
  };

  return {
    lockAmount,
    selectedLock,
    lockVotingPower,
    hasExistingLock,
    isLockModalOpen,
    isUnlockModalOpen,
    isClaimModalOpen,
    setLockAmount,
    openLockModal,
    closeLockModal: () => setIsLockModalOpen(false),
    openUnlockModal,
    closeUnlockModal,
    openClaimModal: () => setIsClaimModalOpen(true),
    closeClaimModal: () => setIsClaimModalOpen(false),
    confirmLock,
    confirmUnlock,
    confirmClaim,
  };
}
