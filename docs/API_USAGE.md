# OpenHiveHub Backend API 使用文档

> **版本**: v1.0 | **基础路径**: `http://{host}:{port}/api/v1` | **默认端口**: `3001`

---

## 一、通用约定

### 1.1 响应格式

**成功响应**:
```json
{
  "code": 0,
  "message": "ok",
  "data": { ... }
}
```

**错误响应**:
```json
{
  "code": 1001,
  "message": "参数错误",
  "data": null
}
```

**分页响应** (data 内包含分页信息):
```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "list": [],
    "pageNum": 1,
    "pageSize": 20,
    "total": 100
  }
}
```

### 1.2 公共参数

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `chainId` | number | `12315` | 链 ID（12315=devnet） |

### 1.3 错误码

| 错误码 | 说明 |
|--------|------|
| 0 | 成功 |
| 400 | 参数缺失 |
| 1001 | 参数错误 |
| 2001 | 数据不存在 |
| 5001 | 数据库错误 |
| 9999 | 系统内部错误 |

---

## 二、健康检查

### `GET /api/health`

无需参数，返回服务运行状态。

```bash
curl http://localhost:3001/api/health
```

```json
{
  "code": 0,
  "data": { "status": "healthy", "timestamp": "...", "uptime": 123.45 }
}
```

---

## 三、Dashboard 仪表盘

### 3.1 `GET /api/v1/dashboard/page` — 首页聚合数据

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| chainId | number | 否 | 默认 12315 |

返回：网络统计、总供应量、流通量、总质押量、交易量、活跃地址数等。

### 3.2 `GET /api/v1/dashboard/blocks` — 区块列表

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| chainId | number | 否 | 默认 12315 |
| pageNum | number | 否 | 默认 1 |
| pageSize | number | 否 | 默认 20 |

返回：最新区块列表（高度、交易数、时间戳、提案者）。

---

## 四、Staking 质押模块

### 4.1 `GET /api/v1/staking/page` — 质押首页聚合

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| chainId | number | 否 | 默认 12315 |

返回：网络统计（活跃验证者数、总质押量、网络正常运行率、平均 APY）、Top 验证者列表。

### 4.2 `GET /api/v1/staking/validators` — 验证者列表（分页/搜索）

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| chainId | number | 否 | 默认 12315 |
| status | string | 否 | `all` / `active` / `inactive`，默认 `all` |
| pageNum | number | 否 | 默认 1 |
| pageSize | number | 否 | 默认 20 |
| keyword | string | 否 | 按名称/ID/地址模糊搜索 |

### 4.3 `GET /api/v1/staking/stakeable-tokens` — 可质押 Token 列表

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| chainId | number | 否 | 默认 12315 |
| address | string | 否 | 可选——传入后返回该地址持有的余额 |

### 4.4 `GET /api/v1/staking/staked-tokens` — 已质押 Token 列表

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| chainId | number | 否 | 默认 12315 |
| address | string | **是** | 钱包地址 |

返回该地址已质押/投资的所有 Token 及总额。

### 4.5 `GET /api/v1/staking/positions` — 质押仓位列表

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| chainId | number | 否 | 默认 12315 |
| address | string | **是** | 钱包地址 |

返回：所有质押仓位（含 Type 2 自身质押 + Type 4 投资），每条含验证者信息、质押 Token、奖励信息、APY、锁定状态等。

### 4.6 `GET /api/v1/staking/stake-info` — 质押（自质押）信息

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| chainId | number | 否 | 默认 12315 |
| address | string | **是** | 钱包地址 |

返回：该地址是否为验证者、自身质押详情（selfStake、APY、佣金、排名、支持的 Token 等）、奖励汇总。

### 4.7 `GET /api/v1/staking/investments` — 投资仓位信息

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| chainId | number | 否 | 默认 12315 |
| address | string | **是** | 钱包地址 |
| pageNum | number | 否 | 默认 1 |
| pageSize | number | 否 | 默认 20 |

返回：投资汇总（总投资额、仓位数量、验证者数量、总奖励）、投资仓位列表。

### 4.8 `GET /api/v1/staking/delegating` — 投资交易记录

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| chainId | number | 否 | 默认 12315 |
| address | string | **是** | 钱包地址 |
| pageNum | number | 否 | 默认 1 |
| pageSize | number | 否 | 默认 20 |

返回：Type 4（投资）和 Type 5（解投资）的交易历史列表，含交易哈希、金额、验证者信息、时间戳等。

### 4.9 `GET /api/v1/staking/rewards/history` — 奖励历史

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| chainId | number | 否 | 默认 12315 |
| address | string | **是** | 钱包地址 |
| pageNum | number | 否 | 默认 1 |
| pageSize | number | 否 | 默认 20 |

返回：奖励记录列表，含验证者信息、质押 Token、领取的奖励 Token、交易哈希等。

---

## 五、Wallet 钱包模块

### 5.1 `GET /api/v1/wallet/page` — 钱包首页聚合

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| chainId | number | 否 | 默认 12315 |
| address | string | 否 | 钱包地址（为空返回零值） |

返回：总余额、余额符号、Token 数量、交易总数。

### 5.2 `GET /api/v1/wallet/tokens` — Token 列表

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| chainId | number | 否 | 默认 12315 |
| address | string | 否 | 钱包地址 |

返回该地址持有的所有 Token（含 OHI 和 ERC-20）。

### 5.3 `GET /api/v1/wallet/transactions` — 交易历史

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| chainId | number | 否 | 默认 12315 |
| address | string | 否 | 钱包地址 |
| pageNum | number | 否 | 默认 1 |
| pageSize | number | 否 | 默认 10 |

返回交易历史分页列表。

### 5.4 `GET /api/v1/wallet/token-catalog` — Token 目录

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| chainId | number | 否 | 默认 12315 |
| address | string | 否 | 可选——用于检测该用户是否已添加 |
| pageNum | number | 否 | 默认 1 |
| pageSize | number | 否 | 默认 20 |
| keyword | string | 否 | 按名称/符号模糊搜索 |

返回所有已知 ERC-20 Token 的目录。

### 5.5 `POST /api/v1/wallet/tokens` — 添加 Token 到钱包

```json
{
  "chainId": 12315,
  "address": "0x用户地址",
  "tokenId": "token-xxx",
  "contractAddress": "0x合约地址"
}
```

### 5.6 `DELETE /api/v1/wallet/tokens/:contractAddress` — 移除 Token

路径参数 `contractAddress`，Body: `{ "chainId": 12315, "address": "0x用户地址" }`

### 5.7 `GET /api/v1/wallet/token-metadata` — Token 元数据

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| chainId | number | 否 | 默认 12315 |
| contractAddress | string | **是** | 合约地址 |

### 5.8 `POST /api/v1/wallet/custom-tokens` — 绑定自定义 Token

```json
{
  "chainId": 12315,
  "address": "0x用户地址",
  "contractAddress": "0x合约地址"
}
```

---

## 六、Governance 治理模块

### 6.1 `GET /api/v1/governance/page` — 治理首页聚合

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| chainId | number | 否 | 默认 12315 |
| address | string | 否 | 可选——传入后返回该用户的投票统计 |

### 6.2 `GET /api/v1/governance/proposals` — 提案列表

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| chainId | number | 否 | 默认 12315 |

返回所有提案（含撤销提案），按结束时间降序。

### 6.3 `GET /api/v1/governance/proposals/:proposalId` — 提案详情

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| chainId | number | 否 | 默认 12315 |

路径参数 `proposalId` 为提案 ID。

### 6.4 `GET /api/v1/governance/proposals/:proposalId/votes` — 提案投票明细

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| chainId | number | 否 | 默认 12315 |
| pageNum | number | 否 | 默认 1 |
| pageSize | number | 否 | 默认 20 |
| voteType | string | 否 | `yes` / `no`，不传=全部 |

---

## 七、Lock 锁仓模块

### 7.1 `GET /api/v1/lock/page` — 锁仓首页聚合

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| chainId | number | 否 | 默认 12315 |

返回全网锁仓总览。

### 7.2 `GET /api/v1/lock/user-summary` — 用户锁仓摘要

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| chainId | number | 否 | 默认 12315 |
| address | string | **是** | 钱包地址 |

### 7.3 `GET /api/v1/lock/positions` — 用户锁仓仓位列表

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| chainId | number | 否 | 默认 12315 |
| address | string | **是** | 钱包地址 |

### 7.4 `GET /api/v1/lock/rewards/history` — 锁仓奖励历史

（当前锁仓无奖励机制，始终返回空列表）

### 7.5 `GET /api/v1/lock/unlock-history` — 解锁历史列表

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| chainId | number | 否 | 默认 12315 |
| address | string | **是** | 钱包地址 |
| pageNum | number | 否 | 默认 1 |
| pageSize | number | 否 | 默认 20 |

---

## 八、Flow 跨链模块

### 8.1 `GET /api/v1/flow/page` — Flow 首页聚合

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| chainId | number | 否 | 默认 12315 |

### 8.2 `GET /api/v1/flow/assets` — Flow 资产列表

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| chainId | number | 否 | 默认 12315 |
| address | string | 否 | 可选——查询该地址的资产余额 |

### 8.3 `GET /api/v1/flow/history` — Flow 历史记录

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| chainId | number | 否 | 默认 12315 |
| address | string | **是** | 钱包地址 |
| pageNum | number | 否 | 默认 1 |
| pageSize | number | 否 | 默认 20 |
| direction | string | 否 | `all` / `in` / `out` |
| status | string | 否 | `all` / `pending` / `completed` / `failed` |
| assetId | string | 否 | 按资产类型过滤 |

---

## 九、快速测试示例

```bash
# 1. 健康检查
curl http://localhost:3001/api/health

# 2. Dashboard 首页数据
curl "http://localhost:3001/api/v1/dashboard/page?chainId=12315"

# 3. 验证者列表
curl "http://localhost:3001/api/v1/staking/validators?status=active&pageNum=1&pageSize=10"

# 4. 质押首页
curl "http://localhost:3001/api/v1/staking/page"

# 5. 查询某地址的质押仓位
curl "http://localhost:3001/api/v1/staking/positions?address=0x用户地址"

# 6. 查询某地址的投资仓位
curl "http://localhost:3001/api/v1/staking/investments?address=0x用户地址&pageNum=1&pageSize=10"

# 7. 查询某地址的质押信息（是否验证者）
curl "http://localhost:3001/api/v1/staking/stake-info?address=0x用户地址"

# 8. 查询某地址的投资交易记录
curl "http://localhost:3001/api/v1/staking/delegating?address=0x用户地址&pageNum=1&pageSize=20"

# 9. 查询奖励历史
curl "http://localhost:3001/api/v1/staking/rewards/history?address=0x用户地址&pageNum=1&pageSize=10"

# 10. 钱包首页
curl "http://localhost:3001/api/v1/wallet/page?address=0x用户地址"

# 11. 交易历史
curl "http://localhost:3001/api/v1/wallet/transactions?address=0x用户地址&pageNum=1&pageSize=10"

# 12. 提案列表
curl "http://localhost:3001/api/v1/governance/proposals"

# 13. 提案详情
curl "http://localhost:3001/api/v1/governance/proposals/提案ID"

# 14. 锁仓首页
curl "http://localhost:3001/api/v1/lock/page"

# 15. 用户锁仓仓位
curl "http://localhost:3001/api/v1/lock/positions?address=0x用户地址"
```

---

## 十、启动方式

```bash
# 开发模式
npm run dev

# 生产模式（PM2）
pm2 start ecosystem.config.cjs
```
