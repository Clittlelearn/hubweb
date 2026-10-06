import { QueryClientProvider } from '@tanstack/react-query';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  useConnect,
  useConfig,
  useConnection,
  useConnectors,
  WagmiProvider,
  type Connector,
} from 'wagmi';
import { useQuery } from '@tanstack/react-query';
import {
  getNetworkByChainId,
  getNetworkByKey,
  type NetworkKey,
  type WalletNetwork,
} from '../lib/wallet';
import { wagmiConfig, wagmiQueryClient, isManualWalletReconnectRequired, setManualWalletReconnectRequired } from '../lib/wagmi';
import { switchWalletForTransaction, WALLET_NETWORK_RECONNECT_MESSAGE } from '../lib/wallet-network';
import { isOkxWallet, OKX_CONNECTOR_ID } from '../lib/injected-wallets';
import { formatUnitsDisplayAmount } from '../lib/format';
import { ApiService } from '../apis/api-service';
import type { WalletSnapshot } from '../data/wallet';
import { WalletConnectModal } from '../components/wallet-connect-modal';
import {
  EMPTY_WALLET_DATA,
  WALLET_STORAGE_KEY,
  RECENT_CONNECTOR_STORAGE_KEY,
  formatAddress,
  formatPercentChange,
  formatUsdPrice,
  findNativeToken,
  normalizeConnectorName,
  readRecentConnectorId,
  readStoredNetwork,
  sortWalletOptions,
  type Eip1193Provider,
  type WalletConnectorOption,
} from './wallet-provider.utils';

interface WalletContextType {
  connected: boolean;
  walletConnected: boolean;
  address: string;
  network: NetworkKey;
  currentNetwork: WalletNetwork;
  walletData: WalletSnapshot;
  explorerUrl: string;
  shortAddress: string;
  connect: () => void;
  disconnect: () => void;
  setNetwork: (network: NetworkKey) => void;
  ensureWalletNetwork: (network?: NetworkKey) => Promise<boolean>;
  refreshAccountData: () => void;
}

const WalletContext = createContext<WalletContextType | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig} reconnectOnMount={!isManualWalletReconnectRequired()}>
      <QueryClientProvider client={wagmiQueryClient}>
        <WalletContextProvider>{children}</WalletContextProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

function WalletContextProvider({ children }: { children: ReactNode }) {
  const walletConfig = useConfig();
  const walletSessionRevision = useRef(0);
  const [network, setStoredNetwork] = useState<NetworkKey>(readStoredNetwork);
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [walletOptions, setWalletOptions] = useState<WalletConnectorOption[]>(
    [],
  );
  const [isDetectingWallets, setIsDetectingWallets] = useState(true);
  const [connectingWalletUid, setConnectingWalletUid] = useState<string | null>(
    null,
  );
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [recentConnectorId, setRecentConnectorId] = useState<string | null>(
    readRecentConnectorId,
  );
  const connection = useConnection();
  const connectors = useConnectors();
  const connectMutation = useConnect();
  useEffect(() => {
    window.localStorage.setItem(WALLET_STORAGE_KEY, network);
  }, [network]);

  useEffect(() => {
    if (recentConnectorId) {
      window.localStorage.setItem(
        RECENT_CONNECTOR_STORAGE_KEY,
        recentConnectorId,
      );
      return;
    }

    window.localStorage.removeItem(RECENT_CONNECTOR_STORAGE_KEY);
  }, [recentConnectorId]);

  useEffect(() => {
    if (!connection.chainId) {
      return;
    }

    const matchedNetwork = getNetworkByChainId(connection.chainId);

    if (matchedNetwork && matchedNetwork.key !== network) {
      setStoredNetwork(matchedNetwork.key);
    }
  }, [connection.chainId, network]);

  useEffect(() => {
    let active = true;

    setIsDetectingWallets(true);

    void Promise.all(
      connectors.map(async (connector) => {
        try {
          const provider = await connector.getProvider();

          if (!provider) {
            return null;
          }

          return {
            uid: connector.uid,
            id: connector.id,
            name: normalizeConnectorName(connector.name),
            icon: connector.icon,
            isRecent: connector.id === recentConnectorId,
            provider,
          } satisfies WalletConnectorOption & { provider: unknown };
        } catch {
          return null;
        }
      }),
    ).then((results) => {
      if (!active) {
        return;
      }

      const detectedWallets = results.filter(
        (item) => item !== null,
      ) as (WalletConnectorOption & { provider: unknown })[];
      // Prefer the provider announced by OKX when both discovery paths exist.
      const announcedOkx = detectedWallets.some(
        (wallet) => wallet.id !== OKX_CONNECTOR_ID && isOkxWallet(wallet.name),
      );
      const availableWallets = detectedWallets.filter(
        (wallet) => !announcedOkx || wallet.id !== OKX_CONNECTOR_ID,
      );
      const visibleWallets = availableWallets.filter((wallet) =>
        wallet.name !== 'Browser Wallet' || !availableWallets.some(
          (other) => other.name !== 'Browser Wallet' && other.provider === wallet.provider,
        ),
      ).map(({ provider: _provider, ...wallet }) => wallet);
      const dedupedWallets = Array.from(
        new Map(visibleWallets.map((wallet) => [wallet.id, wallet])).values(),
      ).sort(sortWalletOptions);

      setWalletOptions(dedupedWallets);
      setIsDetectingWallets(false);
    });

    return () => {
      active = false;
    };
  }, [connectors, recentConnectorId]);

  const currentNetwork = getNetworkByKey(network);
  const apiService = useMemo(
    () => new ApiService(currentNetwork.service.baseApi, '/api/v1'),
    [currentNetwork.service.baseApi],
  );

  const walletAddress = connection.address ?? '';
  const address = walletAddress || '0x';
  const isValidAddress = Boolean(address) && address !== '0x';
  const isWalletConnected = connection.isConnected && isValidAddress;

  const { data: walletTokensData, refetch: refreshAccountData } = useQuery({
    queryKey: [
      'wallet-tokens',
      currentNetwork.key,
      currentNetwork.chainId,
      address,
    ],
    queryFn: () =>
      apiService.walletTokens({
        chainId: currentNetwork.chainId,
        address,
      }),
    enabled: isWalletConnected,
    staleTime: 15_000,
    refetchInterval: 15_000,
  });

  const walletData = useMemo<WalletSnapshot>(() => {
    const tokens = walletTokensData?.list;
    if (!tokens || !Array.isArray(tokens)) {
      return EMPTY_WALLET_DATA;
    }

    const nativeToken = findNativeToken(tokens);
    if (!nativeToken) {
      return EMPTY_WALLET_DATA;
    }

    return {
      ...EMPTY_WALLET_DATA,
      nativeBalance: formatUnitsDisplayAmount(
        nativeToken.balance,
        nativeToken.decimals,
      ),
      balance: nativeToken.balance,
      tokenPriceUsd: formatUsdPrice(nativeToken.priceUsd),
      tokenPriceChange: formatPercentChange(nativeToken.change24hPct),
    };
  }, [walletTokensData]);

  const explorerUrl = `${currentNetwork.explorerBaseUrl}/address/${address}`;
  const shortAddress = formatAddress(address);

  const connect = () => {
    setConnectionError(null);
    setConnectModalOpen(true);
  };

  const disconnectLocally = (connector?: Connector) => {
    walletSessionRevision.current += 1;
    setManualWalletReconnectRequired(true);
    // Disconnect the Hub session immediately. Extension cleanup may never settle.
    // Do not use the async Wagmi disconnect action here: its late state update
    // could otherwise remove a new connection made by the user in the meantime.
    connector?.emitter.emit('disconnect');
    walletConfig.setState((state) => ({
      ...state, connections: new Map(), current: null, status: 'disconnected',
    }));
    setRecentConnectorId(null);
    setConnectingWalletUid(null);
    void (async () => {
      if (connector) await walletConfig.storage?.setItem(`${connector.id}.disconnected`, true);
      await walletConfig.storage?.removeItem('injected.connected');
    })().catch(error => console.error('Failed to persist wallet disconnect.', error));
    if (connector) {
      void Promise.resolve().then(() => connector.disconnect()).catch(error => {
        console.error('Wallet extension cleanup failed; Hub is already disconnected.', error);
      });
    }
  };

  const disconnect = () => {
    const state = walletConfig.state;
    disconnectLocally(state.current ? state.connections.get(state.current)?.connector : undefined);
  };

  useEffect(() => {
    if (!connection.isConnected) {
      return;
    }

    setConnectModalOpen(false);
    setConnectingWalletUid(null);
    setConnectionError(null);
  }, [connection.isConnected]);

  const connectWithWallet = (walletUid: string) => {
    if (connectingWalletUid) {
      return;
    }

    const connector = connectors.find((item) => item.uid === walletUid);

    if (!connector) {
      setConnectionError(
        'The selected wallet is no longer available in this browser.',
      );
      return;
    }

    setConnectionError(null);
    setConnectingWalletUid(walletUid);
    walletSessionRevision.current += 1;
    setManualWalletReconnectRequired(false);

    void connectMutation
      // Connecting an account and switching networks are independent wallet
      // permissions.  Passing chainId here makes MetaMask report a rejected
      // connection when the user only declined the follow-up switch request.
      // Network switching remains explicitly handled by ensureWalletNetwork
      // before a signing operation.
      .mutateAsync({ connector })
      .then(() => {
        setRecentConnectorId(connector.id);
      })
      .catch((error) => {
        const message =
          error instanceof Error
            ? error.message
            : 'Unable to connect the selected wallet.';

        if (/rejected/i.test(message)) {
          setConnectionError('The wallet connection request was rejected.');
        } else {
          setConnectionError(message);
        }
      })
      .finally(() => {
        setConnectingWalletUid(null);
      });
  };

  const ensureWalletNetwork = async (targetNetworkKey = network) => {
    const targetNetwork = getNetworkByKey(targetNetworkKey);
    const revision = walletSessionRevision.current;
    const state = walletConfig.state;
    const activeConnection = state.current ? state.connections.get(state.current) : undefined;
    try {
      if (state.status !== 'connected' || !activeConnection) {
        throw new Error('Wallet session is unavailable. Reconnect your wallet.');
      }
      const provider = await activeConnection.connector.getProvider() as Eip1193Provider;
      await switchWalletForTransaction(provider, targetNetwork, address);
      if (revision !== walletSessionRevision.current) return false;
      setStoredNetwork(targetNetworkKey);
      return true;
    } catch (error) {
      console.error(`Failed to switch wallet network to ${targetNetworkKey}.`, error);
      // Protect a new manual connection, not an automatic connector reannouncement.
      // The same extension can change connector UID while a switch is pending.
      if (revision !== walletSessionRevision.current) return false;
      const current = walletConfig.state;
      disconnectLocally((current.current ? current.connections.get(current.current)?.connector : undefined)
        ?? activeConnection?.connector);
      setConnectionError(WALLET_NETWORK_RECONNECT_MESSAGE);
      setConnectModalOpen(true);
      return false;
    }
  };

  const setNetwork = (nextNetwork: NetworkKey) => {
    if (!connection.isConnected) {
      setStoredNetwork(nextNetwork);
      return;
    }

    void ensureWalletNetwork(nextNetwork);
  };

  return (
    <WalletContext.Provider
      value={{
        connected: connection.isConnected,
        walletConnected: connection.isConnected,
        address,
        network,
        currentNetwork,
        walletData,
        explorerUrl,
        shortAddress,
        connect,
        disconnect,
        setNetwork,
        ensureWalletNetwork,
        refreshAccountData,
      }}>
      {children}
      <WalletConnectModal
        open={connectModalOpen}
        currentNetworkLabel={currentNetwork.label}
        chainName={currentNetwork.chainName}
        walletOptions={walletOptions}
        isDetectingWallets={isDetectingWallets}
        connectingWalletUid={connectingWalletUid}
        connectionError={connectionError}
        onClose={() => {
          setConnectModalOpen(false);
          setConnectionError(null);
        }}
        onConnect={connectWithWallet}
      />
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);

  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }

  return context;
}
