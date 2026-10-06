import type rpcApiJson from '../data/mmc-rpc-api.json';
import type { TokenInfo } from './common';

export type RpcApiType = typeof rpcApiJson;

export type RpcApiPath = keyof RpcApiType;

export type RpcApiParams<K extends RpcApiPath> = RpcApiType[K]['params'];
export type RpcApiResult<K extends RpcApiPath> = RpcApiType[K]['result'];
export type RpcApIError<K extends RpcApiPath> = RpcApiType[K]['error'];

export interface AssetType extends TokenInfo {
  proposalInfo?: {
    BeginTime: number;
    CrossChainInvestmentContractAddr: string;
    CrossChainTxType: number;
    EndTime: number;
    EnteringMoreContractAddr: string;
    ExchangeRate: string;
    ExpirationDate: number;
    Identifier: string;
    MIN_VOTE_NUM: 1;
    Name: string;
    PeerChainTokenAddr: string;
    Title: string;
    Version: number;
    canBeStake: number;
    deployer: string;
  };
  revokeProposalInfo?: any[];
}
