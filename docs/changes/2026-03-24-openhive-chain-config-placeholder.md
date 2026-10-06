# Background

The wallet layer had already been migrated to Wagmi for connection state, but the app still treated `devnet`, `testnet`, and `mainnet` as local UI-only selections because the repository did not contain OpenHive chain metadata.

# What Changed

- Added OpenHive chain metadata to `src/app/lib/wallet.ts`, including:
  - chain name
  - chain id
  - native currency
  - RPC URLs
  - explorer URLs
  - service endpoints
- Defined three Wagmi/viem chain objects:
  - `openHiveDevnet`
  - `openHiveTestnet`
  - `openHiveMainnet`
- Updated `src/app/lib/wagmi.ts` to use the OpenHive chain list instead of the temporary generic chain.
- Updated `src/app/providers/wallet-provider.tsx` so:
  - `connect()` connects against the currently selected OpenHive chain id
  - `setNetwork()` uses Wagmi `switchChain`
  - local network state syncs back from the connected wallet `chainId`

# Impact

- Network selection is no longer only a local label change. When a wallet is connected, changing the network now requests a real wallet chain switch through Wagmi.
- When the wallet is already on a configured OpenHive chain, the provider syncs the app network from the wallet chain id.
- The app still keeps the existing `useWallet()` interface stable for the rest of the UI.

# Verification

- Ran `npm run check`
- Ran `./node_modules/.bin/eslint eslint.config.js`

# Follow-up / Known Limitations

- Only the `devnet` parameters were provided explicitly.
- To avoid duplicate chain identities inside the wallet, this pass used placeholder ids for the remaining networks:
  - `testnet`: `12316`
  - `mainnet`: `12317`
- `testnet` and `mainnet` currently reuse the provided devnet RPC, explorer, and service endpoints as temporary placeholders and should be replaced with their real values when available.
