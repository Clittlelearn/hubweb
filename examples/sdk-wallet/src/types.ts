import type { OpenHiveSdk } from '@openhive/sdk';
import type { Eip1193Provider } from 'ethers';

export type EthereumProvider = Eip1193Provider & {
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (
    event: string,
    handler: (...args: unknown[]) => void,
  ) => void;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

export type NetworkKey = 'devnet' | 'testnet' | 'mainnet';

export interface OpenHiveNetwork {
  key: NetworkKey;
  label: string;
  chainId: number;
  chainName: string;
  rpcUrl: string;
  explorerUrl: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

export type SdkMethod =
  | 'transfer'
  | 'transaction'
  | 'stake'
  | 'unstake'
  | 'delegate'
  | 'delegateAlias'
  | 'undelegate'
  | 'undelegateAlias'
  | 'lock'
  | 'unlock'
  | 'bonus'
  | 'vote'
  | 'proposal'
  | 'revokeProposal'
  | 'revokeProposalAlias'
  | 'fund'
  | 'treasury';

export type SdkRunMode = 'build' | 'send';

export interface SdkFormState {
  method: SdkMethod;
  targetAddress: string;
  assetType: string;
  gasAssetType: string;
  amountRaw: string;
  transferValue: string;
  transferValueDecimals: string;
  rewardRank: string;
  delegateType: string;
  lockType: string;
  utxoHash: string;
  voteHash: string;
  voteValue: '1' | '0';
  firstChoose: boolean;
  sponsorGas: boolean;
  isFindUtxo: boolean;
  encodedInfo: string;
  waitForReceipt: boolean;
}

export type SdkResult = Awaited<ReturnType<OpenHiveSdk<boolean>['transfer']>>;
