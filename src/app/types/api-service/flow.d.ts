import { PaginationParams } from '@/app/apis';
import { ChainAndAddressParams, ChainIdParams, PaginatedResult } from './common';

export interface FlowAssetsParams extends ChainAndAddressParams {}

export interface FlowHistoryParams extends ChainAndAddressParams, PaginationParams {
  direction?: string;
  status?: string;
  assetId?: string;
}

export interface FlowStats {
  totalFlowIn: string;
  totalFlowOut: string;
  netFlow: string;
  flowableAssetCount: number;
}

export interface FlowAssetInfo {
  assetId: string;
  name: string;
  assetName: string;
  symbol: string;
  logoUrl: string;
  contractAddress: string;
  assetType: string;
  decimals: number;
  assetDecimals: number;
  isEnabled: boolean;
  exchangeRate: string;
}

export interface FlowPageResult {
  stats: FlowStats;
  assets: FlowAssetInfo[];
}

export interface FlowAssetItem extends FlowAssetInfo {
  erc20Balance: string;
  flowBalance: string;
  canFlowIn: boolean;
  canFlowOut: boolean;
}

export interface FlowAssetsResult {
  list: FlowAssetItem[];
  defaultAssetId: string;
}

export interface FlowAmountInfo {
  erc20Amount: string;
  flowAmount: string;
  displayAmount: string;
  displaySymbol: string;
}

export interface FlowTimeline {
  submittedAt: number;
  completedAt: number;
}

export interface FlowTxInfo {
  txHash: string;
  blockNumber: number;
}

export interface FlowHistoryItem {
  flowId: string;
  direction: 'in' | 'out';
  method: string;
  status: string;
  asset: FlowAssetInfo;
  amountInfo: FlowAmountInfo;
  timeline: FlowTimeline;
  tx: FlowTxInfo;
}

export type FlowHistoryResult = PaginatedResult<FlowHistoryItem>;
