# Bridge 页面与跨链测试报告

日期：2026-09-18。

## 结果与边界

新增 Hub `/bridge` 页面和导航，用户交易由连接钱包签名。基于 `/home/wbl/hyperlane` 的真实 Solidity 合约，已完成 **Local BSC <-> Local EVM** 双向链上转账。

更新至 2026-09-18 12:35（北京时间）：**真实 HiveX Devnet <-> Local BSC 双向页面交易已通过**。七节点已重启并部署 ETH 事件查询补丁，全部同步到高度 810，区块哈希一致。Local BSC 是本地持久化 EVM 测试链，不是 BSC 主网/公共测试网；安全模型仍是测试用 TrustedRelayerIsm。

## 本次重启与真实链验证

节点：`192.168.1.110`、`.161`、`.162`、`.163`、`.164`、`.165`、`.166`。初始发现 `.161/.164/.166` 未运行，其余停在 801。保持数据库、钱包、共识参数和启动环境，恢复全部节点后继续交易，未清库或跳过共识。

最终运行程序 SHA-256（逐台 `/proc/<pid>/exe` 核验）：

```text
f02d67e7d0ad58de13f326053a0ced53290e163795844e6077320d70c15cb3c5
```

共同高度：810；共同区块哈希：

```text
0x725cfcc31b495f5d0bfaf071e36c01d0c00d168abb5f132c2dec81a94bddb900
```

部署和配置完成于 798-806；补足中继 Gas 的交易位于 807；恢复原跨链消息位于 808；正式页面跨入和跨出分别位于 HiveX 的 809、810。

| 页面操作 | 源交易 | 目标交易 |
|---|---|---|
| Local BSC -> HiveX，2.5 HBR | `0xfae23c4bd6dc76598bdcfe62861d5a0310092bb427c2bbe116c9f327076ff0d6` | `0x1ef42cfde16f74b8d0720c8878c0ce538cc2d4254bc82bc455928c9b7a5e27be` |
| HiveX -> Local BSC，1 HBR | `0x160d8d1be9f491b9329b2bd27af373cb8f095e8f1d5ab88ed8cbdb69396822ad` | `0x1680e6845c385ae4925a6e3af13cf01e40a8609c6c83a417773fccc017591e9b` |

HiveX 跨出的 raw ETH hash 为 `0x3e620fbc3e0e26252d27f7fc6c6f929611cf2ad468806fac7249e8bb5b56e64d`，与上述节点返回的内部 hash 分开记录。

测试包含钱包拒签不广播、approve、切链、刷新恢复未完成记录、源/目标 receipt 与 by-hash、Dispatch/ProcessId 和 delivered 状态。真实签名在测试进程内按 EIP-1559 完成，经页面 EIP-1193 接口调用，没有使用菜单或旧交易 RPC，也没有安装 MetaMask 扩展。

另有首次 2.5 HBR 锁仓因中继 Gas 不足暂停，修复后原消息恢复成功，没有重做锁仓：源交易 `0x3216d28c5919b2e194a12fe55296bb99142a3235c0063b440d90e337de26bb28`，目标交易 `0x3b235457aaad4511fe22291494c14dfb86fefb7862b78ca6d773120af142afde`。

最终余额：用户 Local BSC 为 **999,996 HBR**，用户 HiveX 为 **4 HBR**，BSC Router 锁仓与 HiveX 总发行量均为 **4 HBR**。包含恢复的首次跨入，计算为 `2.5 + 2.5 - 1 = 4`。未经授权的中继调用被拒绝，受信中继的同一模拟调用成功；已交付消息重放被拒绝，重扫未增加 nonce 或余额。

### 本次修复

1. HiveX 未注册 `eth_getLogs`，receipt 的 logs 固定为空：改为读取 `CBlock.data[internalHash].log` 的共识执行结果，补充标准日志字段、全块 logIndex、receipt transactionIndex 和 bloom。没有重执行历史合约或伪造事件。
2. 测试脚本给中继的资金使用了旧 8 位单位：当前 ETH `value` 是 18 位，改为 `parseEther('100')`。原来 `100 * 10^8 wei` 仅相当于 `10^-8 OHI`，导致 EVM 执行预算不足。该修复不改变 HBR 的 8 位 ERC20 精度。
3. 部署断点恢复保留失效交易记录；仅在显式重试、两种 hash 均不可查、nonce 未变化且合约不存在时重试。
4. 页面发送前检查 `eth_getLogs` 可用性，避免连接不具备事件查询能力的节点后才锁仓。

验证通过：节点编译、`eth_logs` CTest、6 项前端测试、TypeScript/Vite 构建、历史事件与 bloom 独立核验、双向页面链上测试、七节点一致性和金额守恒。原始结果：`tools/bridge-lab/test-results/hivex/ui.json`、`verification.json`；截图同目录。现有 Vite 大 chunk 警告仍存在。

节点启动日志还出现 maintenance 委员会候选数量警告（requested=8、available=6）；本次没有调整该协议参数，809/810 交易出块已验证正常。

## 已实现

- 源链和目标链选择、切换方向、余额读取、金额精度校验、收款账户；
- 钱包添加网络/切链，签名前检查账户和 chainId；
- Collateral 按本次金额 approve，必要时先清零旧 allowance；
- 消息费链上报价和 `transferRemote` 钱包签名；
- 源链确认、等待 relayer、目标链确认三个阶段；
- receipt 与 by-hash、Dispatch message ID、Mailbox.delivered 和 ProcessId 核验；
- 表单与交易记录保存，刷新后恢复追踪；
- 校验部署合约、远端 Router、Mailbox、domain、decimals、scale；
- 本地链持久数据库、编译/部署/relayer/服务管理脚本和操作文档。

## 测试结果

| 测试 | 结果 |
|---|---|
| TypeScript 类型检查 | PASS |
| Vite 生产构建 | PASS，现有大 chunk 提示不影响构建 |
| 6 个客户端边界测试 | PASS |
| Local BSC -> Local EVM，125 HBR | PASS，源锁仓和目标铸币一致 |
| Local EVM -> Local BSC，50 HBR | PASS，源销毁和目标释放一致 |
| relayer 重扫 | PASS，没有重复发币 |
| 重复消息交付 | PASS，被拒绝 |
| 非 relayer 伪造新消息 | PASS，被 ISM 拒绝 |
| 已信任 relayer 重放已交付消息 | PASS，被拒绝 |
| 本地 BSC 重启持久化 | PASS，余额、合约和锁仓保持一致 |
| 浏览器钱包拒签 | PASS，没有广播交易 |
| 浏览器授权后跨出 2.5 HBR | PASS |
| 刷新恢复等待中的消息 | PASS |
| 浏览器切链后转回 1 HBR | PASS |
| 两端交易查询 | PASS，浏览器记录包含 sourceHash/messageId/destinationHash |
| 390 / 1440 / 1920 宽度 | PASS，无水平溢出，导航不重叠 |

浏览器使用测试注入的 EIP-1193 签名器，在进程内签署真实 EIP-1559 交易再调用 `eth_sendRawTransaction`。没有声称安装或操作过 MetaMask 扩展；产品页面本身只调用连接钱包的标准接口，不包含私钥输入或自动代签功能。

## 交易证据

### 合约层测试

| 方向 | 源 hash | 目标 hash |
|---|---|---|
| BSC -> EVM，125 HBR | `0xfdfb9569b95cebf329631dbe8aaf84d90491ad861709d76c50a198490b7db3f5` | `0x4154421e289c4d13f9820c2ba92890cf8a3187b568d704474b78d6618687ca69` |
| EVM -> BSC，50 HBR | `0x783fe365efa2f6c175c92439d5a0bf3a7aedab509b44c8ef1379dc6383619fb6` | `0x3d9bca021aaee550d68e7e888cdbed0503dbabfeef63e16facc13c6b33f881cb` |

该阶段结束时：用户 BSC 余额 999,925 HBR、用户 EVM 余额 75 HBR、BSC Router 锁仓 75 HBR。

### 页面端测试

| 方向 | 源 hash | 目标 hash |
|---|---|---|
| BSC -> EVM，2.5 HBR | `0xd866f94fa7c1fbdb6410a35687122221f6bc260f5a62080146344ec45211600b` | `0xf20423660cb0e7dee04debc4e264eb8fef96efc8d2bfc0250f00b6748f742563` |
| EVM -> BSC，1 HBR | `0x2bacad57ce0c32e22c7edfd9eb2fea9e08238a04213c240bea7d90e9ec77d5aa` | `0x0affc2ae582299e60775847d312c3ede87f5b9f9eb8dd6b6bafcb999327a8369` |

该阶段结束时：用户 BSC 余额 999,923.5 HBR、用户 EVM 余额 76.5 HBR、BSC Router 锁仓 76.5 HBR。

## 历史阻塞证据（已恢复）

已确认的部署/初始化覆盖高度 798-801。高度 802 的节点日志：

```text
BEACON_COMMITMENT_BUILD_FAILED height:802 ret:-10
reason:commit_deadline_missing_threshold_aggregate
CONTRACT_WAIT expired by consensus deadline
```

未确认交易：`0x0e46b639c558d0b44767bd4368b7dc88290040c02de4b77652f4a44275e4cd66`。

首次部署时节点 `192.168.1.164:13134` 和 `192.168.1.166:13134` 不可达。后续按用户指示恢复全部节点后，共识恢复；没有修改 HiveX 共识阈值或把本地 EVM 冒充 HiveX 节点。

部署记录已保留在 `tools/bridge-lab/runtime/deployment.json`，旧失败记录在 `expiredAttempts`；真实路由在全部部署与双向 Router 登记完成后已发布。

## 文件入口

- 使用/恢复部署：[tools/bridge-lab/README.md](../tools/bridge-lab/README.md)
- 前端：[src/app/pages/bridge/page.tsx](../src/app/pages/bridge/page.tsx)
- 钱包与交易逻辑：[src/app/lib/bridge-client.ts](../src/app/lib/bridge-client.ts)
- 公开路由：[public/bridge/routes.json](../public/bridge/routes.json)
- 本次原始测试结果：`tools/bridge-lab/test-results/smoke.json`、`ui.json`
- 本次截图：`tools/bridge-lab/test-results/bridge-desktop.png`、`bridge-wide.png`、`bridge-mobile.png`

官方架构参考：[Hyperlane Warp Routes](https://github.com/hyperlane-xyz/hyperlane-monorepo/blob/main/solidity/contracts/token/README.md)、[Relayer](https://docs.hyperlane.xyz/docs/protocol/agents/relayer)。实际编译与测试以本机仓库版本为准。
