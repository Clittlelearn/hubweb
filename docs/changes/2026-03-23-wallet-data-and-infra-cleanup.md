# 2026-03-23 Wallet, Data, And Infra Cleanup

## Background

After the first round of route splitting, the project still had three structural problems:

* The wallet layer only managed connection state and address, while wallet-related display data still lived inside page components.
* Mock data for multiple pages was embedded directly in component files, making pages large and harder to maintain.
* The repository still carried a large amount of unreachable UI code, stale dependencies, and missing engineering basics like TypeScript checking.

## What Changed

### Wallet layer

* Expanded `src/app/components/wallet-context.tsx` so the provider now exposes:
  * selected network
  * selected network metadata
  * wallet snapshot data for the active network
  * explorer URL
  * formatted short address
* Added `src/app/data/wallet.ts` as the single mock wallet data source for:
  * balances
  * token list
  * transaction history
  * price and balance summary used by layout and wallet page
* Updated wallet-related UI to consume provider data instead of local hardcoded values:
  * `src/app/components/layout.tsx`
  * `src/app/components/wallet.tsx`
  * `src/app/components/connect-wallet-prompt.tsx`

### Mock data extraction

* Added data modules for page-level mock content:
  * `src/app/data/dashboard.ts`
  * `src/app/data/governance.ts`
  * `src/app/data/validators.ts`
  * `src/app/data/lock.ts`
  * `src/app/data/flow.ts`
  * `src/app/data/wallet.ts`
* Updated page components to import their mock content from data modules instead of defining it inline:
  * `dashboard.tsx`
  * `governance.tsx`
  * `validators.tsx`
  * `lock-unlock.tsx`
  * `flow.tsx`
  * `wallet.tsx`

### Engineering infrastructure

* Added `tsconfig.json`.
* Added `npm run typecheck`.
* Added `npm run check` to run `typecheck` and `build`.
* Renamed the package from the Figma export default to `openhive-hub`.
* Moved `react` and `react-dom` into normal application dependencies in `package.json`.
* Added a minimal `eslint.config.js` that loads successfully with the currently installed packages.

### Dependency and leftover cleanup

* Removed many direct dependencies that were only used by unreachable UI wrappers or unused generated files.
* Deleted unreachable component and UI files that were not imported from the real app entry graph.
* Removed the empty `src/styles/fonts.css` import and deleted the file.
* Removed the unused logo export under `src/imports/pasted_text/`.

## Impact

### User-facing

* Wallet-related values shown in the header and wallet page now come from a shared provider-backed mock data source.
* Network changes now affect more of the wallet-related UI consistently.
* The final CSS bundle is smaller because a large set of unreachable UI wrappers was removed.

### Developer-facing

* Page components are smaller and easier to reason about because their mock data is no longer embedded inline.
* The wallet layer has a cleaner boundary and is better positioned for a future real wallet adapter or chain integration.
* The repo now has working TypeScript checking and a reusable `check` command for local validation.

## Verification

Verified with:

```bash
npm run typecheck
npm run check
./node_modules/.bin/eslint eslint.config.js
```

Results:

* `typecheck` passed.
* `check` passed.
* The minimal ESLint config loads successfully.

Observed build output changes:

* The CSS bundle dropped from the previous `138.82 kB` range to about `80.31 kB`.
* The route-level lazy loading introduced earlier remains in place and continues to split the dashboard insights chunk from the dashboard shell.

## Follow-up / Known Limitations

* The current wallet layer is still mock-backed. It is now centralized, but it is not connected to a real wallet adapter or on-chain source.
* The current ESLint setup is intentionally minimal. TypeScript-specific lint rules were not enabled in this pass.
* `dashboard-insights` remains the heaviest lazily loaded dashboard chunk because it still contains all chart-heavy content.
