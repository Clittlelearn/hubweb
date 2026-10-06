import { motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { ConnectWalletPrompt } from '../../components/connect-wallet-prompt';
import { TransactionModal } from '../../components/transaction-modal';
import { Card } from '../../components/ui/card';
import { useWallet } from '../../providers/wallet-provider';
import { useApiService, useRpcService } from '@/app/hooks/use-app-apis';
import { useFetchData } from '@/app/hooks/use-fetch-data';
import { formatAmount, shortAddress } from '@/app/lib/format';
import { ValidatorsList } from './validators-list';
import { ValidatorsMyDelegatePanel } from './validators-my-delegate-panel';
import { ValidatorsDelegateSection } from './validators-delegate-section';
import { ValidatorsStatsGrid } from './validators-stats-grid';
import { useValidatorsPageState } from './use-validators-page-state';
import {
  generateDelegateValidators,
  generateDelegateRecords,
  generateDelegateRewardRecords,
  generateDelegateTokens,
  generateTopValidators,
  generateValidatorsStats,
  getLatestRewardClaimDate,
} from './utils';
import { ethers } from 'ethers';
import { OPENHIVE_ASSET_DECIMALS } from '@/app/constants/assets';

export default function ValidatorsPage() {
  const { connected, currentNetwork, address } = useWallet();
  const apiService = useApiService();
  const rpcService = useRpcService();
  const [selectedValidatorId, setSelectedValidatorId] = useState<number | null>(
    null,
  );

  const targetChainId = useMemo(() => currentNetwork.chainId, [currentNetwork]);
  const userQueryEnabled = connected && Boolean(address) && address !== '0x';
  const { rawData: delegatePageData } = useFetchData({
    queryKey: ['delegate-page', currentNetwork.key, targetChainId, address],
    queryFn: (params) => apiService.delegatePage(params),
    params: {
      chainId: targetChainId,
      address,
    },
    enabled: true,
  });

  const { rawData: delegateValidatorsData } = useFetchData({
    queryKey: ['delegate-validators', currentNetwork.key, targetChainId],
    queryFn: (params) => apiService.delegateValidators(params),
    params: {
      chainId: targetChainId,
      status: 'all' as const,
      pageNum: 1,
      pageSize: 50,
    },
    enabled: true,
  });

  const { rawData: positionsData } = useFetchData({
    queryKey: [
      'delegate-positions',
      currentNetwork.key,
      targetChainId,
      address,
    ],
    queryFn: (params) => apiService.delegatePositions(params),
    autoRefresh: 15_000,
    params: {
      chainId: targetChainId,
      address,
      pageNum: 1,
      pageSize: 50,
    },
    enabled: userQueryEnabled,
  });

  const { rawData: rewardsHistoryData } = useFetchData({
    queryKey: ['delegate-rewards', currentNetwork.key, targetChainId, address],
    queryFn: (params) => apiService.delegateRewards(params),
    params: {
      chainId: targetChainId,
      address,
      pageNum: 1,
      pageSize: 20,
    },
    enabled: userQueryEnabled,
  });

  const { rawData: bonusRewardsData } = useFetchData({
    queryKey: [
      'bouns-claimable-rewards',
      currentNetwork.key,
      targetChainId,
      address,
    ],
    queryFn: (params) => rpcService.getBonusClaimableAmount(params.address),
    params: {
      address,
    },
    enabled: userQueryEnabled,
  });

  const tokenDecimals = useMemo(() => {
    const symbol = delegatePageData?.networkStats?.totalDelegatedSymbol;
    const token = delegatePageData?.delegateTokens?.find(
      (item) => item.symbol === symbol,
    );
    return token?.decimals ?? OPENHIVE_ASSET_DECIMALS;
  }, [delegatePageData]);

  const topValidators = useMemo(
    () => generateTopValidators(delegatePageData?.topValidators, tokenDecimals),
    [delegatePageData, tokenDecimals],
  );

  const displayValidators = useMemo(() => {
    const mapped = generateDelegateValidators(
      delegateValidatorsData?.list,
      tokenDecimals,
    );
    return mapped.length ? mapped : topValidators;
  }, [delegateValidatorsData, topValidators, tokenDecimals]);

  const displayStats = useMemo(() => {
    return generateValidatorsStats(
      delegatePageData?.networkStats,
      delegatePageData?.topValidators,
      tokenDecimals,
    );
  }, [delegatePageData, tokenDecimals]);

  const availableTokens = useMemo(() => {
    return generateDelegateTokens(delegatePageData?.delegateTokens, address);
  }, [delegatePageData, address]);

  const positions = useMemo(() => {
    return generateDelegateRecords(positionsData?.list);
  }, [positionsData]);

  const rewardsCount =
    rewardsHistoryData?.total ?? rewardsHistoryData?.list?.length ?? 0;
  const latestRewardClaimAt = useMemo(() => {
    return getLatestRewardClaimDate(rewardsHistoryData?.list);
  }, [rewardsHistoryData]);
  const rewardRecords = useMemo(() => {
    return generateDelegateRewardRecords(rewardsHistoryData?.list);
  }, [rewardsHistoryData]);

  const rewardAssetType = useMemo(() => {
    const rewardRecord = rewardsHistoryData?.list?.find(
      (item) => item.rewardToken?.assetType || item.claimToken?.assetType,
    );
    const historyRewardAssetType =
      rewardRecord?.rewardToken?.assetType ||
      rewardRecord?.claimToken?.assetType;
    return (
      historyRewardAssetType ||
      positionsData?.list?.find((item) => item.delegateToken?.assetType)
        ?.delegateToken?.assetType ||
      ''
    );
  }, [rewardsHistoryData, positionsData]);

  const rewardsAmount = useMemo(() => {
    if (!bonusRewardsData?.info) {
      return '0';
    }
    const claimable = bonusRewardsData?.info?.total_claimable_amount;
    if (!claimable) {
      return '0';
    }
    const val = ethers.formatUnits(
      claimable,
      currentNetwork.nativeCurrency.decimals,
    );

    return val;
  }, [bonusRewardsData]);

  const totalRewardAmount = useMemo(() => {
    const totalRewards = delegatePageData?.userSummary?.totalRewards;
    if (!totalRewards) {
      return '0';
    }
    const val = ethers.formatUnits(
      totalRewards,
      currentNetwork.nativeCurrency.decimals,
    );

    return val;
  }, [delegatePageData]);
  const rewardsSymbol = delegatePageData?.userSummary?.totalRewardsSymbol;

  const currentDelegate = useMemo(() => {
    if (!positions.length) {
      return null;
    }
    return {
      ...positions[0],
      rewardsCount,
      latestRewardClaimAt,
    };
  }, [positions, rewardsCount, latestRewardClaimAt]);

  // The delegated-tokens endpoint is a list of wallet assets, not a list of
  // delegate positions. Only an actual position may disable new investments.
  const hasDelegate = Boolean(currentDelegate);
  const validatorsState = useValidatorsPageState({
    availableTokens,
    currentDelegate,
    onSelectValidator: setSelectedValidatorId,
    rewardAssetType,
    selectedValidatorId,
    validators: displayValidators,
  });

  const handleSelectValidatorFromList = (validatorId: number) => {
    if (hasDelegate) {
      return;
    }

    setSelectedValidatorId(validatorId);

    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className='space-y-8'>
      <div className='space-y-2'>
        <h1 className='bg-gradient-to-r from-white via-purple-200 to-primary bg-clip-text text-2xl font-bold text-transparent sm:text-3xl md:text-4xl'>
          Validators & Delegation
        </h1>
        <p className='text-sm text-muted-foreground sm:text-base md:text-lg'>
          Invest Flow tokens into validators and manage your active delegation.
        </p>
      </div>

      <ValidatorsStatsGrid stats={displayStats} />

      {!connected ? (
        <ConnectWalletPrompt
          variant='inline'
          message='Connect your wallet to invest Flow tokens and view your validator delegation.'
        />
      ) : currentDelegate ? (
        <ValidatorsMyDelegatePanel
          delegate={currentDelegate}
          onUndelegate={validatorsState.openUndelegateModal}
          onClaimRewards={validatorsState.openClaimModal}
          rewardsAmount={rewardsAmount}
          rewardsSymbol={rewardsSymbol}
          rewardRecords={rewardRecords}
          totalRewardAmount={totalRewardAmount}
          isCanClaim={Boolean(Number(rewardsAmount))}
        />
      ) : hasDelegate ? (
        <Card className='border-border/50 bg-card p-6'>
          <p className='text-sm text-muted-foreground'>
            Delegate positions were detected, but detailed position data is not
            available yet. Please try again later.
          </p>
        </Card>
      ) : (
        <ValidatorsDelegateSection
          validators={displayValidators}
          availableTokens={availableTokens}
          selectedValidatorId={selectedValidatorId}
          selectedTokenKey={validatorsState.selectedTokenKey}
          selectedToken={validatorsState.selectedToken}
          selectedValidator={validatorsState.selectedValidator}
          delegateAmount={validatorsState.delegateAmount}
          delegateError={validatorsState.delegateError}
          isDelegateModalOpen={validatorsState.isDelegateModalOpen}
          onCloseDelegateModal={validatorsState.closeDelegateModal}
          onConfirmDelegate={validatorsState.confirmDelegate}
          onOpenDelegate={validatorsState.openDelegateModal}
          onSelectToken={validatorsState.setSelectedTokenKey}
          onSelectValidator={validatorsState.setSelectedValidatorId}
          onDelegateAmountChange={validatorsState.setDelegateAmount}
          getTokenKey={validatorsState.getTokenKey}
        />
      )}

      <ValidatorsList
        validators={displayValidators}
        connected={connected}
        canDelegate={!hasDelegate}
        onSelectValidator={handleSelectValidatorFromList}
      />

      <TransactionModal
        isOpen={validatorsState.isUndelegateModalOpen}
        onClose={validatorsState.closeUndelegateModal}
        title='Undelegate Tokens'
        confirmText='Confirm Undelegate'
        onConfirm={validatorsState.confirmUndelegate}>
        <div className='space-y-4'>
          <div className='flex items-center justify-between'>
            <p className='text-sm text-muted-foreground'>Validator</p>
            <p className='font-medium'>
              {currentDelegate?.validatorName || '-'}
            </p>
          </div>
          <div className='flex items-center justify-between'>
            <p className='text-sm text-muted-foreground'>Delegate Token</p>
            <p className='font-medium'>{currentDelegate?.tokenSymbol || '-'}</p>
          </div>
          <div className='flex items-center justify-between'>
            <p className='text-sm text-muted-foreground'>
              Amount to Undelegate
            </p>
            <p className='font-medium'>
              {currentDelegate?.amount || '0'}{' '}
              {currentDelegate?.tokenSymbol || ''}
            </p>
          </div>
          <div className='flex items-center justify-between'>
            <p className='text-sm text-muted-foreground'>Delegate Tx Hash</p>
            <p className='font-mono text-sm font-medium'>
              {currentDelegate?.txHash
                ? shortAddress(currentDelegate.txHash)
                : '-'}
            </p>
          </div>
          <div className='rounded-lg border border-primary/20 bg-primary/10 p-4'>
            <p className='mb-1 text-sm text-muted-foreground'>Notice</p>
            <p className='text-sm text-foreground'>
              Confirming here will submit an on-chain undelegation transaction
              through your connected wallet.
            </p>
          </div>
        </div>
      </TransactionModal>

      <TransactionModal
        isOpen={validatorsState.isClaimModalOpen}
        onClose={validatorsState.closeClaimModal}
        title='Claim Treasury Rewards'
        confirmText='Confirm Claim'
        onConfirm={validatorsState.confirmClaimRewards}>
        <div className='space-y-4'>
          <div className='flex items-center justify-between'>
            <p className='text-sm text-muted-foreground'>Validator</p>
            <p className='font-medium'>
              {currentDelegate?.validatorName || '-'}
            </p>
          </div>
          <div className='flex items-center justify-between'>
            <p className='text-sm text-muted-foreground'>Rewards</p>
            <p className='font-medium text-green-500'>
              {rewardsAmount || '0'}{' '}
              {rewardsSymbol || currentDelegate?.tokenSymbol || ''}
            </p>
          </div>
          <div className='rounded-lg border border-green-500/20 bg-green-500/10 p-4'>
            <p className='mb-1 text-sm text-muted-foreground'>Notice</p>
            <p className='text-sm text-foreground'>
              Confirming here will submit an on-chain treasury reward claim
              through your connected wallet.
            </p>
          </div>
        </div>
      </TransactionModal>
    </motion.div>
  );
}
