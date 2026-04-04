# SeeleLink Control API & MCP Server

> This file is intended for external programs (like OpenClaw) to read and understand how to fully control SeeleLink.
> **Note:** The host and port for both APIs can be configured in SeeleLink's **Settings** tab (⚙️).

---

## Part 1: Control API (TCP JSON)

### Connection

- **Address:** `127.0.0.1:9380` (default — configurable via Settings UI)
- **Protocol:** JSON over TCP, one JSON object per line (newline-terminated)
- **Response format:** `{"ok":true,"result":<value>}` or `{"ok":false,"error":"message"}`

### Command Reference

#### Ping

```json
{"cmd":"ping"}
// -> {"ok":true,"result":"pong"}
```

#### Status

```json
{"cmd":"status"}
// -> {"ok":true,"result":{"ssh":[...],"ps":[...],"cmd":[...],"serial":[...]}}

{"cmd":"list"}
// -> {"ok":true,"result":[{"type":"ps","id":"my-ps-001"},...]}
```

#### PowerShell

```json
{"cmd":"ps:connect","args":["<connId>"]}
{"cmd":"ps:send","args":["<connId>", "command\r"]}
{"cmd":"ps:disconnect","args":["<connId>"]}
```

#### CMD

```json
{"cmd":"cmd:connect","args":["<connId>"]}
{"cmd":"cmd:send","args":["<connId>", "command\r"]}
{"cmd":"cmd:disconnect","args":["<connId>"]}
```

#### SSH

```json
{"cmd":"ssh:connect","args":["<connId>", "<host>", "<username>", "<password>"]}
{"cmd":"ssh:send","args":["<connId>", "command\r"]}
{"cmd":"ssh:disconnect","args":["<connId>"]}
```

#### Serial

```json
{"cmd":"serial:list"}
// -> {"ok":true,"result":["COM1","COM3","COM5"]}

{"cmd":"serial:connect","args":["<connId>", "<port>", "<baudRate>"]}
{"cmd":"serial:send","args":["<connId>", "<data>"]}
{"cmd":"serial:disconnect","args":["<connId>"]}
```

#### WebSocket

```json
// Connect to a WebSocket server
{"cmd":"ws:connect","args":["<connId>", "<url>"]}
// Example: {"cmd":"ws:connect","args":["my-ws-001", "ws://localhost:8080"]}

// Send a message
{"cmd":"ws:send","args":["<connId>", "<data>"]}

// Disconnect
{"cmd":"ws:disconnect","args":["<connId>"]}
```

Note: WebSocket connections are also managed directly through the SeeleLink UI in the **WEBSOCKET** tab. The UI provides a send area (editable textarea) and a receive log (auto-scrolling, read-only display).

#### Application

```json
{"cmd":"quit"}
// -> {"ok":true,"result":"goodbye"}  (closes the entire application)
```

### Node.js Usage Example

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

// Usage
await seelelinkCommand('ping');
await seelelinkCommand('ps:connect', ['my-session-001']);
await seelelinkCommand('ps:send', ['my-session-001', 'Get-Date\r']);
await seelelinkCommand('ps:disconnect', ['my-session-001']);
```

### PowerShell Usage Example

```powershell
# Using Node.js is more reliable (recommended)
node -e "const net=require('net');const c=new net.Socket();c.connect(9380,'127.0.0.1',()=>{c.write(JSON.stringify({cmd:'ping'})+'\n');});c.on('data',d=>{console.log(d.toString());c.end();});"
```

---

## Part 2: MCP Server (HTTP + SSE)

SeeleLink also acts as an **MCP (Model Context Protocol) server**, allowing AI tools like OpenClaw and Claude Desktop to call its tools via the MCP protocol.

### Connection

- **Default Address:** `127.0.0.1:9381` (configurable via Settings UI)
- **Protocol:** HTTP + SSE (Server-Sent Events) + POST
- **Endpoint:** `http://<host>:<port>/mcp`
- **Health Check:** `http://<host>:<port>/health`

### MCP Tools

#### Connection Management

**`list_connections`** — List all active connections
- Arguments: none
- Returns: JSON array of connections

**`ps_connect`** — Connect to PowerShell
- Arguments: `{ id: string }`

**`ps_execute`** — Execute a PowerShell command
- Arguments: `{ id: string, command: string }`

**`ps_disconnect`** — Disconnect PowerShell session
- Arguments: `{ id: string }`

**`cmd_connect`** — Connect to CMD
- Arguments: `{ id: string }`

**`cmd_execute`** — Execute a CMD command
- Arguments: `{ id: string, command: string }`

**`cmd_disconnect`** — Disconnect CMD session
- Arguments: `{ id: string }`

**`ssh_connect`** — Connect to SSH server
- Arguments: `{ id: string, host: string, username: string, password: string }`

**`ssh_execute`** — Execute a SSH command
- Arguments: `{ id: string, command: string }`

**`ssh_disconnect`** — Disconnect SSH session
- Arguments: `{ id: string }`

**`serial_list`** — List available serial ports
- Arguments: none

**`serial_connect`** — Connect to serial port
- Arguments: `{ id: string, port: string, baudRate?: number }` (default baudRate: 115200)

**`serial_send`** — Send data to serial port
- Arguments: `{ id: string, data: string, newline?: boolean }` (newline default: false)

**`serial_disconnect`** — Disconnect serial port
- Arguments: `{ id: string }`

### OpenClaw Configuration

Add this to your OpenClaw config to connect to SeeleLink's MCP server:

```json
{
  "mcpServers": {
    "SeeleLink": {
      "url": "http://127.0.0.1:9381/mcp"
    }
  }
}
```

Or in Claude Desktop's MCP settings:

```json
{
  "mcpServers": {
    "SeeleLink": {
      "command": "node",
      "args": ["-e", "const{Client}=require('@modelcontextprotocol/sdk');new Client().connect(require('@modelcontextprotocol/sdk/client/streamableHttp').streamableHttpClient({url:'http://127.0.0.1:9381/mcp'}));"]
    }
  }
}
```

### MCP Tool Call Example (Node.js)

```javascript
// Using @modelcontextprotocol/sdk
const { Client } = require('@modelcontextprotocol/sdk');
const { streamableHttpClient } = require('@modelcontextprotocol/sdk/client/streamableHttp');

const client = new Client({
  name: 'SeeleLink-Controller',
  version: '1.0.0',
}, { capabilities: { tools: {} } });

await client.connect(streamableHttpClient({ url: 'http://127.0.0.1:9381/mcp' }));

// List available tools
const tools = await client.request({ method: 'tools/list' }, { method: 'tools/list', params: {} });
console.log('Available tools:', tools);

// Call a tool
const result = await client.request({
  method: 'tools/call',
  params: { name: 'ps_connect', arguments: { id: 'my-ps-001' } }
}, { method: 'tools/call', params: { name: 'ps_connect', arguments: { id: 'my-ps-001' } } });
console.log('Result:', result);
```

---

## Log Files

- **Main log:** `C:\Users\<username>\.seelelink\electron.log`
- **Debug log:** `C:\Users\<username>\.seelelink\debug.log` (cleared on every startup)

## Config File

Settings are persisted in: `C:\Users\<username>\.seelelink\config.json`

```json
{
  "controlApi": { "enabled": true, "host": "127.0.0.1", "port": 9380 },
  "mcpApi": { "enabled": false, "host": "127.0.0.1", "port": 9381 }
}
```
