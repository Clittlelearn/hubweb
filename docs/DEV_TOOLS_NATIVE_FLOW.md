# Native Flow 独立测试工具

更新：2026-09-19。页面：`http://localhost:5174/dev-tools/native-flow`。

## 三个独立操作

| 页签 | 输入 | 结果 | 不会执行 |
|---|---|---|---|
| ERC20 | Token 名称、Symbol、精度、供应量、Logo | 部署 raw hash、节点 hash、确认后的合约地址 | 不创建提案，不修改提案表单，不投票 |
| Proposal | 指定 HiveX ERC20 地址、独立资产名称、期限、最小票数、兑换率 | 提案 raw hash、节点 hash、Proposal ID | 不部署 Token，不覆盖投票表单，不自动投票 |
| Vote | 已有提案的 Proposal ID/hash | 一笔赞成票的 raw hash、节点 hash | 不依赖本页是否部署或创建过提案 |

移除了 Run All Steps。三个表单及结果独立保存，刷新后恢复；旧版已保存的合约地址、提案 hash、Token 参数和交易结果继续读取。旧版 Symbol 只在首次迁移时作为提案资产名称，之后两个名称独立。

刷新发生于交易确认期间时，保留提交的 hash 并标记需要核对，不自动重发。交易失败也保留已经提交的 hash；再次操作前先查原交易，避免重复。

## 签名账户

提案和投票固定使用 `0x755Ccf704E17570b64E247f0794314e4C8E542CA`。

测试签名框必须输入能导出该地址的密钥，其他账户会被拒绝。密钥没有硬编码在源码或文档中；沿用现有测试工具的 tab sessionStorage 保存方式，不写入 localStorage。只用于隔离测试浏览器，结束后清空签名框或清理会话。这里是本地私钥签名测试工具，不是 MetaMask 弹窗。

部署工具也沿用 755 签名，但 `Initial holder` 可以填写其他非零 EVM 地址，初始供应量会发给该地址，而不是固定发给 755。默认值仍为 755，兼容旧表单；填写后刷新会保留。无效地址、错误校验和和零地址会阻止部署。这不改变提案、投票的创世账户，也不影响指定其他已部署合约提案。

例如填写 `0xeb26a104ea1347D4a71fd96f5Cf2F1170ca22BEb`，新 Token 的初始余额属于这个地址。对应资产提案生效后，由持币账户发起 Flow In，并准备 HiveX 的 OHI 支付 Gas。部署者不等于唯一可跃入者；初始持有人将 Token 转给其他账户后，其他持币账户也可以按合约及已激活资产规则跃入。修改表单不会改变已经部署的合约或已有余额。

## 跨链 HBR 的填写示例

1. 选择正确的 HiveX RPC，chainId 填 `12315`，填入 755 测试签名密钥。
2. 直接进入 Proposal，不需要打开 ERC20 页签或重新部署。
3. ERC20 contract address 填 `0x5af1bf521e0576502897a9a7e8ee11fcd5157082`。
4. Asset name 填 `HBR`，Proposal duration 示例 `6m`，Minimum vote 示例 `1`，Exchange rate 示例 `1`。
5. 点击 Create proposal；工具先检查该地址有合约代码，再通过 ETH RPC 发送提案。合约是否满足 Native Flow 元数据、bridge 绑定等要求仍由节点校验，不能为任意不支持 Flow 的 ERC20 自动增加 Flow 能力。
6. 确认成功后复制 Proposal ID。切换 Vote，手动填写 Proposal hash，点击 Submit approval。
7. 等待投票结束且链上后续区块完成激活，再等 HubSQL 索引到该资产。
8. 在 Flow 页面连接真正持有 HiveX EVM HBR 的账户，例如 `0x94413a48d9106475A0391bE0C3Ad252c671038FF`，选择对应资产进行 Flow In。

755 负责提案和投票，不代表其他账户跨入的 Token 归 755。跃入使用持币者自己的签名和余额。提案无需每个持币人重复创建；执行前先核对是否已有同一合约的有效提案。

## ETH RPC 行为

所有发送仍由原有 `sendSignedTransaction` 完成：EIP-1559 本地签名、`eth_sendRawTransaction` 广播、`eth_getTransactionReceipt` 和 `eth_getTransactionByHash` 双接口确认。没有引入菜单或旧私有写 RPC。

提案 JSON 中 `contract_addr` 为手动填写的 HiveX 合约地址，`asset_name` 为独立资产名称，`cross_chain_tx_type=0`，`peer_chain_token_addr` 为该 HiveX 地址左补零到 32 字节。投票 JSON 的 `vote_hash` 为手动填写的提案协议 hash。两种 JSON 的 `to` 和 OHI Gas 账户均为 755；raw to 使用兼容占位地址，raw value 为 0。

Proposal ID 是当前节点返回的提案协议 hash，不要用 raw ETH hash、合约地址或跨链 Message ID 替代。

## 验证

```bash
cd /home/wbl/hubfrontend
npm run check
cd tools/bridge-lab
node test-dev-tools-ui.mjs
```

浏览器测试覆盖三个操作的独立发送、固定签名者、JSON 与构造参数、合约无代码拒绝、复制 hash、失败保留 hash、刷新恢复、旧数据迁移、桌面/手机布局。测试用隔离签名客户端替身，不包含真实私钥、不广播链上交易；截图中的 hash 和结果是测试夹具，不是链上验收证据。

本次修改没有代用户发起新的 HBR 提案或投票，也没有据此宣称 HBR 已激活或完成跃入。
