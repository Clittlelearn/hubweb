import type { ComponentType } from 'react';

export interface ValidatorStatItem {
  label: string;
  value: string;
  icon: ComponentType<{ className?: string }>;
  gradient: string;
  border: string;
  valueColor: string;
  iconBg: string;
  glowColor: string;
  dotColor: string;
  change?: string;
  currency?: string;
  status?: string;
}

export interface ValidatorListItem {
  id: number;
  name: string;
  address: string;
  totalDelegated: string;
  commission: string;
  apy: string;
  uptime: number;
  delegators: number;
  status: string;
  performance: number;
  description: string;
}

export interface ValidatorDelegateRecord {
  validatorId: number;
  validatorName: string;
  validatorAddress: string;
  tokenName: string;
  tokenSymbol: string;
  tokenLogo: string;
  tokenAssetType: string;
  amount: string;
  apy: string;
  startedAt: string;
  txHash: string;
  canUndelegate: boolean;
  rewardsCount?: number;
  latestRewardClaimAt?: string | null;
}

export interface ValidatorRewardRecord {
  id: string;
  amount: string;
  tokenSymbol: string;
  claimedAt: string;
  txHash: string;
}
