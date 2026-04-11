# SeeleLink Documentation (English)

## Documentation Index

```
docs/
├── README.md              # Documentation index (Chinese)
├── README_EN.md          # Documentation index (English)
├── index.md              # 中文文档目录
├── index-en.md           # English Documentation Directory
├── architecture.md        # Architecture Overview (Chinese)
├── architecture-en.md     # Architecture Overview (English)
├── modules.md           # Modules Details (Chinese)
├── modules-en.md        # Modules Details (English)
├── api-reference.md      # API Reference (Chinese)
├── api-reference-en.md   # API Reference (English)
├── control-api.md        # Control API Guide (Chinese)
├── control-api-en.md     # Control API Reference (English)
├── mcp.md               # MCP Server Guide (Chinese)
├── mcp-en.md            # MCP Server Reference (English)
├── openclaw.md          # OpenClaw Integration Guide (Chinese)
├── openclaw-en.md       # OpenClaw Integration Guide (English)
├── TERMINAL.md          # Terminal System Design (Chinese)
├── TERMINAL-en.md       # Terminal System Design (English)
├── IPC.md               # IPC Channel Registry (Chinese)
├── IPC-en.md            # IPC Channel Registry (English)
├── DEVELOPMENT.md       # Development Guide (Chinese)
├── DEVELOPMENT-en.md    # Development Guide (English)
└── TODO.md             # Todo List
```

## Quick Links

| Document | Description |
|----------|-------------|
| [architecture-en.md](architecture-en.md) | Architecture overview (English) |
| [modules-en.md](modules-en.md) | Modules details (English) |
| [api-reference-en.md](api-reference-en.md) | Full API coverage matrix (English) |
| [control-api-en.md](control-api-en.md) | Control API reference (72 commands, English) |
| [mcp-en.md](mcp-en.md) | MCP Server reference (89 tools, English) |
| [openclaw-en.md](openclaw-en.md) | OpenClaw integration (English) |
| [TERMINAL-en.md](TERMINAL-en.md) | Terminal system design (English) |
| [IPC-en.md](IPC-en.md) | IPC channel registry (English) |
| [DEVELOPMENT-en.md](DEVELOPMENT-en.md) | Development guide (English) |

## Core Service Ports

| Service | Port | Protocol |
|---------|------|----------|
| Control API | 9380 | TCP JSON |
| MCP Server | 9381 | HTTP+SSE |

## Quick Start

```bash
npm install
npm run electron:dev   # Development mode
npm run build          # Build
npm run package        # Package
npm test               # Run tests
```
