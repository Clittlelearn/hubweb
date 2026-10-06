# Transaction Confirmation Limit

Dev Tools (ERC20 deployment, proposal and vote), Flow In/Out, bridge approval,
bridge contract deployment and bridge source-transaction tracking stop waiting
after 20 unsuccessful confirmation rounds.

- Each round queries both `eth_getTransactionReceipt` and
  `eth_getTransactionByHash`. Both must confirm the transaction.
- Raw ETH and internal HiveX hashes are checked as aliases within a round;
  they do not each consume a separate round.
- An ordinary confirmation loop waits 1.5 seconds between rounds. Bridge
  history refreshes every 5 seconds. RPC latency adds to this duration.
- A successful twentieth round still succeeds. Otherwise the UI exits waiting
  and reports **Transaction confirmation failed**, including the saved hash.
- RPC calls used for confirmation have request timeouts. A missing transaction
  cannot keep the confirmation loop alive indefinitely.
- Bridge history saves its unsuccessful source-check count and failure state.
  Reloading does not restart a failed check. **Recheck saved transaction** starts
  another read-only check of the same hash. Deployment Resume also checks its
  saved hash instead of signing again.
- A confirmed source awaiting cross-chain relayer delivery is a different state;
  this limit does not label slow relayer delivery as a failed source transaction.

This is a frontend confirmation failure, not proof of a chain revert or
cancellation. It does not release nonce reservations, clear MetaMask activity,
or resend the transaction. Reconcile the saved hash and account nonce before
manually retrying a business operation.

## Verification

From `tools/bridge-lab`, run `npm test` and
`node test-confirmation-ui.mjs` (frontend on port 5174). These tests mock RPC and
wallet activity; they do not submit real transactions. From the frontend root,
run `npm run check`.
