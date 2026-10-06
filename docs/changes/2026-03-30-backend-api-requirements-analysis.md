# Background

当前前端页面同时依赖 mock 数据、已有接口和部分链上/RPC 直读能力。为了支持后端重写，主文档 [docs/backend-api-requirements-by-page.md](/Users/fom8520/Developer/projects/memechain/OpenHivehub/docs/backend-api-requirements-by-page.md) 已经整理成一套新的页面化/BFF 风格接口方案，不再复用现有 `backend-api` 的命名和返回结构。

这份变更记录用于同步“当前主文档的实际状态”，替换掉之前基于旧版本整理的摘要。

# Current Summary

## 全局设计原则

- 首屏优先使用 `page` 聚合接口，减少前端首屏请求数。
- 列表、搜索、历史、quote 单独拆接口，避免 `page` 接口膨胀。
- 所有接口显式传 `chainId`；用户态接口单独传 `address`。
- 金额统一返回原始值，前端自行格式化。
- 时间统一返回时间戳。
- 写操作优先设计为 `POST .../quote`，由后端返回 `txRequest + preview`，前端负责签名和广播。
- 涉及后端持久化的写操作需要鉴权，不能只靠 `address` 直接写库。
- 文档里的 `explorerUrl` 已全部移除，只保留业务必需字段。

## 页面级接口规划

### Dashboard

- 首屏接口：`GET /api/v1/dashboard/page`
- 返回网络状态、主统计卡、次级统计卡、图表数据和最近区块。

### Wallet

- 首屏接口：`GET /api/v1/wallet/page`
- 读接口：
  - `GET /api/v1/wallet/tokens`
  - `GET /api/v1/wallet/transactions`
  - `GET /api/v1/wallet/token-catalog`
  - `GET /api/v1/wallet/token-metadata`
- 写接口：
  - `POST /api/v1/wallet/tokens`
  - `DELETE /api/v1/wallet/tokens/{contractAddress}`
  - `POST /api/v1/wallet/custom-tokens`
  - `DELETE /api/v1/wallet/custom-tokens/{contractAddress}`
- `wallet/transactions` 已按 EVM 钱包兼容方式增强：
  - 标准化展示字段：`kind / direction / amount / symbol / counterpartyRole`
  - 原始交易字段：`txType / from / to / rawData / contractAddress`
  - gas 与 fee 字段
  - `gasCost.native / gasCost.custom`
  - `tokenTransfers[]`
  - `evm.rawTx / evm.rawReceipt / evm.logs`

### Validators / Staking

- 首屏接口：`GET /api/v1/staking/page`
- `staking/page` 现在是纯全网接口，只返回：
  - `networkStats`
  - `stakedTokens`
  - `topValidators`
- 用户态数据拆到：
  - `GET /api/v1/staking/stakeable-tokens`
  - `GET /api/v1/staking/staked-tokens`
  - `GET /api/v1/staking/positions`
  - `GET /api/v1/staking/rewards/history`
- 质押约束：
  - validator 支持多 token 质押
  - 仅允许 Flow 资产参与 stake
  - 明确排除 `VOTE`
- `staking/validators` 支持：
  - `status` 筛选
  - `keyword` 搜索 `name / validatorId / address`
  - 更完整的 validator 信息模型
- `staking/positions` 与 `staking/rewards/history` 已收敛为结构化对象，包含 validator、stake token、reward token、时间和交易信息。
- validator 的 `stake / unstake / claim` 未作为后端必做接口规划，默认前端直连合约。

### Lock

- 首屏接口：`GET /api/v1/lock/page`
- `lock/page` 现在是纯全网接口，只返回：
  - `networkOverview`
  - 固定的 `lockAsset`
- lock 资产范围固定为 `VOTE`，前端不再做 token 选择。
- 用户态数据拆到：
  - `GET /api/v1/lock/user-summary`
  - `GET /api/v1/lock/positions`
  - `GET /api/v1/lock/rewards/history`
  - `GET /api/v1/lock/unlock-history`
- `lock/page` 已补充全网 ready-to-unlock / unlocked 口径。
- `lock/positions`、`lock/rewards/history`、`lock/unlock-history` 都改为结构化对象返回。
- 推荐 quote 接口：
  - `POST /api/v1/lock/create/quote`
  - `POST /api/v1/lock/unlock/quote`
  - `POST /api/v1/lock/claim-rewards/quote`

### Governance

- 首屏接口：`GET /api/v1/governance/page`
- `governance/page` 返回：
  - 用户投票权 summary
  - `recentProposals`
- 提案相关接口：
  - `GET /api/v1/governance/proposals`
  - `GET /api/v1/governance/proposals/{proposalId}`
  - `GET /api/v1/governance/proposals/{proposalId}/votes`
- `governance/proposals` 已收敛为统一结构：
  - `proposal`
  - `timeline`
  - `voteProgress`
  - `permission`
- 详情接口 `governance/proposals/{proposalId}` 复用同一模型，并补充：
  - `description`
  - `snapshotBlockNumber`
  - `execution`
- 提案列表支持：
  - `status`
  - `category`
  - `keyword`
  - `sortBy`
  - `sortOrder`
- 推荐 quote 接口：
  - `POST /api/v1/governance/proposals/create/quote`
  - `POST /api/v1/governance/votes/quote`

### Flow

- 首屏接口：`GET /api/v1/flow/page`
- `flow/page` 现在是纯公共接口，不再接收 `address`，只返回：
  - `stats`
  - 可 Flow 资产目录 `assets`
- 用户态数据拆到：
  - `GET /api/v1/flow/assets`
  - `GET /api/v1/flow/history`
- `flow/assets` 用于资产选择器和余额，明确区分：
  - ERC20 侧：`name / decimals`
  - Flow 资产侧：`assetName / assetDecimals`
- `flow/history` 已改为结构化分页返回，包含：
  - `asset`
  - `amountInfo`
  - `timeline`
  - `tx`
- `flow/history` 支持：
  - `direction`
  - `status`
  - `assetId`
- 推荐 quote 接口：
  - `POST /api/v1/flow/quote`

## 聚合接口策略

主文档当前明确建议优先做这些 `page` 聚合接口：

- `GET /api/v1/dashboard/page`
- `GET /api/v1/staking/page`
- `GET /api/v1/lock/page`
- `GET /api/v1/governance/page`
- `GET /api/v1/flow/page`

`wallet/page` 也建议保留，但交易列表和 token 目录仍建议走独立接口。

## 当前第一批接口清单

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

### 推荐 quote 接口

- `POST /api/v1/lock/create/quote`
- `POST /api/v1/lock/unlock/quote`
- `POST /api/v1/lock/claim-rewards/quote`
- `POST /api/v1/governance/proposals/create/quote`
- `POST /api/v1/governance/votes/quote`
- `POST /api/v1/flow/quote`

## Notes

- 当前主文档已经将“全网公共数据”和“用户地址相关数据”在 Staking、Lock、Flow 三个页面里明确拆开。
- 当前主文档不再要求后端承接所有链上写操作，默认后端负责读模型、聚合和 quote，前端负责签名与广播。
- 这份记录只同步当前文档内容，不代表数据库建模、缓存策略和索引方案已经完成。
