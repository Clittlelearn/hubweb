# HiveX Multi-Wallet Signing

## Connection and submission

Wagmi owns the selected connector, account and chain. EIP-6963 discovers installed
wallets; the explicit OKX connector remains a fallback for older extensions.
No transaction path should choose a global window.ethereum in place of the
selected connector.

All wallet transaction submissions share
`packages/sdk/src/wallet-session.ts::sendWalletTransactionRequest`.
This covers native/ERC20 transfers, native business transactions (including
undelegate), Flow, bridge transfers and bridge deployment. The development
tool's explicit local test-key signer is separate and does not represent a
connected wallet.

The shared sender:

1. Checks the expected account and chain on the selected provider.
2. Rejects conflicting transaction from/chainId fields.
3. Estimates Gas through that provider, then checks account/chain again.
4. Preserves raw ETH to and the custom JSON payload independently.
5. Sends one eth_sendTransaction request and returns its hash immediately.
6. Never retries rejected or ambiguous signing requests automatically.

OKX on HiveX 12315 receives explicit legacy Gas pricing when no fee fields were
specified. Explicit EIP-1559 fields are retained. Other chains/wallets keep their
wallet-selected pricing.

The SDK now returns `{ hash }`, not an ethers TransactionResponse: use the
existing bounded receipt/by-hash confirmation helpers instead of `response.wait()`.
Getting a hash means submitted, not confirmed. Existing bridge journals preserve
late hashes and prevent automatic duplicate submissions.

## Node compatibility

The native business executor still uses JSON `to`. Standard ETH queries must
instead reproduce the signed envelope:

- sendRawTransaction and transaction/receipt/block/log hashes use the raw RLP hash.
- Transaction and receipt to use raw ETH to; creation transactions use null.
- Signature v/r/s and accessList come from the stored signed RLP.
- Both raw ETH and historical internal hashes remain accepted lookup inputs.
- Internal database keys, consensus hashes and JSON business routing are unchanged.

An address mismatch in a wallet is not automatically a business-address error.
Record the failing wallet method, expected account/network and full RPC response.

## Validation

From the frontend root:

```bash
npm run check
cd tools/bridge-lab
npm test
npm run test:okx-wallet
npm run test:flow-balance-ui
npm run test:deployment
npm run test:deployment-ui
```

The wallet tests use mocked providers; deployment tests use isolated in-memory
chains. They do not prove a real OKX extension transaction succeeded on HiveX.

Node read-only validation:

```bash
node eth_test/check_wallet_envelope.mjs http://192.168.1.110:13134
```

This reconstructs historical signed transactions using RPC fields and verifies
their hash, recovered sender, receipt and canonical block without broadcasting.
