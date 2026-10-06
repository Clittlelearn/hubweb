import { Activity, Layers } from 'lucide-react';
import { motion } from 'motion/react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Badge } from '../../components/ui/badge';
import { Card } from '../../components/ui/card';
import { DashboardDataResult } from '@/app/types/api-service/dashboard';
import { useEffect, useMemo, useState } from 'react';
import {
  formatAmount,
  formatDate,
  shortAddress,
  toUnitsAmount,
} from '@/app/lib/format';

const compactNumberFormatter = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

function toSafeNumber(value: string | number | undefined) {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? num : 0;
}

function formatCompact(value: number) {
  return compactNumberFormatter.format(value);
}

function formatAxisLabel(label: string | number) {
  const raw = String(label ?? '').trim();
  if (!raw) {
    return '';
  }

  const looksLikeDate = /[-/:\sT]/.test(raw);
  const parsed = new Date(raw);
  if (looksLikeDate && !Number.isNaN(parsed.getTime())) {
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${month}/${day}`;
  }

  return raw.length > 8 ? `${raw.slice(0, 8)}…` : raw;
}

function getXAxisInterval(length: number, isMobile: boolean) {
  const maxTicks = isMobile ? 4 : 8;
  if (length <= maxTicks) {
    return 0;
  }
  return Math.ceil(length / maxTicks) - 1;
}

function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const updateIsMobile = () => setIsMobile(mediaQuery.matches);

    updateIsMobile();
    mediaQuery.addEventListener('change', updateIsMobile);

    return () => mediaQuery.removeEventListener('change', updateIsMobile);
  }, [breakpoint]);

  return isMobile;
}

export default function DashboardInsights({
  data,
  tokenDecimals = 18,
}: {
  data: DashboardDataResult | null;
  tokenDecimals?: number;
}) {
  const isMobile = useIsMobile();
  const tvlGradientId = 'tvl-grad-dash';
  const barGradientId = 'bar-grad-dash';
  const stakedGradId = 'staked-grad-dash';
  const unstakedGradId = 'unstaked-grad-dash';
  const chartHeight = isMobile ? 220 : 280;
  const chartMargin = isMobile
    ? { top: 6, right: 2, left: -8, bottom: 0 }
    : { top: 8, right: 12, left: 0, bottom: 0 };

  const tvlData = useMemo(() => {
    const chartData = data?.charts.tvl;
    if (!chartData) {
      return [];
    }
    return chartData.map((item) => ({
      label: item.label,
      valueUsd: toSafeNumber(item.valueUsd),
    }));
  }, [data]);

  const txVolumeData = useMemo(() => {
    const chartData = data?.charts.dailyTransactions;
    if (!chartData) {
      return [];
    }
    return chartData.map((item) => ({
      label: item.label,
      txCount: item.txCount,
    }));
  }, [data]);

  const stakingFlowData = useMemo(() => {
    const chartData = data?.charts.staking;
    if (!chartData) {
      return [];
    }
    return chartData.map((item) => ({
      label: item.label,
      staked: toSafeNumber(toUnitsAmount(item.stakedAmount, tokenDecimals)),
      unstaked: toSafeNumber(toUnitsAmount(item.unstakedAmount, tokenDecimals)),
    }));
  }, [data, tokenDecimals]);

  const recentBlocks = data?.recentBlocks ?? [];
  const latestTvl = tvlData[tvlData.length - 1]?.valueUsd ?? 0;
  const tvlXAxisInterval = getXAxisInterval(tvlData.length, isMobile);
  const txXAxisInterval = getXAxisInterval(txVolumeData.length, isMobile);
  const stakingXAxisInterval = getXAxisInterval(stakingFlowData.length, isMobile);

  return (
    <>
      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}>
          <Card className='p-4 sm:p-6 bg-card border-border/50'>
            <div className='flex items-center justify-between gap-2 mb-4 sm:mb-6'>
              <h3 className='text-sm sm:text-base'>Total Value Locked</h3>
              <Badge className='bg-primary/20 text-primary border-primary/30 text-[10px] sm:text-xs'>
                ${formatCompact(latestTvl)}
              </Badge>
            </div>
            <ResponsiveContainer width='100%' height={chartHeight}>
              <AreaChart data={tvlData} margin={chartMargin}>
                <defs>
                  <linearGradient
                    id={tvlGradientId}
                    x1='0'
                    y1='0'
                    x2='0'
                    y2='1'>
                    <stop offset='5%' stopColor='#6366f1' stopOpacity={0.3} />
                    <stop offset='95%' stopColor='#6366f1' stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray='3 3'
                  stroke='rgba(99,102,241,0.1)'
                />
                <XAxis
                  dataKey='label'
                  stroke='#9ca3af'
                  tick={{ fontSize: isMobile ? 10 : 12 }}
                  tickFormatter={formatAxisLabel}
                  interval={tvlXAxisInterval}
                  minTickGap={isMobile ? 24 : 18}
                  tickMargin={8}
                  height={isMobile ? 42 : 30}
                />
                <YAxis
                  hide={isMobile}
                  stroke='#9ca3af'
                  tickFormatter={(v: number) => `$${formatCompact(v)}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#13141f',
                    border: '1px solid rgba(99,102,241,0.2)',
                    borderRadius: '8px',
                    fontSize: isMobile ? '11px' : '12px',
                  }}
                  allowEscapeViewBox={{ x: true, y: true }}
                  formatter={(value: number | string) => {
                    const numericValue = toSafeNumber(value);
                    return [`$${formatAmount(String(numericValue), 2)}`, 'TVL'];
                  }}
                />
                <Area
                  type='monotone'
                  dataKey='valueUsd'
                  stroke='#6366f1'
                  fillOpacity={1}
                  fill={`url(#${tvlGradientId})`}
                  strokeWidth={2}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}>
          <Card className='p-4 sm:p-6 bg-card border-border/50'>
            <div className='flex items-center justify-between gap-2 mb-4 sm:mb-6'>
              <h3 className='text-sm sm:text-base'>Daily Transactions</h3>
              <Badge className='bg-purple-500/20 text-purple-400 border-purple-500/30 text-[10px] sm:text-xs'>
                {txVolumeData.length} Periods
              </Badge>
            </div>
            <ResponsiveContainer width='100%' height={chartHeight}>
              <BarChart data={txVolumeData} margin={chartMargin}>
                <defs>
                  <linearGradient
                    id={barGradientId}
                    x1='0'
                    y1='0'
                    x2='0'
                    y2='1'>
                    <stop offset='0%' stopColor='#a78bfa' stopOpacity={0.8} />
                    <stop offset='100%' stopColor='#6366f1' stopOpacity={0.4} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray='3 3'
                  stroke='rgba(99,102,241,0.1)'
                />
                <XAxis
                  dataKey='label'
                  stroke='#9ca3af'
                  tick={{ fontSize: isMobile ? 10 : 12 }}
                  tickFormatter={formatAxisLabel}
                  interval={txXAxisInterval}
                  minTickGap={isMobile ? 24 : 18}
                  tickMargin={8}
                  height={isMobile ? 42 : 30}
                />
                <YAxis
                  hide={isMobile}
                  stroke='#9ca3af'
                  tickFormatter={(v: number) => formatCompact(v)}
                />
                <Tooltip
                  cursor={{
                    fill: 'rgba(167, 139, 250, 0.08)',
                    stroke: 'rgba(167, 139, 250, 0.22)',
                    strokeWidth: 1,
                  }}
                  contentStyle={{
                    backgroundColor: '#13141f',
                    border: '1px solid rgba(99,102,241,0.2)',
                    borderRadius: '8px',
                    fontSize: isMobile ? '11px' : '12px',
                  }}
                  allowEscapeViewBox={{ x: true, y: true }}
                  formatter={(value: number | string) => {
                    const numericValue = toSafeNumber(value);
                    return [
                      formatAmount(String(numericValue), 0),
                      'Transactions',
                    ];
                  }}
                />
                <Bar
                  dataKey='txCount'
                  fill={`url(#${barGradientId})`}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={isMobile ? 22 : 36}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}>
        <Card className='p-4 sm:p-6 bg-card border-border/50'>
          <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-6'>
            <h3 className='text-sm sm:text-base'>Staking Flow (Network)</h3>
            <div className='flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm'>
              <div className='flex items-center gap-1.5'>
                <div className='w-3 h-1.5 rounded bg-emerald-500' />
                <span className='text-muted-foreground'>Staked</span>
              </div>
              <div className='flex items-center gap-1.5'>
                <div className='w-3 h-1.5 rounded bg-red-500' />
                <span className='text-muted-foreground'>Unstaked</span>
              </div>
            </div>
          </div>
          <ResponsiveContainer width='100%' height={chartHeight}>
            <AreaChart data={stakingFlowData} margin={chartMargin}>
              <defs>
                <linearGradient id={stakedGradId} x1='0' y1='0' x2='0' y2='1'>
                  <stop offset='5%' stopColor='#10b981' stopOpacity={0.3} />
                  <stop offset='95%' stopColor='#10b981' stopOpacity={0} />
                </linearGradient>
                <linearGradient id={unstakedGradId} x1='0' y1='0' x2='0' y2='1'>
                  <stop offset='5%' stopColor='#ef4444' stopOpacity={0.3} />
                  <stop offset='95%' stopColor='#ef4444' stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray='3 3'
                stroke='rgba(99,102,241,0.1)'
              />
              <XAxis
                dataKey='label'
                stroke='#9ca3af'
                tick={{ fontSize: isMobile ? 10 : 12 }}
                tickFormatter={formatAxisLabel}
                interval={stakingXAxisInterval}
                minTickGap={isMobile ? 24 : 18}
                tickMargin={8}
                height={isMobile ? 42 : 30}
              />
              <YAxis
                hide={isMobile}
                stroke='#9ca3af'
                tickFormatter={(v: number) => formatCompact(v)}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#13141f',
                  border: '1px solid rgba(99,102,241,0.2)',
                  borderRadius: '8px',
                  fontSize: isMobile ? '11px' : '12px',
                }}
                allowEscapeViewBox={{ x: true, y: true }}
                formatter={(value: number | string, name: string) => {
                  const numericValue = toSafeNumber(value);
                  return [formatAmount(String(numericValue), 0), name];
                }}
              />
              <Area
                type='monotone'
                dataKey='staked'
                name='Staked'
                stroke='#10b981'
                strokeWidth={2}
                fillOpacity={1}
                fill={`url(#${stakedGradId})`}
                isAnimationActive={false}
              />
              <Area
                type='monotone'
                dataKey='unstaked'
                name='Unstaked'
                stroke='#ef4444'
                strokeWidth={2}
                fillOpacity={1}
                fill={`url(#${unstakedGradId})`}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}>
        <Card className='p-6 bg-card border-border/50'>
          <div className='flex items-center gap-3 mb-6'>
            <Activity className='w-5 h-5 text-primary' />
            <h3>Recent Blocks</h3>
          </div>
          <div className='space-y-3'>
            {recentBlocks.length === 0 ? (
              <div className='rounded-lg border border-border/30 bg-secondary/20 px-4 py-6 text-sm text-muted-foreground'>
                No recent block data
              </div>
            ) : (
              recentBlocks.map((block, index) => (
                <motion.div
                  key={block.height}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.4 + index * 0.06 }}>
                  <div className='flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 rounded-lg bg-secondary/30 border border-border/30 hover:border-primary/30 transition-colors gap-2 sm:gap-0'>
                    <div className='flex items-center gap-3 sm:gap-4'>
                      <div className='p-2 rounded-lg bg-primary/10'>
                        <Layers className='w-4 h-4 text-primary' />
                      </div>
                      <div>
                        <p className='font-mono font-medium text-sm sm:text-base'>
                          #{formatAmount(String(block.height), 0)}
                        </p>
                        <p className='text-xs sm:text-sm text-muted-foreground'>
                          {formatDate(block.timestampMs, 'MM/DD HH:mm:ss')}
                        </p>
                      </div>
                    </div>
                    <div className='flex items-center gap-4 sm:gap-6 ml-11 sm:ml-0'>
                      <div className='text-left sm:text-right'>
                        <p className='text-xs sm:text-sm font-medium'>
                          {formatAmount(String(block.txCount), 0)} txns
                        </p>
                        <p className='text-xs text-muted-foreground'>
                          Transactions
                        </p>
                      </div>
                      <div className='text-left sm:text-right'>
                        <p className='text-xs sm:text-sm font-medium text-primary'>
                          {block.proposerName &&
                          block.proposerName !== 'Unknown'
                            ? block.proposerName
                            : shortAddress(block.proposerAddress, 8, 6)}
                        </p>
                        <p className='text-xs text-muted-foreground'>
                          Proposer
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </Card>
      </motion.div>
    </>
  );
}
