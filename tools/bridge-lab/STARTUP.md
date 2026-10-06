# 跨链环境一键启动

用于恢复本机**已经部署好的** HiveX / Local BSC / Local EVM 跨链测试环境，不是首次安装或重新部署工具。

## Windows 启动

在 PowerShell 执行：

```powershell
& '\\wsl$\wsl-mm\home\wbl\hubfrontend\tools\bridge-lab\Start-Bridge.ps1'
```

如果系统执行策略禁止运行脚本，可仅对本次进程指定策略：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File '\\wsl$\wsl-mm\home\wbl\hubfrontend\tools\bridge-lab\Start-Bridge.ps1'
```

默认使用 WSL `wsl-mm`、Linux 用户 `wbl`，脚本位置 `/home/wbl/hubfrontend/tools/bridge-lab`。Windows 启动器支持 `-Distro`、`-User`；迁移项目路径时需相应修改启动器中的路径。

## WSL 启动

```bash
cd /home/wbl/hubfrontend/tools/bridge-lab
node start-environment.mjs
```

启动顺序：

1. 读取当前 `public/bridge/routes.json`，验证原有运行账户、数据库、交付记录存在。
2. 复用或启动 Local BSC（8546，31338）和 Local EVM（8545，31337），保留原数据库。
3. 对每条路由两端检查 RPC chain ID、Mailbox/Router/Token/ISM/Hook 代码、Mailbox domain、远端 Router 登记、ISM 信任的中继地址、中继 Gas 非零及日志查询能力。
4. 复用配置相同的 Hub 前端；未运行时先构建 SDK，再启动 Vite。
5. 启动或复用单实例中继，输出页面地址和日志位置。

**默认启动中继后，它可能自动提交已有跨链消息的目标链交易并消耗中继 Gas。** 脚本本身不会发起源链跨链、ERC20 部署、提案、投票或充值，也不会删除 pending hash、清空数据库或重新创建账户。

页面：[跨链](http://localhost:5174/bridge)、[测试工具](http://localhost:5174/dev-tools/native-flow)。终端命令结束后后台服务继续运行；关闭 WSL/重启机器后需要再次启动。

## 只读检查和不启动中继

```bash
# 不启动进程、不修改文件、不发送交易；服务未运行/校验失败时退出码为 1
node start-environment.mjs --check

# 恢复本地链和前端，但不启动已停止的中继
node start-environment.mjs --no-relay

# 使用其他前端端口，不抢占现有服务
node start-environment.mjs --port 5175

node --test start-environment.test.mjs
```

Windows 对应参数：`-Check`、`-NoRelay`、`-Port 5175`。可组合，例如 `-Check -NoRelay` 检查不要求中继已启动的环境。

`--no-relay` **不会停止已经运行的中继**；需暂停交付时先执行 `node services.mjs stop relay`，并确认 `runtime/relay.lock` 消失。不要把旧的 `services.mjs status` 当作只读命令，使用这里的 `--check`。

## 前提和边界

- WSL 内已安装 Node.js、项目依赖及 bridge-lab 依赖。不自动联网升级/安装依赖；缺失时分别在 `hubfrontend` 和 `tools/bridge-lab` 执行 `npm ci`。
- 需要保留 `runtime/local-account.json`、`relayer.json`、`relay-state.json`、`bsc-db`、`evm-db` 及与其匹配的路由配置。缺失时从原环境备份恢复，不要用空目录或新密钥凑齐文件。
- HiveX 远程节点需已启动且正常同步。脚本检查路由配置中的 RPC（当前为 `192.168.1.162:13134`），**不 SSH 启动/解锁节点，不证明全部七节点共识正常**。
- Gas 非零只是基础检查，不保证足够完成所有后续消息。中继已经运行也不等于某笔跨链已交付；交易结果仍需确认两端 receipt、by-hash、Mailbox delivered 和收款余额。
- 旧 pending 交易只保留原记录交给现有中继继续确认；本脚本不执行 `recover-delivery.mjs`、不重新发送源交易。
- 只负责 Bridge 运行依赖和前端，不负责启动 HubSQL/数据库。Flow 资产列表依赖 HubSQL 时需另行启动索引服务。
- 原有中继正在运行时，启动前检查不会暂停它。需要完全静默排错，应先停止中继再用 `--check --no-relay`。
- 这是本地测试环境，前端沿用 `0.0.0.0` 监听配置，不要暴露到公网；本地链 RPC 只监听回环地址。

## 日志和停止

```bash
cd /home/wbl/hubfrontend/tools/bridge-lab
tail -n 60 runtime/relay.log
tail -n 30 runtime/bsc.log
tail -n 30 runtime/evm.log
tail -n 30 runtime/frontend.log

node services.mjs stop relay bsc evm
```

旧服务管理器停止命令只发送 SIGTERM，需要等进程退出后再启动。前端复用原服务时不会接管其生命周期；新增前端 PID 保存在 `runtime/frontend.pid`，先用 `ps -p "$(cat runtime/frontend.pid)" -o pid,args` 核对是此项目的 Vite，再手动停止对应进程。

启动失败会返回非零退出码并指出原因。已经启动的部分服务会保留，不自动杀进程或回滚链数据；修复原因后重跑即可。并发启动通过 `runtime/environment-start.lock` 防重入，失效锁只会在确认对应进程不存在后清理。

| 报错 | 处理 |
|---|---|
| `Missing runtime/...` | 恢复原部署的数据库、账户、交付记录，不从零部署覆盖 |
| `wrong chain ID` | 检查端口对应进程和钱包网络，脚本不会杀掉占用服务 |
| `missing contract` | 核查连接的节点、路由文件和链数据库是否属于同一次部署 |
| `enrollment mismatch` / `identity mismatch` | 核对部署配置和原中继身份，禁止随意换私钥 |
| `relayer has no Gas` | 给日志中的中继**地址**在对应链充值 Gas |
| RPC 无响应 | 检查远程节点、WSL 网络、服务日志；恢复节点后重跑 |
| 前端端口被占用或配置不同 | 用 `--port 5175`，或确认并修复原前端服务 |

不要将 `runtime` 中的私钥、数据库或交付状态提交 Git 或复制到 `public`。
