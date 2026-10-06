import { lazy, Suspense, useMemo } from 'react';
import { OpenHiveLogo } from '../../components/openhive-logo';
import { AddNetworkButton } from '../../components/add-network-button';
import { Card } from '../../components/ui/card';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { motion } from 'motion/react';
import { Badge } from '../../components/ui/badge';
import { useWallet } from '../../providers/wallet-provider';
import { useApiService } from '@/app/hooks/use-app-apis';
import { useFetchData } from '@/app/hooks/use-fetch-data';
import { Text } from '@/app/components/ui/text';
import {
  gerneateDashboardPrimaryData,
  gerneateDashboardSecondaryData,
  isPositiveChange,
} from './utils';
const DashboardInsights = lazy(() => import('./dashboard-insights'));

function DashboardInsightsFallback() {
  return (
    <div className='space-y-6'>
      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
        {[0, 1].map((item) => (
          <Card key={item} className='p-6 bg-card border-border/50'>
            <div className='flex items-center justify-between mb-6'>
              <div className='h-6 w-40 rounded bg-secondary/50 animate-pulse' />
              <div className='h-6 w-16 rounded-full bg-secondary/50 animate-pulse' />
            </div>
            <div className='h-[280px] rounded-xl border border-border/30 bg-secondary/20 animate-pulse' />
          </Card>
        ))}
      </div>

      <Card className='p-6 bg-card border-border/50'>
        <div className='flex items-center justify-between mb-6'>
          <div className='h-6 w-44 rounded bg-secondary/50 animate-pulse' />
          <div className='h-5 w-32 rounded bg-secondary/50 animate-pulse' />
        </div>
        <div className='h-[280px] rounded-xl border border-border/30 bg-secondary/20 animate-pulse' />
      </Card>

      <Card className='p-6 bg-card border-border/50'>
        <div className='h-6 w-32 rounded bg-secondary/50 animate-pulse mb-6' />
        <div className='space-y-3'>
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className='h-20 rounded-lg border border-border/30 bg-secondary/20 animate-pulse'
            />
          ))}
        </div>
      </Card>
    </div>
  );
}

export default function DashboardPage() {
  const { currentNetwork } = useWallet();
  const networkName = `${currentNetwork.chainName}`;

  const apiService = useApiService();

  const targetChainId = useMemo(() => currentNetwork.chainId, [currentNetwork]);
  const { rawData, isPending } = useFetchData({
    queryKey: ['dashboard-data', currentNetwork.key, targetChainId],
    queryFn: (params) => apiService.dashboardData(params),
    params: {
      chainId: targetChainId,
    },
    enabled: true,
  });

  const networkStats = useMemo(() => {
    const primaryStats = rawData?.primaryStats;
    return gerneateDashboardPrimaryData(
      primaryStats,
      currentNetwork.nativeCurrency.decimals,
    );
  }, [currentNetwork.nativeCurrency.decimals, rawData]);
  const secondaryStats = useMemo(() => {
    const _secondaryStats = rawData?.secondaryStats;
    return gerneateDashboardSecondaryData(
      _secondaryStats,
      currentNetwork.nativeCurrency.decimals,
    );
  }, [currentNetwork.nativeCurrency.decimals, rawData]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className='space-y-8'>
      {/* Header */}
      <div className='space-y-2'>
        <h1 className='text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-white via-purple-200 to-primary bg-clip-text text-transparent'>
          Dashboard
        </h1>
        <p className='text-muted-foreground text-sm sm:text-base md:text-lg'>
          {networkName} network overview
        </p>
      </div>

      {/* Network Banner */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.05 }}>
        <Card className='p-6 bg-gradient-to-br from-primary/10 to-purple-500/10 border-primary/30'>
          <div className='flex flex-col md:flex-row md:items-center md:justify-between gap-4'>
            <div className='flex items-center gap-4'>
              <div className='p-2 rounded-lg bg-primary/20'>
                <OpenHiveLogo size={32} />
              </div>
              <div>
                <div className='flex items-center gap-2'>
                  <p className='text-sm text-muted-foreground'>Network</p>
                  <AddNetworkButton />
                </div>
                <p className='font-semibold text-lg mt-0.5'>{networkName}</p>
              </div>
            </div>
            <div className='flex items-center gap-6'>
              {isPending ? (
                <></>
              ) : (
                <div className='flex items-center gap-2'>
                  <div
                    className={`w-2 h-2 rounded-full  animate-pulse ${rawData?.network.isOnline ? 'bg-green-500' : 'bg-red-500'}`}
                  />
                  <span
                    className={`text-sm ${rawData?.network.isOnline ? 'text-green-500' : 'text-red-500'}`}>
                    {rawData?.network.isOnline ? 'Online' : 'Offline'}
                  </span>
                </div>
              )}
              <div className='text-right'>
                <p className='text-xs text-muted-foreground'>Block Height</p>
                <p className='font-mono font-medium'>
                  <Text loading={isPending} skeletonWidth={'4rem'}>
                    {rawData?.network.blockHeight || '0'}
                  </Text>
                </p>
              </div>
              <div className='text-right'>
                <p className='text-xs text-muted-foreground'>Epoch</p>
                <p className='font-mono font-medium'>
                  <Text loading={isPending}>
                    {rawData?.network.epoch || '0'}
                  </Text>
                </p>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Primary Stats */}
      <div className='grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6'>
        {networkStats.map((stat, index) => {
          const Icon = stat.icon;
          const isPositive = isPositiveChange(stat.change);
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 + index * 0.08 }}>
              <Card className='p-3 sm:p-6 bg-card border-border/50 hover:border-primary/50 transition-colors'>
                <div className='flex items-start justify-between mb-2 sm:mb-4'>
                  <div className='p-1.5 sm:p-2 rounded-lg bg-primary/10'>
                    <Icon className='w-4 h-4 sm:w-5 sm:h-5 text-primary' />
                  </div>
                  <Badge
                    className={
                      isPositive
                        ? 'bg-green-500/20 text-green-500 border-green-500/30'
                        : 'bg-red-500/20 text-red-500 border-red-500/30'
                    }>
                    {isPositive ? (
                      <TrendingUp className='w-3 h-3 mr-1' />
                    ) : (
                      <TrendingDown className='w-3 h-3 mr-1' />
                    )}
                    <Text loading={isPending}> {stat.change}</Text>
                  </Badge>
                </div>
                <div className='space-y-0.5 sm:space-y-1'>
                  <p className='text-xs sm:text-sm text-muted-foreground'>
                    {stat.label}
                  </p>
                  <p className='text-lg sm:text-2xl font-bold'>{stat.value}</p>
                  <p className='text-[10px] sm:text-xs text-muted-foreground'>
                    {stat.unit}
                  </p>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Secondary Stats */}
      <div className='grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6'>
        {secondaryStats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 + index * 0.08 }}>
              <Card className={`p-3 sm:p-5 ${stat.bg} ${stat.border}`}>
                <div className='flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3'>
                  <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${stat.color}`} />
                  <p className='text-xs sm:text-sm text-muted-foreground'>
                    {stat.label}
                  </p>
                </div>
                <p className={`text-lg sm:text-xl font-bold ${stat.color}`}>
                  <Text loading={isPending}> {stat.value}</Text>
                </p>
                <p className='text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1'>
                  {stat.unit}
                </p>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <Suspense fallback={<DashboardInsightsFallback />}>
        <DashboardInsights
          data={rawData}
          tokenDecimals={currentNetwork.nativeCurrency.decimals}
        />
      </Suspense>
    </motion.div>
  );
}
