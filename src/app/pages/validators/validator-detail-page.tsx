import { motion } from 'motion/react';
import { useMemo } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { useWallet } from '../../providers/wallet-provider';
import { useApiService } from '@/app/hooks/use-app-apis';
import { useFetchData } from '@/app/hooks/use-fetch-data';
import { formatAmount, shortAddress } from '@/app/lib/format';

function toPct(value: string | number | undefined) {
  const num = Number(value ?? 0);
  return `${(Number.isFinite(num) ? num : 0).toFixed(2)}%`;
}

export default function ValidatorDetailPage() {
  const { validatorId = '' } = useParams();
  const { currentNetwork } = useWallet();
  const apiService = useApiService();
  const targetChainId = currentNetwork.chainId;

  const { rawData: detail } = useFetchData({
    queryKey: ['staking-validator-detail', currentNetwork.key, validatorId],
    queryFn: (params) => apiService.stakingValidatorDetail(validatorId, params),
    params: { chainId: targetChainId },
    enabled: Boolean(validatorId),
  });

  const stats = useMemo(
    () => [
      { label: 'APY', value: toPct(detail?.apyPct) },
      { label: 'Commission', value: toPct(detail?.commissionRatePct) },
      { label: 'Uptime', value: toPct(detail?.uptimePct) },
      { label: 'Performance', value: toPct(detail?.performancePct) },
      {
        label: 'Total Delegated',
        value: `${formatAmount(detail?.totalStaked ?? '0', 2)} ${detail?.totalStakedCurrency ?? 'OHI'}`,
      },
      { label: 'Delegators', value: String(detail?.delegatorCount ?? 0) },
    ],
    [detail],
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className='space-y-8'>
      <Link
        to='/validators'
        className='inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground'>
        <ArrowLeft className='h-4 w-4' />
        Back to Validators
      </Link>

      <div className='space-y-2'>
        <h1 className='text-2xl font-bold sm:text-3xl md:text-4xl'>
          {detail?.name || 'Validator'}
        </h1>
        <p className='font-mono text-sm text-muted-foreground'>
          {detail?.address ? shortAddress(detail.address) : '--'}
        </p>
        {detail?.description ? (
          <p className='text-sm text-muted-foreground'>{detail.description}</p>
        ) : null}
      </div>

      <div className='grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3'>
        {stats.map((stat) => (
          <Card
            key={stat.label}
            className='border-border/50 bg-card p-4 sm:p-6'>
            <p className='mb-2 text-xs text-muted-foreground sm:text-sm'>
              {stat.label}
            </p>
            <p className='text-xl font-bold sm:text-2xl'>{stat.value}</p>
          </Card>
        ))}
      </div>

      {detail?.supportedStakeTokens?.length ? (
        <div>
          <h2 className='mb-4 text-lg font-bold'>Supported Delegate Tokens</h2>
          <div className='flex flex-wrap gap-2'>
            {detail.supportedStakeTokens.map((token) => (
              <span
                key={token.tokenId}
                className='rounded-md border border-border/50 bg-card px-3 py-1.5 text-sm'>
                {token.symbol}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </motion.div>
  );
}
