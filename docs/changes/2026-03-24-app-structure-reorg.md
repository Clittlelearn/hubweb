# Background

Most route pages, layout code, and the wallet provider were still stored under `src/app/components/`, which mixed page-level modules with reusable UI and made the directory hard to reason about as the app grew.

# What Changed

- Moved route pages into `src/app/pages/`:
  - `dashboard/page.tsx`
  - `dashboard/dashboard-insights.tsx`
  - `wallet/page.tsx`
  - `validators/page.tsx`
  - `governance/page.tsx`
  - `lock/page.tsx`
  - `flow/page.tsx`
- Moved the shell layout into `src/app/layouts/app-layout.tsx`.
- Moved the wallet state provider into `src/app/providers/wallet-provider.tsx`.
- Updated `src/app/routes.ts` to lazy-load pages and layout from their new locations.
- Updated `src/app/App.tsx` and shared components to import the wallet provider from `src/app/providers/`.
- Renamed page component function names to clearer route-oriented names such as `DashboardPage`, `WalletPage`, and `FlowPage`.

# Impact

- Route pages are now separated from reusable components, which makes ownership clearer and keeps `src/app/components/` focused on shared UI and cross-page building blocks.
- Layout and provider concerns now have explicit homes, which reduces ambiguity when adding new application-level modules.
- The routing layer remains lazy-loaded and behavior is unchanged for end users.

# Verification

- Ran `npm run check`
- Ran `./node_modules/.bin/eslint eslint.config.js`

# Follow-up / Known Limitations

- This pass only reorganized high-level module boundaries. Page-local subcomponents are still embedded inside some large page files and can be split further later if needed.
