# Background

The wallet token management modal already supported list/custom modes, but the list behavior still lagged behind the backend contract:

- A token row should be treated as already added when `token.address` matches the active wallet address.
- Contract addresses needed a direct copy action inside the list.
- The add/remove affordance needed to be icon-based instead of text-based.
- The async list-management logic had enough branching that it needed inline comments.

# What Changed

- Added a reusable copy action component at `src/app/components/copy-button.tsx`.
- Updated `src/app/pages/wallet/wallet-add-token-modal.tsx` to use `CopyButton` for each token contract address.
- Switched the list-row add/remove state to `token.address === active wallet address`.
- Replaced textual add/remove actions with icon-only buttons.
- Added focused comments for stale-request cancellation, search-mode pagination, backend-driven added-state detection, and local row-state synchronization after add/remove.

# Impact

- Users can copy contract addresses directly from the add-token list.
- The remove button now appears based on the backend row payload, which matches the real binding state for the current wallet.
- The add/remove icon updates immediately after a successful action without forcing a full list refresh.
- The copy action is now reusable in other wallet surfaces.

# Verification

- Ran `node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit`

# Follow-up / Known Limitations

- Other wallet copy affordances still use local inline buttons; they can be migrated to `copy-button.tsx` later if you want a single shared pattern across the app.
