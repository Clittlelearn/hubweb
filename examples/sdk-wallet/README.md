# OpenHive SDK Wallet Example

This is a standalone Vite example for testing `@openhive/sdk` with an injected browser wallet.

It does not import the main app wallet provider, routes, styles, or app code under `src/app`.

## Run

From the repository root:

```bash
npm --prefix examples/sdk-wallet run dev
```

Build check:

```bash
npm --prefix examples/sdk-wallet run build
```

The example scripts build `packages/sdk` first, then run against the SDK package entry.
