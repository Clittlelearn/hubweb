# Background

The app could connect wallets through Wagmi, but the UX was still a single-button action with no wallet chooser, no multi-wallet discovery UI, and no explicit empty state when no browser wallet was installed.

# What Changed

- Added `src/app/components/wallet-connect-modal.tsx` as a global wallet connection modal.
- Updated `src/app/providers/wallet-provider.tsx` so:
  - `connect()` now opens the modal instead of immediately connecting
  - installed wallets are detected from Wagmi connectors via `getProvider()`
  - recent wallet choice is persisted in local storage
  - connection status, pending state, and connection errors are tracked for the modal
- Updated `src/app/lib/wagmi.ts` to enable `multiInjectedProviderDiscovery` so browsers that expose multiple EIP-6963 wallets can surface more than one installed wallet option.
- Added an explicit empty state when no compatible wallet is detected.
- Added a right-side education panel and wallet install links, styled to match the existing OpenHive visual language.

# Impact

- Users now get a dedicated wallet-selection flow instead of a blind connect action.
- The modal supports multiple installed browser wallets when the browser/provider stack exposes them.
- If no wallet is detected, the UI now clearly explains the empty state and provides install paths instead of silently failing.
- Existing buttons in the header and page prompts continue to use the same `connect()` call site, so page-level code did not need to change.

# Verification

- Ran `npm run check`
- Ran `./node_modules/.bin/eslint eslint.config.js`

# Follow-up / Known Limitations

- The modal currently supports detected browser wallets surfaced through Wagmi/injected discovery. It does not yet include WalletConnect or app-specific mobile deep links.
- Build verification passed, but the main entry chunk now exceeds Vite's 500 kB warning threshold. The modal/provider layer is a good candidate for lazy loading or manual chunk splitting in a follow-up pass.
