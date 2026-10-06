import { defineChain, type Chain } from 'viem';
import { OPENHIVE_ASSET_DECIMALS } from '@/app/constants/assets';

export type NetworkKey = 'devnet' | 'testnet' | 'mainnet';

interface WalletNetworkService {
  baseApi: string;
  rpcApi: string;
}

export interface WalletNetwork {
  key: NetworkKey;
  label: string;
  chainName: string;
  chainId: number;
  symbol: string;
  logo: string;
  decimals: number;
  color: string;
  textColor: string;
  ringColor: string;
  service: WalletNetworkService;
  rpcs: readonly string[];
  explorerUrls: readonly string[];
  explorerBaseUrl: string;
  chain: Chain;
  nativeCurrency: {
    name: string;
    /** 2-6 characters long */
    symbol: string;
    decimals: number;
    icon: string;
  };
}

export const DEFAULT_NETWORK: NetworkKey = 'devnet';

export const openHiveDevnet = defineChain({
  id: 12315,
  name: 'HiveX Devnet',

  nativeCurrency: {
    name: 'OHI',
    symbol: 'OHI',
    decimals: OPENHIVE_ASSET_DECIMALS,
    icon: '/token/ohi.svg',
  },
  rpcUrls: {
    default: {
      http: [import.meta.env.VITE_HIVEX_RPC_URL || 'http://18.217.213.249:13134'],
    },
  },
  blockExplorers: {
    default: {
      name: 'HiveX Devnet Explorer',
      url: 'http://54.173.171.114:5173',
    },
  },
  testnet: true,
});

export const openHiveTestnet = defineChain({
  id: 12316,
  name: 'HiveX Testnet',
  nativeCurrency: {
    name: 'OHI',
    symbol: 'OHI',
    decimals: OPENHIVE_ASSET_DECIMALS,
    icon: '/token/ohi.svg',
  },
  rpcUrls: {
    default: {
      http: ['http://18.217.213.249:13134'],
    },
  },
  blockExplorers: {
    default: {
      name: 'HiveX Testnet Explorer',
      url: 'http://54.173.171.114:5173',
    },
  },
  testnet: true,
});

export const openHiveMainnet = defineChain({
  id: 12317,
  name: 'HiveX Mainnet',
  nativeCurrency: {
    name: 'OHI',
    symbol: 'OHI',
    decimals: OPENHIVE_ASSET_DECIMALS,
    icon: '/token/ohi.svg',
  },
  rpcUrls: {
    default: {
      http: ['http://18.217.213.249:13134'],
    },
  },
  blockExplorers: {
    default: {
      name: 'HiveX Mainnet Explorer',
      url: 'http://54.173.171.114:5173',
    },
  },
});

export const WAGMI_CHAINS = [
  openHiveDevnet,
  openHiveTestnet,
  openHiveMainnet,
] as const;

export const NETWORKS: readonly WalletNetwork[] = [
  {
    key: 'devnet',
    label: 'Devnet',
    chainName: openHiveDevnet.name,
    chainId: openHiveDevnet.id,
    symbol: openHiveDevnet.nativeCurrency.symbol,
    logo: '/chain/openhive.svg',
    decimals: openHiveDevnet.nativeCurrency.decimals,
    color: 'bg-yellow-500',
    textColor: 'text-yellow-500',
    ringColor: 'ring-yellow-500/30',
    service: {
      baseApi: import.meta.env.VITE_HUBSQL_API_URL && import.meta.env.VITE_HUBSQL_API_URL !== '/'
        ? import.meta.env.VITE_HUBSQL_API_URL
        : window.location.origin,
      // baseApi: 'https://dev-hub-api.test-air.icu',
      rpcApi: openHiveDevnet.rpcUrls.default.http[0]!,
    },
    rpcs: openHiveDevnet.rpcUrls.default.http,
    explorerUrls: [openHiveDevnet.blockExplorers.default.url],
    explorerBaseUrl: openHiveDevnet.blockExplorers.default.url,
    chain: openHiveDevnet,
    nativeCurrency: openHiveDevnet.nativeCurrency,
  },
  {
    key: 'testnet',
    label: 'Testnet',
    chainName: openHiveTestnet.name,
    chainId: openHiveTestnet.id,
    symbol: openHiveTestnet.nativeCurrency.symbol,
    logo: '/chain/openhive.svg',
    decimals: openHiveTestnet.nativeCurrency.decimals,
    color: 'bg-blue-500',
    textColor: 'text-blue-500',
    ringColor: 'ring-blue-500/30',
    service: {
      baseApi: 'https://dev-hub-api.test-air.icu',
      rpcApi: openHiveTestnet.rpcUrls.default.http[0],
    },
    rpcs: openHiveTestnet.rpcUrls.default.http,
    explorerUrls: [openHiveTestnet.blockExplorers.default.url],
    explorerBaseUrl: openHiveTestnet.blockExplorers.default.url,
    chain: openHiveTestnet,
    nativeCurrency: openHiveTestnet.nativeCurrency,
  },
  {
    key: 'mainnet',
    label: 'Mainnet',
    chainName: openHiveMainnet.name,
    chainId: openHiveMainnet.id,
    symbol: openHiveMainnet.nativeCurrency.symbol,
    logo: '/chain/openhive.svg',
    decimals: openHiveMainnet.nativeCurrency.decimals,
    color: 'bg-green-500',
    textColor: 'text-green-500',
    ringColor: 'ring-green-500/30',
    service: {
      baseApi: 'https://dev-hub-api.test-air.icu',
      rpcApi: openHiveMainnet.rpcUrls.default.http[0],
    },
    rpcs: openHiveMainnet.rpcUrls.default.http,
    explorerUrls: [openHiveMainnet.blockExplorers.default.url],
    explorerBaseUrl: openHiveMainnet.blockExplorers.default.url,
    chain: openHiveMainnet,
    nativeCurrency: openHiveMainnet.nativeCurrency,
  },
] as const;

export function getNetworkByKey(network: NetworkKey) {
  return NETWORKS.find((item) => item.key === network) ?? NETWORKS[0];
}

export function getNetworkByChainId(chainId: number) {
  return NETWORKS.find((item) => item.chainId === chainId);
}

export function getChainByKey(network: NetworkKey) {
  return getNetworkByKey(network).chain;
}
