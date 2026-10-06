# Background

The previous responsive pass made the wallet modal usable on mobile, but the scroll behavior happened at the overlay level instead of inside the modal. This did not match the modal behavior used elsewhere in the project.

# What Changed

- Updated `src/app/components/wallet-connect-modal.tsx` so the backdrop/overlay no longer scrolls.
- Moved scroll responsibility back into the modal content area.
- On smaller screens, the modal now uses one internal scroll container for the stacked content.
- On `md` and above, the existing split-panel internal scroll behavior remains in place.

# Impact

- The wallet modal now behaves consistently with the rest of the project's dialogs.
- Users scroll inside the modal body instead of scrolling the whole overlay layer.
- The responsive fixes from the previous pass remain intact.

# Verification

- Ran `npm run check`
- Ran `./node_modules/.bin/eslint eslint.config.js`

# Follow-up / Known Limitations

- Build verification still passes with the existing Vite large-chunk warning on the main entry bundle.
