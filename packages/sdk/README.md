# @openhive/sdk

TypeScript SDK for building, signing, and broadcasting OpenHive custom JSON transactions through EVM-compatible wallets.

The transaction `data` field is encoded as UTF-8 JSON hex for `eth_sendRawTransaction`. The JSON payload follows `docs/eth_sendRawTransaction_custom_json.md`.

## Install

```bash
npm install @openhive/sdk
```

## Quick Start

### With a wallet provider

```ts
import { OpenHiveSdk, ethers } from '@openhive/sdk';

const provider = new ethers.BrowserProvider(window.ethereum);
const sdk = OpenHiveSdk.create({ provider, rpcUrl: 'https://rpc.openhive.io' });

const tx = await sdk.lock(
  {
    gas_asset: { addr: '0xYourAddress', asset_type: 'OHI' },
    sponsor_gas: false,
    lock_amount: '1000000',
    lock_type: '1',
  },
  '0xLockAddress',
  '0xYourAddress',
);

console.log(tx.hash);
```

### Without a provider

```ts
const sdk = OpenHiveSdk.create();

const tx = await sdk.delegate(
  {
    asset_type: 'OHI',
    amount: '1000000',
    delegate_type: '1',
    gas_asset: { addr: '0xYourAddress', asset_type: 'OHI' },
    sponsor_gas: false,
  },
  '0xValidatorAddress',
  '0xYourAddress',
);

// tx is a TransactionRequest object ready to be signed elsewhere.
console.log(tx);
```

## Normal Transfer

For `tx` / `transaction`, the amount must be passed through the raw ETH transaction `value` field. Do not put `amount` in the custom JSON payload.

```ts
const tx = await sdk.transfer(
  {
    asset_type: 'OHI',
    gas_asset: { addr: '0xYourAddress', asset_type: 'OHI' },
    sponsor_gas: false,
    value: ethers.parseUnits('0.00000001', 18),
  },
  '0xRecipientAddress',
  '0xYourAddress',
);
```

## Supported Operations

| Method                                       | JSON `type`          | Notes                              |
| -------------------------------------------- | -------------------- | ---------------------------------- |
| `sdk.transfer(...)` / `sdk.transaction(...)` | `tx` / `transaction` | Amount uses raw tx `value`         |
| `sdk.fund(...)`                              | `fund`               | Claims treasury rewards            |
| `sdk.treasury(...)`                          | `treasury`           | Alias for treasury reward claims   |
| `sdk.stake(...)`                             | `stake`              | Uses `amount` and `reward_rank`    |
| `sdk.unstake(...)`                           | `unstake`            | Uses `stake_utxo_hash`             |
| `sdk.delegate(...)`                          | `delegating`         | Delegated address is raw tx `to`   |
| `sdk.undelegate(...)`                        | `undelegating`       | Uses `utxo_hash`                   |
| `sdk.bonus(...)`                             | `bonus`              | Uses `first_choose`                |
| `sdk.lock(...)`                              | `lock`               | Uses `lock_amount` and `lock_type` |
| `sdk.unlock(...)`                            | `unlock`             | Uses `utxo_hash`                   |
| `sdk.vote(...)`                              | `vote`               | Uses `vote_hash` and `vote`        |
| `sdk.proposal(...)`                          | `proposal`           | Uses `vote_hash`                   |
| `sdk.revokeProposal(...)`                    | `revoke_proposal`    | Uses `vote_hash`                   |

## Build

```bash
cd packages/sdk
npm install
npm run build
```

## Dependencies

- [ethers](https://docs.ethers.org/) ^6.16.0
