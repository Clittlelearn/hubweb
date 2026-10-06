import { QueryClient } from "@tanstack/react-query";
import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { installReadModelCache } from './query-cache';
import { okxInjectedConnector } from './injected-wallets';
import {
  openHiveDevnet,
  openHiveMainnet,
  openHiveTestnet,
  WAGMI_CHAINS,
} from "./wallet";

export const wagmiConfig = createConfig({
  chains: WAGMI_CHAINS,
  connectors: [
    okxInjectedConnector(),
    injected({
      shimDisconnect: true,
    }),
  ],
  multiInjectedProviderDiscovery: true,
  transports: {
    [openHiveDevnet.id]: http(openHiveDevnet.rpcUrls.default.http[0]),
    [openHiveTestnet.id]: http(openHiveTestnet.rpcUrls.default.http[0]),
    [openHiveMainnet.id]: http(openHiveMainnet.rpcUrls.default.http[0]),
  },
});

const MANUAL_RECONNECT_KEY = 'hivex.wallet-manual-reconnect';
let manualReconnectRequired = false;
try {
  manualReconnectRequired = window.localStorage.getItem(MANUAL_RECONNECT_KEY) === 'true';
} catch { /* Storage may be unavailable in a restricted wallet browser. */ }

export function isManualWalletReconnectRequired() {
  return manualReconnectRequired;
}

export function setManualWalletReconnectRequired(required: boolean) {
  manualReconnectRequired = required;
  try {
    if (required) window.localStorage.setItem(MANUAL_RECONNECT_KEY, 'true');
    else window.localStorage.removeItem(MANUAL_RECONNECT_KEY);
  } catch { /* Keep the current session disconnected even without persistence. */ }
}

// Injected wallets can announce accounts again after disconnecting. Do not let
// those events silently undo a failure that requires the user's explicit retry.
const stopReconnectGuard = wagmiConfig.subscribe(state => state.status, status => {
  if (manualReconnectRequired && status !== 'disconnected') {
    wagmiConfig.setState(state => ({ ...state, connections: new Map(), current: null, status: 'disconnected' }));
  }
});

export const wagmiQueryClient = new QueryClient({ defaultOptions: { queries: {
  staleTime: 15_000, gcTime: 10 * 60_000, retry: 1,
} } });
const stopPersistence = installReadModelCache(wagmiQueryClient,
  JSON.stringify([import.meta.env.VITE_HUBSQL_API_URL, import.meta.env.VITE_HIVEX_RPC_URL]));
if (import.meta.hot) import.meta.hot.dispose(() => { stopPersistence(); stopReconnectGuard(); });
