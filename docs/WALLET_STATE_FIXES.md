# Wallet, Delegation and Network Fixes

Date: 2026-09-22

## Changes

- Active delegations request `is_deinvested=0` and also exclude closed rows defensively. Closed records no longer contribute to the displayed delegated amount. Positions refresh every 15 seconds; transaction submission schedules refreshes through 60 seconds. A submitted hash alone is not proof of a completed undelegation.
- Wallet native assets come from the connected account's balances or account-associated catalog entries. Globally activated proposals are no longer automatically inserted into every wallet. OHI remains the default native asset. ERC20 entries must be associated with the current account.
- Wallet and header share one query keyed by network, chain ID and account. Failed balance requests propagate as errors rather than becoming empty lists/zero balances. The last successful result remains visible with a refresh error. Before the first successful read the overview shows `--`.
- Native OHI identification accepts the actual `NATIVE`/`assetType=OHI` API shape. Previously the provider expected `Native` and the zero contract address, and failed to recognize the real balance.
- HubSQL account balance lookup compares addresses case-insensitively and selects only that account, not the entire balance table. An account with no indexed holdings returns an empty balance list; database failures still return an error.
- `GET /api/v1/assets/{contract}/metadata` verifies that the contract is indexed, then reads `name()`, `symbol()` and `decimals()` through HubSQL's configured node. Metadata is cached for five minutes; failed reads have a 30-second retry window. ABI strings and bytes32 names are supported. Invalid decimals are rejected, not invented. No browser-to-node asset catalog calls were added.
- Add Token displays the directory before metadata enrichment, then progressively fills names and symbols with four concurrent reads. Search matches name, symbol, address or identifier before local pagination; address matches are prioritized for enrichment. Search debounce is 250ms. Custom-token lookups include the account so added status is account-specific.
- Public read models have a five-minute browser snapshot, capped at 60 queries. Reload restores the snapshot and immediately revalidates it. Normal query freshness is 15 seconds. The cache does not persist wallet providers, signing data, private keys or mutations. Account/network query keys remain distinct; pagination placeholders cannot cross those scopes.
- Send and Flow now request the correct wallet network before obtaining a signer. SDK-based governance/delegation/lock already use the shared network guard. The guard verifies actual `eth_chainId` and the selected account after switching. Unknown networks may be added via wallet confirmation; rejection stops the operation. Wallet native currency uses 18 EVM decimals, independently of 8-decimal indexed OHI units. Existing Bridge switching is retained.

## Verification

- `npm run check`: typecheck, SDK build and frontend production build passed.
- `cd tools/bridge-lab && npm test`: 35 tests passed.
- `node test-wallet-state-ui.mjs`: mocked wallet/API regression passed for owned-token filtering, names/search, reload cache, failed balance refresh, account changes, switching/rejection and closed delegations. Desktop/mobile screenshots are in `tools/bridge-lab/test-results/wallet-state/`.
- Governance wallet UI, Flow balance UI, Bridge deployment UI and transaction confirmation UI regressions passed.
- HubSQL rebuilt; 34 C++ tests passed, including new ABI metadata decoder tests.
- No live transactions were sent. The user's specific undelegation still needs its account/hash to verify indexing.

## Activation Status

### Old-Backend Compatibility Follow-Up (Historical)

The LAN Add Token errors were traced to the still-running old HubSQL binary: its missing metadata route returned a truncated HTTP 404, which Vite reported as a socket hang-up / HTTP 500. Runtime and on-disk executable hashes differed.

The catalog now advertises `metadata_supported: true`. Frontend clients skip all metadata requests when this flag is absent, show a restart notice, and do not label unknown metadata as verified. HTTP/proxy failures stop the batch after at most four in-flight requests and apply a 30-second backoff. Per-contract API failures are cached separately so unsupported contracts do not block valid tokens.

`node test-token-metadata-compat.mjs` covers legacy catalog responses, blank proxy 500s, failure backoff, partial results, and recovery. Real LAN verification at `http://192.168.1.14:8848/wallet` opened Add Token and searched using the live old HubSQL: zero metadata requests and zero server-error responses. The wallet was simulated and no writes were performed. The compatibility fix prevents error floods; complete names still require the updated HubSQL service.

Frontend changes are served by the existing local Vite service, including its LAN forwarding URL. No deployment to node 110 was performed.

### Progressive Catalog Loading Follow-Up

After the user restarted HubSQL, the metadata endpoint worked, but the modal still waited for metadata reads across the entire catalog before displaying the first page. The live catalog contained 990 entries and returned in approximately 74ms; the all-entry enrichment barrier caused the prolonged loading screen.

- Directory fetching and metadata enrichment are now separate. The first 20 entries render immediately; names arrive incrementally without blocking scrolling or search.
- Search and scrolling do not refetch the directory. Changing the search prioritizes matching entries. Closing the modal or changing tabs stops queued enrichment; already in-flight shared reads may finish.
- Unknown metadata remains unverified and cannot be added with guessed decimals. Partial failures retain the usable directory and display a warning.
- Metadata caching now holds up to 2,048 entries with incremental eviction rather than clearing the entire cache at capacity.
- `cd tools/bridge-lab && npm run test:catalog-progressive` tests 1,000 entries with blocked metadata responses, local pagination, progressive name/address search, cancellation and desktop/mobile layout. Initial directory rendering measured 607ms in this fixture.
- Real LAN verification at `http://192.168.1.14:8848/wallet` rendered the list in approximately 756ms. Address search found `Bridge Lab Token (HBR)` at `0x5af1bf521e0576502897a9a7e8ee11fcd5157082`. No page script errors occurred. This used a simulated wallet and real HubSQL reads, with no transaction writes.
- `npm run check`, metadata compatibility tests and wallet state UI tests passed again.

Current status: the restarted HubSQL advertises `metadata_supported: true`, and its HBR metadata endpoint has been verified. This progressive loading patch changes only the frontend; refresh the browser without restarting HubSQL or clearing any data. No remote node deployment was performed.
