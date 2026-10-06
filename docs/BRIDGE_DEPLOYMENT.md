# 前端钱包一键部署双链跨链合约

入口：<http://localhost:5174/bridge?view=deploy>，或在 Bridge 页面选择 **Deploy contracts**。

本功能针对当前 **Local BSC ↔ HiveX Devnet** 测试环境。点击一次后，前端依次请求钱包切链、部署、初始化、登记双向 Router，最后发布新路由。**每笔交易仍需要钱包确认，不读取私钥，也不使用节点菜单或旧私有交易 RPC。**

“重头测试”在这里指创建一套全新的合约和路由，不是清空区块数据库。旧合约、旧路由、中继密钥、旧跨链记录均保留。不会自动发起提案、投票或转移旧 Token。

## 1. 启动前提

当前网络配置取自 `public/bridge/routes.json` 中 chain ID 为 12315 和 31338 的已有路由，不在浏览器中允许任意填写节点地址：

| 网络 | Chain ID / Domain | 当前 RPC | Gas 资产 |
| --- | --- | --- | --- |
| Local BSC | 31338 / 31338 | http://127.0.0.1:8546 | BNB |
| HiveX Devnet | 12315 / 12315 | http://192.168.1.162:13134 | OHI |

Local BSC 是本地测试链，不是 BSC 主网或公共测试网。连接钱包的同一个地址在两条链上都需要有 Gas。钱包端和浏览器端必须访问同一条链，不能只设置相同 chain ID 而连接不同链数据。

本次增加的编译产物是 `BridgeTestToken`。首次更新后在 WSL 执行：

```bash
cd /home/wbl/hubfrontend/tools/bridge-lab
npm ci
node compile.mjs
node start-environment.mjs
```

`start-environment.mjs` 恢复本地服务，不负责重启远程 HiveX 集群；HiveX 节点和共识必须已正常运行。启动中继后可能处理已有路由的待交付消息。只检查环境使用：

```bash
node start-environment.mjs --check
```

本功能依赖现有 `runtime/relayer.json` 和路由网络配置。它复用中继身份，不创建或更换中继私钥。

部署辅助 API 只在 **Vite 开发服务 + 本机 localhost** 下启用。`npm run build` 生成的纯静态站点不提供路由发布 API；不能仅复制 `dist` 就使用此部署功能。服务检查回环连接、Host、Origin、自定义请求头和当前服务的发布令牌。不要把开发服务作为公开部署管理后台。

## 2. 页面参数

| 参数 | 含义 |
| --- | --- |
| Token name | 两端 ERC20 名称，例如 `Bridge Test Token 02` |
| Token symbol | 两端符号，1～12 个字母、数字、下划线或连字符，例如 `BT02` |
| Decimals | 两端统一精度，0～18，默认 8 |
| Initial supply · Local BSC | 人类可读发行量，默认 `1000000`；按精度转换为合约整数 |
| Initial holder · Local BSC | 接收 Local BSC 初始发行量的账户；留空使用当前钱包地址 |
| Relayer minimum Gas balance · each chain | 中继在每条链上的最低原生 Gas 余额，默认 `0.1`；不足时由钱包补足差额 |

例：发行量 `1000000`、精度 `8`，构造参数实际数量为 `100000000000000`。中继 Gas 使用 ETH RPC 的 18 位原生币单位，不能与 ERC20 的 8 位数量混用。

**部署者、初始持有人、跨链接收人是不同角色：**

- 部署者：当前签名钱包，同一个账户管理两端新 Mailbox、Hook、Router。
- 初始持有人：Local BSC 新 Token 的接收账户，可以不是部署者。
- HiveX ERC20 初始供应为 0；成功跨链后，Token 铸造给 Bridge 表单指定的接收账户，不会因为某人部署了合约就自动归他所有。
- `Native Flow bridge` 是已有 HiveX 协议桥地址，本次将它传给新的 HypERC20，不重复部署该协议桥。

## 3. 操作步骤

1. 打开部署页并连接钱包，确认两条链都有 Gas。
2. 填名称、符号、精度、初始发行量和持有人。
3. 点击 **Deploy both chains**。
4. 按钱包提示确认切链和各笔交易。先部署 Local BSC，再部署 HiveX，随后配置两端路由。
5. 等待 **Route registered**。页面显示两边的 Mailbox、ISM、Hook、Router、ERC20 和每笔交易 hash，可以复制或导出 JSON。
6. 切回 **Transfer**。新路由自动加入列表并被选中，旧路由仍保留。

共 **17 笔必需交易**：9 次合约部署、8 次初始化或配置。根据中继余额，最多再增加 2 笔 Gas 补款，因此通常需要确认 17～19 笔。不把这些不同链上的交易伪装成单笔原子操作；中途失败时已上链的步骤不会回滚。

页面不操作钱包安装、导入私钥或自动点击确认。

## 4. 两端部署内容和参数

共同约定：`owner = 当前钱包`，`relayer = 本地中继公开地址`，`scale = 1`，两端 decimals 相同。

| 顺序 | 链 | 合约 / 调用 | 参数 |
| --- | --- | --- | --- |
| 1 | Local BSC | `Mailbox` 构造 | `31338` |
| 2 | Local BSC | `TrustedRelayerIsm` 构造 | `新 Mailbox, relayer` |
| 3 | Local BSC | `ProtocolFee` 构造 | `0, 0, owner, owner` |
| 4 | Local BSC | `Mailbox.initialize` | `owner, 新 ISM, 新 Hook, 新 Hook` |
| 5 | Local BSC | `BridgeTestToken` 构造 | `name, symbol, decimals, initialHolder, rawSupply` |
| 6 | Local BSC | `HypERC20Collateral` 构造 | `新 ERC20, 1, 新 Mailbox` |
| 7 | Local BSC | `Router.initialize` | `新 Hook, 新 ISM, owner` |
| 8 | HiveX | `Mailbox` 构造 | `12315` |
| 9 | HiveX | `TrustedRelayerIsm` 构造 | `新 Mailbox, relayer` |
| 10 | HiveX | `ProtocolFee` 构造 | `0, 0, owner, owner` |
| 11 | HiveX | `Mailbox.initialize` | `owner, 新 ISM, 新 Hook, 新 Hook` |
| 12 | HiveX | `HypERC20` 构造 | `decimals, 1, 新 Mailbox` |
| 13 | HiveX | `Router.initialize` | `0, name, symbol, 新 Hook, 新 ISM, owner, nativeFlowBridge` |
| 14～17 | 双方 | `enrollRemoteRouter`、`setDestinationGas` | 对方 domain、左侧补零为 bytes32 的对方 Router；目标 Gas 为 `300000` |
| 可选 | 双方 | 中继 Gas 转账 | `to = relayer`，`value = 最低余额 - 当前余额`，仅余额不足时发送 |

HiveX 上 **HypERC20 同时是 Router 和 ERC20**，因此两行地址相同是正常的。Local BSC 上 Token 和 collateral Router 是不同地址。Hook 消息费设为 0，但部署交易、用户交易、中继处理消息仍消耗原生 Gas。

源码使用 `/home/wbl/hyperlane/solidity` 的真实合约；编译器固定 solc 0.8.19、Paris EVM、OZ 4.9.6。Local BSC 新测试币源码为 `tools/bridge-lab/contracts/BridgeTestToken.sol`。

这套 ISM 只信任一个测试中继，合约部署与初始化也是分开的交易。**它不是生产网部署方案**，不要直接用于生产资金。

## 5. RPC 和成功判定

前端通过 EIP-1193 请求 `wallet_switchEthereumChain` / `wallet_addEthereumChain`、`eth_estimateGas`、`eth_sendTransaction`。钱包负责签名并广播交易，前端不构造旧私有 RPC 请求，也不向服务端提交私钥。

每次确认同时检查：

- `eth_getTransactionReceipt`、`eth_getTransactionByHash` 能返回同一交易的区块信息。
- 交易 from、to、input、value、nonce 与保存的请求一致。
- `eth_getBlockByNumber` 返回的区块 hash 与 receipt 一致，receipt status 成功。
- 部署交易的地址符合 `CREATE(from, nonce)`，且 `eth_getCode` 有代码。

返回 hash 本身不代表成功。HiveX 的节点返回 hash 与 raw ETH hash 可能不同；页面记录钱包实际返回、可用于节点查询的 hash，不凭空把内部 hash 当成 raw hash。

发布路由前，还会从链上检查双向 Router 登记、Mailbox/domain、Token/decimals/scale、ISM 信任的中继、Hook、owner、目标 Gas、符号、中继余额和 HiveX Native Flow bridge。

本机服务只在全部验证通过后原子更新 `public/bridge/routes.json`，保留已有条目。同一部署 ID 重复发布是幂等操作；不允许同 ID 替换为另一套合约。

## 6. 暂停、刷新和异常恢复

草稿保存在 `hub.bridge.deployment.form.v1`，部署记录保存在 `hub.bridge.deployments.v1`，均为浏览器 localStorage。记录含公开参数、交易和地址，不含私钥。

请始终使用同一个浏览器和同一个访问域名。`localhost` 与 `127.0.0.1` 的存储不共享；清理浏览器数据会删除恢复记录。导出按钮可下载部署 JSON 供排查和人工恢复，当前没有 JSON 导入按钮。

| 情况 | 行为与处理 |
| --- | --- |
| 钱包明确拒签（4001） | 不发送下一步；点击 Resume deployment 可重试当前步骤 |
| 有 hash，但节点暂未确认 | 保留 hash；Resume 只重新查询，不重发当前交易 |
| 钱包断连或刷新时没有记下 hash | 阻止自动重发；在钱包活动中找到该笔 hash，填入补录栏并点击 Verify transaction hash |
| 补录 hash | 校验 from、to、input、value、nonce，匹配后才恢复查询 |
| 钱包断连且确认根本没有广播 | 不自动推断“未发送”；需人工核对钱包、nonce 和节点后处理记录，不能盲目再建一轮部署 |
| 切换了钱包账户 | 恢复原部署账户后再继续 |
| 合约 artifact 或中继身份改变 | 阻止继续，恢复原编译产物 / 中继配置后重试 |
| 服务重启导致发布令牌过期 | 点击刷新配置图标，再 Resume；已部署合约不重发 |
| 链回滚、receipt 与 by-hash 不一致 | 停止，不发布路由，先修复节点状态 |
| localStorage 写入失败 | 停止下一笔签名；先导出当前 hash 和地址排查 |

暂停按钮在当前交易处理后停止；刷新不会撤销已签名交易。多个标签页通过浏览器部署锁互斥，续跑时会重新读取最新记录，避免旧标签页重复发送。

## 7. 中继与跨链到跃入

服务读取已有中继身份的**公开地址**给前端。私钥只保留在本机中继运行目录，不进入 API、页面或导出的部署文件。

运行中的中继每轮读取路由文件，因此新路由发布后无需重启中继。若页面显示 Offline，在 WSL 执行：

```bash
cd /home/wbl/hubfrontend/tools/bridge-lab
node services.mjs start relay
tail -n 50 runtime/relay.log
```

`Route registered` 表示部署和登记完成，不表示已经跨链。后续完整测试流程：

1. Local BSC 初始持有人在 Transfer 中选新路由，执行 ERC20 approve，再执行跨链转账。
2. 中继向 HiveX 新 Mailbox 交付消息；页面显示 Delivered，核对指定接收人的 HiveX 新 ERC20 `balanceOf`。不要查合约地址自身余额来代替用户余额。
3. 到 Dev Tools 独立提案功能，使用创世账户对**新 HiveX ERC20 地址**发起提案并投票。不能沿用旧 ERC20 的提案。
4. 等待投票结束，且后续区块应用激活；HubSQL 同步解析完成后，Flow 列表才出现新资产。
5. HiveX ERC20 持有人执行 Flow In；不要求是合约部署者。原生资产类型是激活的**提案 hash**，不是 ERC20 地址。
6. 需要返回 Local BSC 时先 Flow Out，再通过 Bridge 反向跨链。

## 8. 测试与边界

```bash
cd /home/wbl/hubfrontend
npm run check
cd tools/bridge-lab
npm test
npm run test:deployment
npm run test:deployment-ui
```

`test:deployment` 在临时内存 Ganache 双链实际执行部署、两端初始化、路由登记、Gas 补款，并测试暂停续跑、发布接口验证和保留旧路由。测试不用当前节点数据库，不修改真实路由文件。

`test:deployment-ui` 使用模拟 EIP-1193 钱包和拦截 RPC，验证草稿/交易刷新恢复、拒签、未知 hash 防重发、旧标签页恢复、hash 补录，以及 390/1440/1920 像素页面布局。截图在 `tools/bridge-lab/test-results/deployment/`。

这些测试不等价于 MetaMask 扩展实测，也不等价于新的 HiveX 测试网部署。本次实现未自动向现有 HiveX / Local BSC 发送部署交易，实际部署由用户在页面连接钱包并逐笔确认。

## 9. 钱包账户、网络与 Gas 校验

- `Connected wallet` 和 `Wallet chain` 表示当前钱包连接；`Deployer` 表示所选部署记录的签名人。手动查看其他账户的历史记录不会更换签名人，恢复按钮会禁止使用不匹配的账户。
- 切换账户时只自动选择该账户、该部署网络配置的历史记录；没有匹配记录则显示新部署，保留其他账户全部历史。
- 部署网络对来自服务器配置，不是导航栏文字，也不是任意钱包网络。当前钱包必须位于配置的其中一条链；部署过程中会依次请求切换到两条目标链。
- 每次开始或恢复都重新获取服务器配置。已经开始的部署锁定原 RPC、Chain ID、Domain、artifact 和中继身份，不能静默改到新环境继续。
- 查询 Gas 前以及签名前，核对钱包实际选中账户、Chain ID，并比较钱包和配置 RPC 同高度的区块 hash。相同 Chain ID 的不同测试链会明确报网络不匹配，不会误报缺少 Gas。
- Gas 余额通过当前签名钱包的 `eth_getBalance` 读取；零余额错误会列出账户、链和配置 RPC。两条链分别需要原生 BNB 和 OHI，跨链 ERC20 余额不能代付部署 Gas。
- 755 账户在 110/162 的一次只读检查中都有 OHI；这不代表所有用户在 HiveX 都有 OHI，也不代表它在 Local BSC 已有 BNB。未自动充值或发送部署交易。
