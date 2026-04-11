# SeeleLink 文档

## 文档结构

```
docs/
├── index.md              # 本文档 — 文档索引
├── README.md             # 项目简介、快速开始（中文）
├── README_EN.md          # 项目简介、快速开始（English）
├── TODO.md               # 开发计划
├── architecture.md       # 架构总览 + Mermaid 图
├── modules.md           # 模块详解
├── api-reference.md    # API 参考（MCP + Control API + IPC）
├── control-api.md       # Control API TCP JSON 详解
├── mcp.md              # MCP Server HTTP+SSE 详解
├── openclaw.md         # OpenClaw 集成指南
└── debug_screen.png    # 调试截图
```

## 快速链接

| 文档 | 说明 |
| --- | --- |
| [README.md](README.md) | 项目简介、快速开始 |
| [architecture.md](architecture.md) | 架构图、IPC 通信、终端模块、插件系统 |
| [modules.md](modules.md) | 各模块详细说明 |
| [api-reference.md](api-reference.md) | 完整 API 覆盖状态表 |
| [control-api.md](control-api.md) | Control API 详解（72个命令） |
| [mcp.md](mcp.md) | MCP Server 详解（89个工具） |
| [api-reference.md](api-reference.md) | API 覆盖状态表 |
| [openclaw.md](openclaw.md) | OpenClaw 集成 |

## 启动方式

```bash
npm install
npm run electron:dev   # 开发模式
npm run build          # 构建
npm run package        # 打包
npm test               # 运行自动化测试
```

## 核心服务端口

| 服务 | 端口 | 协议 |
|------|------|------|
| Control API | 9380 | TCP JSON |
| MCP Server | 9381 | HTTP+SSE |
