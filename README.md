# SeeleLink ⚡

统一连接工具 — SSH · Serial · PowerShell · Bash · WebSocket · Android · IR

---

## 核心优势

**一个工具，全部协议。** 无需在多个终端应用之间切换。

| 类别 | 功能 |
|------|------|
| **多协议** | SSH · Serial · PowerShell · Bash · WebSocket · Android ADB · IR |
| **外部控制** | Control API（72 命令，TCP `:9380`）· MCP Server（89 工具，HTTP `:9381`）|
| **窗口自动化** | 鼠标、键盘、截图、拖拽 — 绝对坐标控制 |
| **AI 集成** | 原生 MCP/JSON-RPC 2.0 端点，OpenClaw 开箱即用 |
| **会话日志** | SSH/Serial/PS/Bash/WS 自动日志，ANSI 脱色，缓冲写入 |
| **安全** | 密码 AES-256-GCM 加密、Shell 注入防护、坐标范围校验 |
| **插件** | 子进程隔离架构（`~/.seelelink/plugins/`）|
| **UI** | React + TypeScript、无边框窗口、深浅主题、VSCode 风格布局 |
| **Web UI** | 浏览器访问（`:9383`）、WebBridge 多端同步（`:9382`）|

---

## 快速开始

```bash
npm install
npm run electron:dev   # 开发模式（构建 + 启动）
npm run build           # 仅构建
npm run package         # 打包 → SeeleLink.exe
```

> 截图黑屏？用 `npm run electron:dev -- --debug-gpu` 禁用硬件加速，或在 Settings 配置截图模式（auto / foreground / gdi）。

---

## 外部控制 API

详细文档：[中文文档](docs/README.md) · [API 参考](docs/api-reference.md) · [Control API](docs/control-api.md) · [MCP Server](docs/mcp.md)

### Control API — `9380`（TCP JSON）

```javascript
const net = require('net');
const client = new net.Socket();
client.connect(9380, '127.0.0.1', () => {
  client.write(JSON.stringify({ cmd: 'control:mouse:position' }) + '\n');
});
client.on('data', d => console.log(JSON.parse(d.toString())));
```

### MCP Server — `9381`（HTTP + SSE）

OpenClaw 配置（`~/.openclaw/config.json`）：

```json
{ "mcpServers": { "SeeleLink": { "url": "http://127.0.0.1:9381/" } } }
```

### Web UI — `9383`（HTTP）

在浏览器中打开 `http://localhost:9383` 访问 SeeleLink 界面，支持多端同步。

```bash
# 本地访问
# http://localhost:9383

# 局域网访问（获取局域网 IP）
# Settings → WebBridge 设置中查看局域网访问地址
```

---

## 数据存储

```text
~/.seelelink/
├── connections.json    连接配置
├── commands.json       快捷命令
├── ir-data.json        IR 红外数据
├── config.json         应用设置
├── electron.log        主日志
├── debug.log           调试日志
├── logs/<Type>/        会话日志
└── plugins/<id>/       插件
```

---

## 协议支持

| 协议 | 库 | 备注 |
|------|---|------|
| SSH | `ssh2` | TCP 直连 |
| Serial | `serialport` | 可配置波特率 |
| PowerShell | `node-pty` | ConPTY 伪终端 |
| Bash | `node-pty` | MSYS2/Git Bash |
| WebSocket | `ws` | TCP 套接字 |
| Android | `adb`（spawn）| WiFi ADB / USB |
| IR | 内置 | 串口或网络 |

---

## 平台

| 平台 | 状态 |
|------|------|
| Windows | ✅ 完整 |
| macOS | ✅ 编译通过 / ⚠️ 功能待验证 |
| Linux | ✅ 编译通过 / ⚠️ 功能待验证 |

---

## License

Mozilla Public License Version 2.0
