# SeeleLink ⚡

Unified Connector Tool - SSH, Serial, PowerShell, CMD, WebSocket

## Features

- 🎨 **Modern Dark UI** - Clean dark theme interface with xterm.js terminal
- 📡 **Multi-Protocol Support** - SSH, Serial, PowerShell, CMD, WebSocket
- 🔄 **Tabbed Interface** - Manage multiple connections simultaneously
- 💾 **Persistent Configuration** - Save connections and quick command buttons
- 🔌 **Control API (TCP JSON)** - Full external control via `127.0.0.1:9380`
- 🤖 **MCP Server (HTTP+SSE)** - AI tool integration via `127.0.0.1:9381`
- ⚙️ **Settings UI** - Configure Control API and MCP server via Settings tab

> 📖 **OpenClaw Integration**: See [SEELINK_CONTROL.md](SEELINK_CONTROL.md)

## Quick Start

### Development Mode

```bash
npm install
npm run electron:dev
```

### Production Build

```bash
npm run build        # Build frontend
npm run package      # Package Electron app
```

Output: `E:\SeeleLink\release\win-unpacked\SeeleLink.exe`

## Architecture

```
SeeleLink/
├── electron/
│   ├── main.cjs      # Electron main process (IPC handlers, connection management)
│   └── preload.js    # Preload script (IPC bridge to renderer)
├── src/
│   └── ui/
│       └── App.tsx   # React main component
├── dist/             # TypeScript build output
├── dist-electron/    # Vite build output (HTML/JS/CSS)
└── SEELINK_CONTROL.md  # Full API documentation
```

### Core Concepts

- **ConnectionTab** - Each tab is an independent connection instance
- **IPC Bridge** - Main process and renderer communicate via `ipcMain`/`ipcRenderer`
- **node-pty** - PowerShell and CMD use `node-pty` for pseudo-terminal emulation
- **xterm.js** - Terminal emulation in the renderer process

## Supported Features

### SSH ✅
- Connect/disconnect SSH servers
- Multiple tabs (same server can have multiple sessions)
- Independent terminal (each tab has separate input/output)
- Quick Commands (preset command buttons)
- Connection persistence

### Serial ✅
- Connect/disconnect serial ports
- Dynamic COM port enumeration
- Multiple configs per COM port (different baud rates)
- Only one connection per COM port at a time
- Connection persistence

### PowerShell ✅
- Connect/disconnect local PowerShell via `node-pty`
- Command execution with ANSI color support
- Auto-scroll and backspace handling

### CMD ✅
- Connect/disconnect local CMD via `node-pty`
- Command execution with ANSI color support

### WebSocket ✅
- Connect to WebSocket servers
- Send/receive message UI
- Connection persistence

### Control API (TCP JSON) ✅
- **Port:** `9380` (configurable via Settings)
- **Protocol:** JSON over TCP, one object per line
- Full external control for SSH, Serial, PowerShell, CMD, WebSocket
- See [SEELINK_CONTROL.md](SEELINK_CONTROL.md) for complete protocol reference

### MCP Server ✅ (Basic)
- **Port:** `9381` (configurable via Settings, disabled by default)
- **Protocol:** HTTP + SSE (Model Context Protocol)
- Tools for all connection types
- Note: Uses `@modelcontextprotocol/sdk` - requires Node.js ESM support

### Settings Tab ✅
- Control API enable/disable and host/port configuration
- MCP Server enable/disable and host/port configuration
- Copy OpenClaw config button for easy integration

## Todo

- [ ] Serial port hot-plug detection
- [ ] Connection timeout auto-reconnect
- [ ] Terminal search functionality
- [ ] Theme customization
- [ ] Connection import/export
- [ ] Connection grouping

## Dependencies

### Production

| Package | Version | Purpose |
|---------|---------|---------|
| `ssh2` | ^1.15.0 | SSH client |
| `serialport` | ^13.0.0 | Serial communication |
| `@xterm/xterm` | ^6.0.0 | Terminal emulator |
| `@xterm/addon-fit` | ^0.11.0 | Terminal auto-resize |
| `ws` | ^8.16.0 | WebSocket client |
| `node-pty` | ^1.1.0 | Pseudo-terminal (PowerShell/CMD) |
| `@modelcontextprotocol/sdk` | ^1.0.0 | MCP protocol (ESM only) |
| `electron` | ^30.0.0 | Desktop framework |
| `react` | ^18.3.0 | UI framework |

### Development

| Package | Version | Purpose |
|---------|---------|---------|
| `typescript` | ^5.4.0 | TypeScript compilation |
| `vite` | ^5.2.0 | Build tool |
| `@vitejs/plugin-react` | ^4.2.0 | React plugin |
| `electron-builder` | ^24.13.0 | App packaging |
| `tsx` | ^4.7.0 | TypeScript execution |

## Log & Config Files

### Log Files
- **Main log:** `C:\Users\<username>\.seelelink\electron.log`
- **Debug log:** `C:\Users\<username>\.seelelink\debug.log`

### Config Files
- **Connections:** `C:\Users\<username>\.seelelink\connections.json`
- **Commands:** `C:\Users\<username>\.seelelink\commands.json`
- **App Settings:** `C:\Users\<username>\.seelelink\config.json`

## Control API Example

```javascript
const net = require('net');

function seelelinkCommand(cmd, args = []) {
  return new Promise((resolve, reject) => {
    const client = new net.Socket();
    client.connect(9380, '127.0.0.1', () => {
      client.write(JSON.stringify({ cmd, args }) + '\n');
    });
    let data = '';
    client.on('data', d => { data += d.toString(); });
    client.on('end', () => {
      const res = JSON.parse(data.trim());
      if (res.ok) resolve(res.result);
      else reject(new Error(res.error));
      client.destroy();
    });
    client.on('error', reject);
  });
}

await seelelinkCommand('ping');
await seelelinkCommand('ps:connect', ['my-session']);
await seelelinkCommand('ps:send', ['my-session', 'Get-Date\r']);
```

## OpenClaw Integration

Add to your OpenClaw config:

```json
{
  "mcpServers": {
    "SeeleLink": {
      "url": "http://127.0.0.1:9381/mcp"
    }
  }
}
```

Or use the Control API directly in a ClawFlow skill.

See [SEELINK_CONTROL.md](SEELINK_CONTROL.md) for complete documentation.

## License

MIT
