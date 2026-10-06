import { useMemo } from 'react';
import { motion } from 'motion/react';
import { useApiService, useRpcService } from '@/app/hooks/use-app-apis';
import { useFetchData } from '@/app/hooks/use-fetch-data';
import { ConnectWalletPrompt } from '../../components/connect-wallet-prompt';
import { useWallet } from '../../providers/wallet-provider';
import { LockActiveLocks } from './lock-active-locks';
import { LockClaimRewardsCard } from './lock-claim-rewards-card';
import {
  LockRewardsHistorySection,
  LockUnlockHistorySection,
} from './lock-history-section';
import { LockStatsGrid } from './lock-stats-grid';
import { LockTokensSection } from './lock-tokens-section';
import { LockTransactionModals } from './lock-transaction-modals';
import { LockVotingRightsNotice } from './lock-voting-rights-notice';
import { useLockPageState } from './use-lock-page-state';
import {
  formatAvailableBalance,
  getLockStats,
  normalizeLockPositions,
  normalizeLockRewardsHistory,
  normalizeLockTotals,
  normalizeLockUnlockHistory,
  normalizeNetworkLockTotals,
  resolveLockSymbols,
} from './utils';
import { ethers } from 'ethers';

export default function LockPage() {
  const { connected, address, currentNetwork } = useWallet();
  const apiService = useApiService();
  const rpcService = useRpcService();
  const targetChainId = currentNetwork.chainId;
  const userQueryEnabled = connected && Boolean(address) && address !== '0x';

  const { rawData: lockPageData } = useFetchData({
    queryKey: ['lock-page', currentNetwork.key, targetChainId],
    queryFn: (params) => apiService.lockData(params),
    params: {
      chainId: targetChainId,
    },
    enabled: true,
  });

  const { rawData: lockUserSummaryData } = useFetchData({
    queryKey: ['lock-user-summary', currentNetwork.key, targetChainId, address],
    queryFn: (params) => apiService.lockUserSummary(params),
    params: {
      chainId: targetChainId,
      address,
    },
    enabled: userQueryEnabled,
  });

  const { rawData: lockPositionsData } = useFetchData({
    queryKey: ['lock-positions', currentNetwork.key, targetChainId, address],
    queryFn: (params) => apiService.lockPositions(params),
    params: {
      chainId: targetChainId,
      address,
    },
    enabled: userQueryEnabled,
  });

  const { rawData: lockRewardsHistoryData } = useFetchData({
    queryKey: [
      'lock-rewards-history',
      currentNetwork.key,
      targetChainId,
      address,
    ],
    queryFn: (params) => apiService.lockRewardsHistory(params),
    params: {
      chainId: targetChainId,
      address,
      pageNum: 1,
      pageSize: 20,
    },
    enabled: userQueryEnabled,
  });

  const { rawData: lockUnlockHistoryData } = useFetchData({
    queryKey: [
      'lock-unlock-history',
      currentNetwork.key,
      targetChainId,
      address,
    ],
    queryFn: (params) => apiService.lockUnlockHistory(params),
    params: {
      chainId: targetChainId,
      address,
      pageNum: 1,
      pageSize: 20,
    },
    enabled: userQueryEnabled,
  });

  const { rawData: fundRewardsData } = useFetchData({
    queryKey: [
      'fund-claimable-rewards',
      currentNetwork.key,
      targetChainId,
      address,
    ],
    queryFn: (params) => rpcService.getFundClaimableAmount(params.address),
    params: {
      address,
    },
    enabled: userQueryEnabled,
  });

  const rewardsAmount = useMemo(() => {
    if (!fundRewardsData?.info) {
      return '0';
    }
    const claimable = fundRewardsData?.info.total_claimable_amount;
    if (!claimable) {
      return '0';
    }
    const val = ethers.formatUnits(
      claimable,
      currentNetwork.nativeCurrency.decimals,
    );

    return val;
  }, [fundRewardsData]);

  const activeLockRows = useMemo(() => {
    return normalizeLockPositions(lockPositionsData?.list);
  }, [lockPositionsData]);

  const rewardHistoryRows = useMemo(() => {
    return normalizeLockRewardsHistory(lockRewardsHistoryData?.list);
  }, [lockRewardsHistoryData]);

  const unlockHistoryRows = useMemo(() => {
    return normalizeLockUnlockHistory(lockUnlockHistoryData?.list);
  }, [lockUnlockHistoryData]);

  const lockAssetDecimals =
    lockUserSummaryData?.lockAsset?.decimals ??
    lockPageData?.lockAsset?.decimals ??
    currentNetwork.nativeCurrency.decimals;

  const userTotals = useMemo(() => {
    return normalizeLockTotals(
      lockUserSummaryData?.userOverview,
      activeLockRows,
      lockAssetDecimals,
    );
  }, [activeLockRows, lockAssetDecimals, lockUserSummaryData]);

  const networkTotals = useMemo(() => {
    return normalizeNetworkLockTotals(
      lockPageData?.networkOverview,
      lockAssetDecimals,
    );
  }, [lockAssetDecimals, lockPageData]);

  const symbols = useMemo(() => {
    return resolveLockSymbols({
      lockPageData,
      lockUserSummaryData,
    });
  }, [lockPageData, lockUserSummaryData]);
  const {
    assetSymbol,
    availableBalanceSymbol,
    lockedSymbol,
    rewardSymbol,
    votingPowerSymbol,
  } = symbols;

  const availableBalance = useMemo(() => {
    return formatAvailableBalance(
      lockUserSummaryData?.userOverview?.availableBalance,
      availableBalanceSymbol,
      lockAssetDecimals,
    );
  }, [availableBalanceSymbol, lockAssetDecimals, lockUserSummaryData]);

  const stats = useMemo(() => {
    const statTotals = connected ? userTotals : networkTotals;

    return getLockStats(statTotals, {
      lockedSymbol,
      votingPowerSymbol,
      rewardSymbol,
      rewardLabel: connected ? 'Claimable Treasury' : 'Treasury Rewards',
    });
  }, [
    connected,
    lockedSymbol,
    rewardSymbol,
    votingPowerSymbol,
    userTotals,
    networkTotals,
  ]);

  const hasExistingLock =
    activeLockRows.length > 0 || userTotals.totalLocked > 0;

  const lockState = useLockPageState(activeLockRows, {
    hasExistingLock,
    lockAsset: lockUserSummaryData?.lockAsset ?? lockPageData?.lockAsset,
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className='space-y-8'>
      <div className='space-y-2'>
        <h1 className='bg-gradient-to-r from-white via-purple-200 to-primary bg-clip-text text-2xl font-bold text-transparent sm:text-3xl md:text-4xl'>
          Lock
        </h1>
        <p className='text-sm text-muted-foreground sm:text-base md:text-lg'>
          Lock OHI tokens without choosing a fixed period, gain voting rights,
          and claim treasury rewards while the position stays locked
        </p>
      </div>

      <LockVotingRightsNotice />

      <LockStatsGrid stats={stats} />

      {!connected ? (
        <ConnectWalletPrompt
          variant='inline'
          message='Connect your wallet to lock OHI tokens, view your locks, and claim rewards.'
        />
      ) : (
        <>
          <LockClaimRewardsCard
            totalRewards={userTotals.totalRewards}
            claimableRewards={rewardsAmount}
            rewardSymbol={rewardSymbol}
            isCanClaim={Boolean(Number(rewardsAmount))}
            onClaim={lockState.openClaimModal}
          />

          {!hasExistingLock ? (
            <LockTokensSection
              lockAmount={lockState.lockAmount}
              lockVotingPower={lockState.lockVotingPower}
              availableBalance={availableBalance}
              tokenSymbol={assetSymbol}
              onAmountChange={lockState.setLockAmount}
              onOpenConfirm={lockState.openLockModal}
            />
          ) : null}

          <LockActiveLocks
            locks={activeLockRows}
            onUnlock={lockState.openUnlockModal}
          />

          <LockRewardsHistorySection items={rewardHistoryRows} />

          <LockUnlockHistorySection items={unlockHistoryRows} />
        </>
      )}

      <LockTransactionModals
        lockAmount={lockState.lockAmount}
        selectedLock={lockState.selectedLock}
        lockVotingPower={lockState.lockVotingPower}
        totalRewards={userTotals.totalRewards}
        claimableRewards={userTotals.claimableRewards}
        tokenSymbol={assetSymbol}
        rewardSymbol={rewardSymbol}
        isLockModalOpen={lockState.isLockModalOpen}
        isUnlockModalOpen={lockState.isUnlockModalOpen}
        isClaimModalOpen={lockState.isClaimModalOpen}
        onCloseLock={lockState.closeLockModal}
        onCloseUnlock={lockState.closeUnlockModal}
        onCloseClaim={lockState.closeClaimModal}
        onConfirmLock={lockState.confirmLock}
        onConfirmUnlock={lockState.confirmUnlock}
        onConfirmClaim={lockState.confirmClaim}
      />
    </motion.div>
  );
}
