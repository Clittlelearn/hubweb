# ApiService 接口可用性探测报告

探测时间：2026-04-14 17:36 (Asia/Shanghai)  
探测目标：`https://dev-hub-api.test-air.icu/api/v1`  
探测链：`chainId=12315`（Devnet）  
测试地址：`0x1111111111111111111111111111111111111111`

## 判定标准

- `可用`：HTTP 200 且业务 `code=0`（或写接口返回成功对象）。
- `后端可用但当前 ApiService 不可用`：后端接口可用，但 `ApiService` 当前请求格式与后端不兼容。
- `不可用`：路由 404、服务器 500、或校验失败且无法按当前实现调用成功。
- `可达待数据`：路由看起来存在，但当前环境无业务数据，无法验证成功路径。

## 总览（按 `src/app/apis/api-service.ts` 的 34 个方法）

- 当前可用：`9`
- 后端可用但当前 ApiService 不可用：`2`
- 可达待数据：`1`
- 不可用：`22`

---

## 1) 当前可用（可直接调用）

- `dashboardData` -> `GET /dashboard/page`
- `walletData` -> `GET /wallet/page`
- `walletTokens` -> `GET /wallet/tokens`
- `walletTransactions` -> `GET /wallet/transactions`
- `walletTokenMetadata` -> `GET /wallet/token-metadata`
- `stakingData` -> `GET /staking/page`
- `stakingValidators` -> `GET /staking/validators`
- `governanceData` -> `GET /governance/page`
- `governanceProposals` -> `GET /governance/proposals`

---

## 2) 后端可用，但当前 ApiService 调用方式不兼容

- `walletBindToken` -> `POST /wallet/tokens`
  - 后端用 `application/json` 调用可成功（返回 `{"success":true,...}`）。
  - 当前 `ApiService._post` 发送 `multipart/form-data`，实测返回 `415 Unsupported Media Type`。

- `walletRemoveToken` -> `DELETE /wallet/tokens/{contractAddress}`
  - 后端用 `application/json` body 调用可成功（返回 `{"success":true,...}`）。
  - 当前 `ApiService._delete` 把参数拼 query，不带 body，实测返回 `400 body must be object`。

---

## 3) 可达待数据

- `governanceProposalDetail` -> `GET /governance/proposals/{proposalId}`
  - 该路由会返回业务错误 `Proposal not found`（`code=2001`，HTTP 404），说明处理器存在。
  - 但 `governance/proposals` 当前 `total=0`，没有可用 `proposalId`，无法验证成功分支。

---

## 4) 不可用（路由未部署或服务异常）

### 4.1 返回 500

- `walletTokenCatalog` -> `GET /wallet/token-catalog`（稳定返回 `code=9999 Internal server error`）

### 4.2 返回 404 Route not found

- `stakingStakeableTokens` -> `GET /staking/stakeable-tokens`
- `stakingStakedTokens` -> `GET /staking/staked-tokens`
- `stakingPositions` -> `GET /staking/positions`
- `stakingRewardsHistory` -> `GET /staking/rewards/history`

- `lockData` -> `GET /lock/page`
- `lockUserSummary` -> `GET /lock/user-summary`
- `lockPositions` -> `GET /lock/positions`
- `lockRewardsHistory` -> `GET /lock/rewards/history`
- `lockUnlockHistory` -> `GET /lock/unlock-history`

- `governanceProposalVotes` -> `GET /governance/proposals/{proposalId}/votes`

- `flowData` -> `GET /flow/page`
- `flowAssets` -> `GET /flow/assets`
- `flowHistory` -> `GET /flow/history`

- `walletBindCustomToken` -> `POST /wallet/custom-tokens`
- `walletRemoveCustomToken` -> `DELETE /wallet/custom-tokens/{contractAddress}`

---

## 5) 对前端的直接影响

- 你现在能稳定接入的页面块：`Dashboard`、`Wallet(除 token-catalog/custom-token)`、`Validators(仅 page + validators)`、`Governance(仅 page + proposals)`。
- 当前不能接入真实数据的主要块：`Lock` 全量、`Flow` 全量、`Staking` 用户态接口、`Governance votes`。
- `wallet/tokens` 的增删虽然后端可用，但你要先修 `ApiService` 的 `POST/DELETE` 请求格式，否则前端调用一定失败。
