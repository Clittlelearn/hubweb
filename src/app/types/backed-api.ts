export interface Validator {
  active: string;
  address: string;
  commissionRate: string;
  delegators: number;
  id: number;
  investArray: {
    amount: string;
    assetType: string;
    assetSymbol: string;
  }[];
  logo: string;
  name: string;
  nodeStake: string;
  online: string;
  pastPeriodAPY: string;
  stakingProgress: string;
  updateTime: number;
  version: string;
  workload: number;
}

export interface FlowAssetInfo {
  assetType: string;
  contractAddress: string;
  decimals: number;
  exchangeRate: string;
  ownerAddress: string;
  symbol: string;
  txHash: string;
}

export interface LockedAssetInfo {
  amount: string;
  isValidator: boolean;
  linuxTime: number;
  tradeTime: number;
  txHash: string;
}

export interface ProposalInfo {
  againstCount: number;
  approveCount: number;
  contractAddress: string;
  createTime: number;
  endTime: number;
  exchangeRate: string;
  id: number;
  isFlow: string;
  logo: string;
  minVoteNum: number;
  name: string;
  proposalStatus: string;
  proposalTxHash: string;
  proposalType: string;
  startTime: number;
  symbol: string;
  title: string;
  tradeTime: number;
  txHash: string;
}

export interface VoteTx {
  fromAddress: string;
  tradeTime: number;
  txHash: string;
  voteAmount: number;
  voteType: string;
}

export interface InvestInfo {
  address: string;
  amount: string;
  assetSymbol: string;
  assetType: string;
  bonusAddress: string;
  createTime: number;
  id: number;
  logo: string;
  tradeTime: number;
  txHash: string;
  chainId: number;
  investType: number;
}

export interface StakedInfo {
  investInfo: InvestInfo;
  stakeInfo: InvestInfo;
}

export interface AddressTx {
  amount: string;
  assetType: string;
  assetTypeSymbol: string;
  bridgeInfo: string;
  contractAddress: string;
  contractName: string;
  contractType: string;
  fromAddress: string;
  fromEvmAddress: string;
  functions: string;
  height: number;
  image: string;
  liquidityInfo: string;
  logo: string;
  nftImageList: string;
  nftNameList: string;
  standard: string;
  symbol: string;
  toAddress: string;
  toEvmAddress: string;
  tokenAmount: string;
  tradeTime: number;
  txHash: string;
  type: string;
  address: string;
}

export interface ContractInfo {
  address: string;
  contractAddress: string;
  contractName: string;
  contractType: string;
  decimals: string;
  liquidityInfo: string;
  logo: string;
  ownerAddress: string;
  symbol: string;
  txHash: string;
}
