import { Shield, CheckCircle2, TrendingUp, Users } from 'lucide-react';
import type { TokenInfo } from '../types/common';

import { OPENHIVE_VALIDATOR_CONSTRAINTS } from './openhive-parameters';

const formatTokenAmount = (amount: number) => `${amount.toLocaleString()} TOKENS`;

export const validatorStats = [
  {
    label: 'Active Validators',
    value: '0',
    change: '+0',
    icon: Shield,
    gradient: 'from-primary/15 via-primary/5 to-purple-500/15',
    border: 'border-primary/30',
    valueColor: 'text-primary',
    iconBg: 'bg-primary/15 text-primary',
    glowColor: 'bg-primary/20',
    dotColor: 'bg-primary',
  },
  {
    label: 'Total Staked',
    value: '0',
    currency: 'TOKENS',
    icon: TrendingUp,
    gradient: 'from-purple-500/15 via-purple-500/5 to-blue-500/15',
    border: 'border-purple-500/30',
    valueColor: 'text-purple-400',
    iconBg: 'bg-purple-500/15 text-purple-400',
    glowColor: 'bg-purple-500/20',
    dotColor: 'bg-purple-400',
  },
  {
    label: 'Network Uptime',
    value: '0',
    status: 'Excellent',
    icon: CheckCircle2,
    gradient: 'from-green-500/15 via-green-500/5 to-emerald-500/15',
    border: 'border-green-500/30',
    valueColor: 'text-green-500',
    iconBg: 'bg-green-500/15 text-green-500',
    glowColor: 'bg-green-500/20',
    dotColor: 'bg-green-500',
  },
  {
    label: 'Avg. Validator APY',
    value: '0',
    change: '0',
    icon: Users,
    gradient: 'from-blue-500/15 via-blue-500/5 to-cyan-500/15',
    border: 'border-blue-500/30',
    valueColor: 'text-blue-400',
    iconBg: 'bg-blue-500/15 text-blue-400',
    glowColor: 'bg-blue-500/20',
    dotColor: 'bg-blue-400',
  },
];

export const topValidators = [
  {
    id: 1,
    name: 'Validator Alpha',
    address: '0x1a2b...3c4d',
    stake: formatTokenAmount(OPENHIVE_VALIDATOR_CONSTRAINTS.NODE_INVESTMENT_CAP),
    commission: '5%',
    apy: '15.25%',
    uptime: 99.95,
    delegators: OPENHIVE_VALIDATOR_CONSTRAINTS.NODE_INVESTOR_COUNT_CAP,
    status: 'active',
    performance: 98.5,
    description:
      'A highly reliable validator with a strong track record of uptime and performance.',
  },
  {
    id: 2,
    name: 'Node Master Pro',
    address: '0x5e6f...7g8h',
    stake: '2,850,000 TOKENS',
    commission: '7%',
    apy: '13.75%',
    uptime: 99.89,
    delegators: 892,
    status: 'active',
    performance: 97.2,
    description:
      'A professional-grade validator offering competitive APY and low commission rates.',
  },
  {
    id: 3,
    name: 'Stake Guard',
    address: '0x9i0j...1k2l',
    stake: '2,120,000 TOKENS',
    commission: '6%',
    apy: '14.10%',
    uptime: 99.92,
    delegators: 756,
    status: 'active',
    performance: 96.8,
    description:
      'A secure and efficient validator with a focus on maximizing returns for delegators.',
  },
  {
    id: 4,
    name: 'Validator Prime',
    address: '0x3m4n...5o6p',
    stake: formatTokenAmount(
      OPENHIVE_VALIDATOR_CONSTRAINTS.EFFECTIVE_NODE_INVESTMENT_THRESHOLD,
    ),
    commission: '8%',
    apy: '12.85%',
    uptime: 98.45,
    delegators: 645,
    status: 'warning',
    performance: 92.3,
    description:
      'A reliable validator with a slightly higher commission rate but competitive APY.',
  },
  {
    id: 5,
    name: 'Block Sentinel',
    address: '0x7q8r...9s0t',
    stake: '735,000 TOKENS',
    commission: '5.5%',
    apy: '14.50%',
    uptime: 99.87,
    delegators: 523,
    status: 'active',
    performance: 95.7,
    description:
      'A trusted validator with a strong focus on security and performance.',
  },
];

export const myStakes = [
  {
    validator: 'Validator Alpha',
    validatorAddress: '0x1a2b...3c4d',
    delegated: '10,000 TOKENS',
    rewards: '152.50 REWARD',
    apy: '15.25%',
    startDate: '2025-12-15',
    lockPeriod: '90 days',
    progress: 35,
  },
  {
    validator: 'Node Master Pro',
    validatorAddress: '0x5e6f...7g8h',
    delegated: '5,000 TOKENS',
    rewards: '68.75 REWARD',
    apy: '13.75%',
    startDate: '2026-01-20',
    lockPeriod: '30 days',
    progress: 85,
  },
];

export const rewardsHistory = [
  {
    amount: '145.80 REWARD',
    claimDate: '2026-03-10',
    validator: 'Validator Alpha',
    apy: '15.25%',
  },
  {
    amount: '89.25 REWARD',
    claimDate: '2026-03-01',
    validator: 'Node Master Pro',
    apy: '13.75%',
  },
  {
    amount: '203.50 REWARD',
    claimDate: '2026-02-20',
    validator: 'Stake Guard',
    apy: '14.10%',
  },
  {
    amount: '67.90 REWARD',
    claimDate: '2026-02-10',
    validator: 'Block Sentinel',
    apy: '14.50%',
  },
];

export const tabItems = [
  { key: 'stake' as const, label: 'Stake to Validators' },
  { key: 'mystakes' as const, label: 'My Stakes' },
];

export const mockStakeTokens: TokenInfo[] = [
  {
    isNative: false,
    balance: '1250.50',
    decimals: 8,
    symbol: 'mUSDC',
    name: 'Mock USD Coin Flow',
    contractAddress: '0x1111111111111111111111111111111111111111',
    assetType: 'MockAssetTypeUSDC',
    deployHash: '0xmockusdc',
    isFlow: true,
    logo: '/token/usdc.svg',
    ownerAddress: '0x0000000000000000000000000000000000000001',
  },
  {
    isNative: false,
    balance: '82.75',
    decimals: 8,
    symbol: 'mETH',
    name: 'Mock Ether Flow',
    contractAddress: '0x2222222222222222222222222222222222222222',
    assetType: 'MockAssetTypeETH',
    deployHash: '0xmocketh',
    isFlow: true,
    logo: '/token/eth.svg',
    ownerAddress: '0x0000000000000000000000000000000000000002',
  },
  {
    isNative: false,
    balance: '4500',
    decimals: 8,
    symbol: 'mTKN',
    name: 'Mock Staking Token',
    contractAddress: '0x3333333333333333333333333333333333333333',
    assetType: 'MockAssetTypeTKN',
    deployHash: '0xmocktkn',
    isFlow: true,
    logo: '',
    ownerAddress: '0x0000000000000000000000000000000000000003',
  },
];

export type ValidatorStat = (typeof validatorStats)[number];
export type TopValidator = (typeof topValidators)[number];
export type RewardHistoryItem = (typeof rewardsHistory)[number];
