import { PaginationParams } from '@/app/apis';
import { ChainAndAddressParams, ChainIdParams, PaginatedResult } from './common';

export interface WalletPageParams extends ChainAndAddressParams {}

export interface WalletOverviewData {
  totalBalance: string;
  balanceSymbol: string;
  tokenCount: number;
  txsCount: number;
}

export interface WalletPageResult {
  overview: WalletOverviewData;
}

export interface WalletToken {
  tokenId: string;
  name: string;
  symbol: string;
  logoUrl: string;
  balance: string;
  decimals: number;
  contractAddress: string;
  assetType: string;
  standard: string;
  ownerAddress: string;
  deployutxo: string;
  priceUsd: string;
  valueUsd: string;
  change24hPct: string;
  isCustom: boolean;
}

export type WalletTokensReuslt = { list: WalletToken[] };

export interface WalletTokenTransfer {
  standard: string;
  contractAddress: string;
  contractName: string;
  symbol: string;
  decimals: number;
  from: string;
  to: string;
  amount: string;
  tokenId: string;
  direction: 'in' | 'out';
}

export interface WalletGasCost {
  native: {
    amount: string;
    symbol: string;
    decimals: number;
  };
  custom: {
    isUsed: boolean;
    amount: string;
    symbol: string;
    decimals: number;
    contractAddress: string;
    assetType: string;
  };
}

export interface WalletEvmDetails {
  txType: string;
  from: string;
  to: string;
  contractAddress: string;
  inputData: string;
  nonce: number;
  value: string;
  blockNumber: number;
  blockHash: string;
  transactionIndex: number;
  gasLimit: string;
  gasUsed: string;
  gasPrice: string;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
  effectiveGasPrice: string;
  logs: unknown[];
  rawTx: Record<string, unknown>;
  rawReceipt: Record<string, unknown>;
}

export interface WalletTransaction {
  txHash: string;
  txType: string;
  kind: string;
  status: 'success' | 'pending' | 'failed';
  direction: 'in' | 'out';
  timestampMs: number;
  amount: string;
  symbol: string;
  decimals: number;
  counterpartyRole: string;
  counterpartyAddress: string;
  contractName: string;
  contractAddress: string;
  methodName: string;
  methodId: string;
  from: string;
  to: string;
  rawData: string;
  blockNumber: number;
  blockHash: string;
  transactionIndex: number;
  nonce: number;
  value: string;
  gasLimit: string;
  gasUsed: string;
  gasPrice: string;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
  effectiveGasPrice: string;
  feeAmount: string;
  feeSymbol: string;
  gasCost: WalletGasCost;
  tokenTransfers: WalletTokenTransfer[];
  evm: WalletEvmDetails;
}

export interface WalletTransactionsParams
  extends ChainAndAddressParams, PaginationParams {}

export type WalletTransactionsResult = PaginatedResult<WalletTransaction>;

export interface WalletTokenCatalogParams
  extends ChainAndAddressParams, PaginationParams {
  keyword?: string;
}

export interface WalletTokenCatalog {
  tokenId: string;
  contractAddress: string;
  name: string;
  symbol: string;
  logoUrl: string;
  decimals: number;
  assetType: string;
  standard: string;
  isVerified: boolean;
  isAdded: boolean;
  listSource?: 'catalog' | 'custom';
}

export type WalletTokenCatalogResult = PaginatedResult<WalletTokenCatalog> & {
  metadataWarning?: string;
  metadataSupported?: boolean;
};

export interface WalletTokenMetadataParams extends ChainIdParams {
  contractAddress: string;
  address?: string;
}

export interface WalletTokenMetadata extends WalletTokenCatalog {
  priceUsd: string;
}

export interface WalletBindTokenParams extends ChainAndAddressParams {
  tokenId: string;
  contractAddress: string;
}

export interface WalletRemoveTokenParams extends ChainAndAddressParams {
  tokenId?: string;
}

export interface WalletBindCustomTokenParams extends ChainAndAddressParams {
  contractAddress: string;
}

export interface WalletWriteResult {
  success: boolean;
  token?: Record<string, unknown>;
  contractAddress?: string;
}
