import { injected } from 'wagmi/connectors';
import type { EIP1193Provider } from 'viem';

export const OKX_CONNECTOR_ID = 'okx-injected';

export function okxInjectedConnector() {
  return injected({
    shimDisconnect: true,
    target: {
      id: OKX_CONNECTOR_ID,
      name: 'OKX Wallet',
      // Do not fall back to window.ethereum: another wallet may own it.
      provider: (window) => (window as typeof window & {
        okxwallet?: EIP1193Provider;
      })?.okxwallet,
    },
  });
}

export function isOkxWallet(name: string) {
  return /\bok(?:x|ex)\b/i.test(name);
}
