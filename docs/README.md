# SeeleLink 文档

本文档目录提供 SeeleLink 项目的完整中文文档索引。

## 文档索引

```
docs/
├── README.md              # 文档索引（本文档）
├── README_EN.md          # Project Introduction (English)
├── index.md              # 中文文档目录
├── index-en.md           # English Documentation Directory
├── architecture.md        # 架构总览（中文）
├── architecture-en.md     # Architecture Overview (English)
├── modules.md           # 模块详解（中文）
├── modules-en.md        # Modules Details (English)
├── api-reference.md      # API 参考（中文）
├── api-reference-en.md   # API Reference (English)
├── control-api.md        # Control API 详解（中文）
├── control-api-en.md     # Control API Reference (English)
├── mcp.md               # MCP Server 详解（中文）
├── mcp-en.md            # MCP Server Reference (English)
├── openclaw.md          # OpenClaw 集成指南
├── openclaw-en.md       # OpenClaw Integration Guide (English)
├── TERMINAL.md          # 终端系统设计（中文）
├── TERMINAL-en.md       # Terminal System Design (English)
├── IPC.md               # IPC 通道注册表（中文）
├── IPC-en.md            # IPC Channel Registry (English)
├── DEVELOPMENT.md       # 开发指南（中文）
├── DEVELOPMENT-en.md    # Development Guide (English)
└── TODO.md             # 待办清单
```

## 快速链接

| 文档 | 说明 |
|------|------|
| [index.md](index.md) | 中文文档目录 |
| [architecture.md](architecture.md) | 架构总览 |
| [modules.md](modules.md) | 模块详解 |
| [api-reference.md](api-reference.md) | 完整 API 覆盖状态表 |
| [control-api.md](control-api.md) | Control API 详解（72 个命令） |
| [mcp.md](mcp.md) | MCP Server 详解（89 个工具） |
| [openclaw.md](openclaw.md) | OpenClaw 集成 |
| [TERMINAL.md](TERMINAL.md) | 终端系统设计 |
| [IPC.md](IPC.md) | IPC 通道注册表 |
| [DEVELOPMENT.md](DEVELOPMENT.md) | 开发指南 |

## 核心服务端口

| 服务 | 端口 | 协议 |
|------|------|------|
| Control API | 9380 | TCP JSON |
| MCP Server | 9381 | HTTP+SSE |

## 启动命令

```bash
npm install
npm run electron:dev   # 开发模式
npm run build          # 构建
npm run package        # 打包
npm test               # 运行测试
```
