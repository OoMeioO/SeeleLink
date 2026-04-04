# SeeleLink 🌊

Unified Connector Tool - SSH, Serial, PowerShell, WebSocket

## 特性

- 🎨 **macOS 风格 UI** - 简洁美观的界面
- 📡 **多协议支持** - SSH、Serial、PowerShell、WebSocket
- 🔄 **多标签支持** - 同时管理多个连接
- 💾 **配置持久化** - 保存连接配置和常用命令

## 代码架构

```
SeeleLink/
├── electron/
│   ├── main.cjs          # Electron 主进程
│   └── preload.js        # 预加载脚本（IPC 桥接）
├── src/
│   ├── ui/
│   │   └── App.tsx      # React 主组件
│   ├── protocols/        # 协议实现
│   │   ├── ssh/SSHClient.ts
│   │   ├── serial/SerialClient.ts
│   │   ├── powershell/PSClient.ts
│   │   └── websocket/WSClient.ts
│   ├── cli/             # CLI 实现
│   │   └── index.ts
│   ├── mcp/             # MCP 服务器
│   │   └── server.ts
│   ├── core/            # 核心模块
│   │   ├── ConnectionManager.ts
│   │   ├── ConnectionStore.ts
│   │   └── EventBus.ts
│   └── types/          # 类型定义
│       └── connection.ts
└── dist-electron/       # 构建输出
```

### 核心概念

- **ConnectionTab** - 每个标签页是独立的连接实例
- **Protocol Handler** - 各协议通过独立模块处理
- **IPC 通道** - 主进程与渲染进程通过 `ipcMain/ipcRenderer` 通信

## 当前支持的功能

### SSH
- ✅ 连接/断开 SSH 服务器
- ✅ 多开支持（同一服务器可开多个标签）
- ✅ 独立终端（每个标签独立输入/输出）
- ✅ Quick Commands（预设命令按钮）
- ✅ 连接持久化

### Serial
- ✅ 连接/断开串口
- ✅ 动态获取可用 COM 口
- ✅ 同一 COM 口可保存多个配置（不同波特率）
- ✅ 同时只能有一个连接使用同一 COM 口
- ✅ 连接持久化

### PowerShell
- ✅ 连接/断开本地 PowerShell
- ✅ 命令执行

### WebSocket
- 基础连接功能

## 预计支持的功能

- [ ] WebSocket 完整实现
- [ ] MCP (Model Context Protocol) 服务器集成
- [ ] 连接导入/导出
- [ ] 连接分组管理
- [ ] 命令历史记录
- [ ] 终端搜索功能
- [ ] 主题定制

## 还未实现的功能

- [ ] WebSocket 数据收发
- [ ] MCP server 完整实现
- [ ] Serial 端口热插拔检测
- [ ] 连接超时自动重连
- [ ] 终端截图/复制粘贴

## 依赖库

### 生产依赖

| 库 | 版本 | 用途 |
|---|---|---|
| `ssh2` | ^1.15.0 | SSH 客户端 |
| `serialport` | ^12.0.0 | 串口通信 |
| `@xterm/xterm` | ^5.5.0 | 终端模拟器 |
| `@xterm/addon-fit` | ^0.10.0 | 终端自适应大小 |
| `electron` | ^33.0.0 | 桌面应用框架 |
| `react` | ^18.3.1 | UI 框架 |
| `react-dom` | ^18.3.1 | React DOM |

### 开发依赖

| 库 | 版本 | 用途 |
|---|---|---|
| `typescript` | ^5.6.0 | TypeScript 编译 |
| `vite` | ^5.4.0 | 构建工具 |
| `@vitejs/plugin-react` | ^4.3.0 | React 插件 |
| `@types/*` | - | 类型定义 |

## 本地编译

### 1. 安装依赖

```bash
npm install
```

### 2. 开发模式运行

```bash
npm run electron:dev
```

### 3. 生产构建

```bash
npm run build
```

构建输出在 `dist-electron/` 目录。

### 4. 直接运行 Electron

```bash
.\node_modules\electron\dist\electron.exe .
```

## 日志配置

### 日志文件位置

- **主日志**: `C:\Users\<用户名>\.seelelink\electron.log`
- **调试日志**: `C:\Users\<用户名>\.seelelink\debug.log`

### 配置文件位置

- **连接配置**: `C:\Users\<用户名>\.seelelink\connections.json`
- **命令配置**: `C:\Users\<用户名>\.seelelink\commands.json`

### 日志内容

- `electron.log` - 主进程日志，包含连接、断开、错误等
- `debug.log` - 调试日志，包含详细的执行流程

## 配置保存

### connections.json 结构

```json
[
  {
    "id": "10.18.224.177-liujinzhidie",
    "name": "Production Server",
    "type": "ssh",
    "host": "10.18.224.177",
    "port": "22",
    "username": "liujinzhidie",
    "password": "xxx"
  },
  {
    "id": "serial-COM4-115200",
    "name": "COM4 @ 115200",
    "type": "serial",
    "serialPort": "COM4",
    "baudRate": "115200"
  }
]
```

## CLI 用法

```bash
# 连接 SSH
npm start -- connect -t ssh -h 192.168.1.100 -u admin -P password

# 连接 PowerShell
npm start -- connect -t powershell

# 列出保存的连接
npm start -- list
```

## License

MIT
