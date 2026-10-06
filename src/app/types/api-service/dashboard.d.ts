export type NumericString = `${number}`;
export type DashboardWeekLabel = string;

export interface DashboardDataParams {
  chainId: number;
}

export interface DashboardNetworkInfo {
  chainId: number;
  networkName: string;
  isOnline: boolean;
  blockHeight: number;
  epoch: number;
}

export interface DashboardPrimaryStats {
  totalSupply: NumericString;
  currentEpoch: number;
  totalSupplySymbol: string;
  totalSupplyChangePct: NumericString;
  circulatingSupply: NumericString;
  circulatingSupplySymbol: string;
  circulatingSupplyChangePct: NumericString;
  totalStaked: NumericString;
  totalStakedSymbol: string;
  totalStakedChangePct: NumericString;
  activeValidatorCount: number;
  activeValidatorDelta: number;
  totalVotingPower: NumericString;
  totalVotingPowerSymbol: string;
  activeProposalCount: number;
  networkTps: number;
  uniqueAddressCount: number;
}

export interface DashboardSecondaryStats {
  totalVotingPower: NumericString;
  totalVotingPowerSymbol: string;
  activeProposalCount: number;
  networkTps: number;
  uniqueAddressCount: number;
}

export interface DashboardTvlPoint {
  label: string;
  valueUsd: NumericString;
}

export interface DashboardDailyTransactionPoint {
  label: string;
  txCount: number;
}

export interface DashboardStakingPoint {
  label: DashboardWeekLabel | string;
  stakedAmount: NumericString;
  unstakedAmount: NumericString;
}

export interface DashboardCharts {
  tvl: DashboardTvlPoint[];
  dailyTransactions: DashboardDailyTransactionPoint[];
  staking: DashboardStakingPoint[];
}

export interface DashboardRecentBlock {
  height: number;
  txCount: number;
  timestampMs: number;
  proposerName: string;
  proposerAddress: string;
  hash: string;
}

export interface DashboardBlocksParams {
  chainId: number;
  pageNum: number;
  pageSize: number;
}

export interface DashboardBlocksResult {
  list: DashboardRecentBlock[];
  pageNum: number;
  pageSize: number;
  total: number;
}

export interface DashboardDataResults {
  network: DashboardNetworkInfo;
  primaryStats: DashboardPrimaryStats;
  secondaryStats: DashboardSecondaryStats;
  charts: DashboardCharts;
  recentBlocks: DashboardRecentBlock[];
}

export type DashboardDataResult = DashboardDataResults;
