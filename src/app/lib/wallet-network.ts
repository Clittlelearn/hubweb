import { getAddEthereumChainParams, isMissingChainError, toHexChainId,
  type Eip1193Provider } from '../providers/wallet-provider.utils';
import type { WalletNetwork } from './wallet';

export const WALLET_NETWORK_RECONNECT_MESSAGE =
  'Unable to switch wallet to the selected network. Please reconnect your wallet manually.';

export async function switchWalletForTransaction(
  provider: Eip1193Provider, network: WalletNetwork, expectedAddress?: string,
) {
  const readChain = async () => Number(BigInt(String(await provider.request({ method: 'eth_chainId' }))));
  if (await readChain() !== network.chainId) {
    const params = [{ chainId: toHexChainId(network.chainId) }];
    try {
      await provider.request({ method: 'wallet_switchEthereumChain', params });
    } catch (error) {
      if (!isMissingChainError(error)) throw error;
      await provider.request({ method: 'wallet_addEthereumChain', params: [getAddEthereumChainParams(network)] });
      await provider.request({ method: 'wallet_switchEthereumChain', params });
    }
  }
  if (await readChain() !== network.chainId) throw new Error('Wallet network switch was not completed.');
  if (expectedAddress) {
    const accounts = await provider.request({ method: 'eth_accounts' }) as string[];
    if (accounts?.[0]?.toLowerCase() !== expectedAddress.toLowerCase()) {
      throw new Error('Wallet account changed. Review the transaction again.');
    }
  }
}
