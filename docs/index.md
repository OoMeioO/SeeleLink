# SeeleLink 文档目录

## 文档索引

```
docs/
├── README.md              # 文档索引（本文档）
├── README_EN.md          # Documentation Index (English)
├── index.md              # 中文文档目录
├── index-en.md           # English Documentation Directory
├── architecture.md        # 架构总览
├── modules.md           # 模块详解
├── api-reference.md      # API 参考（中文）
├── api-reference-zh.md   # API 参考（中文，完整版）
├── api-reference-en.md   # API Reference (English)
├── control-api.md        # Control API 参考（英文）
├── control-api-zh.md     # Control API 参考（中文，完整版）
├── control-api-en.md     # Control API Reference (English)
├── mcp.md               # MCP Server 参考（英文）
├── mcp-zh.md           # MCP Server 参考（中文，完整版）
├── mcp-en.md           # MCP Server Reference (English)
├── openclaw.md          # OpenClaw 集成指南
├── TERMINAL.md          # 终端系统设计
├── IPC.md               # IPC 通道注册表
├── DEVELOPMENT.md       # 开发指南
└── TODO.md             # 待办清单
```

## 快速链接

| 文档 | 说明 |
|------|------|
| [architecture.md](architecture.md) | 架构总览 |
| [modules.md](modules.md) | 模块详解 |
| [api-reference-zh.md](api-reference-zh.md) | 完整 API 覆盖状态表（中文） |
| [control-api-zh.md](control-api-zh.md) | Control API 参考（72 个命令，中文） |
| [mcp-zh.md](mcp-zh.md) | MCP Server 参考（89 个工具，中文） |
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
