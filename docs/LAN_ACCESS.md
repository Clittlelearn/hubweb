# 局域网转发 Hub

## 启动前端与数据代理

```bash
cd /home/wbl/hubfrontend
npm start
```

`npm start` 会构建 SDK 并启动 5174 端口的 Vite，包含 `/api/v1` 等既有代理。
端口被占用时明确报错，不自动切换端口，以免 8848 映射到错误的服务。
它不负责启动 HubSQL/MySQL、本地测试链或中继，也不会重启远程节点。

旧的 `npm start` 实际运行 `serve -s dist -l 3000`，只能显示静态页面，
不会加载 Vite 的 API 代理；请求 `/api/v1/...` 会得到 SPA HTML，表现为页面没有数据。
该命令现改名为 `npm run preview:static`，仅供静态预览，不是完整 Hub 启动方式。
HubSQL 应已在 8080 端口运行。不要同时打开旧 3000 静态预览地址与新的 Hub 地址排查数据。

## 当前转发方式

同事浏览器访问 `http://192.168.1.14:8848`，Python TCP 转发到开发机 `127.0.0.1:5174`。前端页面已经可以加载，无须额外公开 HubSQL 的 8080 端口。

修正后的数据请求路径：

```text
同事浏览器 /api/v1/...
  -> 192.168.1.14:8848
  -> Python TCP 转发
  -> Vite :5174 /api/v1 代理
  -> 开发环境 HubSQL 127.0.0.1:8080
```

此前前端硬编码访问 `http://127.0.0.1:8080`。浏览器中的这个地址始终指访问者自己的电脑，而不是转发服务器，所以同事电脑出现 `ERR_CONNECTION_REFUSED`。现在 Devnet 默认使用 `window.location.origin`，本机与局域网访问均经过相同的同源代理。

## 配置与排查

保持现有 Python 转发配置，刷新页面即可。若 `.env.local` 显式设置了旧 API 地址，改为以下值并重启 Vite：

```dotenv
VITE_HUBSQL_API_URL=/
HUBSQL_API_URL=http://127.0.0.1:8080
```

`VITE_HUBSQL_API_URL` 供浏览器使用，`/` 或不配置表示页面同源；`HUBSQL_API_URL` 仅由服务器使用，指定 Vite 能访问的 HubSQL 地址。独立部署 HubSQL 时只改后者，不把服务器的 localhost 地址交给同事浏览器。

访问下面的 URL，正常应返回 JSON，而不是 HTML 页面：

<http://192.168.1.14:8848/api/v1/stats/overview>

在浏览器 Network 面板中，余额、提案、资产目录请求应以 `http://192.168.1.14:8848/api/v1/` 开头，不应再请求 `127.0.0.1:8080`。HubSQL 本身仍需运行；若代理返回 502/连接错误，检查服务器端的 HubSQL 状态。

React DevTools 下载提示不是错误。Logo 的 `stroke-width`、`stroke-linecap`、`stroke-linejoin` 已改成 React 所需的 camelCase 属性，与网络连接错误属于两个独立问题。

## 跨链与签名限制

数据查询可通过同源接口访问，但不等于把所有跨链管理功能开放到了局域网。

2026-09-22 已修复 Bridge 页面直接访问同事电脑 `127.0.0.1:8546` 的问题：

```text
同事浏览器 POST /__bridge-rpc
  -> 192.168.1.14:8848 -> Vite :5174
  -> 服务器读取 public/bridge/routes.json，核对 chainId/key/rpcUrl
  -> 开发机 Local BSC 127.0.0.1:8546（或 Local EVM :8545）
```

浏览器对回环 RPC 的 Bridge 查询使用此接口，Node 服务端代码仍使用原 RPC。
无需修改旧路由或浏览器保存的交易记录。接口只允许指定 ETH 读取方法，限制请求体大小及
上游请求时间，拒绝跨来源请求、任意目标 URL、批量请求、签名、发交易及 `evm_*` 管理方法。
服务器 RPC 不可用时返回带链名的错误；余额轮询出错后停止定时重试，可手动刷新恢复。
部署选项卡不再后台发起转账表单的路由、余额和报价查询。

- 普通 LAN HTTP 页面不是浏览器安全上下文。需安全上下文的 Web Locks 等能力不可用，不能通过删掉安全检查让钱包部署继续运行。
- `/__bridge-deploy` 目前是本地管理接口，检查 loopback、Host、Origin 和会话令牌。通过 `192.168.1.14:8848` 访问会被拒绝，即使 TCP 代理连接看起来来自 loopback，也不会放开它。
- Local BSC 路由保留 `http://127.0.0.1:8546` 作为服务器及钱包配置地址。**页面读取**已走代理；**MetaMask 中的 RPC**不由此接口代理，需要通过安全隧道或专门受限的 RPC 服务可达。不要把只读 `/__bridge-rpc` 当作钱包发交易接口。
- 完整远程钱包部署可使用认证 SSH 隧道，把前端及所需链 RPC 映射到使用者的 localhost；或另行建设受信任 HTTPS、鉴权部署管理接口和受限 RPC 代理。
- 不要直接把 Ganache 全部 RPC 方法暴露到公司网络；测试节点有修改余额等管理方法。也不要放开前端运行目录、私钥和中继文件下载权限。

生产静态部署不含 Vite 开发服务器。Nginx/Caddy 等实际服务端也必须配置 `/api/v1` 到 HubSQL 的反向代理，并实现 `/__bridge-rpc` 的相同只读访问控制，否则同源 API 会返回 404 或 SPA HTML。

## 验证

在 WSL 中执行：

```bash
cd /home/wbl/hubfrontend
npm run check
cd tools/bridge-lab
npm run test:lan-api
node test-bridge-lan.mjs
```

`HUB_LAN_URL` 可指定其他转发地址。此测试通过真实转发访问 HubSQL 的只读 API，禁止浏览器写请求，不发送交易；同时验证部署接口没有被放开。截图位于 `tools/bridge-lab/test-results/lan-api/`。

`test-bridge-lan.mjs` 使用 `BRIDGE_UI_URL`（默认 `http://192.168.1.14:8848`），验证
真实路由及 Local BSC 区块读取，并断言浏览器没有直连 `127.0.0.1:8545/8546`，不连接钱包或发送交易。
2026-09-22 验证通过，Local BSC 高度为 48；32 项单元测试、Bridge 地址显示、部署恢复、20 次查询上限浏览器回归和构建通过。
