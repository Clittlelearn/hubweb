# OKX Wallet Support

Date: 2026-09-23

## Connection and Signing

The Hub previously configured only generic injected-wallet discovery and
EIP-6963. It did not explicitly discover the OKX EVM provider at
`window.okxwallet`. The new targeted connector supports that provider without
falling back to another extension's `window.ethereum`.

- Prefer the OKX EIP-6963 connector when the extension announces one; hide the
  duplicate legacy OKX option.
- Retain the generic Browser Wallet option when it points to a different
  provider. Installing OKX must not hide a legacy MetaMask provider.
- Existing transaction flows continue to use the selected Wagmi connector's
  provider for network switching, estimation and wallet signing. No private key
  input, automated confirmation or alternative transaction submission API was
  introduced.

Reference: [OKX EVM provider API](https://web3.okx.com/zh-hans/onchainos/dev-docs/wallet/dapp-connect/chains/evm/provider).

## Using the Updated Page

Refresh the Hub, disconnect the old connection, and select **OKX Wallet** in
Connect Wallet. Approve connection and any network switch in OKX. Review each
transaction in the wallet before confirming it. No node restart is needed.

Connection compatibility alone does not solve an RPC rejection, inaccessible
wallet RPC URL, account change, locked extension or already-pending wallet
prompt. If confirmation still does not open, collect the operation/page and
displayed error; do not repeatedly submit or provide private keys.

## Verification

`cd tools/bridge-lab && npm run test:okx-wallet`

The browser regression uses simulated providers and mocked HubSQL reads. It
covers legacy OKX plus MetaMask, EIP-6963 plus MetaMask, legacy OKX alone, and
EIP-6963-only OKX. Assertions cover unique wallet discovery, auto network switch,
normal-transfer confirmation handoff, Bridge confirmation handoff, rejection,
selected provider isolation, reload reconnection, and desktop/mobile screenshots.
All confirmation requests deliberately reject; network writes are blocked.

This is not a test of a real OKX extension popup or an on-chain transaction.
The user's original failure has not been reproduced inside their extension.

## Disabled Transfer Confirmation (2026-09-23)

The user subsequently reached the real OKX confirmation screen, but its network
fee was blank and Confirm was disabled. This is a different symptom from wallet
discovery. A read-only check of node 110 returned a balance and a Gas estimate,
but `eth_feeHistory(0x5, latest, [10,50,90])` returned a fixed single-block
placeholder (`oldestBlock=0x1`, one reward percentile). This response is not
a usable EIP-1559 fee history. It is a compatibility risk, not proof of the
extension's exact internal failure; its request trace has not been captured.

For Wallet-page OHI/ERC20 transfers only, `okx-transfer.ts` now explicitly
prepares legacy type-0 parameters when the selected connector is OKX and the
chain is HiveX Devnet (12315). It obtains `gasPrice` and estimates `gasLimit`
through that same wallet's provider, preserves recipient/value/calldata, and
checks the account/network before and after preparation. Invalid or failed
estimates stop before signing; preparation times out after 15 seconds. No
price floor, automatic retry, nonce override or unattended signature is used.
MetaMask, other chains and Bridge/Flow/governance are unchanged by this patch.
HiveX's `ca/eth_trans.cpp` supports legacy EIP-155 transactions.

This follows the [OKX send-transaction documentation](https://web3.okx.com/zh-hans/onchainos/dev-docs/wallet/dapp-connect/chains/evm/web-send-transaction),
which recommends supplying Gas price on private chains. It reduces dependence
on wallet fee inference; it does not repair the node's fee-history API, guarantee
an accurate native UTXO fee display, or disable wallet safety checks.

Run `node tools/bridge-lab/test-okx-transfer.mjs` for preparation/failure guards
and `cd tools/bridge-lab && npm run test:okx-wallet` for the actual UI request
payload assertions. These are simulated-provider tests, not a verified real
OKX Confirm button or a live transfer. Cancel the old unsigned prompt, refresh
the page and reconnect OKX before reviewing a new request. If the wallet has
already returned a hash, check that transaction first rather than resending.
