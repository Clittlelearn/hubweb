# 2026-03-23 Route And Wallet Refactor

## Background

The app was shipping all page code in the initial bundle and the wallet state only existed as a local mock toggle. That made the first load heavier than necessary and made network-related UI state hard to reuse across the app.

## What Changed

### Route loading

* Converted route components in `src/app/routes.ts` to `React.lazy`.
* Wrapped the router in `Suspense` in `src/app/App.tsx`.
* Added `src/app/components/route-loading-screen.tsx` as the shared loading fallback.

### Wallet state

* Added `src/app/lib/wallet.ts` to centralize network metadata, default addresses, and explorer base URLs.
* Expanded `src/app/components/wallet-context.tsx` to manage:
  * `connected`
  * `address`
  * `network`
  * `currentNetwork`
  * `connect`
  * `disconnect`
  * `setNetwork`
* Added `localStorage` persistence for the wallet session.

### UI integration

* Updated `src/app/components/layout.tsx` to use shared network state instead of local network state.
* Updated wallet explorer links to follow the selected network.
* Updated `src/app/components/dashboard.tsx` so the displayed network name follows the selected network.
* Updated `src/app/components/wallet.tsx` so the overview card reflects the selected network.

## Impact

### User-facing

* The app now loads routes lazily instead of shipping all pages in a single entry chunk.
* Network selection is shared across the layout and supported pages.
* Wallet and network state now persist across refreshes.

### Developer-facing

* Network configuration now has a single source of truth.
* Future wallet integration work has a cleaner provider boundary.

## Verification

Verified with:

```bash
npm run build
```

Build completed successfully after the refactor.

Observed bundle change:

* Previous build had a single main JS bundle around `944 kB`.
* Refactored build splits code by route, with the main entry reduced to about `238.52 kB`.

## Follow-up / Known Limitations

* `dashboard` is still the heaviest page chunk because it contains the chart-heavy dashboard UI.
* Wallet behavior is still mock-based; the provider is now structured for future real wallet integration, but it is not yet connected to an actual chain or wallet adapter.
* Mock data is still embedded in large page components and should be extracted into dedicated data modules or hooks in a later refactor.
