import { motion } from 'motion/react';
import { useMemo } from 'react';
import { ConnectWalletPrompt } from '../../components/connect-wallet-prompt';
import { Card } from '../../components/ui/card';
import { useWallet } from '../../providers/wallet-provider';
import { useApiService } from '@/app/hooks/use-app-apis';
import { useFetchData } from '@/app/hooks/use-fetch-data';
import { shortAddress } from '@/app/lib/format';
import {
  normalizeDelegateHistory,
  normalizeDelegatePositions,
  normalizeDelegateSummary,
} from './utils';

export default function DelegatePage() {
  const { connected, address, currentNetwork } = useWallet();
  const apiService = useApiService();

  const targetChainId = currentNetwork.chainId;
  const userQueryEnabled = connected && Boolean(address) && address !== '0x';

  const { rawData: positionsData } = useFetchData({
    queryKey: ['delegate-positions', currentNetwork.key, targetChainId, address],
    queryFn: (params) => apiService.delegatePositions(params),
    autoRefresh: 15_000,
    params: { chainId: targetChainId, address, pageNum: 1, pageSize: 50 },
    enabled: userQueryEnabled,
  });

  const { rawData: historyData } = useFetchData({
    queryKey: ['delegate-history', currentNetwork.key, targetChainId, address],
    queryFn: (params) => apiService.delegateHistory(params),
    params: { chainId: targetChainId, address, pageNum: 1, pageSize: 20 },
    enabled: userQueryEnabled,
  });

  const summaryStats = useMemo(
    () => normalizeDelegateSummary(positionsData?.summary),
    [positionsData],
  );
  const positions = useMemo(
    () => normalizeDelegatePositions(positionsData?.list),
    [positionsData],
  );
  const history = useMemo(
    () => normalizeDelegateHistory(historyData?.list),
    [historyData],
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className='space-y-8'>
      <div className='space-y-2'>
        <h1 className='bg-gradient-to-r from-white via-purple-200 to-primary bg-clip-text text-2xl font-bold text-transparent sm:text-3xl md:text-4xl'>
          Delegations
        </h1>
        <p className='text-sm text-muted-foreground sm:text-base md:text-lg'>
          Track your delegated positions, rewards, and delegation history.
        </p>
      </div>

      {!connected ? (
        <ConnectWalletPrompt
          variant='inline'
          message='Connect your wallet to view your delegation positions.'
        />
      ) : (
        <>
          <div className='grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-4'>
            {summaryStats.map((stat) => (
              <Card
                key={stat.label}
                className='border-border/50 bg-card p-4 sm:p-6'>
                <p className='mb-2 text-xs text-muted-foreground sm:text-sm'>
                  {stat.label}
                </p>
                <p className='text-xl font-bold sm:text-2xl'>
                  {stat.value}
                  {stat.suffix ? (
                    <span className='ml-1 text-sm text-muted-foreground'>
                      {stat.suffix}
                    </span>
                  ) : null}
                </p>
              </Card>
            ))}
          </div>

          <div>
            <h2 className='mb-4 text-lg font-bold'>Active Positions</h2>
            {positions.length ? (
              <div className='space-y-3'>
                {positions.map((position) => (
                  <Card
                    key={position.positionId}
                    className='border-border/50 bg-card p-4 sm:p-6'>
                    <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
                      <div>
                        <p className='font-bold'>{position.validatorName}</p>
                        <p className='text-xs text-muted-foreground'>
                          {shortAddress(position.validatorAddress)}
                        </p>
                      </div>
                      <div className='grid grid-cols-2 gap-4 text-sm sm:grid-cols-4 sm:text-right'>
                        <div>
                          <p className='text-muted-foreground'>Amount</p>
                          <p className='font-medium'>
                            {position.amount} {position.tokenSymbol}
                          </p>
                        </div>
                        <div>
                          <p className='text-muted-foreground'>Rewards</p>
                          <p className='font-medium text-green-500'>
                            {position.rewardAmount} {position.rewardSymbol}
                          </p>
                        </div>
                        <div>
                          <p className='text-muted-foreground'>APY</p>
                          <p className='font-medium'>{position.apy}</p>
                        </div>
                        <div>
                          <p className='text-muted-foreground'>Delegated</p>
                          <p className='font-medium'>{position.delegatedAt}</p>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className='border-border/50 bg-card p-6'>
                <p className='text-sm text-muted-foreground'>
                  No active delegation positions yet.
                </p>
              </Card>
            )}
          </div>

          <div>
            <h2 className='mb-4 text-lg font-bold'>Delegation History</h2>
            {history.length ? (
              <div className='space-y-2'>
                {history.map((item) => (
                  <Card
                    key={item.id}
                    className='flex flex-col gap-2 border-border/50 bg-card p-4 sm:flex-row sm:items-center sm:justify-between'>
                    <div className='flex items-center gap-3'>
                      <span
                        className={`rounded-md px-2 py-1 text-xs font-medium ${
                          item.typeLabel === 'Undelegate'
                            ? 'bg-red-500/15 text-red-500'
                            : 'bg-primary/15 text-primary'
                        }`}>
                        {item.typeLabel}
                      </span>
                      <span className='text-sm'>{item.validatorName}</span>
                    </div>
                    <div className='flex items-center gap-4 text-sm text-muted-foreground'>
                      <span className='font-medium text-foreground'>
                        {item.amount}
                      </span>
                      <span className='font-mono'>
                        {shortAddress(item.hash)}
                      </span>
                      <span>{item.timestamp}</span>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className='border-border/50 bg-card p-6'>
                <p className='text-sm text-muted-foreground'>
                  No delegation history yet.
                </p>
              </Card>
            )}
          </div>
        </>
      )}
    </motion.div>
  );
}
