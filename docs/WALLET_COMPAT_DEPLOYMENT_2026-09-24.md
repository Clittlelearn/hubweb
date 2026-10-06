# Multi-wallet compatibility deployment: 2026-09-24

## Scope and exclusions

Unified the existing Wagmi/EIP-6963 connector and EIP-1193 signing paths. No new
wallet SDK, hosted signing service or private-key workflow was introduced.
Native/ERC20 transfers, business transactions, Flow and bridge transactions use
the selected connector and validate the account/network before submission.

The user's local `ca/transaction.cpp` change that unconditionally allows
undelegating remains untouched in `/home/wbl/hivex`. It was NOT deployed.
The binary was built from detached HEAD `07e651b` in
`/home/wbl/hivex-wallet-compat`, with only the wallet-RPC patch applied.
`git diff HEAD -- ca/transaction.cpp` in that worktree is empty.

## Node behavior

- JSON business `to` still controls native transaction execution.
- ETH transaction/receipt `to` now represents the signed raw ETH envelope.
- Real signature v/r/s, accessList and transaction index are returned.
- ETH send/query/block/log responses consistently use the raw ETH hash.
- Historical internal hashes remain accepted as lookup aliases.
- No database reset, protocol waiting-period bypass or forced process kill.

This fixes a verified inconsistency in RPC transaction reconstruction. It does
not establish that every reported OKX failure had this same cause.

## Deployed artifact

Source artifact:
`/home/wbl/hivex-wallet-compat/build/bin/openhive_v0.0.0_07e651b`

SHA-256:
`ca8b69dc6f1a2e0ba1e51783090a53e91c9893f40afe3a0664c16a94e40e69e2`

All seven hosts verified: `192.168.1.110`, `.161`, `.162`, `.163`, `.164`,
`.165`, `.166`. Each running process, on-disk executable and startup wrapper
agreed on the checksum. Nodes were upgraded sequentially, stopped nodes first.

Checkpoint after deployment: height **881**, block
`0xe111e2ce1e52f1dabbfa858c61e6f53e491a1d17b769931390950acf6a530745`.

Installed filename: `openhive_wallet_ca8b69dc6f1a2e0b` in the existing node
directory (`/root/wbl/9_6` on 110, `/root/9_6` on the other hosts).
Old executables remain in place. The previous startup wrapper is retained in
`wallet-upgrade-ca8b69dc6f1a2e0b/start_openhive.sh` below each node directory.
Never run old and new binaries against the same database simultaneously.

Local deployment evidence:
`/home/wbl/.cache/hivex/wallet-upgrade-20260924T115749/`.

110 frontend deployment also completed; remote typecheck, build, source-file
checksums and API checks passed. Frontend backup:
`/srv/hivex-hub/updates/frontend-20260924T034738Z`.
HubSQL's stale MySQL connection was recovered by restarting its indexer service;
MySQL and stored chain data were not reset.

## Verification

- Frontend `npm run check`: passed.
- Shared signing tests: 9 passed; existing bridge/confirmation tests: 35 passed.
- OKX browser mocks: four injection/discovery combinations passed locally and
  against the deployed 110 frontend, including network switching, confirmation
  handoff, user rejection and reconnect.
- Flow balance and bridge deployment UI regressions passed.
- Isolated bridge deployment: 19 submissions and 19 confirmations passed.
- Node CTest: `eth_signed_fields`, `eth_wallet_projection`, `eth_business_to`
  passed; full node compilation and linking passed.
- All seven nodes passed read-only signed-transaction reconstruction, sender
  recovery, receipt and canonical block checks for the two hashes below.
- All seven nodes passed block timestamp/nonce, Gas and fee-history checks.

Historical EIP-1559 samples:

1. Undelegating raw hash:
   `0x21902cfdacd2ec9ce573c54cb07825ce5998f940d749dbc6b97cabc34260c8ea`.
   Internal alias:
   `0x86ba261fb44c0843e0d87fbba2dbe9c8eb1fde1a678905be452720108eb7c4f7`.
   ETH recipient: `0x00530a843b706eb0647b430a023fdadd4231493f`.
   JSON business recipient: `0xefcf7aa81e23912ef883103c6b9692a44d82b742`.
2. Ordinary transfer raw hash:
   `0xea83ceb1af8d4bfae91845297bb3f1fa6f16b36cbcba6e08c3557c4736130791`.

Recheck without broadcasting, from `/home/wbl/hivex`:

```bash
node eth_test/check_wallet_envelope.mjs http://192.168.1.110:13134
node eth_test/check_wallet_rpc.mjs --rpc http://192.168.1.110:13134
.venv-testnet/bin/python scripts/testnet/restart_testnet.py status
```

No new testnet transaction was signed or sent during this deployment. Real
MetaMask/OKX extension confirmation and new-transaction inclusion remain a
manual acceptance test; mocked wallet success is not evidence of that result.
Refresh the Hub page and reconnect the intended wallet before acceptance testing.
Do not retry an ambiguous existing transaction before checking its history.

Implementation details: [MULTI_WALLET_SIGNING.md](MULTI_WALLET_SIGNING.md).
