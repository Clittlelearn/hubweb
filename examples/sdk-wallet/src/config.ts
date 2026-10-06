import type { OpenHiveNetwork, NetworkKey, SdkFormState, SdkMethod } from './types';

export const FEATURE_ADDRESS = '0x00530a843B706Eb0647b430a023FdAdD4231493f';

export const NETWORKS = [
  {
    key: 'devnet',
    label: 'Devnet',
    chainId: 12315,
    chainName: 'OpenHive Devnet',
    rpcUrl: 'http://222.128.23.254:23134',
    explorerUrl: 'https://dev-explorer.test-air.icu',
    nativeCurrency: {
      name: 'OHI',
      symbol: 'OHI',
      decimals: 8,
    },
  },
  {
    key: 'testnet',
    label: 'Testnet',
    chainId: 12316,
    chainName: 'OpenHive Testnet',
    rpcUrl: 'http://222.128.23.254:23134',
    explorerUrl: 'https://dev-explorer.test-air.icu',
    nativeCurrency: {
      name: 'OHI',
      symbol: 'OHI',
      decimals: 8,
    },
  },
  {
    key: 'mainnet',
    label: 'Mainnet',
    chainId: 12317,
    chainName: 'OpenHive Mainnet',
    rpcUrl: 'http://222.128.23.254:23134',
    explorerUrl: 'https://dev-explorer.test-air.icu',
    nativeCurrency: {
      name: 'OHI',
      symbol: 'OHI',
      decimals: 8,
    },
  },
] as const satisfies readonly OpenHiveNetwork[];

export const DEFAULT_NETWORK_KEY: NetworkKey = 'devnet';

export const DEFAULT_FORM_STATE: SdkFormState = {
  method: 'transfer',
  targetAddress: '',
  assetType: 'OHI',
  gasAssetType: '',
  amountRaw: '1000000',
  transferValue: '0.00000001',
  transferValueDecimals: '18',
  rewardRank: '10',
  delegateType: '1',
  lockType: '1',
  utxoHash: '',
  voteHash: '',
  voteValue: '1',
  firstChoose: false,
  sponsorGas: false,
  isFindUtxo: false,
  encodedInfo: '',
  waitForReceipt: false,
};

export const METHOD_OPTIONS: Array<{ value: SdkMethod; label: string }> = [
  { value: 'transfer', label: 'tx transfer' },
  { value: 'transaction', label: 'transaction alias' },
  { value: 'delegate', label: 'delegating' },
  { value: 'delegateAlias', label: 'delegate alias' },
  { value: 'undelegate', label: 'undelegating' },
  { value: 'undelegateAlias', label: 'undelegate alias' },
  { value: 'stake', label: 'stake' },
  { value: 'unstake', label: 'unstake' },
  { value: 'lock', label: 'lock' },
  { value: 'unlock', label: 'unlock' },
  { value: 'bonus', label: 'bonus' },
  { value: 'vote', label: 'vote' },
  { value: 'proposal', label: 'proposal' },
  { value: 'revokeProposal', label: 'revokeProposal' },
  { value: 'revokeProposalAlias', label: 'revokeProposal alias' },
  { value: 'fund', label: 'fund' },
  { value: 'treasury', label: 'treasury alias' },
];

export function getNetworkByKey(networkKey: NetworkKey) {
  return NETWORKS.find((item) => item.key === networkKey) ?? NETWORKS[0];
}
