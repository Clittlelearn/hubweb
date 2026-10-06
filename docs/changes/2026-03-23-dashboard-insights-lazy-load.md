# 2026-03-23 Dashboard Insights Lazy Load

## Background

After the first route-level code splitting pass, the `dashboard` route was still the heaviest page chunk because it directly imported `recharts` and rendered all chart-heavy sections in the main route component.

## What Changed

### Dashboard split

* Moved the chart and recent-block sections out of `src/app/components/dashboard.tsx`.
* Added `src/app/components/dashboard-insights.tsx` to own:
  * TVL chart
  * Daily transactions chart
  * Staking flow chart
  * Recent blocks list
* Loaded `dashboard-insights` with `React.lazy` and `Suspense` inside the dashboard page.

### Data extraction

* Added `src/app/data/dashboard.ts` to hold the static dashboard datasets:
  * `tvlData`
  * `txVolumeData`
  * `stakingFlowData`
  * `recentBlocks`

### Loading state

* Added a dashboard-specific skeleton fallback in `src/app/components/dashboard.tsx` so the header and stat cards render immediately while insights load.

## Impact

### User-facing

* The dashboard page can render its top section and stat cards before the chart-heavy insights module finishes loading.
* Large charting code is no longer bundled into the dashboard route's main page chunk.

### Developer-facing

* The dashboard file is slimmer and easier to navigate.
* Chart-related code and dashboard datasets now have clearer ownership boundaries.

## Verification

Verified with:

```bash
npm run build
```

Build completed successfully.

Observed bundle change:

* Before this change, `dashboard` was about `405.79 kB`.
* After this change, `dashboard` is about `7.94 kB`.
* The heavy content now lives in `dashboard-insights` at about `399.77 kB`.

## Follow-up / Known Limitations

* This is a structural split, not a data-level optimization. The charting chunk is still large because it still contains `recharts` and all dashboard insights UI.
* On the first dashboard visit, the insights chunk is still requested immediately after the route renders because the lazy section is mounted right away.
* If deeper performance work is needed, the next step should be to defer some insights by interaction or viewport visibility, or reduce charting-library cost further.
