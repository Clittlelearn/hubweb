import {
  DEFAULT_NETWORK,
  NETWORKS,
  type NetworkKey,
  type WalletNetwork,
} from '../lib/wallet';
import type { WalletSnapshot } from '../data/wallet';
import type { WalletToken } from '../types/api-service/wallet';
import { ethers } from 'ethers';

export interface WalletConnectorOption {
  uid: string;
  id: string;
  name: string;
  icon?: string;
  isRecent: boolean;
}

export interface Eip1193Provider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
}

export const WALLET_STORAGE_KEY = 'openhive.wallet-network';
export const RECENT_CONNECTOR_STORAGE_KEY = 'openhive.wallet-recent-connector';

export const EMPTY_WALLET_DATA: WalletSnapshot = {
  nativeBalance: '0',
  tokenPriceUsd: '0',
  balance: '0',
  tokenPriceChange: '0',
  tokens: [],
  transactions: [],
};

export function formatAddress(address: string) {
  if (address.length <= 12) {
    return address;
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function isNetworkKey(value: unknown): value is NetworkKey {
  return NETWORKS.some((network) => network.key === value);
}

export function readStoredNetwork() {
  if (typeof window === 'undefined') {
    return DEFAULT_NETWORK;
  }

  try {
    const raw = window.localStorage.getItem(WALLET_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_NETWORK;
    }

    return isNetworkKey(raw) ? raw : DEFAULT_NETWORK;
  } catch {
    return DEFAULT_NETWORK;
  }
}

export function readRecentConnectorId() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage.getItem(RECENT_CONNECTOR_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function normalizeConnectorName(name: string) {
  if (name === 'Injected') {
    return 'Browser Wallet';
  }

  return name;
}

export function sortWalletOptions(
  a: WalletConnectorOption,
  b: WalletConnectorOption,
) {
  if (a.isRecent !== b.isRecent) {
    return a.isRecent ? -1 : 1;
  }

  if (a.name === 'Browser Wallet' && b.name !== 'Browser Wallet') {
    return 1;
  }

  if (b.name === 'Browser Wallet' && a.name !== 'Browser Wallet') {
    return -1;
  }

  return a.name.localeCompare(b.name);
}

export function getErrorCode(error: unknown) {
  if (typeof error !== 'object' || !error) {
    return undefined;
  }

  const source = error as {
    code?: number;
    cause?: { code?: number };
    data?: { originalError?: { code?: number } };
  };

  return source.code ?? source.cause?.code ?? source.data?.originalError?.code;
}

export function isMissingChainError(error: unknown) {
  const code = getErrorCode(error);

  if (code === 4902) {
    return true;
  }

  const message = error instanceof Error ? error.message : String(error ?? '');

  return /4902|unknown chain|unrecognized chain|not added|missing chain/i.test(
    message,
  );
}

export function toHexChainId(chainId: number) {
  return `0x${chainId.toString(16)}`;
}

export function formatUsdPrice(value: string) {
  const num = Number(value);
  if (!Number.isFinite(num) || num === 0) {
    return '0';
  }

  const fixed = num.toFixed(4);
  const trimmed = fixed.replace(/\.?0+$/, '');
  return `$${trimmed}`;
}

export function formatPercentChange(value: string) {
  const num = Number(value);
  if (!Number.isFinite(num) || num === 0) {
    return '0%';
  }

  const sign = num > 0 ? '+' : '';
  return `${sign}${num.toFixed(2)}%`;
}

export function findNativeToken(tokens: WalletToken[]) {
  return tokens.find(
    (token) =>
      token.assetType?.toUpperCase() === 'OHI' ||
      (token.standard?.toUpperCase() === 'NATIVE' && token.symbol === 'OHI'),
  );
}

export function getAddEthereumChainParams(network: WalletNetwork) {
  return {
    chainId: toHexChainId(network.chainId),
    chainName: network.chainName,
    nativeCurrency: {
      name: network.nativeCurrency.name,
      symbol: network.nativeCurrency.symbol,
      decimals: 18,
    },
    rpcUrls: [...network.rpcs],
    blockExplorerUrls: [...network.explorerUrls],
  };
}
