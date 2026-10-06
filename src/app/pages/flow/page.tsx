import { useMemo } from 'react';
import { motion } from 'motion/react';
import { ethers, type Eip1193Provider } from 'ethers';
import { useConnection } from 'wagmi';
import { useApiService } from '@/app/hooks/use-app-apis';
import { useFetchData } from '@/app/hooks/use-fetch-data';
import { ConnectWalletPrompt } from '../../components/connect-wallet-prompt';
import { useWallet } from '../../providers/wallet-provider';
import { FlowFormCard } from './flow-form-card';
import { FlowRecentHistory } from './flow-recent-history';
import { FlowSidebar } from './flow-sidebar';
import { FlowStatsGrid } from './flow-stats-grid';
import {
  generateFlowStats,
  normalizeFlowAssets,
  normalizeFlowHistory,
} from './utils';

export default function FlowPage() {
  const { connected, address, currentNetwork } = useWallet();
  const connection = useConnection();
  const apiService = useApiService();
  const targetChainId = currentNetwork.chainId;
  const userQueryEnabled = connected && Boolean(address) && address !== '0x';

  const { rawData: flowPageData } = useFetchData({
    queryKey: ['flow-page', currentNetwork.key, targetChainId],
    queryFn: (params) => apiService.flowData(params),
    params: {
      chainId: targetChainId,
    },
    enabled: true,
  });

  const {
    rawData: flowAssetsData,
    isLoading: isFlowAssetsLoading,
    error: flowAssetsError,
  } = useFetchData({
    queryKey: ['flow-assets', currentNetwork.key, targetChainId, address],
    queryFn: async (params) => {
      const data = await apiService.flowAssets(params);
      const injectedProvider = (await connection.connector?.getProvider()) as
        | Eip1193Provider
        | undefined;

      if (!injectedProvider || !ethers.isAddress(params.address)) {
        return data;
      }

      const provider = new ethers.BrowserProvider(injectedProvider);
      const list = await Promise.all(
        data.list.map(async (asset) => {
          if (!ethers.isAddress(asset.contractAddress)) {
            return asset;
          }

          try {
            const contract = new ethers.Contract(
              asset.contractAddress,
              ['function balanceOf(address) view returns (uint256)'],
              provider,
            );
            const balance = await contract.balanceOf(params.address);
            return { ...asset, erc20Balance: balance.toString() };
          } catch {
            return asset;
          }
        }),
      );

      return { ...data, list };
    },
    params: {
      chainId: targetChainId,
      address,
    },
    enabled: userQueryEnabled,
  });

  const { rawData: flowHistoryData } = useFetchData({
    queryKey: ['flow-history', currentNetwork.key, targetChainId, address],
    queryFn: (params) => apiService.flowHistory(params),
    params: {
      chainId: targetChainId,
      address,
      pageNum: 1,
      pageSize: 20,
      direction: 'all',
      status: 'all',
      assetId: '',
    },
    enabled: userQueryEnabled,
  });

  const stats = useMemo(() => {
    return generateFlowStats(
      flowPageData?.stats,
      currentNetwork.nativeCurrency.decimals,
    );
  }, [currentNetwork.nativeCurrency.decimals, flowPageData]);

  const flowAssets = useMemo(() => {
    return normalizeFlowAssets(flowAssetsData?.list);
  }, [flowAssetsData]);

  const recentFlows = useMemo(() => {
    return normalizeFlowHistory(flowHistoryData?.list);
  }, [flowHistoryData]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className='space-y-8'>
      <div className='space-y-2'>
        <h1 className='bg-gradient-to-r from-white via-purple-200 to-primary bg-clip-text text-2xl font-bold text-transparent sm:text-3xl md:text-4xl'>
          Flow
        </h1>
        <p className='text-sm text-muted-foreground sm:text-base md:text-lg'>
          Convert ERC20 tokens to native base layer assets, or withdraw them
          back to ERC20
        </p>
      </div>

      <FlowStatsGrid stats={stats} />

      {!connected ? (
        <ConnectWalletPrompt
          variant='full'
          message='Connect your wallet to convert assets between ERC20 and native base layer tokens.'
        />
      ) : (
        <>
          <div className='grid grid-cols-1 gap-8 lg:grid-cols-5'>
            <FlowFormCard
              assets={flowAssets}
              defaultAssetId={flowAssetsData?.defaultAssetId}
              isAssetsLoading={isFlowAssetsLoading}
              assetsError={flowAssetsError?.message || ''}
            />

            <FlowSidebar />
          </div>

          <FlowRecentHistory flows={recentFlows} />
        </>
      )}
    </motion.div>
  );
}
