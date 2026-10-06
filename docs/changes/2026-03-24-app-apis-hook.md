# Background

The project already had a `BackedApi` class, but API instances were still intended to be created ad hoc from the active network config. That would spread `new BackedApi(...)` logic across components and make network-aware API access harder to standardize.

# What Changed

- Extended `src/app/apis/backed-api.ts` so `BackedApi` accepts and stores `rpcApi`.
- Added `src/app/apis/use-app-apis.ts` to centralize:
  - `backedApi`
  - `backedAppApi`
  - `rpcApi`
  - current active network binding
- Added module-level caching so each network reuses the same API instances instead of recreating them on every hook call.
- Added `src/app/apis/index.ts` as the public entry for API access.

# Impact

- Components no longer need to manually construct:
  - `new BackedApi(activeNetwork.service.baseApi, '/memeServer/hub', rpcApi)`
  - `new BackedApi(activeNetwork.service.baseApi, '/memeServer/app', rpcApi)`
- The current network can now be consumed with:
  - `useAppApis()`
  - `useBackedApi()`
  - `useBackedAppApi()`
  - `useRpcApi()`

# Verification

- Ran `npm run check`
- Ran `./node_modules/.bin/eslint eslint.config.js`

# Follow-up / Known Limitations

- This pass only added the shared API entry and hook layer. It did not yet migrate existing page-level mock data to live backend requests.
