# Background

The existing wallet layer only simulated connection state in local storage. The project needed a real wallet connection adapter so the UI could reflect an injected browser wallet instead of mock connect/disconnect behavior.

# What Changed

- Added `wagmi`, `viem`, and `@tanstack/react-query` to the project dependencies.
- Added `src/app/lib/wagmi.ts` to centralize Wagmi config and the shared TanStack Query client.
- Refactored `src/app/providers/wallet-provider.tsx` so `WalletProvider` now wraps children with:
  - `WagmiProvider`
  - `QueryClientProvider`
  - the existing app-specific wallet context
- Replaced the old local-storage-only wallet session logic with Wagmi hooks:
  - `useConnection` for connected address/status
  - `useConnect` for injected wallet connection
  - `useDisconnect` for disconnect handling
  - `useConnectors` for selecting the configured connector
- Kept the existing `useWallet()` API stable for the rest of the app, so page components did not need to change.
- Reduced local storage persistence to the selected app network only via `openhive.wallet-network`.

# Impact

- Wallet connect/disconnect is now driven by an injected browser wallet through Wagmi instead of mock state.
- Existing pages continue to read `connected`, `address`, `currentNetwork`, `walletData`, and `explorerUrl` from the same `useWallet()` interface.
- App-level network selection still works as before, but it is not yet mapped to real OpenHive chain switching in Wagmi because the repository does not contain authoritative OpenHive `chainId` and `rpcUrl` values.

# Verification

- Ran `npm install wagmi viem @tanstack/react-query`
- Ran `npm run check`
- Ran `./node_modules/.bin/eslint eslint.config.js`

# Follow-up / Known Limitations

- The current Wagmi config uses a generic injected-wallet setup for connection state only.
- OpenHive chain definitions should be added next so `setNetwork` can drive real `switchChain` behavior and network-add flows instead of remaining an app-local selector.
