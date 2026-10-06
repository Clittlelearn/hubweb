# eth_sendRawTransaction 自定义 JSON data 规范

`fun_eth_sendRawTransaction` 会先解析 raw ETH transaction。

如果 raw tx 的 `data` 字段解码后是合法 JSON，则进入自定义业务交易逻辑；否则进入普通合约调用逻辑。

## data 编码方式

后端或前端签 raw ETH tx 时，需要先把 JSON 转成 UTF-8 字符串，再转成 hex：

```ts
const payload = {
  type: "tx",
  asset_type: "OHI",
  is_find_utxo: false,
  sponsor_gas: false,
  encoded_info: ""
};

const data =
  "0x" + Buffer.from(JSON.stringify(payload), "utf8").toString("hex");
```

不要直接把 JSON 字符串塞进 raw tx 的 `data` 字段。

## 通用字段

所有自定义 JSON 交易都支持这些字段：

```json
{
  "type": "tx",
  "asset_type": "OHI",
  "is_find_utxo": false,
  "sponsor_gas": false,
  "gas_asset": {
    "addr": "0x...",
    "asset_type": "OHI"
  },
  "encoded_info": ""
}
```

字段说明：

| 字段 | 是否必填 | 说明 |
| --- | --- | --- |
| `type` | 是 | 交易类型 |
| `asset_type` | 按交易类型 | 资产类型，通常为 `OHI` 或资产 hash；带不带 `0x` 都可以 |
| `is_find_utxo` | 否 | 是否自动找 UTXO，默认 `false` |
| `sponsor_gas` | 否 | 是否由其他资产/地址代付 gas，默认 `false` |
| `gas_asset` | 否 | 代付 gas 信息，只有 `sponsor_gas=true` 时才有意义 |
| `encoded_info` | 否 | 附加信息，默认空字符串 |

## 重要变更：普通转账不再使用 JSON amount

普通转账的金额统一使用 raw ETH transaction 的 `value` 字段。

JSON 里不要再传 `amount`。

节点会把 raw tx 的 `value` 从 ETH 18 位精度换算到链内 8 位精度。

例如转 `0.00000001 OHI`：

```ts
value = ethers.parseUnits("0.00000001", 18)
```

## 普通转账 tx / transaction

```json
{
  "type": "tx",
  "asset_type": "OHI",
  "is_find_utxo": false,
  "sponsor_gas": false,
  "encoded_info": ""
}
```

也支持：

```json
{
  "type": "transaction",
  "asset_type": "OHI",
  "is_find_utxo": false,
  "sponsor_gas": false,
  "encoded_info": ""
}
```

金额只认 raw ETH tx 的 `value`。

## 质押 stake

```json
{
  "type": "stake",
  "asset_type": "OHI",
  "amount": "1000000",
  "reward_rank": "10",
  "is_find_utxo": false,
  "sponsor_gas": false,
  "encoded_info": ""
}
```

## 解除质押 unstake

```json
{
  "type": "unstake",
  "asset_type": "OHI",
  "stake_utxo_hash": "0x...",
  "is_find_utxo": false,
  "sponsor_gas": false,
  "encoded_info": ""
}
```

## 委托 delegating

被委托地址从 raw ETH tx 的 `to` 字段获取。

```json
{
  "type": "delegating",
  "asset_type": "OHI",
  "amount": "1000000",
  "delegate_type": "1",
  "is_find_utxo": false,
  "sponsor_gas": false,
  "encoded_info": ""
}
```

## 撤销委托 undelegating

```json
{
  "type": "undelegating",
  "asset_type": "OHI",
  "utxo_hash": "0x...",
  "is_find_utxo": false,
  "sponsor_gas": false,
  "encoded_info": ""
}
```

## 领取奖励 bonus

```json
{
  "type": "bonus",
  "asset_type": "OHI",
  "first_choose": false,
  "is_find_utxo": false,
  "sponsor_gas": false,
  "encoded_info": ""
}
```

## 锁仓 lock

```json
{
  "type": "lock",
  "lock_amount": "1000000",
  "lock_type": "1",
  "is_find_utxo": false,
  "sponsor_gas": false,
  "encoded_info": ""
}
```

## 解锁 unlock

```json
{
  "type": "unlock",
  "utxo_hash": "0x...",
  "is_find_utxo": false,
  "sponsor_gas": false,
  "encoded_info": ""
}
```

## 投票 vote

```json
{
  "type": "vote",
  "vote_hash": "0x...",
  "vote": "1",
  "is_find_utxo": false,
  "sponsor_gas": false,
  "encoded_info": ""
}
```

`vote` 取值：

| 值 | 含义 |
| --- | --- |
| `"1"` 或 `true` | 赞成 |
| `"0"` 或 `false` | 反对 |

## 提案 proposal

```json
{
  "type": "proposal",
  "vote_hash": "0x...",
  "is_find_utxo": false,
  "sponsor_gas": false,
  "encoded_info": ""
}
```

也兼容：

```json
{
  "type": "proposal",
  "proposal_hash": "0x..."
}
```

## 撤销提案 revoke_proposal

```json
{
  "type": "revoke_proposal",
  "vote_hash": "0x...",
  "is_find_utxo": false,
  "sponsor_gas": false,
  "encoded_info": ""
}
```

也兼容：

```json
{
  "type": "revoke_proposal",
  "proposal_hash": "0x..."
}
```

## 国库奖励 fund

```json
{
  "type": "fund",
  "is_find_utxo": false,
  "encoded_info": ""
}
```

## 后端签名示例

```ts
const payload = {
  type: "tx",
  asset_type: "OHI",
  is_find_utxo: false,
  sponsor_gas: false,
  encoded_info: ""
};

const data =
  "0x" + Buffer.from(JSON.stringify(payload), "utf8").toString("hex");

const rawTx = await wallet.signTransaction({
  type: 2,
  chainId,
  nonce,
  to,
  value: ethers.parseUnits("0.00000001", 18),
  data,
  gasLimit,
  maxFeePerGas,
  maxPriorityFeePerGas
});
```

## 核心注意点

1. `data` 必须是 hex 编码后的 JSON。
2. 普通转账 `type=tx` / `type=transaction` 不要再在 JSON 里放 `amount`。
3. 普通转账金额只认 raw ETH tx 的 `value`。
4. `asset_type` 可以是 `OHI`，也可以是资产 hash。
5. 带 `0x` 的 hash / asset type 节点内部会去掉 `0x` 后使用。
