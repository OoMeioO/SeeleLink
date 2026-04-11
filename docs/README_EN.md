# SeeleLink ⚡

Unified Connector Tool — SSH, Serial, PowerShell, Bash, WebSocket

## Features

- 🎨 **Modern UI** — Clean interface with dark/light theme support and VSCode-style layout
- 📡 **Multi-Protocol Support** — SSH, Serial, PowerShell, Bash, WebSocket
- 🔄 **Tabbed Interface** — Manage multiple connections simultaneously
- 💾 **Persistent Configuration** — Save connections and quick command buttons
- 🔌 **Control API (TCP JSON)** — Full external control via `127.0.0.1:9380`
- 🤖 **MCP Server (HTTP+SSE)** — AI tool integration via `127.0.0.1:9381`
- 📷 **Window Automation** — Screenshot, mouse click, keyboard input via Control API
- 🐛 **Debug Mode** — Built-in UI event monitor for coordinate discovery
- ⚙️ **Settings UI** — Configure Control API, MCP server, and theme in-app

## Quick Start

### Installation & Development

```bash
npm install
npm run electron:dev      # Development mode (with DevTools)
npm run build            # Build frontend + TypeScript
npm run package         # Package → release/win-unpacked/SeeleLink.exe
```

> ⚠️ **Note:** On some systems, you may need `--disable-hardware-acceleration` flag for proper screenshot functionality.
> ```bash
> npx electron . --disable-hardware-acceleration
> ```

### Documentation

| Document | Description |
|----------|-------------|
| **[docs/index.md](docs/index.md)** | Documentation index |
| **[docs/architecture.md](docs/architecture.md)** | Code architecture & module overview |
| **[docs/api.md](docs/api.md)** | Complete API reference |
| **[config/openclaw.md](config/openclaw.md)** | OpenClaw integration guide |
| **[config/control-api.md](config/control-api.md)** | Control API TCP JSON reference |
| **[config/mcp.md](config/mcp.md)** | MCP Server HTTP+SSE reference |

## Architecture

```
SeeleLink/
├── electron/
│   ├── main.cjs      # Electron main process (IPC, connections, Control API, MCP)
│   └── preload.js    # Preload script (IPC bridge to renderer)
├── src/ui/
│   ├── App.tsx              # Main React component
│   ├── main.tsx             # React entry point
│   ├── index.css            # Global styles (xterm viewport)
│   ├── themes/              # Theme system (dark/light)
│   └── hooks/useThemeStyles.ts  # Theme-aware style objects
├── docs/                      # Documentation
│   ├── index.md            # Doc index
│   ├── architecture.md     # Code architecture
│   ├── modules.md         # Module details
│   └── api.md             # API reference
├── config/                    # External config templates
│   ├── openclaw.md        # OpenClaw integration
│   ├── control-api.md     # Control API details
│   └── mcp.md            # MCP Server details
└── scripts/                    # Debug scripts
```

## Protocol Support

| Protocol | Library | Connection |
|----------|---------|-----------|
| SSH | `ssh2` | TCP socket |
| Serial | `serialport` | COM port |
| PowerShell | `node-pty` | Pseudoterminal |
| Bash | `node-pty` | Pseudoterminal (MSYS2) |
| WebSocket | `ws` | TCP socket |

## External Control APIs

### Control API (TCP JSON) — Port 9380

Send JSON commands over TCP for full control:

```javascript
const net = require('net');
const client = new net.Socket();
client.connect(9380, '127.0.0.1', () => {
  client.write(JSON.stringify({cmd: 'window:capture'}) + '\n');
});
client.on('data', d => {
  console.log(JSON.parse(d.toString()));
  client.end();
});
```

### MCP Server (HTTP+SSE) — Port 9381

Add to OpenClaw config:
```json
{
  "mcpServers": {
    "SeeleLink": { "url": "http://127.0.0.1:9381/mcp" }
  }
}
```

## Window Automation

Control the SeeleLink UI via Control API commands:

```javascript
// Screenshot
const {png} = await cmd('window:capture');

// Click at coordinates
await cmd('window:click', [200, 50]);

// Send keyboard
await cmd('window:sendKeys', ['Enter', 'Ctrl+a']);
```

See [config/control-api.md](config/control-api.md) for the complete command reference.

## Settings

- **Control API** — Enable/configure TCP JSON server
- **MCP Server** — Enable/configure HTTP+SSE server
- **OpenClaw** — Copy integration config to clipboard
- **Theme** — Dark/Light toggle

## Log & Config Files

| File | Path |
|------|------|
| Main log | `~/.seelelink/electron.log` |
| Connections | `~/.seelelink/connections.json` |
| Commands | `~/.seelelink/commands.json` |
| Settings | `~/.seelelink/config.json` |

## Todo

- [ ] Serial port hot-plug detection
- [ ] Connection timeout auto-reconnect
- [ ] Terminal search functionality
- [ ] Connection import/export
- [ ] Connection grouping

## Dependencies

### Production

| Package | Purpose |
|---------|---------|
| `ssh2` | SSH client |
| `serialport` | Serial communication |
| `@xterm/xterm` | Terminal emulator |
| `node-pty` | Pseudoterminal (PS/Bash) |
| `ws` | WebSocket client |
| `@modelcontextprotocol/sdk` | MCP protocol |
| `electron` | Desktop framework |
| `react` | UI framework |

## License

MIT
