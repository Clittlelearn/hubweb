import { ethers, type Eip1193Provider } from 'ethers';
import { assertWalletContext } from '@openhive/sdk';

export async function getConnectedBrowserProvider(
  connector: { getProvider(): Promise<unknown> } | undefined,
  chainId: number, account: string,
) {
  const provider = await connector?.getProvider() as Eip1193Provider | undefined;
  if (!provider) throw new Error('Wallet provider is unavailable. Reconnect your wallet.');
  await assertWalletContext(provider, { chainId, account });
  return new ethers.BrowserProvider(provider);
}
