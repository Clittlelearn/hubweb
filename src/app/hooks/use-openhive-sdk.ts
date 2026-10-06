import { getConnectedBrowserProvider } from '@/app/lib/wallet-session';
import { useConnection } from 'wagmi';
import { OpenHiveSdk } from '@openhive/sdk';
import { errorHandling } from '@/app/lib/helper';
import { useWallet } from '@/app/providers/wallet-provider';
import { WALLET_NETWORK_RECONNECT_MESSAGE } from '@/app/lib/wallet-network';


export function normalizeOpenHiveError(error: unknown) {
  if (!(error instanceof Error) && (typeof error !== 'object' || !error)) {
    return new Error(String(error || 'Unknown error'));
  }

  try {
    return errorHandling(error);
  } catch (handledError) {
    return handledError instanceof Error
      ? handledError
      : new Error(String(handledError));
  }
}

export function useOpenHiveSdk() {
  const {
    walletConnected: connected,
    address,
    currentNetwork,
    ensureWalletNetwork,
  } = useWallet();
  const connection = useConnection();

  const getOpenHiveSdk = async () => {
    if (!connected || !connection.connector || !address || address === '0x') {
      throw new Error('Wallet is not connected.');
    }

    const switched = await ensureWalletNetwork();

    if (!switched) {
      throw new Error(WALLET_NETWORK_RECONNECT_MESSAGE);
    }

    const provider = await getConnectedBrowserProvider(
      connection.connector,
      currentNetwork.chainId,
      address,
    );

    return OpenHiveSdk.create({
      provider,
      expectedWallet: { account: address, chainId: currentNetwork.chainId, walletName: connection.connector.name },
      rpcUrl: currentNetwork.service.rpcApi || currentNetwork.rpcs[0],
    });
  };

  return {
    address,
    connected,
    currentNetwork,
    getOpenHiveSdk,
  };
}
