import { formatAmount, toUnitsAmount } from '@/app/lib/format';
import {
  DashboardPrimaryStats,
  DashboardSecondaryStats,
} from '@/app/types/api-service/dashboard';
import { OPENHIVE_TOKENOMICS } from '@/app/data/openhive-parameters';
import {
  Globe,
  Lock,
  Vote,
  Layers,
  Shield,
  Zap,
  Users,
  BarChart3,
} from 'lucide-react';

export function formatChangePercent(change: string | number) {
  const raw = String(change ?? '').trim();

  if (!raw) {
    return '0';
  }

  if (raw.endsWith('%')) {
    return raw;
  }

  return Number(raw) === 0 ? '0' : `${raw}%`;
}

export function isPositiveChange(change: string | number) {
  const normalized =
    typeof change === 'number'
      ? change
      : Number(String(change).replace(/[%\s,]/g, ''));

  if (!Number.isNaN(normalized)) {
    return normalized >= 0;
  }

  return !String(change).trim().startsWith('-');
}

function formatTokenStatAmount(
  value: string | number | undefined,
  tokenDecimals: number,
) {
  return formatAmount(toUnitsAmount(value ?? '0', tokenDecimals));
}

export function gerneateDashboardPrimaryData(
  data?: DashboardPrimaryStats,
  tokenDecimals = 18,
) {
  return [
    {
      label: 'Total Supply',
      value: data?.totalSupply !== undefined
        ? formatAmount(data.totalSupply)
        : formatAmount(String(OPENHIVE_TOKENOMICS.TOTAL_SUPPLY)),
      unit: data?.totalSupplySymbol ?? 'OHI',
      change: formatChangePercent(data?.totalSupplyChangePct ?? '0'),
      icon: Globe,
    },
    {
      label: 'Circulating Supply',
      value: formatAmount(data?.circulatingSupply),
      unit: data?.circulatingSupplySymbol ?? '--',
      change: formatChangePercent(data?.circulatingSupplyChangePct ?? '0'),
      icon: Layers,
    },
    {
      label: 'Total Staked',
      value: formatAmount(data?.totalStaked),
      unit: data?.totalStakedSymbol ?? '--',
      change: formatChangePercent(data?.totalStakedChangePct ?? '0'),
      icon: Lock,
    },
    {
      label: 'Active Validators',
      value: formatAmount((data?.activeValidatorCount ?? '0').toString()),
      unit: 'Nodes',
      change: formatChangePercent(data?.activeValidatorDelta ?? 0),
      icon: Shield,
    },
  ];
}

export function gerneateDashboardSecondaryData(
  data?: DashboardSecondaryStats,
  tokenDecimals = 18,
) {
  return [
    {
      label: 'Total Voting Power',
      value: formatTokenStatAmount(data?.totalVotingPower, tokenDecimals),
      unit: data?.totalVotingPowerSymbol || 'OHI',
      icon: Vote,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
      border: 'border-purple-500/30',
    },
    {
      label: 'Active Proposals',
      value: formatAmount((data?.activeProposalCount || '0').toString()),
      unit: 'Governance',
      icon: BarChart3,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/30',
    },
    {
      label: 'Network TPS',
      value: formatAmount((data?.networkTps || '0').toString()),
      unit: 'tx/s',
      icon: Zap,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/30',
    },
    {
      label: 'Unique Addresses',
      value: formatAmount((data?.uniqueAddressCount || '0').toString()),
      unit: 'Wallets',
      icon: Users,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/30',
    },
  ];
}
