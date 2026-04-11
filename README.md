# SeeleLink ⚡

统一连接工具 — SSH · Serial · PowerShell · Bash · WebSocket · Android · IR

---

## Features

**One tool, every protocol.** No more juggling multiple terminal apps.

| Category | What you get |
|----------|-------------|
| **Multi-Protocol** | SSH · Serial · PowerShell · Bash · WebSocket · Android ADB · IR |
| **External Control** | Control API (72 commands, TCP `:9380`) · MCP Server (89 tools, HTTP `:9381`) |
| **UI Automation** | Mouse, keyboard, screenshot, drag — absolute coordinate control |
| **AI Integration** | Native MCP/JSON-RPC 2.0 endpoint, OpenClaw-ready |
| **Security** | AES-256-GCM encrypted passwords, shell injection protection |
| **Session Logging** | ANSI-stripped logs for SSH/Serial/PS/Bash/WS with buffered writes |
| **Plugin System** | Isolated subprocess plugins at `~/.seelelink/plugins/` |
| **UI** | React + TypeScript, frameless window, dark/light themes, VSCode-style layout |

---

## 功能

| 类别 | 支持 |
|------|------|
| **终端协议** | SSH、Serial、PowerShell、Bash、WebSocket |
| **设备控制** | Android ADB（WiFi/USB）、IR 红外 |
| **外部控制** | Control API（TCP `:9380`）、MCP Server（HTTP `:9381`） |
| **窗口自动化** | 鼠标、键盘、截图、拖拽 — 支持绝对坐标操作 |
| **UI** | React + TypeScript、无边框窗口、深浅主题、VSCode 风格 |
| **安全** | 密码 AES-256-GCM 加密、Shell 注入防护、坐标范围校验 |
| **插件** | 子进程隔离架构（`~/.seelelink/plugins/`） |

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

| 接口 | 命令/工具数 | 说明 |
|------|------------|------|
| Control API | **72** 个命令 | 鼠标、键盘、截图、窗口、SSH、Serial、插件、配置等 |
| MCP | **89** 个工具 | 与 Control API 功能完全对等，JSON-RPC 2.0 |

详细文档：[docs/control-api.md](docs/control-api.md) · [docs/mcp.md](docs/mcp.md) · [docs/api-reference.md](docs/api-reference.md)

---

## 项目结构

```
electron/          主进程（IPC、连接管理、窗口）
src/ui/           React 渲染进程（终端、Android、IR、设置）
src/core/         连接存储、事件总线、插件管理
src/services/     控制服务层（mouse/keyboard/screen/debug）
platform/         跨平台适配（Windows Win32 / Linux X11 / macOS CGEvent）
docs/             完整文档
tests/integration/ 功能覆盖测试（115 项，自动化）
```

---

## 数据存储

```
~/.seelelink/
├── connections.json    连接配置
├── commands.json       快捷命令
├── ir-data.json        IR 红外数据
├── config.json         应用设置
├── electron.log        主日志
├── debug.log           调试日志
├── logs/<Type>/        会话日志（ANSI 脱色）
└── plugins/<id>/       插件
```

---

## 协议

| 协议 | 库 | 备注 |
|------|---|------|
| SSH | `ssh2` | TCP 直连 |
| Serial | `serialport` | 可配置波特率 |
| PowerShell | `node-pty` | ConPTY 伪终端 |
| Bash | `node-pty` | MSYS2/Git Bash |
| WebSocket | `ws` | TCP 套接字 |
| Android | `adb`（spawn） | WiFi ADB / USB |
| IR | 内置 | 串口或网络 |

---

## 平台

| 平台 | 状态 |
|------|------|
| Windows | ✅ 完整 |
| macOS | ⚠️ node-pty 需源码编译 |
| Linux | ⚠️ ADB / node-pty 需配置 |

---

## License

MIT
