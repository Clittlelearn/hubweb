# Bridge Transaction Recovery

## 2026-09-22 Incident

The wallet completed a 100 HBR transfer for
`0xeb26a104ea1347D4a71fd96f5Cf2F1170ca22BEb`, but the user reported that Hub
remained busy without a history record. Read-only chain checks confirmed:

- Source: Local BSC, chain 31338, block 51.
- Source transaction:
  `0x56e3a8bdf98352888dadb807a9a23fcbd4a3349186262da12016db0466b99de7`.
- Message:
  `0x09a984e00490c410efd7f990817702f5aed1e83925d7ebb52d84e277a25e4ac7`.
- Destination: HiveX, chain 12315, block 844.
- Destination transaction:
  `0xf213c648a695fe09b46596b1efff963fc45084ccdc427dfd9f725e831edc7006`.
- Local BSC balance: 9,900 HBR. HiveX balance: 100 HBR.
- Successful source receipt/transaction, Dispatch event, destination receipt/
  transaction, ProcessId and Mailbox.delivered were verified. Nothing was resent.

The precise browser failure cannot be established from chain data alone. The
previous frontend waited indefinitely for the wallet's eth_sendTransaction
promise before recording the transfer. Approval requests were not journaled.
That gap is now protected; no claim is made that a wallet timeout was directly
observed on the colleague's browser.

## Restore a Missing Record

1. Refresh the LAN Hub page and connect the original sending wallet.
2. Select the original route and direction, e.g. Local BSC -> HiveX.
3. Under Transfers, enter the source transaction hash in Source transaction hash.
4. Click the search icon (Recover existing transaction).

Recovery only reads ETH RPC. It verifies sender, Router, calldata, destination
domain, amount, receipt and canonical source block. Saved pending requests also
check their exact transaction payload, value, nonce and known hash. A recovered
transfer is saved in this browser and normal delivery tracking resumes.

Use the source Router transaction, not the approval hash or destination hash.
For a saved pending approval, its matching approval hash can instead be reconciled
to release that approval's waiting state. A source transaction that is still
unconfirmed cannot be imported as successful.

## Waiting and Persistence

- Before requesting a wallet transaction, save the account, route, phase,
  payload, value and nonce under `hub.bridge.submissions.v1`.
- Storage failure stops submission. Wallet reads have a 15-second timeout;
  interactive wallet requests have a 120-second limit.
- Save a returned hash immediately, including a late hash after timeout. A
  transfer hash is saved to `hub.bridge.history.v1` before delivery polling.
- An ambiguous wallet result remains unresolved and blocks another submission
  for that account. Explicit rejection (4001) releases that request.
- A timeout does not cancel a wallet request or prove a chain revert. Do not
  delete browser data or resend to clear it. Reconcile with the wallet first.
- Existing receipt/by-hash confirmation retains the 20-round limit.
- Browser history remains origin-specific and is not centrally synchronized
  across PCs. Recovery changes only the browser where it is performed.

## Verification

`npm test` in `tools/bridge-lab` includes wallet timeout/late-result, storage
failure, explicit rejection, route/payload validation and canonical-block tests.
`node test-bridge-recovery-ui.mjs` reads the incident's already confirmed transaction
through the LAN Hub, imports it into an isolated browser, and tests refresh plus a
mock wallet that never returns. It never broadcasts a real transaction.

Run `npm run check` from the frontend root for type checking and the production build.
