# 110 Hub 测试环境部署

## 2026-09-23 OKX 转账费用参数补充

- 仅更新 `src/app/lib/okx-transfer.ts` 和 `src/app/hooks/use-send-transaction.ts`。
- OKX 在 HiveX Devnet 的钱包页转账显式提供传统交易 `type=0`、钱包 RPC 查询的 `gasPrice` 和估算的 `gasLimit`；不覆盖 nonce、不代签、不自动重发。
- 服务器 TypeScript 检查、构建、源码校验及 API 检查通过。链节点、HubSQL、MySQL 进程和 Bridge 路由未改变。
- 局域网入口 `http://192.168.1.14:8848` 已确认提供新增模块及更新后的转账 hook；该入口仍是开发机的端口映射。
- 本地构建、钱包状态回归及 OKX 四种连接方式的模拟转账参数验证通过。110 上的准备阶段回归通过；真实 OKX 确认按钮仍需用户验证，没有签名或发送测试交易。
- 110 节点 `eth_feeHistory` 仍返回固定占位数据，此次没有修改或部署节点 C++ 程序。详见 `docs/OKX_WALLET_SUPPORT.md`。

备份：`/srv/hivex-hub/updates/frontend-20260923T052718Z`。

## 2026-09-23 前端与 OKX 更新

- 更新 32 个有差异的前端源码及 Vite 插件文件，包含 OKX 专用注入连接器、钱包发现去重、近期钱包和资产目录前端修复。
- 保留服务器 RPC 环境配置 `VITE_HIVEX_RPC_URL=http://192.168.1.110:13134`、同源 API 配置、公开 Bridge 路由和所有运行数据；没有复制开发机的路由、数据库或私钥。
- 先核对依赖和 SDK 源码一致，再在独立覆盖目录执行服务器 TypeScript 检查和 Vite 构建，均通过后才替换文件、重启 `hivex-hub-frontend`。
- 更新后逐文件 SHA-256、实际提供的 OKX 模块、RPC 配置及 `/api/v1/stats/overview` 均通过检查。
- HiveX 节点 PID `396777`、HubSQL PID `379136`、MySQL PID `379066` 与更新前一致，Bridge 路由文件摘要不变。
- 通过 `http://127.0.0.1:25174` 访问 110 实际页面，运行 `HUB_TEST_ORIGIN=http://127.0.0.1:25174 npm run test:okx-wallet`。此测试使用模拟钱包和 API，不代表真实 OKX 扩展弹窗或链上交易验证。
- 110 HubSQL 未升级，当前目录未声明 `metadata_supported`；前端采用旧后端兼容路径。要启用服务器端 ERC20 名称查询仍需单独升级 HubSQL。

备份、上传校验清单、构建日志和部署结果：
`/srv/hivex-hub/updates/frontend-20260923T044950Z`。
更新入口：`tools/update-frontend-110.py`，不是首次安装脚本。

当前服务器仍运行 Vite 服务，不是独立静态文件服务器。使用
<http://localhost:25174/bridge?view=deploy> 访问 110；`localhost:5174` 是开发机，
不是 110。旧钱包连接需先断开，再从连接列表选择 **OKX Wallet**。

## 2026-09-22 交易确认上限更新

已检查 `110、161、162、163、164、165、166` 七台测试服务器。只有 110
运行 Hub 前端，161～166 未发现 Hub 前端目录或服务，因此本次前端改动仅需更新 110，
没有在其他链节点上新增前端、数据库或中继。

- 更新范围：`transaction-confirmation.ts`、`hivex-eth-client.ts`、
  `bridge-client.ts`、`bridge-deployment.ts`、`pages/bridge/page.tsx`。
- 交易确认最多 20 轮；失败保留 hash，不自动重发；跨链历史计数及失败状态持久化。
- 服务器更新前的源码覆盖层 TypeScript 检查通过；更新后逐文件 SHA-256 与开发机一致。
- 经 `http://127.0.0.1:25174` SSH 隧道加载 110 实际页面，使用模拟 RPC 验证
  第 20 轮失败、刷新不重新查询、保留 hash、手动只读重查、桌面及手机布局，全部通过。
- 前端、HubSQL、MySQL 服务均为 `active`，同源 `/api/v1/stats/overview` 正常。
- 七节点复查均为高度 **843**，区块 hash：
  `0xfd016b08a8f8ad1b368a316af06da515d33d577f5d1599522fe309dd3492f002`。
  全部链节点 PID 与更新前一致，没有重启节点或发送链上交易。
- 没有更改 RPC 配置、公开路由、部署插件、链数据库、钱包或中继身份。

备份及校验清单位于 110：
`/srv/hivex-hub/updates/confirmation-20260922T054113Z`，其中 `backup/` 为原文件，
`manifest.json` 为新文件 SHA-256，`original.json` 为旧文件 SHA-256，
`result.json` 为验证结果。此次更新脚本为 `tools/update-confirmation-110.py`；
它仅更新上述五个前端文件，不用于链节点程序升级。

## 当前状态

目标服务器：`192.168.1.110`。部署目录：`/srv/hivex-hub`。

- MySQL 8.0.42、HubSQL、Hub 前端已作为 systemd 服务运行，随服务器启动。
- HubSQL 连接服务器本机 HiveX RPC `http://127.0.0.1:13134`，从历史区块重新建立索引，不复制开发库中的旧同步状态。
- 验收时节点和 HubSQL 均为高度 **829**，索引包含 **8 个提案、9 条投票、1203 条合约记录**。
- 按资产 ID 比对，984 项资产目录与原环境一致；创世账户与 `0x94413a48d9106475A0391bE0C3Ad252c671038FF` 的余额 API 响应与原环境一致。
- 远程页面浏览器只读检查通过：提案显示正常、API 经服务器同源代理、移动端无页面横向溢出、浏览器无未捕获异常。前端构建及 20 项单元测试通过，未进行钱包签名或跨链上链测试。
- 保留 110 上原有 HiveX 节点的程序、进程和数据，本次没有重启节点。
- **跨链迁移待确认**：Local BSC、Local EVM、中继的程序及 systemd 单元已经安装，但没有启动，没有复制在线链数据库或中继私钥。
- 开发机原有跨链服务仍运行。服务器待迁移路由保存在 `config/routes.pending.json`，尚未发布到前端，避免浏览器误连开发机同端口的链。

本环境属于内部测试部署，不是公网生产站点。前端保留 Vite 的本地部署插件，不能直接公开 Vite 端口或放宽插件的 loopback/same-origin 检查。

## 访问

当前已建立仅前端的 SSH 隧道，可在开发机浏览器打开：

<http://localhost:25174/governance>

虽然浏览器地址是 localhost，页面、API、数据库实际均运行在 110。SSH 隧道保留浏览器安全上下文，允许钱包和 Web Locks 正常工作，不需要关闭安全检查。

在 WSL 重新启动隧道：

```bash
cd /home/wbl/hubfrontend
/home/wbl/hivex/.venv-testnet/bin/python tools/open-110.py --frontend-only
```

SSH 凭据从已有的受保护配置 `/home/wbl/.config/hivex/testnet-credentials.json` 读取，不写在脚本、报告或命令行中。主机公钥固定在 `/home/wbl/.cache/hivex-hub-deploy110/known_hosts`，变化时连接会失败。

也可自行使用 SSH 客户端：

```bash
ssh -N -L 25174:127.0.0.1:5174 root@192.168.1.110
```

不要同时运行多个占用 25174 的隧道。当前测试隧道的 PID 和日志位于开发机 `/home/wbl/.cache/hivex-hub-deploy110/tunnel.pid` 和 `tunnel.log`。

## 服务与目录

| 服务 | 用途 | 监听地址 | 状态 |
| --- | --- | --- | --- |
| hivex-hub-mysql | HubSQL 独立数据库 | 127.0.0.1:3306 | 已启动 |
| hivex-hub-indexer | 区块解析与数据 API | 127.0.0.1:8080 | 已启动 |
| hivex-hub-frontend | 前端及受保护部署接口 | 127.0.0.1:5174 | 已启动 |
| hivex-hub-bsc | Local BSC，chain ID 31338 | 127.0.0.1:8546 | 待迁移，未启动 |
| hivex-hub-evm | Local EVM，chain ID 31337 | 127.0.0.1:8545 | 待迁移，未启动 |
| hivex-hub-relay | 跨链消息交付 | 无对外端口 | 待迁移，未启动 |

运行用户为无登录权限的 `hubstack`。MySQL、HubSQL、前端均不对内网直接开放，链节点原有 RPC 监听方式没有改变。

Vite 文件访问规则禁止下载 `tools/bridge-lab/runtime/**`，避免后续迁移的中继或本地链私钥经前端文件路由暴露。部署插件仍在服务器内部读取配置，仅返回公开身份及合约 artifacts。

目录说明：

- `app/frontend`：前端、合约 artifacts 和 bridge-lab 程序。
- `app/runtime-bin`：Node.js、HubSQL、MySQL 及随包运行库，不替换服务器系统库。
- `state/mysql-data`：数据库。
- `state/hubsql-data/utxo`：HubSQL UTXO 索引。
- `state/logs`：数据库及 HubSQL 日志。
- `config`：本机配置与随机生成的数据库凭据，权限受限，不对浏览器提供。

前端服务配置指定 `VITE_HIVEX_RPC_URL=http://192.168.1.110:13134`，`VITE_HUBSQL_API_URL=/`。`/api/v1` 由 Vite 代理到本机 HubSQL；资产目录仍由 HubSQL 解析区块产生。

## 运维

以下命令在 **110** 上执行，仅影响新部署的 Hub 服务：

```bash
systemctl status hivex-hub-mysql hivex-hub-indexer hivex-hub-frontend
systemctl restart hivex-hub-indexer hivex-hub-frontend
journalctl -u hivex-hub-frontend -n 100 --no-pager
tail -n 100 /srv/hivex-hub/state/logs/hubsql.log
curl http://127.0.0.1:8080/health
curl http://127.0.0.1:8080/api/v1/stats/overview
```

跨链单元设置了 `ConditionPathExists`：缺少账户、链数据库或中继配置时不启动。不要绕过它直接运行旧 `chain.mjs`，旧代码在账户文件缺失时会生成新身份，空链不等于已迁移环境。

## 跨链迁移选择

**推荐：保留现有环境。** 需要短暂停止开发机中继和两条本地链，冷备份链数据库、账户身份和中继状态，传到 110 后核对区块 hash、合约代码、余额和未完成交付记录，再只启用 110 的中继。切换后不要同时恢复开发机旧中继或分叉出的本地链。

另一个选择是部署全新链并重新通过钱包部署合约。新链不会继承旧合约和余额，不能继续发布旧合约地址的路由。

这一步尚未执行，也没有发送跨链、提案、投票或跃入交易。不要把本次服务部署验证当成端到端跨链成功测试。

## 部署脚本

`tools/deploy-110.py prepare` 将当前程序、依赖和运行库打包，不包含跨链 runtime 和数据库。

`tools/deploy-110.py stage` 上传并校验 SHA-256；已有 staging 目录时拒绝覆盖。

`tools/install-110.py` 是服务器首次安装脚本；若 `app` 或 `state` 已存在则拒绝覆盖。**本机已经安装完成，不要再次执行首次安装流程作为升级或重启。**

后续升级应先备份配置、数据库和跨链状态，更新明确的程序文件，再逐服务重启；不要用安装脚本清空或覆盖运行目录。
