# SeeleLink ⚡ Unified Connector Tool

SSH · Serial · PowerShell · CMD · WebSocket · Android · IR

---

## Features

| Category | Features |
|----------|----------|
| **Multi-Protocol** | SSH (`ssh2`), Serial (`serialport`), PowerShell/CMD (`node-pty`), WebSocket (`ws`), Android ADB, IR infrared |
| **UI/UX** | React + TypeScript, frameless window, dark/light theme, VSCode-style layout, multi-tab |
| **External Control** | Control API (TCP JSON, port 9380), MCP Server (HTTP+SSE, port 9381) |
| **Window Automation** | Screenshot, mouse click/drag, keyboard input (via Control API) |
| **Session Logs** | SSH/Serial/PS/CMD/WebSocket auto-save, ANSI stripping, buffered write |
| **Platform Control** | Cross-platform Mouse/Keyboard/Screen (Windows/Linux/macOS) |
| **Security** | Password AES-256-GCM encryption, shell injection protection, coordinate range validation |
| **Plugin System** | Isolated subprocess plugin architecture (`~/.seelelink/plugins/`) |

---

## Quick Start

```bash
npm install
npm run electron:dev   # Build + launch Electron (development)
npm run build         # Build frontend only
npm run package       # Package → SeeleLink.exe
```

> App launches via `electron/start.cjs`, which automatically clears the `ELECTRON_RUN_AS_NODE` environment variable.

### Screenshot Notes

Background window capture may return a black screen. Solutions:

```bash
npm run electron:dev -- --debug-gpu   # Disable hardware acceleration (recommended)
```

Or configure window capture mode in Settings UI: **auto** / **foreground** / **gdi**

---

## Project Structure

```
SeeleLink/
├── electron/                        # Electron main process
│   ├── main.cjs                    # Main entry (IPC, connections, Control/MCP Server)
│   ├── preload.js                   # contextBridge security bridge
│   ├── controlHandlers.cjs           # Control API command handlers (mouse/keyboard/screenshot)
│   ├── start.cjs                   # Launch script
│   ├── terminal.html               # Standalone terminal window (unused)
│   └── platform/                   # Cross-platform control adapter
│       ├── WindowsControl.cjs       # Win32 GDI / user32 implementation
│       ├── LinuxControl.cjs         # X11 / uinput implementation
│       └── DarwinControl.cjs        # CGEvent / HID implementation
│
├── src/
│   ├── ui/                         # React renderer process
│   │   ├── App.tsx                 # Main component (state, layout, menu, tabs)
│   │   ├── main.tsx                # React entry (createRoot)
│   │   ├── index.css              # Global styles (xterm overrides, scrollbar, animation)
│   │   ├── electronAPI.ts          # TypeScript IPC interface definition
│   │   ├── types.ts               # Global types (SavedConn, Android, Config, etc.)
│   │   ├── components/
│   │   │   ├── AndroidPage.tsx    # Android ADB device list, screenshot, touch control
│   │   │   └── IRPage.tsx         # IR device, command library, sequence execution
│   │   ├── terminal/              # Terminal module
│   │   │   ├── panel/TerminalPanel.tsx   # Tab container (mount-all, CSS display toggle)
│   │   │   ├── core/
│   │   │   │   ├── TerminalCore.tsx       # xterm.js wrapper (forwardRef handle)
│   │   │   │   ├── useTerminalTheme.ts   # flat theme → xterm ANSI 16-color mapping
│   │   │   │   └── types.ts               # TerminalHandle / ProtocolAdapter types
│   │   │   └── protocols/                  # Protocol adapters (SSH/PS/CMD/Serial/WS)
│   │   └── themes/
│   │       ├── theme.ts           # flat theme color tokens + createStyles()
│   │       ├── ThemeProvider.tsx  # ThemeProvider + useTheme() React Context
│   │       └── types.ts           # Theme interface type definitions
│   │
│   ├── core/                       # Core (PluginManager, EventBus, ConnectionStore)
│   ├── services/                   # Services (control/mouse/keyboard/screen/debug)
│   ├── plugins/                    # Plugin system (isolated subprocess)
│   ├── platform/                    # Platform abstraction layer (TypeScript)
│   ├── cli/                        # CLI tool (uc connect/list/status)
│   ├── types/                      # Shared types
│   └── utils/                      # Logger
│
├── docs/                            # Documentation
│   ├── README.md                   # Doc index (Chinese)
│   ├── ARCHITECTURE.md             # Architecture diagrams (9 diagrams)
│   ├── MODULES.md                  # Module details
│   ├── API.md                      # API coverage table
│   ├── CONTROL-API.md              # Control API TCP JSON reference
│   ├── MCP.md                      # MCP Server HTTP+SSE reference
│   ├── OPENCLAW.md                 # OpenClaw integration guide
│   ├── TERMINAL.md                 # Terminal system design
│   ├── IPC.md                     # IPC channel registry
│   ├── DEVELOPMENT.md              # Development guide
│   └── TODO.md                    # Todo list
│
├── scripts/                         # Dev/debug scripts (PowerShell/Node)
├── tests/                            # Automated tests
│   ├── ui-smoke.cjs               # UI smoke test (Playwright)
│   ├── control-api-tcp.cjs       # Control API TCP test
│   └── mcp-api-http.cjs          # MCP Server HTTP test
│
├── package.json
├── vite.config.ts
└── tsconfig.json
```

---

## Protocol Support

| Protocol | Library | Connection | Encoding |
|----------|---------|------------|----------|
| SSH | `ssh2` | TCP socket | UTF-8 |
| Serial | `serialport` | COM port | configurable |
| PowerShell | `node-pty` | Pseudoterminal | GBK→UTF-8 |
| CMD | `node-pty` | Pseudoterminal | GBK→UTF-8 |
| WebSocket | `ws` | TCP socket | UTF-8 |
| Android | `adb` (Node.js spawn) | WiFi ADB / USB | UTF-8 |
| IR | built-in / network / USB | serial or network | — |

---

## External Control APIs

### Control API (TCP JSON) — Port 9380

TCP connection, send JSON commands, JSON response per line:

```javascript
const net = require('net');
const client = new net.Socket();
client.connect(9380, '127.0.0.1', () => {
  client.write(JSON.stringify({ cmd: 'window:capture' }) + '\n');
});
client.on('data', d => {
  console.log(JSON.parse(d.toString()));
  client.end();
});
```

### MCP Server (HTTP+SSE) — Port 9381

Add to OpenClaw config (`~/.openclaw/config.json`):

```json
{
  "mcpServers": {
    "SeeleLink": { "url": "http://127.0.0.1:9381/mcp" }
  }
}
```

Full API reference: [docs/API.md](docs/API.md).

---

## Data Storage

| Data | Path |
|------|------|
| Connections | `~/.seelelink/connections.json` |
| Commands | `~/.seelelink/commands.json` |
| IR Data | `~/.seelelink/ir-data.json` |
| Config | `~/.seelelink/config.json` |
| Main Log | `~/.seelelink/electron.log` |
| Debug Log | `~/.seelelink/debug.log` |
| Session Logs | `~/.seelelink/logs/<Type>/` |
| Plugins | `~/.seelelink/plugins/<id>/` |

---

## Platform Support

| Platform | Status | Notes |
|---------|--------|-------|
| Windows | ✅ Full | All features working |
| macOS | ⚠️ Partial | node-pty needs source compilation |
| Linux | ⚠️ Partial | ADB, node-pty need extra setup |

---

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `electron` | ^30 | Desktop framework |
| `react` / `react-dom` | ^18 | UI framework |
| `@xterm/xterm` + `@xterm/addon-fit` | ^6 / ^0.11 | Terminal emulator |
| `node-pty` | ^1.1 | Pseudoterminal (PS/CMD) |
| `ssh2` | ^1.15 | SSH client |
| `serialport` | ^13 | Serial communication |
| `ws` | ^8 | WebSocket client |
| `@modelcontextprotocol/sdk` | ^1 | MCP protocol implementation |
| `lucide-react` | ^1.7 | Icon library |
| `commander` | ^12 | CLI argument parsing |

---

## License

MIT
