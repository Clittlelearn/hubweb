# OpenHiveHub Backend 前端 API 对接文档

> **版本**: v2.0 | **基础路径**: `http://{host}:{port}/api/v1` | **默认端口**: `3001`  
> **最后更新**: 2026-07-06

---

## 目录

- [一、通用约定](#一通用约定)
- [二、健康检查](#二健康检查)
- [三、Dashboard 仪表盘](#三dashboard-仪表盘)
- [四、Staking 质押 / 验证者](#四staking-质押--验证者)
- [五、Delegate 委托](#五delegate-委托)
- [六、Wallet 钱包](#六wallet-钱包)
- [七、Governance 治理](#七governance-治理)
- [八、Lock 锁仓](#八lock-锁仓)
- [九、Flow 跨链](#九flow-跨链)
- [十、TypeScript 类型定义](#十typescript-类型定义)

---

## 一、通用约定

### 1.1 统一响应格式

所有接口返回以下 JSON 结构：

```typescript
// 成功
{
  code: 0;
  message: "ok";
  data: T;
}

// 分页
{
  code: 0;
  message: "ok";
  data: {
    list: T[];
    pageNum: number;   // 当前页码
    pageSize: number;  // 每页条数
    total: number;     // 总条数
  }
}

// 错误
{
  code: number;        // 非 0
  message: string;
  data: null;
}
```

### 1.2 公共参数

所有接口可通过 query 传递 `chainId`（默认 `12315`），无需在每个接口单独声明。

### 1.3 错误码

| 错误码 | 含义 |
|--------|------|
| `0` | 成功 |
| `400` | 必填参数缺失（如 `address`） |
| `1001` | 参数错误 |
| `2001` | 数据不存在 |
| `404` | 路由不存在 |
| `5001` | 数据库错误 |
| `9999` | 系统内部错误 |

### 1.4 HTTP 方法

| 方法 | 用途 |
|------|------|
| `GET` | 查询数据 |
| `POST` | 创建/绑定资源 |
| `DELETE` | 删除/移除资源 |

---

## 二、健康检查

### `GET /api/health`

> 无需参数，返回服务运行状态。

**响应示例**：
```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "status": "healthy",
    "timestamp": "2026-07-06T12:00:00.000Z",
    "uptime": 12345.67
  }
}
```

---

## 三、Dashboard 仪表盘

### 3.1 `GET /api/v1/dashboard/page` — 首页聚合

**Query 参数**：`chainId?` (number, 默认 12315)

<details>
<summary><b>响应结构</b></summary>

```typescript
interface DashboardPageData {
  network: {
    chainId: number;
    networkName: string;       // e.g. "OpenHive Devnet"
    isOnline: boolean;
    blockHeight: number;
    epoch: number;
  };
  primaryStats: {
    totalSupply: string;
    totalSupplySymbol: string;           // "OHI"
    totalSupplyChangePct: string;
    circulatingSupply: string;
    circulatingSupplySymbol: string;     // "OHI"
    circulatingSupplyChangePct: string;
    totalStaked: string;
    totalStakedSymbol: string;           // "OHI"
    totalStakedChangePct: string;
    activeValidatorCount: number;
    activeValidatorDelta: number;
  };
  secondaryStats: {
    totalVotingPower: string;
    totalVotingPowerSymbol: string;      // "OHI"
    activeProposalCount: number;
    networkTps: number;
    uniqueAddressCount: number;
  };
  charts: {
    tvl: { label: string; valueUsd: string }[];
    dailyTransactions: { label: string; txCount: number }[];
    staking: { label: string; stakedAmount: string; unstakedAmount: string }[];
  };
  recentBlocks: {
    height: number;
    txCount: number;
    timestampMs: number;          // 毫秒时间戳
    proposerName: string;
    proposerAddress: string;
    hash: string;
  }[];
}
```
</details>

### 3.2 `GET /api/v1/dashboard/blocks` — 区块列表

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `chainId` | number | 否 | 12315 | |
| `pageNum` | number | 否 | 1 | |
| `pageSize` | number | 否 | 20 | |

<details>
<summary><b>响应结构</b></summary>

```typescript
// data: PaginatedResponse<{
//   height: number;
//   txCount: number;
//   timestampMs: number;
//   proposerName: string;
//   proposerAddress: string;
//   hash: string;
// }>
```
</details>

---

## 四、Staking 质押 / 验证者

### 4.1 `GET /api/v1/staking/page` — 质押首页聚合

| 参数 | 类型 | 必填 | 默认值 |
|------|------|------|--------|
| `chainId` | number | 否 | 12315 |

<details>
<summary><b>响应结构</b></summary>

```typescript
interface StakingPageData {
  networkStats: {
    activeValidatorCount: number;
    totalStaked: string;              // 已千分位格式化，如 "12,345,678"
    totalStakedSymbol: "OHI";
    totalStakedCurrency: "OHI";
    networkUptimePct: string;
    avgValidatorApyPct: string;
  };
  stakedTokens: any[];                // 当前为空，待实现
  topValidators: {
    validatorId: string;
    rank: number;
    name: string;
    address: string;
    logoUrl: string;
    status: string;                   // "active" | "inactive"
    uptimePct: string;
    apyPct: string;
    commission: string;
    totalStake: string;
    delegatorsCount: number;
    // ... 更多 Validator 字段
  }[];
}
```
</details>

### 4.2 `GET /api/v1/staking/validators` — 验证者列表

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `chainId` | number | 否 | 12315 | |
| `status` | string | 否 | `"all"` | `"all"` / `"active"` / `"inactive"` |
| `pageNum` | number | 否 | 1 | |
| `pageSize` | number | 否 | 20 | |
| `keyword` | string | 否 | — | 按名称/ID/地址模糊搜索 |

<details>
<summary><b>响应结构 (list 项)</b></summary>

```typescript
interface ValidatorItem {
  validatorId: string;
  rank: number;
  name: string;
  address: string;
  logoUrl: string;
  status: string;
  description: string;
  website: string;
  identityName: string;
  identityVerified: boolean;
  delegatorCount: number;
  selfStakeUsd: string;
  selfStakeCurrency: string;
  commissionRatePct: string;
  apyPct: string;
  supportedStakeTokens: {
    tokenId: string;
    symbol: string;
    assetType: string;
    logoUrl: string;
  }[];
  stakeTokenCount: number;
  totalStakedUsd: string;
  totalStakedCurrency: string;
  delegatorRewardsUsd24h: string;
  slashCount30d: number;
  proposedBlockCount24h: number;
  performancePct: string;
  uptimePct: string;
  online: boolean;
  lastActiveAt: number | null;   // 毫秒时间戳
  version: string;
  updatedAt: number;
  canStake: boolean;
}
```
</details>

### 4.3 `GET /api/v1/staking/validators/:validatorId` — 验证者详情

> ⚠️ **当前为 TODO 状态**，返回数据不完整。

**路径参数**：`validatorId` (string)

### 4.4 `GET /api/v1/staking/stake-info` — 验证者自身质押信息

| 参数 | 类型 | 必填 | 默认值 |
|------|------|------|--------|
| `chainId` | number | 否 | 12315 |
| `address` | string | **是** | — |

<details>
<summary><b>响应结构</b></summary>

```typescript
interface StakeInfoData {
  isValidator: boolean;
  message?: string;           // 非验证者时的提示
  stakeInfo: {                // isValidator=true 时有值
    selfStake: string;        // 自身质押量 (最小精度)
    selfStakeSymbol: string;
    commission: string;
    apyPct: string;
    rank: number;
    supportedTokens: {
      tokenId: string;
      symbol: string;
      assetType: string;
      logoUrl: string;
    }[];
  } | null;
  summary: {
    totalSelfStake: string;
    totalSelfStakeSymbol: string;
    totalRewards: string;
    totalRewardsSymbol: string;
    // ...
  };
}
```
</details>

---

## 五、Delegate 委托

> 所有委托/投资（Type 4）和解委托（Type 5）相关接口。

### 5.1 `GET /api/v1/delegate/validators` — 可委托验证者列表

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `chainId` | number | 否 | 12315 | |
| `status` | string | 否 | `"all"` | `"all"` / `"active"` / `"inactive"` |
| `pageNum` | number | 否 | 1 | |
| `pageSize` | number | 否 | 20 | |
| `keyword` | string | 否 | — | 按名称/ID/地址模糊搜索 |

<details>
<summary><b>响应结构 (list 项)</b></summary>

```typescript
interface DelegateValidatorItem {
  validatorId: string;
  rank: number;
  name: string;
  address: string;
  logoUrl: string;
  status: string;
  description: string;
  website: string;
  delegatorCount: number;
  commissionRatePct: string;    // 佣金率
  apyPct: string;               // APY
  totalStaked: string;          // 总质押 (最小精度)
  delegatedStake: string;       // 委托质押量 (最小精度)
  selfStake: string;            // 自身质押量 (最小精度)
  performancePct: string;
  uptimePct: string;
  online: boolean;
  lastActiveAt: number | null;  // 毫秒时间戳
}
```
</details>

### 5.2 `GET /api/v1/delegate/tokens` — 可委托 Token 列表

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `chainId` | number | 否 | 12315 | |
| `address` | string | 否 | — | 传入后返回该地址的各 Token 余额 |

<details>
<summary><b>响应结构</b></summary>

```typescript
// data: {
//   list: {
//     tokenId: string;
//     name: string;
//     symbol: string;
//     logoUrl: string;
//     contractAddress: string;
//     assetType: string;
//     decimals: number;
//     balance: string;       // 用户余额, 未传 address 则为 "0"
//   }[]
// }
```
列表第一项固定为 OHI。
</details>

### 5.3 `GET /api/v1/delegate/delegated-tokens` — 已委托 Token 汇总

| 参数 | 类型 | 必填 | 默认值 |
|------|------|------|--------|
| `chainId` | number | 否 | 12315 |
| `address` | string | **是** | — |

<details>
<summary><b>响应结构</b></summary>

```typescript
// data: {
//   list: {
//     tokenId: string;
//     name: string;
//     symbol: string;
//     logoUrl: string;
//     contractAddress: string;
//     assetType: string;
//     decimals: number;
//     balance: string;       // 已委托总额 (最小精度)
//   }[]
// }
```
</details>

### 5.4 `GET /api/v1/delegate/positions` — 委托仓位列表

| 参数 | 类型 | 必填 | 默认值 |
|------|------|------|--------|
| `chainId` | number | 否 | 12315 |
| `address` | string | **是** | — |
| `pageNum` | number | 否 | 1 |
| `pageSize` | number | 否 | 20 |

<details>
<summary><b>响应结构</b></summary>

```typescript
interface DelegatePositionsData {
  summary: {
    totalDelegated: string;          // 总委托额 (最小精度)
    totalDelegatedSymbol: string;    // "OHI"
    positionCount: number;           // 仓位数量
    validatorCount: number;          // 去重验证者数量
    totalRewards: string;            // 总奖励
    totalRewardsSymbol: string;      // "OHI"
  };
  list: {
    positionId: string;
    validator: {
      validatorId: string;
      name: string;
      address: string;
      logoUrl: string;
      status: string;
      description: string;
      commissionRatePct: string;
      apyPct: string;
      performancePct: string;
      uptimePct: string;
    };
    delegateToken: {
      tokenId: string;
      name: string;
      symbol: string;
      logoUrl: string;
      decimals: number;
      contractAddress: string;
      assetType: string;
      amount: string;            // 委托数量 (最小精度)
    };
    rewardAmount: string;
    rewardSymbol: string;
    delegateTxHash: string;
    delegatedAt: number;         // 毫秒时间戳
  }[];
  // + 分页字段
}
```
</details>

### 5.5 `GET /api/v1/delegate/history` — 委托/解委托交易记录

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `chainId` | number | 否 | 12315 | |
| `address` | string | **是** | — | |
| `pageNum` | number | 否 | 1 | |
| `pageSize` | number | 否 | 20 | |

<details>
<summary><b>响应结构 (list 项)</b></summary>

```typescript
interface DelegateHistoryItem {
  id: string;
  hash: string;                  // 交易哈希
  type: string;                  // "4" (委托) | "5" (解委托)
  fromAddr: string;
  toAddr: string;
  amount: string;                // 金额 (最小精度)
  assetType: string;
  validatorAddress: string;
  validatorName: string;
  timestamp: number;             // 毫秒时间戳
  blockHeight: string;
  // ...更多交易字段
}
```
</details>

### 5.6 `GET /api/v1/delegate/rewards` — 委托奖励历史

| 参数 | 类型 | 必填 | 默认值 |
|------|------|------|--------|
| `chainId` | number | 否 | 12315 |
| `address` | string | **是** | — |
| `pageNum` | number | 否 | 1 |
| `pageSize` | number | 否 | 20 |

<details>
<summary><b>响应结构 (list 项)</b></summary>

```typescript
interface DelegateRewardItem {
  rewardHistoryId: string;
  positionId: string;
  validator: {
    validatorId: string;
    name: string;
    address: string;
    logoUrl: string;
    status: string;
    description: string;
    delegatorCount: number;
    commissionRatePct: string;
    apyPct: string;
    performancePct: string;
    uptimePct: string;
  };
  stakeToken: {
    tokenId: string;
    name: string;
    symbol: string;
    logoUrl: string;
    decimals: number;
    contractAddress: string;
    assetType: string;
    amount: string;
  } | null;
  claimToken: {
    tokenId: string;
    name: string;
    symbol: string;
    logoUrl: string;
    decimals: number;
    contractAddress: string;
    assetType: string;
    amount: string;
  };
  stakeStartedAt: number;        // 毫秒时间戳
  claimAddress: string;
  apyPct: string;
  claimedAt: number;             // 毫秒时间戳
  txHash: string;
  txType: string;
}
```
</details>

---

## 六、Wallet 钱包

### 6.1 `GET /api/v1/wallet/page` — 钱包首页

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `chainId` | number | 否 | 12315 | |
| `address` | string | 否 | `"0x"` | 为空时返回零值 |

<details>
<summary><b>响应结构</b></summary>

```typescript
interface WalletPageData {
  overview: {
    totalBalance: string;        // 总余额
    balanceSymbol: string;       // "OHI"
    tokenCount: number;          // Token 种类数
    txsCount: number;            // 交易总数
  };
}
```
</details>

### 6.2 `GET /api/v1/wallet/tokens` — Token 列表

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `chainId` | number | 否 | 12315 | |
| `address` | string | 否 | `"0x"` | 为空时返回空列表 |

<details>
<summary><b>响应结构 (list 项)</b></summary>

```typescript
interface WalletTokenItem {
  tokenId: string;
  name: string;
  symbol: string;
  logoUrl: string;
  balance: string;               // 余额 (最小精度)
  decimals: number;
  contractAddress: string;
  assetType: string;
  standard: string;              // "Native" | "Native Token" | "ERC-20"
  ownerAddress: string;
  deployutxo: string;
  priceUsd: string;
  valueUsd: string;              // balance × priceUsd
  change24hPct: string;
  isCustom: boolean;
}
```
第一项固定为 Native Token (OHI)，之后是 Native Token，最后是 ERC-20 Token。
</details>

### 6.3 `GET /api/v1/wallet/transactions` — 交易历史

| 参数 | 类型 | 必填 | 默认值 |
|------|------|------|--------|
| `chainId` | number | 否 | 12315 |
| `address` | string | 否 | `"0x"` |
| `pageNum` | number | 否 | 1 |
| `pageSize` | number | 否 | 10 |

<details>
<summary><b>响应结构</b></summary>

```typescript
// data: {
//   list: {
//     hash: string;
//     fromAddr: string;
//     toAddr: string;
//     amount: string;
//     type: string;
//     timestamp: number;       // 毫秒时间戳
//     blockHeight: string;
//     // ... 更多交易字段
//   }[];
//   pageNum: number;
//   pageSize: number;
//   total: number;
// }
```
</details>

### 6.4 `GET /api/v1/wallet/token-catalog` — Token 目录

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `chainId` | number | 否 | 12315 | |
| `address` | string | 否 | — | 用于检测是否已添加 (`isAdded`) |
| `pageNum` | number | 否 | 1 | |
| `pageSize` | number | 否 | 20 | |
| `keyword` | string | 否 | — | 按名称/符号模糊搜索 |

<details>
<summary><b>响应结构 (list 项)</b></summary>

```typescript
interface TokenCatalogItem {
  tokenId: string;
  contractAddress: string;
  name: string;
  symbol: string;
  logoUrl: string;
  decimals: number;
  assetType: string;
  standard: string;
  isVerified: boolean;
  isAdded: boolean;              // 当前地址是否已添加
  listSource: "catalog";
}
```
</details>

### 6.5 `POST /api/v1/wallet/tokens` — 添加 Token

**Body (JSON)**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `chainId` | number | 是 | |
| `address` | string | 是 | 钱包地址 |
| `tokenId` | string | 是 | Token ID |
| `contractAddress` | string | 是 | 合约地址 |

<details>
<summary><b>响应</b></summary>

```typescript
// 成功: { success: true, token: TokenCatalogItem & { isAdded: true } }
// 失败: { code: 9999, message: "...", data: null }
```
</details>

### 6.6 `DELETE /api/v1/wallet/tokens/:contractAddress` — 移除 Token

**路径参数**：`contractAddress` (string)

**Body (JSON)**：`{ chainId: number, address: string }`

**响应**：`{ success: true, contractAddress: string }`

### 6.7 `GET /api/v1/wallet/token-metadata` — Token 元数据

| 参数 | 类型 | 必填 | 默认值 |
|------|------|------|--------|
| `chainId` | number | 否 | 12315 |
| `contractAddress` | string | **是** | — |

<details>
<summary><b>响应</b></summary>

```typescript
// data: {
//   tokenId: string;
//   contractAddress: string;
//   name: string;
//   symbol: string;
//   decimals: number;
//   logoUrl: string;
//   assetType: string;
//   standard: string;
//   priceUsd: string;
//   isVerified: boolean;
//   isAdded: false;
// }
// 未找到: { code: 2001, message: "Token not found", data: null }
// 缺参数: { code: 1001, message: "contractAddress is required", data: null }
```
</details>

### 6.8 `POST /api/v1/wallet/custom-tokens` — 绑定自定义 Token

**Body (JSON)**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `chainId` | number | 是 | |
| `address` | string | 是 | 钱包地址 |
| `contractAddress` | string | 是 | 合约地址 |

<details>
<summary><b>响应</b></summary>

```typescript
// 成功
{
  success: true;
  token: {
    tokenId: string;           // "custom-{contractAddress}"
    contractAddress: string;
    name: string;              // 从链上获取的 Token 名称
    symbol: "";
    logoUrl: "";
    decimals: 0;
    assetType: string;
    isCustom: true;
    standard: "";
    isVerified: false;
    isAdded: true;
    listSource: "custom";
  }
}
// 合约未找到: { success: false, message: "Failed to get asset type..." }
```
</details>

### 6.9 `DELETE /api/v1/wallet/custom-tokens/:contractAddress` — 移除自定义 Token

**路径参数**：`contractAddress` (string)

**Body (JSON)**：`{ chainId: number, address: string }`

**响应**：`{ success: true, contractAddress: string }`

---

## 七、Governance 治理

### 7.1 `GET /api/v1/governance/page` — 治理首页

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `chainId` | number | 否 | 12315 | |
| `address` | string | 否 | — | 传入后返回用户相关统计 |

<details>
<summary><b>响应结构</b></summary>

```typescript
interface GovernancePageData {
  summary: {
    votingPower: string;             // 用户投票权 (未传 address 为 "0")
    votingPowerSymbol: "vOHI";
    votedProposalCount: number;      // 已投票提案数
    activeProposalCount: number;     // 活跃提案数
    passedProposalCount: number;     // 已通过提案数
    rejectedProposalCount: number;   // 已拒绝提案数
    canCreateProposal: boolean;      // 是否可创建提案 (≥100000 投票权)
    proposalThreshold: "100000";     // 创建提案门槛
  };
  recentProposals: {
    proposal: {
      proposalId: string;
      title: string;
      summary: string;
      category: string;              // 默认 "General"
      status: "active" | "passed" | "rejected";   // 动态计算
      statusLabel: string;
      proposalType: string;
      proposalTxHash: string;
      author: {
        address: string;
        displayName: string;         // 截断显示
      };
    };
    timeline: {
      createdAt: number;             // 毫秒时间戳
      startVotingAt: number;
      endVotingAt: number;
      timeLeftSeconds: number;       // 剩余投票秒数 (已结束为 0)
    };
    voteProgress: {
      forVotes: string;
      againstVotes: string;
      abstainVotes: "0";
      totalVotes: string;
      quorumThreshold: "100000";
      quorumReached: boolean;
      forPct: string;
      againstPct: string;
      turnoutPct: "0";
    };
    permission: {
      canVote: boolean;
      userHasVoted: boolean;         // ⚠️ 当前恒为 false
      userVoteType: "";
      userVoteAmount: "0";
    };
  }[];
}
```
</details>

### 7.2 `GET /api/v1/governance/proposals` — 提案列表

| 参数 | 类型 | 必填 | 默认值 |
|------|------|------|--------|
| `chainId` | number | 否 | 12315 |

<details>
<summary><b>响应结构</b></summary>

```typescript
// data: {
//   proposals: {
//     id: string;                  // proposalId
//     proposalHash: string;
//     title: string;
//     name: string;
//     type: string;
//     isRevoke: boolean;           // 是否撤销提案
//     proposerAddress: string;
//     revokerAddress: string | null;
//     originalProposalHash: string | null;
//     totalVotes: number;          // 已转换为 number
//     yesVotes: number;
//     noVotes: number;
//     yesPercentage: number;       // 保留 1 位小数
//     noPercentage: number;
//     endTime: string;             // "YYYY-MM-DD"
//     status: string;
//     revokeBeginTime: string | null;  // "YYYY-MM-DD"
//   }[]
// }
```
按结束时间降序排列，含撤销提案。
</details>

### 7.3 `GET /api/v1/governance/proposals/:proposalId` — 提案详情

**路径参数**：`proposalId` (string)

| Query 参数 | 类型 | 必填 | 默认值 |
|------------|------|------|--------|
| `chainId` | number | 否 | 12315 |

<details>
<summary><b>响应结构</b></summary>

```typescript
interface ProposalDetail {
  // ... 提案基本字段 (同提案列表项)
  votes: {
    txHash: string;
    voter: string;           // 投票人地址
    voteType: string;        // "yes" | "no"
    voteAmount: string;      // 投票数量
    timestamp: number;       // 毫秒时间戳
  }[];
}
```
未找到返回：`{ code: 2001, message: "Proposal not found", data: null }`
</details>

### 7.4 `GET /api/v1/governance/proposals/:proposalId/votes` — 提案投票明细

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `chainId` | number | 否 | 12315 | |
| `pageNum` | number | 否 | 1 | |
| `pageSize` | number | 否 | 20 | |
| `voteType` | string | 否 | — | `"yes"` / `"no"`，不传=全部 |

<details>
<summary><b>响应结构 (list 项)</b></summary>

```typescript
interface VoteItem {
  voteId: string;
  voterAddress: string;
  voteType: string;          // "yes" | "no"
  voteAmount: string;
  votedAt: number;           // 毫秒时间戳
  txHash: string;
}
```
</details>

---

## 八、Lock 锁仓

### 8.1 `GET /api/v1/lock/page` — 锁仓首页

| 参数 | 类型 | 必填 | 默认值 |
|------|------|------|--------|
| `chainId` | number | 否 | 12315 |

<details>
<summary><b>响应结构</b></summary>

```typescript
interface LockPageData {
  networkOverview: {
    totalLockedAmount: string;           // 总锁仓量 (最小精度)
    lockedSymbol: "OHI";
    totalLockedUsd: "0";                 // 暂无价格源
    lockedCurrency: "USD";
    totalVotingPower: string;            // 投票权总量
    votingPowerSymbol: "vOHI";
    totalRewardAmount: "0";             // 锁仓无奖励
    rewardSymbol: "OHI";
    activeLockCount: number;            // 活跃锁仓数
    readyToUnlockCount: number;         // 已解锁仓位数
    totalUnlockedAmount24h: string;     // 24h 解锁总量
    totalUnlockedUsd24h: "0";
  };
  lockAsset: {
    name: "OHI";
    symbol: "OHI";
    logoUrl: "/token/vote.svg";
    decimals: 8;
    contractAddress: "";
    assetType: "OHI";
  };
}
```
</details>

### 8.2 `GET /api/v1/lock/user-summary` — 用户锁仓摘要

| 参数 | 类型 | 必填 | 默认值 |
|------|------|------|--------|
| `chainId` | number | 否 | 12315 |
| `address` | string | **是** | — |

<details>
<summary><b>响应结构</b></summary>

```typescript
interface LockUserSummaryData {
  lockAsset: {
    name: "OHI";
    symbol: "OHI";
    logoUrl: "/token/vote.svg";
    decimals: 8;
    contractAddress: "";
    assetType: "OHI";
  };
  userOverview: {
    availableBalance: string;            // 可用余额
    availableBalanceSymbol: "OHI";
    totalLockedAmount: string;           // 总锁仓量
    totalLockedUsd: "0";
    lockedSymbol: "OHI";
    totalVotingPower: string;            // 投票权
    votingPowerSymbol: "vOHI";
    claimableRewardAmount: "0";         // 锁仓无奖励
    rewardSymbol: "OHI";
    readyToUnlockCount: number;         // 可解锁仓位数
    claimableLockCount: 0;
  };
}
```
</details>

### 8.3 `GET /api/v1/lock/positions` — 锁仓仓位列表

| 参数 | 类型 | 必填 | 默认值 |
|------|------|------|--------|
| `chainId` | number | 否 | 12315 |
| `address` | string | **是** | — |

<details>
<summary><b>响应结构 (list 项)</b></summary>

```typescript
interface LockPositionItem {
  lockId: string;
  lockToken: {
    name: "OHI";
    symbol: "OHI";
    logoUrl: "/token/vote.svg";
    decimals: 8;
    contractAddress: "";
    assetType: "OHI";
    amount: string;              // 锁仓量
  };
  rewardToken: {                 // 奖励恒为 0
    name: "OHI";
    symbol: "OHI";
    logoUrl: "/token/vote.svg";
    decimals: 8;
    contractAddress: "";
    assetType: "OHI";
    amount: "0";
  };
  period: {
    periodId: 1;
    label: "24 hours";
    durationDays: 1;
    aprPct: "0";
    multiplier: "1";
    bonusPct: "0";
  };
  votingPower: string;           // = amount
  status: "locked" | "unlocked";
  startedAt: number;             // 毫秒时间戳
  endsAt: number;                // startedAt + 24h
  progressPct: number;           // 0-100
  lockTxHash: string;
  unlockTxHash: string;
  canUnlock: boolean;            // 未解锁 && 已过 24h
  canClaimRewards: false;
  canEarlyUnlock: false;
}
```
</details>

### 8.4 `GET /api/v1/lock/rewards/history` — 锁仓奖励历史

> ⚠️ 锁仓无奖励机制，**始终返回空列表**。

| 参数 | 类型 | 必填 |
|------|------|------|
| `chainId` | number | 否 |
| `address` | string | 是 |
| `pageNum` | number | 否 |
| `pageSize` | number | 否 |

### 8.5 `GET /api/v1/lock/unlock-history` — 解锁历史

| 参数 | 类型 | 必填 | 默认值 |
|------|------|------|--------|
| `chainId` | number | 否 | 12315 |
| `address` | string | **是** | — |
| `pageNum` | number | 否 | 1 |
| `pageSize` | number | 否 | 20 |

<details>
<summary><b>响应结构 (list 项)</b></summary>

```typescript
interface UnlockHistoryItem {
  unlockHistoryId: string;
  lockId: string;
  lockToken: {
    name: "OHI";
    symbol: "OHI";
    logoUrl: "/token/vote.svg";
    decimals: 8;
    contractAddress: "";
    assetType: "OHI";
    amount: string;
  };
  rewardToken: { /* 同上, amount: "0" */ };
  period: { periodId: 1; label: "24 hours"; durationDays: 1; /* ... */ };
  startedAt: number;             // 毫秒时间戳
  unlockedAt: number;            // 毫秒时间戳
  unlockTxHash: string;
}
```
</details>

---

## 九、Flow 跨链

### 9.1 `GET /api/v1/flow/page` — Flow 首页

| 参数 | 类型 | 必填 | 默认值 |
|------|------|------|--------|
| `chainId` | number | 否 | 12315 |

<details>
<summary><b>响应结构</b></summary>

```typescript
interface FlowPageData {
  stats: {
    totalFlowIn: string;              // 总流入 (最小精度)
    totalFlowOut: string;             // 总流出
    netFlow: string;                  // 净流入 = in - out
    flowableAssetCount: number;       // 可 Flow 资产数
  };
  assets: {
    assetId: string;                  // = assetType
    name: string;
    assetName: string;
    symbol: string;
    logoUrl: string;
    contractAddress: string;
    assetType: string;
    decimals: number;
    assetDecimals: number;
    isEnabled: boolean;
    exchangeRate: string;
  }[];
}
```
</details>

### 9.2 `GET /api/v1/flow/assets` — Flow 资产列表

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `chainId` | number | 否 | 12315 | |
| `address` | string | 否 | — | 传入后返回用户余额 |

<details>
<summary><b>响应结构</b></summary>

```typescript
// data: {
//   list: {
//     assetId: string;
//     name: string;
//     assetName: string;
//     symbol: string;
//     logoUrl: string;
//     contractAddress: string;
//     assetType: string;
//     decimals: number;
//     assetDecimals: number;
//     erc20Balance: string;        // 用户 ERC-20 余额
//     flowBalance: string;         // 用户 Flow 余额
//     isEnabled: boolean;
//     exchangeRate: string;
//     canFlowIn: true;             // 恒为 true
//     canFlowOut: boolean;         // flowBalance !== "0"
//   }[];
//   defaultAssetId: string;       // 默认选中第一个
// }
```
</details>

### 9.3 `GET /api/v1/flow/history` — Flow 历史记录

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `chainId` | number | 否 | 12315 | |
| `address` | string | **是** | — | |
| `pageNum` | number | 否 | 1 | |
| `pageSize` | number | 否 | 20 | |
| `direction` | string | 否 | `"all"` | `"all"` / `"in"` / `"out"` |
| `status` | string | 否 | `"all"` | `"all"` / `"pending"` / `"completed"` / `"failed"` |
| `assetId` | string | 否 | — | 按资产类型过滤 |

<details>
<summary><b>响应结构 (list 项)</b></summary>

```typescript
interface FlowHistoryItem {
  flowId: string;
  direction: "in" | "out";
  method: string;                    // Flow 方法
  status: "pending" | "completed" | "failed";
  asset: {
    assetId: string;
    name: string;
    assetName: string;
    symbol: string;
    logoUrl: string;
    contractAddress: string;
    assetType: string;
    decimals: number;
    assetDecimals: number;
  };
  amountInfo: {
    erc20Amount: string;
    flowAmount: string;
    displayAmount: string;           // = erc20Amount
    displaySymbol: "";
  };
  timeline: {
    submittedAt: number;             // 毫秒时间戳
    completedAt: number;             // 0 表示未完成
  };
  tx: {
    txHash: string;
    blockNumber: number;
  };
}
```
</details>

---

## 十、TypeScript 类型定义

以下为前端可直接使用的完整类型定义：

```typescript
// ==================== 通用 ====================

interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

interface PaginatedData<T> {
  list: T[];
  pageNum: number;
  pageSize: number;
  total: number;
}

// ==================== Token 相关 ====================

interface TokenInfo {
  tokenId: string;
  name: string;
  symbol: string;
  logoUrl: string;
  decimals: number;
  contractAddress: string;
  assetType: string;
}

interface TokenBalance extends TokenInfo {
  balance: string;          // 最小精度字符串
}

// ==================== Validator ====================

interface ValidatorBrief {
  validatorId: string;
  name: string;
  address: string;
  logoUrl: string;
  status: string;
  description: string;
  commissionRatePct: string;
  apyPct: string;
  performancePct: string;
  uptimePct: string;
}

interface ValidatorDetail extends ValidatorBrief {
  rank: number;
  website: string;
  identityName: string;
  identityVerified: boolean;
  delegatorCount: number;
  selfStakeUsd: string;
  selfStakeCurrency: string;
  supportedStakeTokens: { tokenId: string; symbol: string; assetType: string; logoUrl: string }[];
  stakeTokenCount: number;
  totalStakedUsd: string;
  totalStakedCurrency: string;
  delegatorRewardsUsd24h: string;
  slashCount30d: number;
  proposedBlockCount24h: number;
  online: boolean;
  lastActiveAt: number | null;
  version: string;
  updatedAt: number;
  canStake: boolean;
}

// ==================== Dashboard ====================

interface DashboardNetwork {
  chainId: number;
  networkName: string;
  isOnline: boolean;
  blockHeight: number;
  epoch: number;
}

interface DashboardPrimaryStats {
  totalSupply: string;
  totalSupplySymbol: string;
  totalSupplyChangePct: string;
  circulatingSupply: string;
  circulatingSupplySymbol: string;
  circulatingSupplyChangePct: string;
  totalStaked: string;
  totalStakedSymbol: string;
  totalStakedChangePct: string;
  activeValidatorCount: number;
  activeValidatorDelta: number;
}

interface DashboardSecondaryStats {
  totalVotingPower: string;
  totalVotingPowerSymbol: string;
  activeProposalCount: number;
  networkTps: number;
  uniqueAddressCount: number;
}

interface RecentBlock {
  height: number;
  txCount: number;
  timestampMs: number;
  proposerName: string;
  proposerAddress: string;
  hash: string;
}

// ==================== Delegate ====================

interface DelegatePosition {
  positionId: string;
  validator: ValidatorBrief;
  delegateToken: TokenBalance;
  rewardAmount: string;
  rewardSymbol: string;
  delegateTxHash: string;
  delegatedAt: number;
}

interface DelegatePositionsSummary {
  totalDelegated: string;
  totalDelegatedSymbol: string;
  positionCount: number;
  validatorCount: number;
  totalRewards: string;
  totalRewardsSymbol: string;
}

interface DelegateReward {
  rewardHistoryId: string;
  positionId: string;
  validator: ValidatorBrief & { delegatorCount: number };
  stakeToken: TokenBalance | null;
  claimToken: TokenBalance;
  stakeStartedAt: number;
  claimAddress: string;
  apyPct: string;
  claimedAt: number;
  txHash: string;
  txType: string;
}

// ==================== Governance ====================

interface GovernanceSummary {
  votingPower: string;
  votingPowerSymbol: string;
  votedProposalCount: number;
  activeProposalCount: number;
  passedProposalCount: number;
  rejectedProposalCount: number;
  canCreateProposal: boolean;
  proposalThreshold: string;
}

interface ProposalItem {
  id: string;
  proposalHash: string;
  title: string;
  name: string;
  type: string;
  isRevoke: boolean;
  proposerAddress: string;
  revokerAddress: string | null;
  totalVotes: number;
  yesVotes: number;
  noVotes: number;
  yesPercentage: number;
  noPercentage: number;
  endTime: string;             // "YYYY-MM-DD"
  status: string;
}

interface VoteItem {
  voteId: string;
  voterAddress: string;
  voteType: "yes" | "no";
  voteAmount: string;
  votedAt: number;
  txHash: string;
}

// ==================== Lock ====================

interface LockPosition {
  lockId: string;
  lockToken: TokenBalance;
  rewardToken: TokenBalance;
  period: { periodId: number; label: string; durationDays: number; aprPct: string; multiplier: string; bonusPct: string };
  votingPower: string;
  status: "locked" | "unlocked";
  startedAt: number;
  endsAt: number;
  progressPct: number;
  lockTxHash: string;
  unlockTxHash: string;
  canUnlock: boolean;
  canClaimRewards: boolean;
  canEarlyUnlock: boolean;
}

interface UnlockHistoryItem {
  unlockHistoryId: string;
  lockId: string;
  lockToken: TokenBalance;
  rewardToken: TokenBalance;
  period: LockPosition["period"];
  startedAt: number;
  unlockedAt: number;
  unlockTxHash: string;
}

// ==================== Flow ====================

interface FlowAsset extends TokenInfo {
  assetId: string;
  assetName: string;
  assetDecimals: number;
  erc20Balance?: string;
  flowBalance?: string;
  isEnabled: boolean;
  exchangeRate: string;
  canFlowIn?: boolean;
  canFlowOut?: boolean;
}

interface FlowHistoryItem {
  flowId: string;
  direction: "in" | "out";
  method: string;
  status: "pending" | "completed" | "failed";
  asset: FlowAsset;
  amountInfo: { erc20Amount: string; flowAmount: string; displayAmount: string; displaySymbol: string };
  timeline: { submittedAt: number; completedAt: number };
  tx: { txHash: string; blockNumber: number };
}
```

---

## 快速参考：接口总览

| 模块 | 方法 | 路径 | 说明 |
|------|------|------|------|
| Health | `GET` | `/api/health` | 健康检查 |
| Dashboard | `GET` | `/api/v1/dashboard/page` | 首页聚合 |
| Dashboard | `GET` | `/api/v1/dashboard/blocks` | 区块列表 |
| Staking | `GET` | `/api/v1/staking/page` | 质押首页 |
| Staking | `GET` | `/api/v1/staking/validators` | 验证者列表 |
| Staking | `GET` | `/api/v1/staking/validators/:id` | 验证者详情 |
| Staking | `GET` | `/api/v1/staking/stake-info` | 自身质押信息 |
| Delegate | `GET` | `/api/v1/delegate/validators` | 可委托验证者 |
| Delegate | `GET` | `/api/v1/delegate/tokens` | 可委托 Token |
| Delegate | `GET` | `/api/v1/delegate/delegated-tokens` | 已委托 Token |
| Delegate | `GET` | `/api/v1/delegate/positions` | 委托仓位 |
| Delegate | `GET` | `/api/v1/delegate/history` | 委托交易记录 |
| Delegate | `GET` | `/api/v1/delegate/rewards` | 委托奖励 |
| Wallet | `GET` | `/api/v1/wallet/page` | 钱包首页 |
| Wallet | `GET` | `/api/v1/wallet/tokens` | Token 列表 |
| Wallet | `GET` | `/api/v1/wallet/transactions` | 交易历史 |
| Wallet | `GET` | `/api/v1/wallet/token-catalog` | Token 目录 |
| Wallet | `POST` | `/api/v1/wallet/tokens` | 添加 Token |
| Wallet | `DELETE` | `/api/v1/wallet/tokens/:addr` | 移除 Token |
| Wallet | `GET` | `/api/v1/wallet/token-metadata` | Token 元数据 |
| Wallet | `POST` | `/api/v1/wallet/custom-tokens` | 绑定自定义 Token |
| Wallet | `DELETE` | `/api/v1/wallet/custom-tokens/:addr` | 移除自定义 Token |
| Governance | `GET` | `/api/v1/governance/page` | 治理首页 |
| Governance | `GET` | `/api/v1/governance/proposals` | 提案列表 |
| Governance | `GET` | `/api/v1/governance/proposals/:id` | 提案详情 |
| Governance | `GET` | `/api/v1/governance/proposals/:id/votes` | 提案投票明细 |
| Lock | `GET` | `/api/v1/lock/page` | 锁仓首页 |
| Lock | `GET` | `/api/v1/lock/user-summary` | 用户锁仓摘要 |
| Lock | `GET` | `/api/v1/lock/positions` | 锁仓仓位 |
| Lock | `GET` | `/api/v1/lock/rewards/history` | 锁仓奖励（空） |
| Lock | `GET` | `/api/v1/lock/unlock-history` | 解锁历史 |
| Flow | `GET` | `/api/v1/flow/page` | Flow 首页 |
| Flow | `GET` | `/api/v1/flow/assets` | Flow 资产 |
| Flow | `GET` | `/api/v1/flow/history` | Flow 历史 |
