# OpenHiveHub 后端接口规划（按页面）

## 目标

这份文档只根据当前前端页面的展示内容、交互动作和数据依赖重新规划后端接口，不沿用现有 `backend-api` 的命名、路径和返回结构。

目标是给后端重写提供一份更干净的页面化/BFF 方案，让前端首屏尽量少拼接口，列表和交易动作再拆成独立接口。

## 设计原则

### 1. 按页面聚合首屏数据

优先给每个页面提供一个 `page` 聚合接口，返回首屏需要的 summary、列表首屏数据和配置项，减少前端首屏并发请求。

### 2. 再拆分页接口和动作接口

列表、搜索、历史记录和配置项单独拆接口，避免 `page` 接口过大。

### 3. 链和钱包上下文显式传入

前端支持 `devnet / testnet / mainnet` 切换，所以所有接口建议显式带 `chainId`。

用户态接口建议显式带 `address`。

### 4. 金额字段统一返回原始值

金额不要返回 `"1,250 VOTE"` 这种格式化字符串，统一返回：

- `amount`: `"1250"`
- `symbol`: `"VOTE"`
- `decimals`: `8`

展示格式由前端处理。

### 5. 时间统一返回时间戳

统一返回 `timestampMs`，不要直接返回 `"3s ago"`、`"2026-03-10"` 这类展示文案。

### 6. 链上交易由前端直接调用合约

钱包签名和链上发送放前端完成；这份文档只规划前端真正依赖的读接口，以及少量需要后端持久化的写接口。

### 7. 需要后端持久化的接口应预留鉴权能力

例如钱包自定义 token 绑定，这类接口不应该长期只靠 `address` 直接写库。

当前文档先不在请求参数里显式要求 `nonce`、`signature`；后续可以按 session / JWT / 网关鉴权方案补上。

## 通用返回约定

### 通用成功结构

```json
{
  "code": 0,
  "message": "ok",
  "data": {}
}
```

### 分页结构

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "list": [],
    "pageNum": 1,
    "pageSize": 20,
    "total": 0
  }
}
```

## 页面总览

| 页面       | 路由          | 推荐首屏接口                  |
| ---------- | ------------- | ----------------------------- |
| Dashboard  | `/`           | `GET /api/v1/dashboard/page`  |
| Wallet     | `/wallet`     | `GET /api/v1/wallet/page`     |
| Validators | `/validators` | `GET /api/v1/staking/page`    |
| Lock       | `/lock`       | `GET /api/v1/lock/page`       |
| Governance | `/governance` | `GET /api/v1/governance/page` |
| Flow       | `/flow`       | `GET /api/v1/flow/page`       |

---

## 1. Dashboard 页面

### 页面数据块

- 网络 Banner：在线状态、最新区块、高度、epoch
- 主统计卡：总发行量、流通量、总质押、活跃验证者
- 次级统计卡：总投票权、活跃提案、TPS、独立地址数
- 图表：TVL（日级别）、每日交易量、质押流入/流出
- Recent Blocks 列表 // 最新的5条

### 推荐接口

#### `GET /api/v1/dashboard/page`

请求参数：

```json
{
  "chainId": 12315
}
```

返回字段：

```json
{
  "network": {
    "chainId": 12315,
    "networkName": "OpenHive Devnet",
    "isOnline": true,
    "blockHeight": 12845392,
    "epoch": 1284
  },
  "primaryStats": {
    "totalSupply": "1000000000",
    "totalSupplySymbol": "VOTE",
    "totalSupplyChangePct": "0",
    "circulatingSupply": "682450000",
    "circulatingSupplySymbol": "VOTE",
    "circulatingSupplyChangePct": "2.4",
    "totalStaked": "345120000",
    "totalStakedSymbol": "VOTE",
    "totalStakedChangePct": "5.8",
    "activeValidatorCount": 128,
    "activeValidatorDelta": 3
  },
  "secondaryStats": {
    "totalVotingPower": "520360000",
    "totalVotingPowerSymbol": "vVOTE",
    "activeProposalCount": 7,
    "networkTps": "4280",
    "uniqueAddressCount": 1245680
  },
  "charts": {
    "tvl": [
      {
        "label": "2026-03",
        "valueUsd": "420000000"
      }
    ],
    "dailyTransactions": [
      {
        "label": "Mon",
        "txCount": 12400
      }
    ],
    "staking": [
      {
        "label": "W1",
        "stakedAmount": "28000",
        "unstakedAmount": "5200"
      }
    ]
  },
  "recentBlocks": [
    {
      "height": 12845392,
      "txCount": 156,
      "timestampMs": 1770000000000,
      "proposerName": "Validator-A",
      "proposerAddress": "0x..."
    }
  ]
}
```

请求字段说明：

- `chainId`：目标网络 ID，用于区分 devnet / testnet / mainnet。

返回字段说明：

- `network`：网络基础信息。
- `network.chainId`：当前返回数据所属链 ID。
- `network.networkName`：网络展示名称。
- `network.isOnline`：网络当前是否可用。
- `network.blockHeight`：最新区块高度。
- `network.epoch`：当前 epoch 编号。
- `primaryStats`：首页主统计卡数据。
- `primaryStats.totalSupply`：总发行量原始值。
- `primaryStats.totalSupplySymbol`：总发行量对应资产 symbol。
- `primaryStats.totalSupplyChangePct`：总发行量环比变化百分比。
- `primaryStats.circulatingSupply`：流通量原始值。
- `primaryStats.circulatingSupplySymbol`：流通量对应资产 symbol。
- `primaryStats.circulatingSupplyChangePct`：流通量环比变化百分比。
- `primaryStats.totalStaked`：全网总质押量原始值。
- `primaryStats.totalStakedSymbol`：总质押量对应资产 symbol。
- `primaryStats.totalStakedChangePct`：总质押量变化百分比。
- `primaryStats.activeValidatorCount`：当前活跃验证者数量。
- `primaryStats.activeValidatorDelta`：与上一统计周期相比的活跃验证者增量。
- `secondaryStats`：首页次级统计卡数据。
- `secondaryStats.totalVotingPower`：全网投票权总量原始值。
- `secondaryStats.totalVotingPowerSymbol`：投票权 symbol。
- `secondaryStats.activeProposalCount`：活跃提案数量。
- `secondaryStats.networkTps`：当前网络 TPS。
- `secondaryStats.uniqueAddressCount`：累计独立地址数量。
- `charts`：图表区块。
- `charts.tvl`：TVL 时间序列。
- `charts.tvl[].label`：TVL 图表横轴标签。
- `charts.tvl[].valueUsd`：对应时间点的 TVL USD 值。
- `charts.dailyTransactions`：每日交易量时间序列。
- `charts.dailyTransactions[].label`：交易量图表横轴标签。
- `charts.dailyTransactions[].txCount`：对应时间点交易数量。
- `charts.staking`：质押流入流出时间序列。
- `charts.staking[].label`：质押图表横轴标签。
- `charts.staking[].stakedAmount`：该时间点新增质押量。
- `charts.staking[].unstakedAmount`：该时间点解质押量。
- `recentBlocks`：最近区块列表。
- `recentBlocks[].height`：区块高度。
- `recentBlocks[].txCount`：区块内交易数量。
- `recentBlocks[].timestampMs`：区块时间戳。
- `recentBlocks[].proposerName`：出块 validator 名称。
- `recentBlocks[].proposerAddress`：出块 validator 地址。

### 字段说明

- `recentBlocks.proposerAddress` 当前 UI 还没直接用，但后续跳转 explorer 时会需要。
- `charts.*.label` 可以是周、月、日标签，前端直接展示。

---

## 2. Wallet 页面

### 页面数据块

- 钱包地址区块
- Overview 卡片：总余额、Token 数量、交易总数
- Tokens Tab
- Transactions Tab
- Add Token Modal
- Send Token Modal

### 推荐接口

#### `GET /api/v1/wallet/page`

用途：钱包页首屏聚合数据。

请求参数：

```json
{
  "chainId": 12315,
  "address": "0x..." // optional
}
```

返回字段：

```json
{
  "overview": {
    "totalBalance": "36180.50",
    "balanceSymbol": "VOTE",
    "tokenCount": 12,
    "txsCount": 100
  }
}
```

请求字段说明：

- `chainId`：目标网络 ID。
- `address`：钱包地址；不传时只返回公共或空态结果。

返回字段说明：

- `overview`：钱包总览卡片。
- `overview.totalBalance`：当前钱包聚合后的总资产值。
- `overview.balanceSymbol`：总资产默认展示单位。
- `overview.tokenCount`：当前钱包持有的 token 数量。
- `overview.txsCount`：当前钱包交易总数。

#### `GET /api/v1/wallet/tokens`

用途：Tokens Tab 全量/刷新。

请求参数：

```json
{
  "chainId": 12315,
  "address": "0x..." // optional
}
```

返回字段：

```json
{
  "list": [
    {
      "tokenId": "usdc-1",
      "name": "USD Coin",
      "symbol": "USDC",
      "logoUrl": "https://...",
      "balance": "25000",
      "decimals": 6,
      "contractAddress": "0x...",
      "assetType": "",
      "standard": "ERC20",
      "ownerAddress": "0x...",
      "deployutxo": "0x...",
      "priceUsd": "1",
      "valueUsd": "25000",
      "change24hPct": "0.02",
      "isCustom": false
    }
  ]
}
```

最小必需字段：

- `name`
- `symbol`
- `logoUrl`
- `balance`
- `decimals`
- `contractAddress`
- `assetType`
- `deployutxo`
- `ownerAddress`

请求字段说明：

- `chainId`：目标网络 ID。
- `address`：钱包地址。

返回字段说明：

- `list`：钱包 token 列表。
- `list[].tokenId`：token 主键或业务侧唯一标识。
- `list[].name`：token 名称。
- `list[].symbol`：token 简称。
- `list[].logoUrl`：token logo 地址。
- `list[].balance`：钱包当前余额原始值。
- `list[].decimals`：token 精度。
- `list[].contractAddress`：EVM 合约地址；原生资产可为空。
- `list[].assetType`：链内资产类型标识。
- `list[].standard`：资产标准，如 `ERC20`。
- `list[].ownerAddress`：该资产的持有地址。
- `list[].deployutxo`：资产铸造或部署来源标识。
- `list[].priceUsd`：单个 token 的 USD 价格。
- `list[].valueUsd`：当前持仓折算 USD 价值。
- `list[].change24hPct`：24 小时涨跌幅。
- `list[].isCustom`：是否是用户手动导入的自定义 token。

#### `GET /api/v1/wallet/transactions`

用途：Transactions Tab 分页列表。

请求参数：

```json
{
  "chainId": 12315,
  "address": "0x...",
  "pageNum": 1,
  "pageSize": 10
}
```

返回字段：

```json
{
  "list": [
    {
      "txHash": "0x...",
      "txType": "2",
      "kind": "send",
      "status": "success",
      "direction": "out",
      "timestampMs": 1770000000000,
      "amount": "100",
      "symbol": "USDC",
      "decimals": 6,
      "counterpartyRole": "to",
      "counterpartyAddress": "0x...",
      "contractName": "USD Coin",
      "contractAddress": "0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      "methodName": "transfer",
      "methodId": "0xa9059cbb",
      "from": "0x1111111111111111111111111111111111111111",
      "to": "0x2222222222222222222222222222222222222222",
      "rawData": "0xa9059cbb00000000000000000000000022222222222222222222222222222222222222220000000000000000000000000000000000000000000000000000000005f5e100",
      "blockNumber": 21903211,
      "blockHash": "0x...",
      "transactionIndex": 12,
      "nonce": 58,
      "value": "0",
      "gasLimit": "65000",
      "gasUsed": "52143",
      "gasPrice": "3000000000",
      "maxFeePerGas": "3500000000",
      "maxPriorityFeePerGas": "1000000000",
      "effectiveGasPrice": "3200000000",
      "feeAmount": "166857600000000",
      "feeSymbol": "ETH",
      "gasCost": {
        "native": {
          "amount": "166857600000000",
          "symbol": "ETH",
          "decimals": 18
        },
        "custom": {
          "isUsed": false,
          "amount": "0",
          "symbol": "",
          "decimals": 0,
          "contractAddress": "",
          "assetType": ""
        }
      },
      "tokenTransfers": [
        {
          "standard": "ERC20",
          "contractAddress": "0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
          "contractName": "USD Coin",
          "symbol": "USDC",
          "decimals": 6,
          "from": "0x1111111111111111111111111111111111111111",
          "to": "0x2222222222222222222222222222222222222222",
          "amount": "100",
          "tokenId": "",
          "direction": "out"
        }
      ],
      "evm": {
        "txType": "2",
        "from": "0x1111111111111111111111111111111111111111",
        "to": "0x2222222222222222222222222222222222222222",
        "contractAddress": "0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
        "inputData": "0xa9059cbb00000000000000000000000022222222222222222222222222222222222222220000000000000000000000000000000000000000000000000000000005f5e100",
        "nonce": 58,
        "value": "0",
        "blockNumber": 21903211,
        "blockHash": "0x...",
        "transactionIndex": 12,
        "gasLimit": "65000",
        "gasUsed": "52143",
        "gasPrice": "3000000000",
        "maxFeePerGas": "3500000000",
        "maxPriorityFeePerGas": "1000000000",
        "effectiveGasPrice": "3200000000",
        "logs": [],
        "rawTx": {},
        "rawReceipt": {}
      }
    }
  ],
  "pageNum": 1,
  "pageSize": 10,
  "total": 128
}
```

兼容性要求：

- 这个接口建议同时提供两层字段：
  - 第一层是前端直接展示用的标准化字段：`kind`、`direction`、`amount`、`symbol`、`counterpartyRole` 等。
  - 第二层是 `evm` 原始兼容字段，尽量覆盖 EVM 钱包详情页常见展示项。
- `txType` 保留为原始链上交易类型：
  - EVM 链建议直接返回 `0 | 1 | 2` 这类真实值。
  - 非 EVM 场景可以返回链侧原始类型或 `null`。
- `rawData`、`from`、`to`、`contractAddress` 必须直接可取，不要只放在深层解析对象里。
- `gasCost.native` 表示原生币 gas 消耗；`gasCost.custom` 表示自定义 gas 资产消耗。
- 如果当前链或当前交易没有自定义 gas 支付，`gasCost.custom` 建议返回 `null` 或 `isUsed=false` 的空对象。
- `gasCost.custom` 至少建议包含：`amount`、`symbol`、`decimals`、`contractAddress`、`assetType`，这样前端可以直接展示“非原生 gas 扣费资产”。
- `tokenTransfers[]` 建议作为解析后的资产变动结果返回，便于前端直接画出 ERC20 / ERC721 / ERC1155 转账记录。
- `evm.rawTx`、`evm.rawReceipt`、`evm.logs` 建议保留透传能力，后续做交易详情抽屉、调试页、区块浏览器跳转时会更稳。

前端展示不要只靠原始 `txType` 自己猜业务含义，仍然建议后端补一层可读业务枚举：

- `kind`: `send | receive | validator_stake | stake_withdrawal | delegation | contract_creation | flow_in | flow_out | lock | unlock | vote | treasury | reward`
- `direction`: `in | out`
- `status`: `pending | success | failed`

请求字段说明：

- `chainId`：目标网络 ID。
- `address`：钱包地址。
- `pageNum`：页码，从 `1` 开始。
- `pageSize`：每页条数。

返回字段说明：

- `list`：交易记录列表。
- `list[].txHash`：交易哈希。
- `list[].txType`：链上原始交易类型。
- `list[].kind`：后端归一后的业务交易类型。
- `list[].status`：交易状态。
- `list[].direction`：资金方向，`in` 或 `out`。
- `list[].timestampMs`：交易时间戳。
- `list[].amount`：主展示资产数量原始值。
- `list[].symbol`：主展示资产 symbol。
- `list[].decimals`：主展示资产精度。
- `list[].counterpartyRole`：对手方在本笔交易中的角色，例如 `to`、`from`。
- `list[].counterpartyAddress`：对手方地址。
- `list[].contractName`：交互合约名称。
- `list[].contractAddress`：交互合约地址。
- `list[].methodName`：解析后的方法名。
- `list[].methodId`：方法选择器。
- `list[].from`：链上 from 地址。
- `list[].to`：链上 to 地址。
- `list[].rawData`：原始输入数据。
- `list[].blockNumber`：区块高度。
- `list[].blockHash`：区块哈希。
- `list[].transactionIndex`：区块内交易索引。
- `list[].nonce`：交易 nonce。
- `list[].value`：原生币 value 字段。
- `list[].gasLimit`：交易 gas limit。
- `list[].gasUsed`：实际消耗 gas。
- `list[].gasPrice`：gas price。
- `list[].maxFeePerGas`：EIP-1559 最大 gas 费用。
- `list[].maxPriorityFeePerGas`：EIP-1559 小费上限。
- `list[].effectiveGasPrice`：实际生效 gas 单价。
- `list[].feeAmount`：总手续费数量。
- `list[].feeSymbol`：手续费计价币种。
- `list[].gasCost`：gas 消耗对象。
- `list[].gasCost.native`：原生币 gas 消耗。
- `list[].gasCost.native.amount`：原生 gas 消耗数量。
- `list[].gasCost.native.symbol`：原生 gas 资产 symbol。
- `list[].gasCost.native.decimals`：原生 gas 资产精度。
- `list[].gasCost.custom`：自定义 gas 资产消耗对象。
- `list[].gasCost.custom.isUsed`：本笔交易是否启用了自定义 gas 支付。
- `list[].gasCost.custom.amount`：自定义 gas 资产消耗数量。
- `list[].gasCost.custom.symbol`：自定义 gas 资产 symbol。
- `list[].gasCost.custom.decimals`：自定义 gas 资产精度。
- `list[].gasCost.custom.contractAddress`：自定义 gas 资产合约地址。
- `list[].gasCost.custom.assetType`：自定义 gas 资产链内类型。
- `list[].tokenTransfers`：解析后的资产转移记录。
- `list[].tokenTransfers[].standard`：资产标准，如 `ERC20`、`ERC721`、`ERC1155`。
- `list[].tokenTransfers[].contractAddress`：转移资产的合约地址。
- `list[].tokenTransfers[].contractName`：转移资产的合约名。
- `list[].tokenTransfers[].symbol`：转移资产 symbol。
- `list[].tokenTransfers[].decimals`：转移资产精度。
- `list[].tokenTransfers[].from`：资产转出地址。
- `list[].tokenTransfers[].to`：资产转入地址。
- `list[].tokenTransfers[].amount`：资产数量。
- `list[].tokenTransfers[].tokenId`：NFT 等资产的 tokenId；普通 ERC20 可为空。
- `list[].tokenTransfers[].direction`：相对当前地址的资金方向。
- `list[].evm`：EVM 原始兼容字段集合。
- `list[].evm.txType`：EVM 原始交易类型。
- `list[].evm.from`：EVM 原始 from 地址。
- `list[].evm.to`：EVM 原始 to 地址。
- `list[].evm.contractAddress`：EVM 解析出的目标合约地址。
- `list[].evm.inputData`：EVM 原始输入数据。
- `list[].evm.nonce`：EVM nonce。
- `list[].evm.value`：EVM 原始 value。
- `list[].evm.blockNumber`：EVM 区块高度。
- `list[].evm.blockHash`：EVM 区块哈希。
- `list[].evm.transactionIndex`：EVM 区块内索引。
- `list[].evm.gasLimit`：EVM gas limit。
- `list[].evm.gasUsed`：EVM gas used。
- `list[].evm.gasPrice`：EVM gas price。
- `list[].evm.maxFeePerGas`：EVM 最大 gas 费用。
- `list[].evm.maxPriorityFeePerGas`：EVM 最大优先费。
- `list[].evm.effectiveGasPrice`：EVM 实际 gas 价格。
- `list[].evm.logs`：EVM receipt logs 透传。
- `list[].evm.rawTx`：原始交易对象透传。
- `list[].evm.rawReceipt`：原始 receipt 对象透传。
- `pageNum`：当前页码。
- `pageSize`：当前页大小。
- `total`：总记录数。

#### `GET /api/v1/wallet/token-catalog`

用途：Add Token Modal 的 token 列表和搜索。

请求参数：

```json
{
  "chainId": 12315,
  "address": "0x...",
  "pageNum": 1,
  "pageSize": 20,
  "keyword": "usdc" // optional
}
```

返回字段：

```json
{
  "list": [
    {
      "tokenId": "catalog-usdc-1",
      "contractAddress": "0x...",
      "name": "USD Coin",
      "symbol": "USDC",
      "logoUrl": "https://...",
      "decimals": 6,
      "assetType": "0x...",
      "standard": "ERC20",
      "isVerified": true,
      "isAdded": true,
      "listSource": "catalog"
    }
  ],
  "pageNum": 1,
  "pageSize": 20,
  "total": 200
}
```

最小必需字段：

- `tokenId`
- `contractAddress`
- `name`
- `symbol`
- `decimals`
- `logoUrl`
- `isVerified`
- `isAdded`

请求字段说明：

- `chainId`：目标网络 ID。
- `address`：钱包地址；用于标记是否已加入我的列表。
- `keyword`：搜索关键字。
- `pageNum`：页码。
- `pageSize`：每页条数。

返回字段说明：

- `list`：token 目录列表。
- `list[].tokenId`：目录 token 主键。
- `list[].contractAddress`：token 合约地址。
- `list[].name`：token 名称。
- `list[].symbol`：token symbol。
- `list[].logoUrl`：token logo。
- `list[].decimals`：token 精度。
- `list[].assetType`：链内资产类型。
- `list[].standard`：资产标准。
- `list[].isVerified`：是否为平台已校验资产。
- `list[].isAdded`：是否已经加入当前用户的钱包 token 列表。
- `list[].listSource`：目录来源。
- `pageNum`：当前页码。
- `pageSize`：当前页大小。
- `total`：总记录数。

#### `POST /api/v1/wallet/tokens`

用途：把 `token-catalog` 里的 token 加入“我的 token 列表”。

请求参数：

```json
{
  "chainId": 12315,
  "address": "0x...",
  "tokenId": "catalog-usdc-1",
  "contractAddress": "0x..."
}
```

返回字段：

```json
{
  "success": true,
  "token": {
    "tokenId": "catalog-usdc-1",
    "contractAddress": "0x...",
    "name": "USD Coin",
    "symbol": "USDC",
    "logoUrl": "https://...",
    "decimals": 6,
    "assetType": "0x...",
    "standard": "ERC20",
    "isVerified": true,
    "isAdded": true,
    "listSource": "catalog"
  }
}
```

说明：

- 这里操作的是 `GET /api/v1/wallet/token-catalog` 返回的 token。
- `tokenId` 是目录主键，`contractAddress` 是链上主键，建议同时传，避免目录 token 和链上地址映射错位。
- 成功后前端可以直接把返回的 `token` 合并进“我的 token 列表”，不需要立刻再调一次全量刷新。

请求字段说明：

- `chainId`：目标网络 ID。
- `address`：用户钱包地址。
- `tokenId`：目录 token 主键。
- `contractAddress`：目录 token 对应的链上合约地址。

返回字段说明：

- `success`：是否写入成功。
- `token`：加入后的钱包 token 信息。
- `token.tokenId`：目录 token 主键。
- `token.contractAddress`：token 合约地址。
- `token.name`：token 名称。
- `token.symbol`：token symbol。
- `token.logoUrl`：token logo。
- `token.decimals`：token 精度。
- `token.assetType`：链内资产类型。
- `token.standard`：资产标准。
- `token.isVerified`：是否为已校验资产。
- `token.isAdded`：是否已加入当前钱包列表。
- `token.listSource`：目录来源。

#### `DELETE /api/v1/wallet/tokens/{contractAddress}`

用途：把已经加入“我的 token 列表”的目录 token 移除。

路径参数：

- `contractAddress`：要从钱包列表移除的 token 合约地址。

请求参数：

```json
{
  "chainId": 12315,
  "address": "0x...",
  "tokenId": "catalog-usdc-1"
}
```

返回字段：

```json
{
  "success": true,
  "contractAddress": "0x..."
}
```

请求字段说明：

- `chainId`：目标网络 ID。
- `address`：用户钱包地址。
- `tokenId`：目录 token 主键，用于和目录系统做精确映射。

返回字段说明：

- `success`：是否移除成功。
- `contractAddress`：被移除的 token 合约地址。

#### `GET /api/v1/wallet/token-metadata`

用途：自定义 token 输入合约地址后，返回 token 元数据，替代前端自己直连 ERC20 合约。

请求参数：

```json
{
  "chainId": 12315,
  "contractAddress": "0x..."
}
```

返回字段：

```json
{
  "tokenId": "custom-usdc-1",
  "contractAddress": "0x...",
  "name": "USD Coin",
  "symbol": "USDC",
  "decimals": 6,
  "logoUrl": "https://...",
  "assetType": "0x...",
  "standard": "ERC20",
  "priceUsd": "1",
  "isVerified": true,
  "isAdded": true
}
```

请求字段说明：

- `chainId`：目标网络 ID。
- `contractAddress`：要查询的 token 合约地址。

返回字段说明：

- `tokenId`：token 唯一标识。
- `contractAddress`：token 合约地址。
- `name`：token 名称。
- `symbol`：token symbol。
- `decimals`：token 精度。
- `logoUrl`：token logo。
- `assetType`：链内资产类型。
- `standard`：资产标准。
- `priceUsd`：token 单价。
- `isVerified`：是否为已校验资产。
- `isAdded`：当前钱包是否已经添加过该 token。

#### `POST /api/v1/wallet/custom-tokens`

用途：绑定自定义 token 到用户钱包视图。

请求参数：

```json
{
  "chainId": 12315,
  "address": "0x...",
  "contractAddress": "0x..."
}
```

返回字段：

```json
{
  "success": true,
  "token": {
    "tokenId": "custom-usdc-1",
    "name": "USD Coin",
    "symbol": "USDC",
    "logoUrl": "https://...",
    "decimals": 6,
    "contractAddress": "0x...",
    "assetType": "0x...",
    "isCustom": true
  }
}
```

请求字段说明：

- `chainId`：目标网络 ID。
- `address`：用户钱包地址。
- `contractAddress`：自定义 token 合约地址。

返回字段说明：

- `success`：是否导入成功。
- `token`：导入后的 token 信息。
- `token.tokenId`：token 唯一标识。
- `token.name`：token 名称。
- `token.symbol`：token symbol。
- `token.logoUrl`：token logo。
- `token.decimals`：token 精度。
- `token.contractAddress`：token 合约地址。
- `token.assetType`：链内资产类型。
- `token.isCustom`：是否为自定义导入 token。

#### `DELETE /api/v1/wallet/custom-tokens/{contractAddress}`

用途：移除自定义 token。

路径参数：

- `contractAddress`：要删除的自定义 token 合约地址。

请求参数：

```json
{
  "chainId": 12315,
  "address": "0x..."
}
```

返回字段：

```json
{
  "success": true,
  "contractAddress": "0x..."
}
```

请求字段说明：

- `chainId`：目标网络 ID。
- `address`：用户钱包地址。

返回字段说明：

- `success`：是否删除成功。
- `contractAddress`：被删除的自定义 token 合约地址。



## 3. Validators 页面

### 页面数据块

- 网络统计卡：活跃验证者、总质押、网络可用性、平均 APY
- Stake 表单：可选验证者、可质押 Flow token 列表、各 token 余额、预计 APY
- My Stakes：我的质押、总奖励、奖励历史
- All Validators 列表

### 质押资产范围

- Validators 页面支持多 token 质押。
- 可质押 token 范围为：具备有效 `assetType` 的 Flow 资产 token。
- `VOTE` 不在 validator stake 的可质押资产范围内。

### 推荐接口

#### `GET /api/v1/staking/page`

用途：Validators 页首屏聚合接口。

请求参数：

```json
{
  "chainId": 12315
}
```

返回字段：

```json
{
  "networkStats": {
    "activeValidatorCount": 1248,
    "totalStakedUsd": "42500000",
    "totalStakedCurrency": "USD",
    "networkUptimePct": "99.98",
    "avgValidatorApyPct": "15.2"
  },
  "stakedTokens": [
    {
      "tokenId": "flow-usdc-1",
      "name": "Flow USDC",
      "symbol": "USDC",
      "logoUrl": "https://...",
      "totalStakedAmount": "1250000",
      "totalStakedUsd": "1875000",
      "decimals": 6,
      "contractAddress": "0x...",
      "assetType": "0x...",
      "validatorCount": 128,
      "delegatorCount": 5230
    }
  ],
  "topValidators": [
    {
      "validatorId": "val-1",
      "name": "Validator Alpha",
      "address": "0x...",
      "logoUrl": "https://...",
      "status": "active",
      "description": "A highly reliable validator...",
      "delegatorCount": 1234,
      "commissionRatePct": "5",
      "apyPct": "15.25",
      "totalStakedUsd": "125000",
      "totalStakedCurrency": "USD",
      "performancePct": "98.5",
      "uptimePct": "99.95"
    }
  ]
}
```

说明：

- `/api/v1/staking/page` 只返回全网数据，不返回任何用户地址相关数据。
- `stakedTokens` 返回“全网所有已质押的各类 token 列表”，不是当前用户维度。
- `topValidators` 固定返回排名前十的 validator 列表，用于页面首屏展示。
- 用户态数据改走独立接口：
  - `GET /api/v1/staking/stakeable-tokens`
  - `GET /api/v1/staking/staked-tokens`
  - `GET /api/v1/staking/positions`
  - `GET /api/v1/staking/rewards/history`

请求字段说明：

- `chainId`：目标网络 ID。

返回字段说明：

- `networkStats`：Validators 页公共统计卡。
- `networkStats.activeValidatorCount`：活跃 validator 数量。
- `networkStats.totalStakedUsd`：全网总质押折算 USD 数值。
- `networkStats.totalStakedCurrency`：总质押金额的计价币种。
- `networkStats.networkUptimePct`：全网运行时长可用率。
- `networkStats.avgValidatorApyPct`：验证者平均 APY。
- `stakedTokens`：全网已参与质押的 token 列表。
- `stakedTokens[].tokenId`：质押 token 主键。
- `stakedTokens[].name`：质押 token 名称。
- `stakedTokens[].symbol`：质押 token symbol。
- `stakedTokens[].logoUrl`：质押 token logo。
- `stakedTokens[].totalStakedAmount`：全网该 token 总质押量。
- `stakedTokens[].totalStakedUsd`：全网该 token 总质押折算 USD。
- `stakedTokens[].decimals`：token 精度。
- `stakedTokens[].contractAddress`：token 合约地址。
- `stakedTokens[].assetType`：链内资产类型。
- `stakedTokens[].validatorCount`：支持该 token 质押的 validator 数量。
- `stakedTokens[].delegatorCount`：质押该 token 的地址数量。
- `topValidators`：首页前十 validator 列表。
- `topValidators[].validatorId`：validator 主键。
- `topValidators[].name`：validator 名称。
- `topValidators[].address`：validator 地址。
- `topValidators[].logoUrl`：validator logo。
- `topValidators[].status`：validator 状态。
- `topValidators[].description`：validator 简介。
- `topValidators[].delegatorCount`：委托人数。
- `topValidators[].commissionRatePct`：佣金费率。
- `topValidators[].apyPct`：APY。
- `topValidators[].totalStakedUsd`：validator 总质押折算 USD。
- `topValidators[].totalStakedCurrency`：总质押计价币种。
- `topValidators[].performancePct`：性能评分。
- `topValidators[].uptimePct`：在线率。

#### `GET /api/v1/staking/stakeable-tokens`

用途：单独获取当前钱包可用于 stake 的 token 列表。

请求参数：

```json
{
  "chainId": 12315,
  "address": "0x..."
}
```

返回字段：

```json
{
  "list": [
    {
      "tokenId": "flow-usdc-1",
      "name": "Flow USDC",
      "symbol": "USDC",
      "logoUrl": "https://...",
      "balance": "36180.50",
      "decimals": 6,
      "contractAddress": "0x...",
      "assetType": "0x...",
      "isStakeable": true
    }
  ]
}
```

过滤规则：

- 只返回 Flow 资产 token，前端根据 `assetType` 判断是否为 Flow 资产
- 排除 `VOTE`
- 已失效、已禁用、余额不可用的 token 可以通过 `isStakeable=false` 标出来

请求字段说明：

- `chainId`：目标网络 ID。
- `address`：用户钱包地址。

返回字段说明：

- `list`：当前用户可质押 token 列表。
- `list[].tokenId`：token 主键。
- `list[].name`：token 名称。
- `list[].symbol`：token symbol。
- `list[].logoUrl`：token logo。
- `list[].balance`：当前钱包可用余额。
- `list[].decimals`：token 精度。
- `list[].contractAddress`：token 合约地址。
- `list[].assetType`：链内资产类型。
- `list[].isStakeable`：当前是否允许参与 stake。

#### `GET /api/v1/staking/staked-tokens`

用途：获取当前用户已经质押过的 token 列表，按 token 维度汇总。

请求参数：

```json
{
  "chainId": 12315,
  "address": "0x..."
}
```

返回字段：

```json
{
  "list": [
    {
      "tokenId": "flow-usdc-1",
      "name": "Flow USDC",
      "symbol": "USDC",
      "logoUrl": "https://...",
      "totalStakedAmount": "10000",
      "totalStakedUsd": "15000",
      "decimals": 6,
      "contractAddress": "0x...",
      "assetType": "0x...",
      "positionCount": 2
    }
  ]
}
```

请求字段说明：

- `chainId`：目标网络 ID。
- `address`：用户钱包地址。

返回字段说明：

- `list`：当前用户已参与质押的 token 汇总列表。
- `list[].tokenId`：token 主键。
- `list[].name`：token 名称。
- `list[].symbol`：token symbol。
- `list[].logoUrl`：token logo。
- `list[].totalStakedAmount`：当前用户该 token 总质押量。
- `list[].totalStakedUsd`：当前用户该 token 总质押折算 USD。
- `list[].decimals`：token 精度。
- `list[].contractAddress`：token 合约地址。
- `list[].assetType`：链内资产类型。
- `list[].positionCount`：该 token 对应的质押仓位数量。

#### `GET /api/v1/staking/validators`

用途：验证者列表分页/搜索。

请求参数：

```json
{
  "chainId": 12315,
  "status": "all", // all | active | warning | inactive
  "pageNum": 1,
  "pageSize": 20,
  "keyword": "alpha"
}
```

搜索规则：

- `keyword` 支持按 `name`
- `keyword` 支持按 `validatorId / id`
- `keyword` 支持按 `address`

返回字段：

```json
{
  "list": [
    {
      "validatorId": "val-1",
      "rank": 1,
      "name": "Validator Alpha",
      "address": "0x...",
      "operatorAddress": "0x...",
      "logoUrl": "https://...",
      "status": "active",
      "description": "A highly reliable validator...",
      "website": "https://validator-alpha.example",
      "identityName": "Validator Alpha",
      "identityVerified": true,
      "delegatorCount": 1234,
      "selfStakeUsd": "25000",
      "selfStakeCurrency": "USD",
      "commissionRatePct": "5",
      "apyPct": "15.25",
      "supportedStakeTokens": [
        {
          "tokenId": "flow-usdc-1",
          "symbol": "USDC",
          "assetType": "0x...",
          "logoUrl": "https://..."
        }
      ],
      "stakeTokenCount": 3,
      "totalStakedUsd": "125000",
      "totalStakedCurrency": "USD",
      "delegatorRewardsUsd24h": "3200",
      "slashCount30d": 0,
      "proposedBlockCount24h": 128,
      "performancePct": "98.5",
      "uptimePct": "99.95",
      "online": true,
      "lastActiveAt": 1770000000000,
      "version": "v1.4.2",
      "updatedAt": 1770000000000,
      "canStake": true
    }
  ],
  "pageNum": 1,
  "pageSize": 20,
  "total": 128
}
```

建议字段分层：

- 基础身份：`validatorId`、`rank`、`name`、`address`、`operatorAddress`、`logoUrl`
- 状态与信誉：`status`、`online`、`identityVerified`、`slashCount30d`、`lastActiveAt`
- 收益与规模：`apyPct`、`commissionRatePct`、`selfStakeUsd`、`totalStakedUsd`、`delegatorRewardsUsd24h`
- 节点信息：`version`、`updatedAt`
- 资产支持：`supportedStakeTokens[]`、`stakeTokenCount`

请求字段说明：

- `chainId`：目标网络 ID。
- `status`：validator 状态筛选条件。
- `pageNum`：页码。
- `pageSize`：每页条数。
- `keyword`：搜索关键字，支持 `name / validatorId / address`。

返回字段说明：

- `list`：validator 分页列表。
- `list[].validatorId`：validator 主键。
- `list[].rank`：validator 排名。
- `list[].name`：validator 名称。
- `list[].address`：validator 地址。
- `list[].operatorAddress`：operator 地址。
- `list[].logoUrl`：validator logo。
- `list[].status`：validator 状态。
- `list[].description`：validator 描述。
- `list[].website`：validator 官网地址。
- `list[].identityName`：链上或平台认证名。
- `list[].identityVerified`：是否完成认证。
- `list[].delegatorCount`：委托地址数量。
- `list[].selfStakeUsd`：自质押折算 USD。
- `list[].selfStakeCurrency`：自质押金额计价币种。
- `list[].commissionRatePct`：validator 佣金比例。
- `list[].apyPct`：预估 APY。
- `list[].supportedStakeTokens`：该 validator 支持的质押 token 列表。
- `list[].supportedStakeTokens[].tokenId`：token 主键。
- `list[].supportedStakeTokens[].symbol`：token symbol。
- `list[].supportedStakeTokens[].assetType`：链内资产类型。
- `list[].supportedStakeTokens[].logoUrl`：token logo。
- `list[].stakeTokenCount`：支持质押 token 数量。
- `list[].totalStakedUsd`：总质押折算 USD。
- `list[].totalStakedCurrency`：总质押计价币种。
- `list[].delegatorRewardsUsd24h`：24 小时委托奖励折算 USD。
- `list[].slashCount30d`：近 30 天 slash 次数。
- `list[].proposedBlockCount24h`：24 小时提块数量。
- `list[].performancePct`：综合表现百分比。
- `list[].uptimePct`：在线率。
- `list[].online`：节点当前是否在线。
- `list[].lastActiveAt`：最近活跃时间。
- `list[].version`：节点版本。
- `list[].updatedAt`：数据更新时间。
- `list[].canStake`：当前是否允许继续对该 validator 质押。
- `pageNum`：当前页码。
- `pageSize`：当前页大小。
- `total`：总记录数。

#### `GET /api/v1/staking/positions`

用途：我的质押列表。

请求参数：

```json
{
  "chainId": 12315,
  "address": "0x..."
}
```

返回字段：

```json
{
  "list": [
    {
      "positionId": "stake-1",
      "validator": {
        "validatorId": "val-1",
        "name": "Validator Alpha",
        "address": "0x...",
        "logoUrl": "https://...",
        "status": "active",
        "description": "A highly reliable validator...",
        "delegatorCount": 1234,
        "commissionRatePct": "5",
        "apyPct": "15.25",
        "performancePct": "98.5",
        "uptimePct": "99.95"
      },
      "stakeInfo": {
        "tokenId": "flow-usdc-1",
        "name": "Flow USDC",
        "symbol": "USDC",
        "logoUrl": "https://...",
        "decimals": 6,
        "contractAddress": "0x...",
        "assetType": "0x...",
        "amount": "10000"
      },
      "rewardInfo": {
        "tokenId": "reward-token-1",
        "name": "Reward Token",
        "symbol": "REWARD",
        "logoUrl": "https://...",
        "decimals": 18,
        "contractAddress": "0x...",
        "assetType": "",
        "amount": "152.50"
      },
      "apyPct": "15.25",
      "stakedAt": 1770000000000,
      "stakeTxHash": "0x...",
      "lockPeriodDays": 90,
      "progressPct": 35,
      "canUnstake": true
    }
  ]
}
```

字段优化说明：

- 去掉了顶层重复的 `validatorId / validatorName / validatorAddress`，统一放在 `validator` 对象里。
- 去掉了顶层重复的 `stakeToken*` 和 `delegatedAmount / delegatedSymbol`，统一放在 `stakeInfo` 对象里。
- 奖励 token 改为 `rewardInfo` 对象，结构与 `stakeInfo` 对齐，便于前端直接复用渲染逻辑。

请求字段说明：

- `chainId`：目标网络 ID。
- `address`：用户钱包地址。

返回字段说明：

- `list`：当前用户质押仓位列表。
- `list[].positionId`：质押仓位主键。
- `list[].validator`：validator 信息对象。
- `list[].validator.validatorId`：validator 主键。
- `list[].validator.name`：validator 名称。
- `list[].validator.address`：validator 地址。
- `list[].validator.logoUrl`：validator logo。
- `list[].validator.status`：validator 状态。
- `list[].validator.description`：validator 描述。
- `list[].validator.delegatorCount`：委托人数。
- `list[].validator.commissionRatePct`：佣金比例。
- `list[].validator.apyPct`：APY。
- `list[].stakeInfo`：质押资产信息。
- `list[].stakeInfo.tokenId`：质押 token 主键。
- `list[].stakeInfo.name`：质押 token 名称。
- `list[].stakeInfo.symbol`：质押 token symbol。
- `list[].stakeInfo.logoUrl`：质押 token logo。
- `list[].stakeInfo.amount`：质押数量。
- `list[].stakeInfo.decimals`：质押 token 精度。
- `list[].stakeInfo.contractAddress`：质押 token 合约地址。
- `list[].stakeInfo.assetType`：质押 token 链内资产类型。
- `list[].rewardInfo`：奖励资产信息。
- `list[].rewardInfo.tokenId`：奖励 token 主键。
- `list[].rewardInfo.name`：奖励 token 名称。
- `list[].rewardInfo.symbol`：奖励 token symbol。
- `list[].rewardInfo.logoUrl`：奖励 token logo。
- `list[].rewardInfo.amount`：当前累计奖励数量。
- `list[].rewardInfo.decimals`：奖励 token 精度。
- `list[].rewardInfo.contractAddress`：奖励 token 合约地址。
- `list[].rewardInfo.assetType`：奖励 token 链内资产类型。
- `list[].apyPct`：当前仓位 APY。
- `list[].stakedAt`：质押时间。
- `list[].stakeTxHash`：质押交易哈希。
- `list[].lockPeriodDays`：锁定期天数。
- `list[].progressPct`：当前锁定进度。
- `list[].canUnstake`：是否允许解质押。

#### `GET /api/v1/staking/rewards/history`

请求参数：

```json
{
  "chainId": 12315,
  "address": "0x...",
  "pageNum": 1,
  "pageSize": 20
}
```

返回字段：

```json
{
  "list": [
    {
      "rewardHistoryId": "reward-1",
      "positionId": "stake-1",
      "validator": {
        "validatorId": "val-1",
        "name": "Validator Alpha",
        "address": "0x...",
        "logoUrl": "https://...",
        "status": "active",
        "description": "A highly reliable validator...",
        "commissionRatePct": "5",
        "apyPct": "15.25",
        "performancePct": "98.5",
        "uptimePct": "99.95"
      },
      "stakeToken": {
        "tokenId": "flow-usdc-1",
        "name": "Flow USDC",
        "symbol": "USDC",
        "logoUrl": "https://...",
        "decimals": 6,
        "contractAddress": "0x...",
        "assetType": "0x...",
        "amount": "10000"
      },
      "claimToken": {
        "tokenId": "reward-token-1",
        "name": "Reward Token",
        "symbol": "REWARD",
        "logoUrl": "https://...",
        "decimals": 18,
        "contractAddress": "0x...",
        "assetType": "",
        "amount": "145.80"
      },
      "stakeStartedAt": 1770000000000,
      "claimAddress": "0xabc...",
      "apyPct": "15.25",
      "claimedAt": 1770000000000,
      "txHash": "0x..."
    }
  ],
  "pageNum": 1,
  "pageSize": 20,
  "total": 40
}
```

请求字段说明：

- `chainId`：目标网络 ID。
- `address`：用户钱包地址。
- `pageNum`：页码。
- `pageSize`：每页条数。

返回字段说明：

- `list`：奖励领取历史列表。
- `list[].rewardHistoryId`：奖励历史主键。
- `list[].positionId`：关联质押仓位主键。
- `list[].validator`：validator 信息对象。
- `list[].validator.validatorId`：validator 主键。
- `list[].validator.name`：validator 名称。
- `list[].validator.address`：validator 地址。
- `list[].validator.logoUrl`：validator logo。
- `list[].validator.status`：validator 状态。
- `list[].validator.description`：validator 简介。
- `list[].validator.commissionRatePct`：validator 佣金比例。
- `list[].validator.apyPct`：validator 当前 APY。
- `list[].validator.performancePct`：validator 表现分。
- `list[].validator.uptimePct`：validator 在线率。
- `list[].stakeToken`：被质押的 token 信息。
- `list[].stakeToken.tokenId`：质押 token 主键。
- `list[].stakeToken.name`：质押 token 名称。
- `list[].stakeToken.symbol`：质押 token symbol。
- `list[].stakeToken.logoUrl`：质押 token logo。
- `list[].stakeToken.decimals`：质押 token 精度。
- `list[].stakeToken.contractAddress`：质押 token 合约地址。
- `list[].stakeToken.assetType`：质押 token 链内资产类型。
- `list[].stakeToken.amount`：参与该次奖励记录的质押数量。
- `list[].claimToken`：领取的奖励 token 信息。
- `list[].claimToken.tokenId`：奖励 token 主键。
- `list[].claimToken.name`：奖励 token 名称。
- `list[].claimToken.symbol`：奖励 token symbol。
- `list[].claimToken.logoUrl`：奖励 token logo。
- `list[].claimToken.decimals`：奖励 token 精度。
- `list[].claimToken.contractAddress`：奖励 token 合约地址。
- `list[].claimToken.assetType`：奖励 token 链内资产类型。
- `list[].claimToken.amount`：本次领取奖励数量。
- `list[].stakeStartedAt`：最初质押时间。
- `list[].claimAddress`：奖励领取地址。
- `list[].apyPct`：该次奖励记录对应的 APY。
- `list[].claimedAt`：奖励领取时间。
- `list[].txHash`：领取交易哈希。
- `pageNum`：当前页码。
- `pageSize`：当前页大小。
- `total`：总记录数。

字段优化说明：

- 去掉了顶层重复的 `validatorId / validatorName / validatorAddress`，统一放在 `validator` 对象里。
- 质押资产改为 `stakeToken` 对象，包含 token 信息和该次 reward 对应的质押数量。
- 领取资产改为 `claimToken` 对象，包含奖励 token 信息和该次领取数量。

说明：

- `stake / unstake / claim` 由前端直接调合约，这里不规划后端接口。



## 4. Lock 页面

### 页面数据块

- 顶部说明卡
- 统计卡：总锁仓、总投票权、全网奖励、活跃锁仓数
- Claim All Rewards
- Lock 配置选择
- Active Locks
- Rewards Claim History
- Unlock History

### 锁仓资产范围

- Lock 只支持 `VOTE`。
- 不支持其他 token lock。

### 推荐接口

#### `GET /api/v1/lock/page`

请求参数：

```json
{
  "chainId": 12315
}
```

返回字段：

```json
{
  "networkOverview": {
    "totalLockedAmount": "90000",
    "lockedSymbol": "VOTE",
    "totalLockedUsd": "2142000",
    "lockedCurrency": "USD",
    "totalVotingPower": "143000",
    "votingPowerSymbol": "vVOTE",
    "totalRewardAmount": "3528",
    "rewardSymbol": "VOTE",
    "activeLockCount": 18234,
    "readyToUnlockCount": 431,
    "totalUnlockedAmount24h": "12500",
    "totalUnlockedUsd24h": "297500"
  },
  "lockAsset": {
    "name": "Vote",
    "symbol": "VOTE",
    "logoUrl": "/token/vote.svg",
    "decimals": 8,
    "contractAddress": "",
    "assetType": "Vote"
  }
}
```

说明：

- `/api/v1/lock/page` 只返回全网数据，不返回任何用户地址相关数据。
- `lockAsset` 固定为 `VOTE`，前端不需要再做 token 选择。
- 用户态数据改走独立接口：
  - `GET /api/v1/lock/user-summary`
  - `GET /api/v1/lock/positions`
  - `GET /api/v1/lock/rewards/history`
  - `GET /api/v1/lock/unlock-history`

请求字段说明：

- `chainId`：目标网络 ID。

返回字段说明：

- `networkOverview`：Lock 页全网概览数据。
- `networkOverview.totalLockedAmount`：全网锁仓总量。
- `networkOverview.lockedSymbol`：锁仓资产 symbol，当前固定为 `VOTE`。
- `networkOverview.totalLockedUsd`：全网锁仓折算 USD。
- `networkOverview.lockedCurrency`：锁仓金额计价币种。
- `networkOverview.totalVotingPower`：全网投票权总量。
- `networkOverview.votingPowerSymbol`：投票权 symbol。
- `networkOverview.totalRewardAmount`：全网累计奖励总量。
- `networkOverview.rewardSymbol`：奖励资产 symbol。
- `networkOverview.activeLockCount`：当前活跃锁仓数量。
- `networkOverview.readyToUnlockCount`：当前可解锁仓位数量。
- `networkOverview.totalUnlockedAmount24h`：近 24 小时解锁总量。
- `networkOverview.totalUnlockedUsd24h`：近 24 小时解锁折算 USD。
- `lockAsset`：固定锁仓资产信息。
- `lockAsset.name`：锁仓资产名称。
- `lockAsset.symbol`：锁仓资产 symbol。
- `lockAsset.logoUrl`：锁仓资产 logo。
- `lockAsset.decimals`：锁仓资产精度。
- `lockAsset.contractAddress`：锁仓资产合约地址。
- `lockAsset.assetType`：锁仓资产链内类型。

#### `GET /api/v1/lock/user-summary`

用途：Lock 页用户态顶部卡片、Claim All Rewards、Lock 表单余额区块。

请求参数：

```json
{
  "chainId": 12315,
  "address": "0x..."
}
```

返回字段：

```json
{
  "lockAsset": {
    "name": "Vote",
    "symbol": "VOTE",
    "logoUrl": "/token/vote.svg",
    "decimals": 8,
    "contractAddress": "",
    "assetType": "Vote"
  },
  "userOverview": {
    "availableBalance": "125430.50",
    "availableBalanceSymbol": "VOTE",
    "totalLockedAmount": "90000",
    "totalLockedUsd": "2142000",
    "lockedSymbol": "VOTE",
    "totalVotingPower": "143000",
    "votingPowerSymbol": "vVOTE",
    "claimableRewardAmount": "3528",
    "rewardSymbol": "VOTE",
    "readyToUnlockCount": 1,
    "claimableLockCount": 3
  }
}
```

请求字段说明：

- `chainId`：目标网络 ID。
- `address`：用户钱包地址。

返回字段说明：

- `lockAsset`：锁仓资产信息。
- `lockAsset.name`：锁仓资产名称。
- `lockAsset.symbol`：锁仓资产 symbol。
- `lockAsset.logoUrl`：锁仓资产 logo。
- `lockAsset.decimals`：锁仓资产精度。
- `lockAsset.contractAddress`：锁仓资产合约地址。
- `lockAsset.assetType`：锁仓资产链内类型。
- `userOverview`：用户锁仓摘要。
- `userOverview.availableBalance`：当前可用于锁仓的余额。
- `userOverview.availableBalanceSymbol`：可用余额 symbol。
- `userOverview.totalLockedAmount`：当前用户总锁仓量。
- `userOverview.totalLockedUsd`：当前用户总锁仓折算 USD。
- `userOverview.lockedSymbol`：锁仓资产 symbol。
- `userOverview.totalVotingPower`：当前用户总投票权。
- `userOverview.votingPowerSymbol`：投票权 symbol。
- `userOverview.claimableRewardAmount`：当前可领取奖励总量。
- `userOverview.rewardSymbol`：奖励资产 symbol。
- `userOverview.readyToUnlockCount`：当前可解锁仓位数量。
- `userOverview.claimableLockCount`：当前可领取奖励的锁仓仓位数量。

#### `GET /api/v1/lock/positions`

用途：锁仓列表单独刷新。

请求参数：

```json
{
  "chainId": 12315,
  "address": "0x..."
}
```

返回字段：

```json
{
  "list": [
    {
      "lockId": "lock-1",
      "lockToken": {
        "name": "Vote",
        "symbol": "VOTE",
        "logoUrl": "/token/vote.svg",
        "decimals": 8,
        "contractAddress": "",
        "assetType": "Vote",
        "amount": "50000"
      },
      "rewardToken": {
        "name": "Vote",
        "symbol": "VOTE",
        "logoUrl": "/token/vote.svg",
        "decimals": 8,
        "contractAddress": "",
        "assetType": "Vote",
        "amount": "1250"
      },
      "period": {
        "periodId": 2,
        "label": "90 days",
        "durationDays": 90,
        "aprPct": "12",
        "multiplier": "1.5",
        "bonusPct": "50"
      },
      "votingPower": "75000",
      "status": "locked",
      "startedAt": 1770000000000,
      "endsAt": 1771000000000,
      "progressPct": 67,
      "lockTxHash": "0x...",
      "unlockTxHash": "",
      "canUnlock": false,
      "canClaimRewards": true,
      "canEarlyUnlock": false
    }
  ]
}
```

请求字段说明：

- `chainId`：目标网络 ID。
- `address`：用户钱包地址。

返回字段说明：

- `list`：用户锁仓仓位列表。
- `list[].lockId`：锁仓仓位主键。
- `list[].lockToken`：锁仓资产信息。
- `list[].lockToken.name`：锁仓资产名称。
- `list[].lockToken.symbol`：锁仓资产 symbol。
- `list[].lockToken.logoUrl`：锁仓资产 logo。
- `list[].lockToken.decimals`：锁仓资产精度。
- `list[].lockToken.contractAddress`：锁仓资产合约地址。
- `list[].lockToken.assetType`：锁仓资产链内类型。
- `list[].lockToken.amount`：本仓位锁仓数量。
- `list[].rewardToken`：奖励资产信息。
- `list[].rewardToken.name`：奖励资产名称。
- `list[].rewardToken.symbol`：奖励资产 symbol。
- `list[].rewardToken.logoUrl`：奖励资产 logo。
- `list[].rewardToken.decimals`：奖励资产精度。
- `list[].rewardToken.contractAddress`：奖励资产合约地址。
- `list[].rewardToken.assetType`：奖励资产链内类型。
- `list[].rewardToken.amount`：当前累计奖励数量。
- `list[].period`：锁仓周期信息。
- `list[].period.periodId`：周期主键。
- `list[].period.label`：周期展示文案。
- `list[].period.durationDays`：锁仓天数。
- `list[].period.aprPct`：该周期 APR。
- `list[].period.multiplier`：投票权或奖励倍数。
- `list[].period.bonusPct`：周期额外奖励百分比。
- `list[].votingPower`：当前仓位对应投票权。
- `list[].status`：仓位状态。
- `list[].startedAt`：开始锁仓时间。
- `list[].endsAt`：预计到期时间。
- `list[].progressPct`：当前进度百分比。
- `list[].lockTxHash`：锁仓交易哈希。
- `list[].unlockTxHash`：解锁交易哈希；未解锁时可为空。
- `list[].canUnlock`：是否允许当前解锁。
- `list[].canClaimRewards`：是否允许领取奖励。
- `list[].canEarlyUnlock`：是否允许提前解锁。

#### `GET /api/v1/lock/rewards/history`

请求参数：

```json
{
  "chainId": 12315,
  "address": "0x...",
  "pageNum": 1,
  "pageSize": 20
}
```

返回字段：

```json
{
  "list": [
    {
      "rewardHistoryId": "lock-reward-1",
      "lockId": "lock-5",
      "lockToken": {
        "name": "Vote",
        "symbol": "VOTE",
        "logoUrl": "/token/vote.svg",
        "decimals": 8,
        "contractAddress": "",
        "assetType": "Vote",
        "amount": "20000"
      },
      "claimToken": {
        "name": "Vote",
        "symbol": "VOTE",
        "logoUrl": "/token/vote.svg",
        "decimals": 8,
        "contractAddress": "",
        "assetType": "Vote",
        "amount": "856"
      },
      "period": {
        "periodId": 2,
        "label": "90 days",
        "durationDays": 90,
        "aprPct": "12",
        "multiplier": "1.5"
      },
      "startedAt": 1770000000000,
      "claimAddress": "0x...",
      "claimedAt": 1770000000000,
      "claimTxHash": "0x..."
    }
  ],
  "pageNum": 1,
  "pageSize": 20,
  "total": 30
}
```

请求字段说明：

- `chainId`：目标网络 ID。
- `address`：用户钱包地址。
- `pageNum`：页码。
- `pageSize`：每页条数。

返回字段说明：

- `list`：奖励领取历史列表。
- `list[].rewardHistoryId`：奖励历史主键。
- `list[].lockId`：关联锁仓仓位主键。
- `list[].lockToken`：锁仓资产信息。
- `list[].lockToken.name`：锁仓资产名称。
- `list[].lockToken.symbol`：锁仓资产 symbol。
- `list[].lockToken.logoUrl`：锁仓资产 logo。
- `list[].lockToken.decimals`：锁仓资产精度。
- `list[].lockToken.contractAddress`：锁仓资产合约地址。
- `list[].lockToken.assetType`：锁仓资产链内类型。
- `list[].lockToken.amount`：参与该次奖励记录的锁仓数量。
- `list[].claimToken`：领取的奖励资产信息。
- `list[].claimToken.name`：奖励资产名称。
- `list[].claimToken.symbol`：奖励资产 symbol。
- `list[].claimToken.logoUrl`：奖励资产 logo。
- `list[].claimToken.decimals`：奖励资产精度。
- `list[].claimToken.contractAddress`：奖励资产合约地址。
- `list[].claimToken.assetType`：奖励资产链内类型。
- `list[].claimToken.amount`：本次领取的奖励数量。
- `list[].period`：对应锁仓周期信息。
- `list[].period.periodId`：周期主键。
- `list[].period.label`：周期展示名称。
- `list[].period.durationDays`：锁仓天数。
- `list[].period.aprPct`：周期 APR。
- `list[].period.multiplier`：周期倍数。
- `list[].startedAt`：锁仓开始时间。
- `list[].claimAddress`：奖励领取地址。
- `list[].claimedAt`：奖励领取时间。
- `list[].claimTxHash`：领取交易哈希。
- `pageNum`：当前页码。
- `pageSize`：当前页大小。
- `total`：总记录数。

#### `GET /api/v1/lock/unlock-history`

请求参数：

```json
{
  "chainId": 12315,
  "address": "0x...",
  "pageNum": 1,
  "pageSize": 20
}
```

返回字段：

```json
{
  "list": [
    {
      "unlockHistoryId": "unlock-1",
      "lockId": "lock-3",
      "lockToken": {
        "name": "Vote",
        "symbol": "VOTE",
        "logoUrl": "/token/vote.svg",
        "decimals": 8,
        "contractAddress": "",
        "assetType": "Vote",
        "amount": "20000"
      },
      "rewardToken": {
        "name": "Vote",
        "symbol": "VOTE",
        "logoUrl": "/token/vote.svg",
        "decimals": 8,
        "contractAddress": "",
        "assetType": "Vote",
        "amount": "856"
      },
      "period": {
        "periodId": 2,
        "label": "90 days",
        "durationDays": 90,
        "aprPct": "12",
        "multiplier": "1.5"
      },
      "startedAt": 1770000000000,
      "unlockedAt": 1770000000000,
      "unlockTxHash": "0x..."
    }
  ],
  "pageNum": 1,
  "pageSize": 20,
  "total": 18
}
```

请求字段说明：

- `chainId`：目标网络 ID。
- `address`：用户钱包地址。
- `pageNum`：页码。
- `pageSize`：每页条数。

返回字段说明：

- `list`：解锁历史列表。
- `list[].unlockHistoryId`：解锁历史主键。
- `list[].lockId`：关联锁仓仓位主键。
- `list[].lockToken`：锁仓资产信息。
- `list[].lockToken.name`：锁仓资产名称。
- `list[].lockToken.symbol`：锁仓资产 symbol。
- `list[].lockToken.logoUrl`：锁仓资产 logo。
- `list[].lockToken.decimals`：锁仓资产精度。
- `list[].lockToken.contractAddress`：锁仓资产合约地址。
- `list[].lockToken.assetType`：锁仓资产链内类型。
- `list[].lockToken.amount`：本次解锁的锁仓数量。
- `list[].rewardToken`：奖励资产信息。
- `list[].rewardToken.name`：奖励资产名称。
- `list[].rewardToken.symbol`：奖励资产 symbol。
- `list[].rewardToken.logoUrl`：奖励资产 logo。
- `list[].rewardToken.decimals`：奖励资产精度。
- `list[].rewardToken.contractAddress`：奖励资产合约地址。
- `list[].rewardToken.assetType`：奖励资产链内类型。
- `list[].rewardToken.amount`：解锁时关联的奖励数量。
- `list[].period`：对应锁仓周期信息。
- `list[].period.periodId`：周期主键。
- `list[].period.label`：周期展示名称。
- `list[].period.durationDays`：锁仓天数。
- `list[].period.aprPct`：周期 APR。
- `list[].period.multiplier`：周期倍数。
- `list[].startedAt`：锁仓开始时间。
- `list[].unlockedAt`：实际解锁时间。
- `list[].unlockTxHash`：解锁交易哈希。
- `pageNum`：当前页码。
- `pageSize`：当前页大小。
- `total`：总记录数。

说明：

- `lock / unlock / claim rewards` 由前端直接调合约，这里不规划后端接口。



## 5. Governance 页面

### 页面数据块

- 用户投票权 summary
- 提案列表
- 投票动作
- 创建提案入口

### 推荐接口

#### `GET /api/v1/governance/page`

请求参数：

```json
{
  "chainId": 12315,
  "address": "0x..."
}
```

返回字段：

```json
{
  "summary": {
    "votingPower": "45680",
    "votingPowerSymbol": "VOTES",
    "votedProposalCount": 12,
    "activeProposalCount": 7,
    "passedProposalCount": 20,
    "rejectedProposalCount": 5,
    "canCreateProposal": true,
    "proposalThreshold": "100000"
  },
  "recentProposals": [
    // 5 条就行
    {
      "proposal": {
        "proposalId": "prop-1",
        "title": "Increase Block Gas Limit to 30M",
        "summary": "Proposal to increase...",
        "category": "Network Upgrade",
        "status": "active",
        "statusLabel": "Active",
        "proposalType": "parameter_change",
        "proposalTxHash": "0x...",
        "author": {
          "address": "0x...",
          "displayName": "0x1234...5678"
        }
      },
      "timeline": {
        "createdAt": 1770000000000,
        "startVotingAt": 1770003600000,
        "endVotingAt": 1770500000000,
        "timeLeftSeconds": 86400
      },
      "voteProgress": {
        "forVotes": "45680",
        "againstVotes": "12340",
        "abstainVotes": "0",
        "totalVotes": "58020",
        "quorumThreshold": "100000",
        "quorumReached": false,
        "forPct": "78.73",
        "againstPct": "21.27",
        "turnoutPct": "58.02"
      },
      "permission": {
        "canVote": true,
        "userHasVoted": false,
        "userVoteType": "",
        "userVoteAmount": "0"
      }
    }
  ]
}
```

说明：

- `recentProposals` 建议只返回 3 到 5 条 active/recent 提案。
- `recentProposals` 的单项结构建议与 `GET /api/v1/governance/proposals` 保持一致。

请求字段说明：

- `chainId`：目标网络 ID。
- `address`：用户钱包地址。

返回字段说明：

- `summary`：用户治理摘要。
- `summary.votingPower`：当前用户投票权总量。
- `summary.votingPowerSymbol`：投票权 symbol。
- `summary.votedProposalCount`：用户已投票提案数量。
- `summary.activeProposalCount`：当前活跃提案数量。
- `summary.passedProposalCount`：已通过提案数量。
- `summary.rejectedProposalCount`：已拒绝提案数量。
- `summary.canCreateProposal`：当前用户是否可发起提案。
- `summary.proposalThreshold`：创建提案所需门槛值。
- `recentProposals`：最近提案列表。
- `recentProposals[].proposal`：提案基础信息。
- `recentProposals[].proposal.proposalId`：提案主键。
- `recentProposals[].proposal.title`：提案标题。
- `recentProposals[].proposal.summary`：提案摘要。
- `recentProposals[].proposal.category`：提案分类。
- `recentProposals[].proposal.status`：提案状态。
- `recentProposals[].proposal.statusLabel`：提案状态展示文案。
- `recentProposals[].proposal.proposalType`：提案类型。
- `recentProposals[].proposal.proposalTxHash`：提案创建交易哈希。
- `recentProposals[].proposal.author`：提案作者信息。
- `recentProposals[].proposal.author.address`：作者地址。
- `recentProposals[].proposal.author.displayName`：作者展示名。
- `recentProposals[].timeline`：提案时间轴信息。
- `recentProposals[].timeline.createdAt`：提案创建时间。
- `recentProposals[].timeline.startVotingAt`：投票开始时间。
- `recentProposals[].timeline.endVotingAt`：投票结束时间。
- `recentProposals[].timeline.timeLeftSeconds`：距投票结束剩余秒数。
- `recentProposals[].voteProgress`：投票进度信息。
- `recentProposals[].voteProgress.forVotes`：赞成票数量。
- `recentProposals[].voteProgress.againstVotes`：反对票数量。
- `recentProposals[].voteProgress.abstainVotes`：弃权票数量。
- `recentProposals[].voteProgress.totalVotes`：总票数。
- `recentProposals[].voteProgress.quorumThreshold`：法定人数门槛。
- `recentProposals[].voteProgress.quorumReached`：是否达到法定人数。
- `recentProposals[].voteProgress.forPct`：赞成票占比。
- `recentProposals[].voteProgress.againstPct`：反对票占比。
- `recentProposals[].voteProgress.turnoutPct`：投票参与率。
- `recentProposals[].permission`：当前用户权限信息。
- `recentProposals[].permission.canVote`：当前用户是否可投票。
- `recentProposals[].permission.userHasVoted`：当前用户是否已投票。
- `recentProposals[].permission.userVoteType`：当前用户投票方向。
- `recentProposals[].permission.userVoteAmount`：当前用户投票权数量。

#### `GET /api/v1/governance/proposals`

用途：提案分页、状态筛选、分类筛选、搜索和排序。

请求参数：

```json
{
  "chainId": 12315,
  "address": "0x...", // 可选，传了用户地址后，把用户自己的提案放在最前面，已投票的其次，但前提是当前提案是活跃的；（不受排序的影响）；
  "status": "all", // 可选， 默认 all
  "category": "all", // 可选， 默认 all
  "keyword": "", // 可选
  "pageNum": 1,
  "pageSize": 20,
  "sortBy": "endVotingAt", // 可选，默认排序时间排序
  "sortOrder": "asc" //由新到旧
}
```

返回字段：

```json
{
  "list": [
    {
      "proposal": {
        "proposalId": "prop-1",
        "title": "Increase Block Gas Limit to 30M",
        "summary": "Proposal to increase the block gas limit from 20M to 30M...",
        "category": "Network Upgrade",
        "status": "active",
        "statusLabel": "Active",
        "proposalType": "parameter_change",
        "proposalTxHash": "0x...",
        "discussionUrl": "https://...",
        "author": {
          "address": "0x...",
          "displayName": "0x1234...5678"
        }
      },
      "timeline": {
        "createdAt": 1770000000000,
        "startVotingAt": 1770003600000,
        "endVotingAt": 1770500000000,
        "executedAt": 0,
        "timeLeftSeconds": 86400
      },
      "voteProgress": {
        "forVotes": "45680",
        "againstVotes": "12340",
        "abstainVotes": "0",
        "totalVotes": "58020",
        "quorumThreshold": "100000",
        "quorumReached": false,
        "forPct": "78.73",
        "againstPct": "21.27",
        "turnoutPct": "58.02"
      },
      "permission": {
        "canVote": true,
        "userHasVoted": false,
        "userVoteType": "",
        "userVoteAmount": "0"
      }
    }
  ],
  "filters": {
    "statusOptions": [
      "all",
      "active",
      "passed",
      "rejected",
      "executed",
      "canceled"
    ],
    "categoryOptions": [
      "all",
      "Network Upgrade",
      "Treasury",
      "Technical",
      "Governance"
    ]
  },
  "pageNum": 1,
  "pageSize": 20,
  "total": 30
}
```

说明：

- `address` 建议为可选；未传时也应返回公共提案数据，只是不返回用户态投票结果。
- `keyword` 建议支持按 `title`、`proposalId`、`author.address` 搜索。
- `sortBy` 建议支持 `createdAt`、`endVotingAt`、`totalVotes`。
- 前端展示所需的 `for/against` 百分比、是否达到 quorum、剩余时间，建议由后端直接算好并返回。
- 列表项建议收敛为 4 个对象：
  - `proposal`：提案基础信息
  - `timeline`：时间轴信息
  - `voteProgress`：票数与进度信息
  - `permission`：用户是否可投、是否已投票等权限信息

请求字段说明：

- `chainId`：目标网络 ID。
- `address`：用户钱包地址；可选，用于返回用户态投票信息和排序增强。
- `status`：提案状态筛选条件。
- `category`：提案分类筛选条件。
- `keyword`：搜索关键字。
- `pageNum`：页码。
- `pageSize`：每页条数。
- `sortBy`：排序字段。
- `sortOrder`：排序方向。

返回字段说明：

- `list`：提案分页列表。
- `list[].proposal`：提案基础信息。
- `list[].proposal.proposalId`：提案主键。
- `list[].proposal.title`：提案标题。
- `list[].proposal.summary`：提案摘要。
- `list[].proposal.category`：提案分类。
- `list[].proposal.status`：提案状态。
- `list[].proposal.statusLabel`：提案状态文案。
- `list[].proposal.proposalType`：提案类型。
- `list[].proposal.proposalTxHash`：提案创建交易哈希。
- `list[].proposal.discussionUrl`：讨论帖链接。
- `list[].proposal.author`：作者信息。
- `list[].proposal.author.address`：作者地址。
- `list[].proposal.author.displayName`：作者展示名。
- `list[].timeline`：提案时间轴。
- `list[].timeline.createdAt`：提案创建时间。
- `list[].timeline.startVotingAt`：投票开始时间。
- `list[].timeline.endVotingAt`：投票结束时间。
- `list[].timeline.executedAt`：提案执行时间；未执行时可为 `0`。
- `list[].timeline.timeLeftSeconds`：剩余投票秒数。
- `list[].voteProgress`：投票进度信息。
- `list[].voteProgress.forVotes`：赞成票数量。
- `list[].voteProgress.againstVotes`：反对票数量。
- `list[].voteProgress.abstainVotes`：弃权票数量。
- `list[].voteProgress.totalVotes`：总票数。
- `list[].voteProgress.quorumThreshold`：法定人数门槛。
- `list[].voteProgress.quorumReached`：是否达到法定人数。
- `list[].voteProgress.forPct`：赞成票占比。
- `list[].voteProgress.againstPct`：反对票占比。
- `list[].voteProgress.turnoutPct`：投票参与率。
- `list[].permission`：当前用户权限信息。
- `list[].permission.canVote`：当前用户是否可投票。
- `list[].permission.userHasVoted`：当前用户是否已投票。
- `list[].permission.userVoteType`：当前用户投票方向。
- `list[].permission.userVoteAmount`：当前用户投票权数量。
- `filters`：前端筛选项配置。
- `filters.statusOptions`：状态筛选候选项。
- `filters.categoryOptions`：分类筛选候选项。
- `pageNum`：当前页码。
- `pageSize`：当前页大小。
- `total`：总记录数。

#### `GET /api/v1/governance/proposals/{proposalId}`

用途：根据提案 id 查询提案详情，用于提案详情页、投票弹窗详情、执行状态展示。

请求参数：

```json
{
  "chainId": 12315,
  "proposalId": "prop-1",
  "address": "0x..."
}
```

返回字段：

```json
{
  "proposal": {
    "proposalId": "prop-1",
    "title": "Increase Block Gas Limit to 30M",
    "summary": "Proposal to increase the block gas limit from 20M to 30M...",
    "description": "Full markdown/plain-text proposal content...",
    "category": "Network Upgrade",
    "status": "active",
    "statusLabel": "Active",
    "proposalType": "parameter_change",
    "proposalTxHash": "0x...",
    "discussionUrl": "https://...",
    "snapshotBlockNumber": 12345678,
    "author": {
      "address": "0x...",
      "displayName": "0x1234...5678"
    }
  },
  "timeline": {
    "createdAt": 1770000000000,
    "startVotingAt": 1770003600000,
    "endVotingAt": 1770500000000,
    "queuedAt": 0,
    "executedAt": 0,
    "canceledAt": 0,
    "timeLeftSeconds": 86400
  },
  "voteProgress": {
    "forVotes": "45680",
    "againstVotes": "12340",
    "abstainVotes": "0",
    "totalVotes": "58020",
    "quorumThreshold": "100000",
    "quorumReached": false,
    "forPct": "78.73",
    "againstPct": "21.27",
    "turnoutPct": "58.02"
  },
  "permission": {
    "canVote": true,
    "canExecute": false,
    "canCancel": false,
    "userHasVoted": false,
    "userVoteType": "",
    "userVoteAmount": "0"
  },
  "execution": {
    "targetCount": 2,
    "actions": [
      {
        "actionIndex": 0,
        "targetAddress": "0x...",
        "value": "0",
        "signature": "setBlockGasLimit(uint256)",
        "calldata": "0x..."
      }
    ]
  }
}
```

说明：

- 这条接口建议复用 `GET /api/v1/governance/proposals` 的 `proposal / timeline / voteProgress / permission` 结构，详情页只在此基础上补充 `description`、`snapshotBlockNumber`、`execution`。
- `address` 建议为可选；未传时可不返回用户态权限或将 `permission` 中用户相关字段置空。
- 如果提案没有执行动作，`execution.actions` 返回空数组即可。

请求字段说明：

- `chainId`：目标网络 ID。
- `proposalId`：提案主键。
- `address`：用户钱包地址；可选。

返回字段说明：

- `proposal`：提案基础信息。
- `proposal.proposalId`：提案主键。
- `proposal.title`：提案标题。
- `proposal.summary`：提案摘要。
- `proposal.description`：提案完整正文。
- `proposal.category`：提案分类。
- `proposal.status`：提案状态。
- `proposal.statusLabel`：提案状态展示文案。
- `proposal.proposalType`：提案类型。
- `proposal.proposalTxHash`：提案创建交易哈希。
- `proposal.discussionUrl`：提案讨论链接。
- `proposal.snapshotBlockNumber`：投票快照区块高度。
- `proposal.author`：作者信息。
- `proposal.author.address`：作者地址。
- `proposal.author.displayName`：作者展示名。
- `timeline`：提案时间轴信息。
- `timeline.createdAt`：提案创建时间。
- `timeline.startVotingAt`：投票开始时间。
- `timeline.endVotingAt`：投票结束时间。
- `timeline.queuedAt`：提案排队执行时间。
- `timeline.executedAt`：提案实际执行时间。
- `timeline.canceledAt`：提案取消时间。
- `timeline.timeLeftSeconds`：距投票结束剩余秒数。
- `voteProgress`：投票进度信息。
- `voteProgress.forVotes`：赞成票数量。
- `voteProgress.againstVotes`：反对票数量。
- `voteProgress.abstainVotes`：弃权票数量。
- `voteProgress.totalVotes`：总票数。
- `voteProgress.quorumThreshold`：法定人数门槛。
- `voteProgress.quorumReached`：是否达到法定人数。
- `voteProgress.forPct`：赞成票占比。
- `voteProgress.againstPct`：反对票占比。
- `voteProgress.turnoutPct`：投票参与率。
- `permission`：用户权限信息。
- `permission.canVote`：当前用户是否可投票。
- `permission.canExecute`：当前用户是否可执行提案。
- `permission.canCancel`：当前用户是否可取消提案。
- `permission.userHasVoted`：当前用户是否已投票。
- `permission.userVoteType`：当前用户投票方向。
- `permission.userVoteAmount`：当前用户投票权数量。
- `execution`：提案执行动作信息。
- `execution.targetCount`：执行动作数量。
- `execution.actions`：动作列表。
- `execution.actions[].actionIndex`：动作顺序索引。
- `execution.actions[].targetAddress`：目标合约地址。
- `execution.actions[].value`：附带原生币数量。
- `execution.actions[].signature`：目标方法签名。
- `execution.actions[].calldata`：执行 calldata。

#### `GET /api/v1/governance/proposals/{proposalId}/votes`

用途：提案投票明细。

请求参数：

```json
{
  "chainId": 12315,
  "pageNum": 1,
  "pageSize": 20,
  "voteType": "for"
}
```

返回字段：

```json
{
  "list": [
    {
      "voteId": "vote-1",
      "voterAddress": "0x...",
      "voteType": "for",
      "voteAmount": "10000",
      "votedAt": 1770000000000,
      "txHash": "0x..."
    }
  ],
  "pageNum": 1,
  "pageSize": 20,
  "total": 200
}
```

请求字段说明：

- `chainId`：目标网络 ID。
- `pageNum`：页码。
- `pageSize`：每页条数。
- `voteType`：投票方向筛选。

返回字段说明：

- `list`：投票明细列表。
- `list[].voteId`：投票记录主键。
- `list[].voterAddress`：投票地址。
- `list[].voteType`：投票方向。
- `list[].voteAmount`：投票权数量。
- `list[].votedAt`：投票时间。
- `list[].txHash`：投票交易哈希。
- `pageNum`：当前页码。
- `pageSize`：当前页大小。
- `total`：总记录数。

说明：

- 创建提案和投票由前端直接调合约，这里不规划后端接口。



## 6. Flow 页面

### 页面数据块

- 统计卡：Total Flow In / Out / Net Flow / Flowable Assets
- 资产选择器
- 当前资产余额
- Flow 历史
- Flow In / Flow Out 交易确认

### 推荐接口

#### `GET /api/v1/flow/page`

用途：Flow 页首屏公共聚合接口。

请求参数：

```json
{
  "chainId": 12315
}
```

返回字段：

```json
{
  "stats": {
    "totalFlowIn": "67086.15",
    "totalFlowOut": "41452.85",
    "netFlow": "25633.30",
    "flowableAssetCount": 10
  },
  "assets": [
    {
      "assetId": "usdc-flow",
      "name": "USD Coin",
      "assetName": "Flow USD",
      "symbol": "USDC",
      "logoUrl": "https://...",
      "contractAddress": "0x...",
      "assetType": "0x...",
      "decimals": 6,
      "assetDecimals": 8,
      "isEnabled": true,
      "exchangeRate": "1"
    }
  ]
}
```

- `/api/v1/flow/page` 不返回任何用户地址相关数据。
- 这个接口只负责：
  - 全网统计卡
  - 可 Flow 资产目录
- 用户态数据改走独立接口：
  - `GET /api/v1/flow/assets`
  - `GET /api/v1/flow/history`

请求字段说明：

- `chainId`：目标网络 ID。

返回字段说明：

- `stats`：Flow 页公共统计卡数据。
- `stats.totalFlowIn`：全网累计 Flow In 数量。
- `stats.totalFlowOut`：全网累计 Flow Out 数量。
- `stats.netFlow`：全网净流入数量。
- `stats.flowableAssetCount`：支持 Flow 的资产数量。
- `assets`：可 Flow 资产目录列表。
- `assets[].assetId`：Flow 资产主键。
- `assets[].name`：ERC20 侧资产名称。
- `assets[].assetName`：Flow 侧资产名称。
- `assets[].symbol`：资产 symbol。
- `assets[].logoUrl`：资产 logo。
- `assets[].contractAddress`：ERC20 合约地址。
- `assets[].assetType`：Flow 侧链内资产类型。
- `assets[].decimals`：ERC20 侧精度。
- `assets[].assetDecimals`：Flow 侧精度。
- `assets[].isEnabled`：当前是否启用 Flow。
- `assets[].exchangeRate`：ERC20 和 Flow 资产之间的兑换率。

#### `GET /api/v1/flow/assets`

用途：Flow 表单资产选择器、当前资产余额。

请求参数：

```json
{
  "chainId": 12315,
  "address": "0x..."
}
```

返回字段：

```json
{
  "list": [
    {
      "assetId": "usdc-flow",
      "name": "USD Coin",
      "assetName": "Flow USD",
      "symbol": "USDC",
      "logoUrl": "https://...",
      "contractAddress": "0x...",
      "assetType": "0x...",
      "decimals": 6,
      "assetDecimals": 8,
      "erc20Balance": "25000",
      "flowBalance": "18750",
      "isEnabled": true,
      "exchangeRate": "1",
      "canFlowIn": true,
      "canFlowOut": true
    }
  ],
  "defaultAssetId": "usdc-flow"
}
```

字段说明：

- `name` / `decimals`：ERC20 侧的 token name 和 decimals。
- `assetName` / `assetDecimals`：Flow In 后链上资产侧的 name 和 decimals。
- 不要假设 Flow 资产一定沿用 ERC20 的 `name` 或 `decimals`。

这个接口里建议直接把两侧余额都算好：

- `erc20Balance`
- `flowBalance`

这样前端不需要再自己混用业务接口、ERC20 RPC 和链 RPC。

请求字段说明：

- `chainId`：目标网络 ID。
- `address`：用户钱包地址。

返回字段说明：

- `list`：当前用户可操作的 Flow 资产列表。
- `list[].assetId`：Flow 资产主键。
- `list[].name`：ERC20 侧资产名称。
- `list[].assetName`：Flow 侧资产名称。
- `list[].symbol`：资产 symbol。
- `list[].logoUrl`：资产 logo。
- `list[].contractAddress`：ERC20 合约地址。
- `list[].assetType`：Flow 侧资产类型。
- `list[].decimals`：ERC20 侧精度。
- `list[].assetDecimals`：Flow 侧精度。
- `list[].erc20Balance`：当前 ERC20 侧余额。
- `list[].flowBalance`：当前 Flow 侧余额。
- `list[].isEnabled`：当前是否启用 Flow。
- `list[].exchangeRate`：兑换率。
- `list[].canFlowIn`：当前是否允许做 Flow In。
- `list[].canFlowOut`：当前是否允许做 Flow Out。
- `defaultAssetId`：前端默认选中的资产主键。

#### `GET /api/v1/flow/history`

用途：用户 Flow 历史分页列表，兼容 Recent Flows 列表和后续历史页扩展。

请求参数：

```json
{
  "chainId": 12315,
  "address": "0x...",
  "pageNum": 1,
  "pageSize": 20,
  "direction": "all",
  "status": "all",
  "assetId": ""
}
```

返回字段：

```json
{
  "list": [
    {
      "flowId": "flow-1",
      "direction": "in",
      "method": "lockTokens",
      "status": "completed",
      "asset": {
        "assetId": "usdc-flow",
        "name": "USD Coin",
        "assetName": "Flow USD",
        "symbol": "USDC",
        "logoUrl": "https://...",
        "contractAddress": "0x...",
        "assetType": "0x...",
        "decimals": 6,
        "assetDecimals": 8
      },
      "amountInfo": {
        "erc20Amount": "5000",
        "flowAmount": "5000",
        "displayAmount": "5000",
        "displaySymbol": "USDC"
      },
      "timeline": {
        "submittedAt": 1770000000000,
        "completedAt": 1770000060000
      },
      "tx": {
        "txHash": "0x...",
        "blockNumber": 12345678
      }
    }
  ],
  "pageNum": 1,
  "pageSize": 20,
  "total": 36
}
```

字段说明：

- `direction`
  - `in`：ERC20 -> Flow 资产
  - `out`：Flow 资产 -> ERC20
- `method`
  - `lockTokens`：Flow In
  - `unlockTokens`：Flow Out
- `asset`
  - 统一返回 ERC20 侧和 Flow 资产侧的完整元数据，避免列表页和详情页再补查资产信息。
- `amountInfo`
  - `erc20Amount`：ERC20 侧数量
  - `flowAmount`：Flow 资产侧数量
  - `displayAmount`：列表主展示数量
  - `displaySymbol`：列表主展示 symbol
- `timeline.submittedAt`
  - 钱包交易发起时间
- `timeline.completedAt`
  - 后端确认 Flow 状态完成的时间；未完成时可返回 `0`
- `tx`
  - 历史列表最少应返回 `txHash`，建议一起返回 `blockNumber`

筛选建议：

- `direction` 支持 `all / in / out`
- `status` 支持 `all / pending / completed / failed`
- `assetId` 为空时表示不过滤资产

请求字段说明：

- `chainId`：目标网络 ID。
- `address`：用户钱包地址。
- `pageNum`：页码。
- `pageSize`：每页条数。
- `direction`：Flow 方向筛选。
- `status`：Flow 状态筛选。
- `assetId`：按资产主键筛选；空字符串表示不过滤。

返回字段说明：

- `list`：Flow 历史列表。
- `list[].flowId`：Flow 记录主键。
- `list[].direction`：Flow 方向。
- `list[].method`：底层调用方法名。
- `list[].status`：Flow 状态。
- `list[].asset`：Flow 资产信息。
- `list[].asset.assetId`：Flow 资产主键。
- `list[].asset.name`：ERC20 侧资产名称。
- `list[].asset.assetName`：Flow 侧资产名称。
- `list[].asset.symbol`：资产 symbol。
- `list[].asset.logoUrl`：资产 logo。
- `list[].asset.contractAddress`：ERC20 合约地址。
- `list[].asset.assetType`：Flow 侧资产类型。
- `list[].asset.decimals`：ERC20 侧精度。
- `list[].asset.assetDecimals`：Flow 侧精度。
- `list[].amountInfo`：数量展示信息。
- `list[].amountInfo.erc20Amount`：ERC20 侧数量。
- `list[].amountInfo.flowAmount`：Flow 侧数量。
- `list[].amountInfo.displayAmount`：列表主展示数量。
- `list[].amountInfo.displaySymbol`：列表主展示 symbol。
- `list[].timeline`：时间信息。
- `list[].timeline.submittedAt`：交易发起时间。
- `list[].timeline.completedAt`：Flow 完成时间。
- `list[].tx`：交易信息。
- `list[].tx.txHash`：交易哈希。
- `list[].tx.blockNumber`：区块高度。
- `pageNum`：当前页码。
- `pageSize`：当前页大小。
- `total`：总记录数。



### 必做读接口

- `GET /api/v1/dashboard/page`
- `GET /api/v1/wallet/page`
- `GET /api/v1/wallet/tokens`
- `GET /api/v1/wallet/transactions`
- `GET /api/v1/wallet/token-catalog`
- `GET /api/v1/wallet/token-metadata`
- `GET /api/v1/staking/page`
- `GET /api/v1/staking/stakeable-tokens`
- `GET /api/v1/staking/staked-tokens`
- `GET /api/v1/staking/validators`
- `GET /api/v1/staking/positions`
- `GET /api/v1/staking/rewards/history`
- `GET /api/v1/lock/page`
- `GET /api/v1/lock/user-summary`
- `GET /api/v1/lock/positions`
- `GET /api/v1/lock/rewards/history`
- `GET /api/v1/lock/unlock-history`
- `GET /api/v1/governance/page`
- `GET /api/v1/governance/proposals`
- `GET /api/v1/governance/proposals/{proposalId}`
- `GET /api/v1/governance/proposals/{proposalId}/votes`
- `GET /api/v1/flow/page`
- `GET /api/v1/flow/assets`
- `GET /api/v1/flow/history`

### 必做写接口

- `POST /api/v1/wallet/tokens`
- `DELETE /api/v1/wallet/tokens/{contractAddress}`
- `POST /api/v1/wallet/custom-tokens`
- `DELETE /api/v1/wallet/custom-tokens/{contractAddress}`
