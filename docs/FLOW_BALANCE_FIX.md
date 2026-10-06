# Flow 余额刷新错误修复

## 现象与核查

2026-09-21 核查资产 `0xea429213fd69d40b65ddcc9ef52bf6a797c989e849ff061a62675df21b636586`（xxkk01），HubSQL `/api/v1/balances/0x755Ccf704E17570b64E247f0794314e4C8E542CA` 返回余额 `1000000000000`，按 8 位精度为 **10,000**。

浏览器模拟测试复现了错误：选择 xxkk01 后刷新余额，表单自动选回第一个资产，显示从 `10K` 变为 `1K`。当前真实资产列表的第一个非 OHI 资产也有 1,000 余额。这里发生的是资产选择被替换，不是把同一个余额除以十。

## 原因与修改

- `use-flow-form-state.ts` 的 effect 依赖整个 assets 列表，每次数据变化都会重新应用 defaultAssetId。改为用 assetId/hash 保存选择，只在初始化或所选资产不存在时采用默认项；列表顺序变化也不影响选择。
- 当资产确实被移除时，清空输入金额并关闭确认窗口，避免把原金额误用到另一个资产。
- 表单余额和确认金额使用完整高精度文本，例如 `10,000`，不再使用 K/M 缩写，不通过 JavaScript Number/parseFloat 转换金额。MAX 和 ABI 编码仍使用原始精确数值。
- 历史记录原来固定按 18 位解释跃入金额；现在读取提案精度。
- 历史记录用 `flow_in_amount ?? flow_out_amount` 取金额，但跃出记录的 flow_in_amount 是字符串 `"0"`，不是 null。现在按交易方向选择字段，并从 HubSQL 目录取得资产名称。

没有修改合约、节点、HubSQL 数据库或余额，也没有发送跃入/跃出交易。

## 回归验证

```bash
cd /home/wbl/hubfrontend/tools/bridge-lab
npm run test:flow-balance-ui
cd /home/wbl/hubfrontend
npm run check
```

页面测试拦截所有 API 请求并使用只读模拟钱包，覆盖余额刷新、列表重排、MAX、FlowOut 原始参数 `1000000000000`、历史双向金额、资产移除后清空输入和关闭确认、完整精度，以及桌面/手机布局。

修复前复现入口为 `node test-flow-balance-ui.mjs --reproduce`；它断言旧错误存在，仅适用于修复前版本，修复后应失败。截图保存在 `tools/bridge-lab/test-results/flow-balance/`。
