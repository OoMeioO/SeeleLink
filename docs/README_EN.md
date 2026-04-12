# SeeleLink Documentation

This section provides the complete English documentation index for SeeleLink.

## Documentation Index

```
docs/
├── README.md              # Documentation index (Chinese)
├── README_EN.md          # Documentation index (English)
├── index.md              # Chinese Documentation Directory
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
| [index-en.md](index-en.md) | English documentation directory |
| [architecture-en.md](architecture-en.md) | Architecture overview |
| [modules-en.md](modules-en.md) | Modules details |
| [api-reference-en.md](api-reference-en.md) | Full API coverage matrix |
| [control-api-en.md](control-api-en.md) | Control API reference (72 commands) |
| [mcp-en.md](mcp-en.md) | MCP Server reference (89 tools) |
| [openclaw-en.md](openclaw-en.md) | OpenClaw integration |
| [TERMINAL-en.md](TERMINAL-en.md) | Terminal system design |
| [IPC-en.md](IPC-en.md) | IPC channel registry |
| [DEVELOPMENT-en.md](DEVELOPMENT-en.md) | Development guide |

## Core Service Ports

| Service | Port | Protocol |
|---------|------|----------|
| Control API | 9380 | TCP JSON |
| MCP Server | 9381 | HTTP+SSE |
| WebBridge | 9382 | WebSocket |
| Web UI | 9383 | HTTP |

## Quick Start

```bash
npm install
npm run electron:dev   # Development mode
npm run build          # Build
npm run package        # Package
npm test               # Run tests
```
