# Background

The wallet connection modal worked on desktop, but on smaller screens the content could not scroll properly and wallet icons could appear cramped or visually distorted.

# What Changed

- Updated `src/app/components/wallet-connect-modal.tsx` so the modal uses overlay-level scrolling on smaller screens.
- Kept split-pane internal scrolling behavior for `md` and above.
- Adjusted modal sizing and spacing for mobile:
  - top-aligned overlay layout on small screens
  - smaller outer padding and corner radius on mobile
  - `100dvh`-based max-height behavior for desktop-sized split layout
- Changed wallet icon rendering from `object-cover` to `object-contain` with internal padding so wallet logos keep their aspect ratio and do not look squeezed.

# Impact

- The wallet modal can now be fully scrolled on mobile screens.
- Wallet option icons preserve their original proportions better across screen sizes.
- Desktop interaction remains effectively unchanged.

# Verification

- Ran `npm run check`
- Ran `./node_modules/.bin/eslint eslint.config.js`

# Follow-up / Known Limitations

- Build verification still passes with the existing Vite large-chunk warning on the main entry bundle. This responsive fix does not change that packaging issue.
