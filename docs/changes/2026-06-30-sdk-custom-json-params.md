# Background

`docs/eth_sendRawTransaction_custom_json.md` defines the current custom JSON payload accepted by `eth_sendRawTransaction`.

The SDK and app call sites still used the older payload shape in several places, including `delegatinged_amount`, `vote_type`, `gas`, and validator addresses inside JSON data. That did not match the new rule that the raw ETH transaction supplies fields such as `to` and, for normal transfers, `value`.

# What Changed

- Updated `packages/sdk` payload builders to emit the documented custom JSON fields:
  - `tx` / `transaction`
  - `stake`
  - `unstake`
  - `delegating`
  - `undelegating`
  - `bonus`
  - `lock`
  - `unlock`
  - `vote`
  - `proposal`
  - `revoke_proposal`
- Added SDK methods for the newly covered transaction types:
  - `transaction`
  - `transfer`
  - `stake`
  - `unstake`
  - `proposal`
  - `revokeProposal`
- Kept compatibility for older SDK inputs where low-risk:
  - `fund` remains an alias for normal `tx`
  - `delegatinged_amount` is still accepted and converted to `amount`
  - `to_addr` is still accepted for older delegate/undelegate callers
  - `vote_type` is still accepted and converted to `vote`
  - `gas` is still accepted for older unlock callers and converted to `gas_asset`
- Updated app `OpenHiveSdk` call sites:
  - `src/app/pages/validators/use-validators-page-state.ts`
  - `src/app/pages/lock/use-lock-page-state.ts`
  - `src/app/pages/governance/use-governance-page-state.ts`
- Updated `src/app/lib/transaction-model.ts` so the local helper emits the same JSON shape as the SDK, even though it is not currently imported by other app code.
- Updated `packages/sdk/README.md` with the new call examples and the normal transfer rule that amount must be sent through raw tx `value`, not JSON `amount`.

# Impact

- App staking/delegation transactions now send:
  - `type: "delegating"`
  - `amount`
  - `delegate_type`
  - validator address as raw transaction `to`
- App undelegation transactions now send:
  - `type: "undelegating"`
  - `utxo_hash`
  - validator address as raw transaction `to`
- App unlock transactions now use `gas_asset` instead of the old `gas` field.
- App governance votes now send `vote: "1"` or `vote: "0"` instead of `vote_type`.
- Normal transfer SDK calls no longer encode `amount` in JSON. The amount is carried by the raw ETH transaction `value` field.

# Verification

- Ran `cd packages/sdk && npm run build`
- Ran `npm run typecheck`
- Ran `npm run build`
- Manually generated and decoded SDK transaction data for:
  - `delegating`
  - normal `tx`
- Confirmed no old SDK parameter fields remain in app hooks/pages/lib code:
  - `delegatinged_amount`
  - `vote_type`
  - `bonus_first_choose`
  - `encode_info`
  - `gas: { ... }`

# Follow-up / Known Limitations

- `src/app/data/mmc-rpc-api.json` still contains backend API example fields such as `delegatinged_amount`, `to_addr`, and `vote_type`. These are static API reference data, not active `OpenHiveSdk` call parameters.
- `src/app/hooks/use-flow-transaction.ts` and `src/app/pages/flow/use-flow-form-state.ts` had pre-existing uncommitted changes and were not modified for this SDK parameter update.
