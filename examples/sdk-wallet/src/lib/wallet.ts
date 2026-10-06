import type { OpenHiveNetwork } from '../types';
import {
  formatAddress,
  isMissingChainError,
  parseChainId,
  toHexChainId,
} from './utils';

export interface WalletSnapshot {
  address: string;
  chainId: number | null;
  status: string;
}

export function getEthereum() {
  if (!window.ethereum) {
    throw new Error('No injected wallet found. Install or unlock a browser wallet.');
  }

  return window.ethereum;
}

export async function getCurrentWalletState(): Promise<WalletSnapshot> {
  const ethereum = window.ethereum;
  if (!ethereum) {
    return {
      address: '',
      chainId: null,
      status: 'No injected wallet detected',
    };
  }

  const [accounts, chainIdValue] = await Promise.all([
    ethereum.request({ method: 'eth_accounts' }),
    ethereum.request({ method: 'eth_chainId' }),
  ]);

  const accountList = Array.isArray(accounts) ? accounts : [];
  const address =
    typeof accountList[0] === 'string' ? formatAddress(accountList[0]) : '';

  return {
    address,
    chainId: parseChainId(chainIdValue),
    status: address ? 'Wallet connected' : 'Wallet available',
  };
}

export async function connectInjectedWallet() {
  const accounts = await getEthereum().request({
    method: 'eth_requestAccounts',
  });
  const accountList = Array.isArray(accounts) ? accounts : [];
  const address =
    typeof accountList[0] === 'string' ? formatAddress(accountList[0]) : '';

  if (!address) {
    throw new Error('Wallet did not return an account.');
  }

  return address;
}

export async function ensureWalletNetwork(network: OpenHiveNetwork) {
  const ethereum = getEthereum();
  const currentChainId = parseChainId(
    await ethereum.request({ method: 'eth_chainId' }),
  );

  if (currentChainId === network.chainId) {
    return currentChainId;
  }

  try {
    await ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: toHexChainId(network.chainId) }],
    });
  } catch (err) {
    if (!isMissingChainError(err)) {
      throw err;
    }

    await ethereum.request({
      method: 'wallet_addEthereumChain',
      params: [
        {
          chainId: toHexChainId(network.chainId),
          chainName: network.chainName,
          nativeCurrency: network.nativeCurrency,
          rpcUrls: [network.rpcUrl],
          blockExplorerUrls: [network.explorerUrl],
        },
      ],
    });

    await ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: toHexChainId(network.chainId) }],
    });
  }

  const nextChainId = parseChainId(
    await ethereum.request({ method: 'eth_chainId' }),
  );

  if (nextChainId !== network.chainId) {
    throw new Error(
      `Wallet is on chain ${nextChainId ?? 'unknown'}; expected ${network.chainId}.`,
    );
  }

  return nextChainId;
}

export function listenToWalletChanges(handlers: {
  onAccountsChanged: (address: string) => void;
  onChainChanged: (chainId: number | null) => void;
}) {
  const ethereum = window.ethereum;
  if (!ethereum?.on) {
    return () => undefined;
  }

  const handleAccountsChanged = (accountsValue: unknown) => {
    const accounts = Array.isArray(accountsValue) ? accountsValue : [];
    const address =
      typeof accounts[0] === 'string' ? formatAddress(accounts[0]) : '';

    handlers.onAccountsChanged(address);
  };

  const handleChainChanged = (chainIdValue: unknown) => {
    handlers.onChainChanged(parseChainId(chainIdValue));
  };

  ethereum.on('accountsChanged', handleAccountsChanged);
  ethereum.on('chainChanged', handleChainChanged);

  return () => {
    ethereum.removeListener?.('accountsChanged', handleAccountsChanged);
    ethereum.removeListener?.('chainChanged', handleChainChanged);
  };
}
