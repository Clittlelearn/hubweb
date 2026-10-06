# Hub 跨链本地环境

代码来源是 `/home/wbl/hyperlane/solidity/contracts`。使用其真实 Mailbox、TrustedRelayerIsm、ProtocolFee、HypERC20Collateral 和包含 HiveX Flow 方法的 HypERC20。

当前默认路由为 **HiveX Devnet <-> Local BSC**，已通过真实 HiveX 七节点双向链上测试。另保留 **Local EVM <-> Local BSC** 独立本地路由。Local BSC 使用 Ganache、BNB 测试 Gas 符号，不是 BSC 主网、公共测试网或主网分叉；Local EVM 不模拟 HiveX UTXO/共识。

## 1. 打开页面

`http://localhost:5174/bridge`

连接支持 EIP-1193 的钱包，选择源链、输入金额、填写接收人（留空使用连接账户），确认授权与跨链交易。页面只通过钱包签名，不收集私钥。

重新部署两端跨链合约可使用 **Deploy contracts** 标签页：钱包串行确认 17～19 笔交易，支持刷新续跑，完成后自动登记新路由并保留旧路由。详见 [前端钱包部署指南](../../docs/BRIDGE_DEPLOYMENT.md)。该功能需要本机 Vite 开发服务。

本次为创世测试账户预发 HBR 和本地 Gas：

```text
0x755Ccf704E17570b64E247f0794314e4C8E542CA
```

初始 HBR 在 Local BSC，初始发行量 1,000,000，精度 8。测试已执行过双向转账，因此当前余额以页面查询为准。

| 网络 | RPC | Chain ID | Hyperlane Domain | Gas |
|---|---|---|---|---|
| Local BSC | http://127.0.0.1:8546 | 31338 | 31338 | BNB |
| Local EVM | http://127.0.0.1:8545 | 31337 | 31337 | ETH |
| HiveX Devnet | http://192.168.1.162:13134 | 12315 | 12315 | OHI |

钱包首次使用会请求添加/切换网络。跨链金额是 HBR，不是用于支付 Gas 的 BNB/ETH。RPC 只监听本机回环地址，Windows 浏览器可通过 WSL localhost 转发访问。

## 2. 跨链原理

Local BSC -> Local EVM：

1. 钱包对 HBR 执行 `approve(collateralRouter, amount)`，授权量是本次金额；
2. Router `quoteTransferRemote(domain, recipientBytes32, amount)` 返回消息费；
3. 钱包调用 `transferRemote(uint32,bytes32,uint256)`，ETH value 为消息费；
4. HypERC20Collateral 把 HBR 从用户转到 Router 锁定；
5. Mailbox 发出 Dispatch 消息；
6. relayer 确认源交易后，在目标 Mailbox 调用 `process`；
7. TrustedRelayerIsm 验证消息处理人；
8. 目标 HypERC20 验证已登记的远端 Router，为接收人铸造 HBR。

返回时，Local EVM 销毁用户的合成 HBR，relayer 交付消息后，Local BSC 释放相同数量的锁仓 HBR。

本地消息费设为 0，仍有两条链的网络 Gas。relayer 的目标链 Gas 由本地预充值承担。该配置只信任本机 relayer，不代表生产环境的多验证者安全模型。

## 3. 与 Native Flow 的关系

Bridge 页处理 EVM Token 跨链；Flow 页处理 HiveX 内部的 ERC20 与 Native UTXO 转换。

真实 HiveX 路由已部署；若进一步完成 Native Flow 提案激活，路径可以是：

```text
外链 ERC20 -> Hyperlane -> HiveX HypERC20
    -> 提案/投票/激活 -> FlowIn -> HiveX 原生资产
```

反向必须先 FlowOut 恢复为 HiveX ERC20，才能通过 Bridge 转回外链。本地 Local EVM 不能替代真实 HiveX 来验证 Native UTXO 这一步。

## 4. 服务管理

已部署环境推荐使用一键恢复入口（包含本地双链、前端、中继和路由检查）：

```bash
node start-environment.mjs
node start-environment.mjs --check
```

Windows 入口为同目录 `Start-Bridge.ps1`。参数、只读模式、日志和故障处理见 [STARTUP.md](./STARTUP.md)。默认启动会开启中继，可能交付已有跨链消息；不需要开启中继时使用 `--no-relay`。

在 WSL 执行：

```bash
cd /home/wbl/hubfrontend/tools/bridge-lab
npm ci
node services.mjs start bsc evm
node services.mjs start relay
```

检查启动记录：

```bash
tail -n 30 runtime/bsc.log
tail -n 30 runtime/evm.log
tail -n 30 runtime/relay.log
```

停止本工具管理的服务，不删除链数据：

```bash
node services.mjs stop relay bsc evm
```

区块数据库在 `runtime/bsc-db`、`runtime/evm-db`，重启后余额和合约保留。`runtime` 已加入 `.gitignore`；本机生成的运行账户文件权限为 0600。不要把该目录复制到前端 public 或提交 Git。

## 5. 从零部署本地环境

```bash
cd /home/wbl/hubfrontend/tools/bridge-lab
npm ci
node compile.mjs
node services.mjs start bsc evm
node deploy.mjs --local
node services.mjs start relay
```

编译固定 solc 0.8.19、OZ 4.9.6、Paris EVM。可用 `HYPERLANE_ROOT` 指定其他 Hyperlane Solidity 根目录。

部署会生成：

- `runtime/local-deployment.json`：每一步的 hash、nonce、receipt；
- `public/bridge/routes.json`：公开网络与合约配置，不含私钥；
- `runtime/relayer.json`：本机 relayer 身份；
- `runtime/relay-state.json`：扫描游标和目标链交付交易。

部署脚本会在广播后立即保存 hash，再查询 receipt，重跑时优先恢复原交易，防止超时后重复部署。已完成步骤跳过。

可在首次部署前设置 `BRIDGE_INITIAL_HOLDER` 来指定测试 HBR 接收人。该设置不会修改已部署合约。

## 6. 真实 HiveX 部署状态

2026-09-18 对 `http://192.168.1.162:13134` 的部署已完成：

| 项目 | 地址/结果 |
|---|---|
| Mailbox | `0x8051cdd1caae9ccc63129eb68f428b41fd70b110` |
| TrustedRelayerIsm | `0xb5037ba8213ae2e9a4fd22e3d89a62196d8cb175` |
| 零费率 ProtocolFee | `0x900ef8d0ea3c0f40cd91220b0f066e6a19e898a6` |
| Mailbox.initialize | 已上链，区块 801 |
| HypERC20 / Router | `0x5af1bf521e0576502897a9a7e8ee11fcd5157082`，部署于 802，初始化于 803 |
| 双向远端 Router 登记和 Gas 配置 | 已完成，HiveX 至 806 |

首次未确认的 HypERC20 交易（历史记录）：

```text
节点 hash: 0x0e46b639c558d0b44767bd4368b7dc88290040c02de4b77652f4a44275e4cd66
本地 hash: 0x09f9ccad54d49e12349b6ebd7f0873766b71b0de697409f44e17e5c287c702c3
```

162 节点日志实际报错：

```text
BEACON_COMMITMENT_BUILD_FAILED height:802 ret:-10
reason:commit_deadline_missing_threshold_aggregate
Create block failed! : -5
CONTRACT_WAIT expired by consensus deadline
```

当时 164 和 166 的 RPC 不可达。2026-09-18 用户要求恢复全部节点后，共识恢复；已核对两种 hash、nonce 和合约代码，再以相同 nonce 重试。最终部署内部 hash 是 `0x05b45f2f6e1d0ca2ba5fa9cb7756ae347a24e12988df9c89474aecfa0a60f340`，原 raw ETH hash 保持不变。

`runtime/deployment.json` 的 `expiredAttempts` 保留旧记录。正常重跑不会丢弃待确认步骤；只有显式 `--retry-expired-step=步骤名` 且核查通过，才归档旧记录并重试。该参数仅供运维确认节点缓存已经过期后使用。

当前 ETH `value` 使用 18 位单位，OHI 测试 Gas 转账用 `parseEther('100')`；不要把原生 UTXO 的 8 位数量直接写入 raw ETH value。HBR 的 ERC20 数量仍为 8 位精度，两者不可混用。

节点已补充 `eth_getLogs` 和 receipt 的真实事件投影，七节点均更新。前端会在发送前检查日志查询能力。补丁从 `CBlock.data[internalHash].log` 读取历史事件，不要求重新部署合约。

真实节点部署命令（私钥只进入当前进程环境）：

```bash
read -rsp 'HiveX deployer private key: ' HIVEX_PRIVATE_KEY
export HIVEX_PRIVATE_KEY
HIVEX_RPC_URL=http://192.168.1.162:13134 node deploy.mjs
unset HIVEX_PRIVATE_KEY
```

真实路由全部部署、初始化、登记远端 Router 后才会合并发布到 `public/bridge/routes.json`。更换节点地址需要同时核对部署日志中的端点地址和 chainId，不能把某条链的合约地址直接用于另一条链。

## 7. 前端配置和限制

- `/bridge/routes.json` 是已部署 Hyperlane 路由清单，不是 Native Flow 资产类型目录；HubSQL 原有资产解析流程保持不变。
- 每条路由包含两个 endpoint，区分 ETH `chainId` 与 Hyperlane `domain`。
- 当前页面支持 ERC20 collateral/synthetic、同精度、`scale=1`。其他缩放或额外费币会明确拒绝。
- 签名前检查链 ID、合约代码、双向 Router 登记、Mailbox、domain、token decimals、scale。
- 普通用户跨链和前端双链部署由连接钱包签名；relayer 保持独立的运维进程，CLI 部署入口仍保留。
- 页面不把源链成功当成目标链到账；两边均核验 receipt 和 by-hash，目标还需 `Mailbox.delivered` 与 `ProcessId` 事件。
- 源 hash、消息 ID、目标 hash 和表单保存到 localStorage；刷新继续追踪未完成消息。
- 页面每个账户/路由存在未完成跨链时会暂缓新转账，避免用户重复操作。

部署前端到另一台机器时，`127.0.0.1` 指访问者本机，应替换成钱包和浏览器可访问的测试 RPC，并处理 HTTPS 页面访问 HTTP RPC 的混合内容限制。

## 8. 测试

```bash
npm test
```

真实链上测试和浏览器签名流程测试：

```bash
node services.mjs stop relay
read -rsp 'Funded local test wallet private key: ' BRIDGE_USER_PRIVATE_KEY
export BRIDGE_USER_PRIVATE_KEY
npm run test:chain
npx playwright install chromium
npm run test:ui
node ui-test.mjs --hivex
node verify-logs.mjs
node verify-hivex.mjs
unset BRIDGE_USER_PRIVATE_KEY
node services.mjs start relay
```

浏览器测试注入 EIP-1193 测试签名器，通过真正的 `eth_sendRawTransaction` 上链；没有安装或自动操作 MetaMask 扩展。页面本身使用标准钱包接口，钱包拒签与切链等交互已覆盖。

结果在 `test-results/smoke.json`、`test-results/ui.json`，截图为 `bridge-desktop.png`、`bridge-wide.png`、`bridge-mobile.png`。

真实 HiveX 结果单独保存在 `test-results/hivex/ui.json` 和 `verification.json`；`node ui-test.mjs --hivex --visual-only` 只恢复测试记录并检查截图，不新增交易。测试失败时 `ui-incomplete.json` 保留已发送的 hash，先处理原交易，不要立即重复跨出。

完整证据见 [BRIDGE_TEST_REPORT.md](../../docs/BRIDGE_TEST_REPORT.md)。本次最终 HiveX 余额、BSC 锁仓和 HiveX 总供应均为 4 HBR；本地 Gas、合约及中继服务保留，页面可以继续手动钱包测试。
