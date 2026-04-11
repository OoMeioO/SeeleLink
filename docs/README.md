# SeeleLink 文档索引

## 文档地图

```
docs/
├── README.md           ← 文档索引（本文档）
├── ARCHITECTURE.md     # 系统架构（9张架构图）
├── MODULES.md          # 模块详解（Electron/终端/UI/插件/ControlService）
├── api-reference.md    # API 覆盖状态表（MCP / Control API / IPC 三层）
├── control-api.md     # Control API 详解（命令参考 + 示例代码）
├── mcp.md             # MCP Server 详解（工具列表 + JSON-RPC 格式）
├── openclaw.md        # OpenClaw 集成指南
├── TERMINAL.md        # 终端系统设计（xterm / Protocol Adapter / Tab 架构）
├── IPC.md             # IPC 通道注册表（preload.js 所有通道）
└── DEVELOPMENT.md      # 开发指南（启动/构建/调试/测试）

../README.md           # 主 README（项目概述 + 快速开始）
```

## 快速链接

| 文档 | 内容 |
|------|------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | 系统架构总览、9 张架构图（IPC 通信、终端渲染、插件、ControlService 等） |
| [MODULES.md](MODULES.md) | 各模块详细说明：Electron 主进程、preload、终端、UI 组件、插件、平台控制 |
| [api-reference.md](api-reference.md) | 22 个功能分类的 API 覆盖状态表（MCP / Control API / IPC） |
| [control-api.md](control-api.md) | TCP JSON 命令参考（窗口自动化、连接管理、坐标系统、Node.js/PowerShell 示例） |
| [mcp.md](mcp.md) | MCP 工具列表、JSON-RPC 2.0 格式、cURL 示例 |
| [openclaw.md](openclaw.md) | OpenClaw 配置、MCP vs Control API 两种集成方式、坐标系统 |
| [TERMINAL.md](TERMINAL.md) | 终端模块设计哲学、TerminalCore/TerminalPanel/Protocol Adapter 详解 |
| [IPC.md](IPC.md) | `electron/preload.js` 所有 IPC 通道的完整注册表 |
| [DEVELOPMENT.md](DEVELOPMENT.md) | 开发环境、构建、调试、测试、目录规范 |

## 核心服务端口

| 服务 | 端口 | 协议 |
|------|------|------|
| Control API | 9380 | TCP JSON（newline-delimited） |
| MCP Server | 9381 | HTTP + SSE + POST（JSON-RPC 2.0） |

## 相关文件

| 文件 | 说明 |
|------|------|
| `SEELINK_CONTROL.md` | Control API 模板（打包时包含） |
| `electron/main.cjs` | 主进程入口，所有 IPC handler、连接池、Control/MCP Server |
| `electron/preload.js` | contextBridge，所有暴露给渲染进程的 API |
| `src/ui/electronAPI.ts` | preload.js 的 TypeScript 类型定义 |

## 启动命令

```bash
npm install
npm run electron:dev   # 开发模式（构建 + 启动）
npm run build          # 构建前端
npm run package        # 打包为 exe
npm test               # 运行所有测试
```
