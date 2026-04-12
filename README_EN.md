# SeeleLink ⚡

Unified Connector Tool — SSH · Serial · PowerShell · Bash · WebSocket · Android · IR

---

## Features

**One tool, every protocol.** No more juggling multiple terminal apps.

| Category | What you get |
|----------|-------------|
| **Multi-Protocol** | SSH · Serial · PowerShell · Bash · WebSocket · Android ADB · IR |
| **External Control** | Control API (72 commands, TCP `:9380`) · MCP Server (89 tools, HTTP `:9381`) |
| **UI Automation** | Mouse, keyboard, screenshot, drag — absolute coordinate control |
| **AI Integration** | Native MCP/JSON-RPC 2.0 endpoint, OpenClaw-ready |
| **Session Logging** | ANSI-stripped logs for SSH/Serial/PS/Bash/WS with buffered writes |
| **Security** | AES-256-GCM encrypted passwords, shell injection protection |
| **Plugin System** | Isolated subprocess plugins (`~/.seelelink/plugins/`) |
| **UI** | React + TypeScript, frameless window, dark/light themes, VSCode-style layout |
| **Web UI** | Browser access (`9383`), WebBridge multi-client sync (`9382`) |

---

## Quick Start

```bash
npm install
npm run electron:dev   # Development mode (build + launch)
npm run build           # Build only
npm run package         # Package → SeeleLink.exe
```

> Screenshot black screen? Use `npm run electron:dev -- --debug-gpu` to disable hardware acceleration, or configure capture mode in Settings (auto / foreground / gdi).

---

## External Control APIs

Documentation: [English Docs](docs/README_EN.md) · [API Reference](docs/api-reference-en.md) · [Control API](docs/control-api-en.md) · [MCP Server](docs/mcp-en.md)

### Control API — `9380` (TCP JSON)

```javascript
const net = require('net');
const client = new net.Socket();
client.connect(9380, '127.0.0.1', () => {
  client.write(JSON.stringify({ cmd: 'control:mouse:position' }) + '\n');
});
client.on('data', d => console.log(JSON.parse(d.toString())));
```

### MCP Server — `9381` (HTTP + SSE)

OpenClaw config (`~/.openclaw/config.json`):

```json
{ "mcpServers": { "SeeleLink": { "url": "http://127.0.0.1:9381/" } } }
```

### Web UI — `9383` (HTTP)

Access SeeleLink in your browser at `http://localhost:9383` with multi-client sync support.

```bash
# Local access
# http://localhost:9383

# LAN access (get IP from Settings)
# Settings → WebBridge to find LAN access address
```

---

## Data Storage

```text
~/.seelelink/
├── connections.json    Connection configs
├── commands.json       Quick commands
├── ir-data.json        IR data
├── config.json         App settings
├── electron.log        Main log
├── debug.log           Debug log
├── logs/<Type>/        Session logs
└── plugins/<id>/       Plugins
```

---

## Protocol Support

| Protocol | Library | Notes |
|----------|---------|-------|
| SSH | `ssh2` | TCP socket |
| Serial | `serialport` | Configurable baud rate |
| PowerShell | `node-pty` | ConPTY pseudoterminal |
| Bash | `node-pty` | MSYS2/Git Bash |
| WebSocket | `ws` | TCP socket |
| Android | `adb` (spawn) | WiFi ADB / USB |
| IR | built-in | Serial or network |

---

## Platform

| Platform | Status |
|----------|--------|
| Windows | ✅ Full |
| macOS | ✅ Build OK / ⚠️ Functionality unverified |
| Linux | ✅ Build OK / ⚠️ Functionality unverified |

---

## License

Mozilla Public License Version 2.0
