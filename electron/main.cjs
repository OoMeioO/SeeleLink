const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { fork } = require('child_process');
const fs = require('fs');
const os = require('os');
const net = require('net');

// ============================================================
// Config Management
// ============================================================
const configFilePath = path.join(os.homedir(), '.seelelink', 'config.json');
const defaultConfig = {
  controlApi: { enabled: true, host: '127.0.0.1', port: 9380 },
  mcpApi: { enabled: false, host: '127.0.0.1', port: 9381 }
};

function loadConfig() {
  try {
    if (fs.existsSync(configFilePath)) {
      return JSON.parse(fs.readFileSync(configFilePath, 'utf-8'));
    }
  } catch (e) {}
  return JSON.parse(JSON.stringify(defaultConfig));
}

function saveConfig(cfg) {
  try {
    const dir = path.dirname(configFilePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(configFilePath, JSON.stringify(cfg, null, 2));
  } catch (e) { log('Save config error:', e.message); }
}

let appConfig = loadConfig();

// ============================================================
// Log (logFile defined early to avoid TDZ)
// ============================================================
const logFile = path.join(os.homedir(), '.seelelink', 'electron.log');
const debugLogFile = path.join(os.homedir(), '.seelelink', 'debug.log');

function log(...args) {
  const msg = new Date().toISOString() + ' ' + args.join(' ');
  console.log(msg);
  try {
    const dir = path.dirname(logFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(logFile, msg + '\n');
    fs.appendFileSync(debugLogFile, msg + '\n');
  } catch (e) { console.error('log error:', e); }
}

// Use node-pty for proper PTY support (required for interactive PowerShell)
let nodePty;
try {
  nodePty = require('node-pty');
  log('node-pty loaded successfully');
} catch (e) {
  log('node-pty load failed:', e.message);
}

let mainWindow;
let psProcess;

// Multiple SSH connections support - map of connection id -> { client, stream }
const sshConnections = new Map();

// Serial connections - Map of port name -> { port, connId, config }
const serialConnections = new Map();

// PowerShell connections - Map of connId -> { pty }
const psConnections = new Map();

// CMD connections - Map of connId -> { pty }
const cmdConnections = new Map();

// WebSocket connections - Map of connId -> { ws, url }
const wsConnections = new Map();

let executeCount = 0;
let streamWriteCount = 0;

function createWindow() {
  // Clear debug log on startup
  try { fs.writeFileSync(debugLogFile, ''); } catch (e) {}

  log('Creating window');
  mainWindow = new BrowserWindow({
    width: 1200, height: 800, minWidth: 900, minHeight: 600,
    frame: true, backgroundColor: '#1e1e1e',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist-electron/index.html'));
  }

  mainWindow.webContents.on('crashed', () => { log('Renderer crashed'); });
  mainWindow.webContents.on('render-process-gone', (_, details) => { log('Renderer process gone:', details.reason); });
  mainWindow.on('closed', () => { log('Window closed'); mainWindow = null; });
  log('Window created');
}

// ============================================================
// Control API Server (TCP, dynamic start/stop)
// ============================================================
let controlServer = null;

function startControlServer(cfg) {
  if (controlServer) {
    try { controlServer.close(); } catch (e) {}
    controlServer = null;
  }
  if (!cfg || !cfg.enabled) { log('Control API: disabled'); return; }

  const server = net.createServer((socket) => {
    const remoteAddr = socket.remoteAddress;
    log('Control API: client connected from', remoteAddr);
    let buffer = '';
    socket.on('data', (data) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const req = JSON.parse(line);
          const result = handleControlCommand(req);
          socket.write(JSON.stringify({ ok: true, result }) + '\n');
        } catch (e) {
          socket.write(JSON.stringify({ ok: false, error: e.message }) + '\n');
        }
      }
    });
    socket.on('error', (e) => { log('Control API: socket error:', e.message); });
    socket.on('close', () => { log('Control API: client disconnected'); });
  });

  server.on('error', (e) => { log('Control API server error:', e.message); });
  server.listen(cfg.port, cfg.host, () => {
    log('Control API server listening on ' + cfg.host + ':' + cfg.port);
  });
  controlServer = server;
}

function stopControlServer() {
  if (controlServer) {
    try { controlServer.close(); } catch (e) {}
    controlServer = null;
    log('Control API server stopped');
  }
}

function findAvailablePort(host, startPort, callback) {
  const server = net.createServer();
  server.listen(startPort, host, () => {
    const port = server.address().port;
    server.close(() => callback(port));
  });
  server.on('error', () => {
    if (startPort < 65535) findAvailablePort(host, startPort + 1, callback);
    else callback(null);
  });
}

// ============================================================
// ============================================================
// MCP Server (HTTP + SSE, native implementation)
// ============================================================
let mcpHttpServer = null;
let mcpSseClients = new Map(); // sessionId -> response
const mcpRequestIdCounter = { value: 1 };

function sendSseEvent(res, event) {
  if (!res || res.writableEnded) return;
  try {
    res.write('event: message\n');
    res.write('data: ' + JSON.stringify(event) + '\n\n');
  } catch (e) {}
}

function buildMcpTools() {
  return [
    {
      name: 'list_connections',
      description: 'List all active SeeleLink connections',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'ps_connect',
      description: 'Connect to PowerShell',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Connection ID' },
        },
        required: ['id'],
      },
    },
    {
      name: 'ps_execute',
      description: 'Execute a PowerShell command',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Connection ID' },
          command: { type: 'string', description: 'PowerShell command' },
        },
        required: ['id', 'command'],
      },
    },
    {
      name: 'ps_disconnect',
      description: 'Disconnect PowerShell session',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Connection ID' },
        },
        required: ['id'],
      },
    },
    {
      name: 'cmd_connect',
      description: 'Connect to CMD',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Connection ID' },
        },
        required: ['id'],
      },
    },
    {
      name: 'cmd_execute',
      description: 'Execute a CMD command',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Connection ID' },
          command: { type: 'string', description: 'CMD command' },
        },
        required: ['id', 'command'],
      },
    },
    {
      name: 'cmd_disconnect',
      description: 'Disconnect CMD session',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Connection ID' },
        },
        required: ['id'],
      },
    },
    {
      name: 'ssh_connect',
      description: 'Connect to SSH server',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Connection ID' },
          host: { type: 'string', description: 'SSH host' },
          username: { type: 'string', description: 'Username' },
          password: { type: 'string', description: 'Password' },
        },
        required: ['id', 'host', 'username'],
      },
    },
    {
      name: 'ssh_execute',
      description: 'Execute a SSH command',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Connection ID' },
          command: { type: 'string', description: 'Command to execute' },
        },
        required: ['id', 'command'],
      },
    },
    {
      name: 'ssh_disconnect',
      description: 'Disconnect SSH session',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Connection ID' },
        },
        required: ['id'],
      },
    },
    {
      name: 'serial_list',
      description: 'List available serial ports',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'serial_connect',
      description: 'Connect to serial port',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Connection ID' },
          port: { type: 'string', description: 'Serial port (e.g. COM3)' },
          baudRate: { type: 'number', description: 'Baud rate', default: 115200 },
        },
        required: ['id', 'port'],
      },
    },
    {
      name: 'serial_send',
      description: 'Send data to serial port',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Connection ID' },
          data: { type: 'string', description: 'Data to send' },
          newline: { type: 'boolean', description: 'Append newline', default: false },
        },
        required: ['id', 'data'],
      },
    },
    {
      name: 'serial_disconnect',
      description: 'Disconnect serial port',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Connection ID' },
        },
        required: ['id'],
      },
    },
  ];
}

async function startMcpServer(cfg) {
  if (mcpServer) {
    try { mcpServer.close(); } catch (e) {}
    mcpServer = null;
  }
  if (!cfg || !cfg.enabled) { log('MCP server: disabled'); return; }

  try {
    const http = require('http');
    // Try multiple import strategies for StreamableHTTPServerTransport
    let Server;
    try {
      const mcpSdk = require('@modelcontextprotocol/sdk');
      Server = mcpSdk.Server;
    } catch (e1) {
      try {
        Server = require('@modelcontextprotocol/sdk/server/streamableHttp').Server;
      } catch (e2) {
        try {
          // Direct path fallback
          Server = require('E:/SeeleLink/release/win-unpacked/resources/app/node_modules/@modelcontextprotocol/sdk/dist/cjs/server/streamableHttp').Server;
        } catch (e3) {
          log('MCP Server import failed:', e3.message);
          return;
        }
      }
    }

    const transport = new Server({
      name: 'SeeleLink',
      version: '0.1.0',
    }, {
      capabilities: {
        tools: {},
      },
    });

    // Register tools
    transport.setRequestHandler({ method: 'tools/list' }, async () => ({
      tools: buildMcpTools(),
    }));

    transport.setRequestHandler({ method: 'tools/call' }, async (req) => {
      const { name, arguments: args } = req.params;
      log('MCP tool call:', name, JSON.stringify(args));

      try {
        switch (name) {
          case 'list_connections': {
            const results = [];
            for (const [id] of sshConnections) results.push({ type: 'ssh', id });
            for (const [id] of psConnections) results.push({ type: 'ps', id });
            for (const [id] of cmdConnections) results.push({ type: 'cmd', id });
            for (const [port, info] of serialConnections) results.push({ type: 'serial', id: port, connId: info.connId });
            return { content: [{ type: 'text', text: JSON.stringify(results) }] };
          }

          case 'ps_connect': {
            if (!nodePty) return { content: [{ type: 'text', text: 'node-pty not available' }], isError: true };
            if (psConnections.has(args.id)) return { content: [{ type: 'text', text: 'already connected' }] };
            const pty = nodePty.spawn('powershell.exe', ['-NoLogo', '-NoExit', '-ExecutionPolicy', 'Bypass'], {
              name: 'xterm-256color', cols: 120, rows: 30, cwd: os.homedir(), env: process.env, conpty: true,
            });
            pty.onData((data) => { if (mainWindow) mainWindow.webContents.send('ps:data:' + args.id, data); });
            pty.onExit(() => {
              psConnections.delete(args.id);
              if (mainWindow) mainWindow.webContents.send('ps:data:' + args.id, '\r\n[PowerShell exited]\r\n');
            });
            psConnections.set(args.id, { pty });
            return { content: [{ type: 'text', text: 'PowerShell connected [' + args.id + ']' }] };
          }

          case 'ps_execute': {
            const conn = psConnections.get(args.id);
            if (!conn) return { content: [{ type: 'text', text: 'not connected' }], isError: true };
            const cmdText = args.command + '\r';
            conn.pty.write(cmdText);
            return { content: [{ type: 'text', text: 'executed' }] };
          }

          case 'ps_disconnect': {
            const conn = psConnections.get(args.id);
            if (conn) { try { conn.pty.kill(); } catch (e) {} psConnections.delete(args.id); }
            return { content: [{ type: 'text', text: 'disconnected' }] };
          }

          case 'cmd_connect': {
            if (!nodePty) return { content: [{ type: 'text', text: 'node-pty not available' }], isError: true };
            if (cmdConnections.has(args.id)) return { content: [{ type: 'text', text: 'already connected' }] };
            const pty = nodePty.spawn('cmd.exe', [], {
              name: 'xterm-256color', cols: 120, rows: 30, cwd: os.homedir(), env: process.env, conpty: true,
            });
            pty.onData((data) => { if (mainWindow) mainWindow.webContents.send('cmd:data:' + args.id, data); });
            pty.onExit(() => {
              cmdConnections.delete(args.id);
              if (mainWindow) mainWindow.webContents.send('cmd:data:' + args.id, '\r\n[Command Prompt exited]\r\n');
            });
            cmdConnections.set(args.id, { pty });
            return { content: [{ type: 'text', text: 'CMD connected [' + args.id + ']' }] };
          }

          case 'cmd_execute': {
            const conn = cmdConnections.get(args.id);
            if (!conn) return { content: [{ type: 'text', text: 'not connected' }], isError: true };
            conn.pty.write(args.command + '\r');
            return { content: [{ type: 'text', text: 'executed' }] };
          }

          case 'cmd_disconnect': {
            const conn = cmdConnections.get(args.id);
            if (conn) { try { conn.pty.kill(); } catch (e) {} cmdConnections.delete(args.id); }
            return { content: [{ type: 'text', text: 'disconnected' }] };
          }

          case 'ssh_connect': {
            if (sshConnections.has(args.id)) return { content: [{ type: 'text', text: 'already connected' }] };
            return new Promise((resolve) => {
              const { Client } = require('ssh2');
              const client = new Client();
              client.on('ready', () => {
                client.shell((err, stream) => {
                  if (err) { resolve({ content: [{ type: 'text', text: 'Shell error: ' + err.message }], isError: true }); return; }
                  stream.on('data', (data) => { if (mainWindow) mainWindow.webContents.send('ssh:data:' + args.id, data.toString()); });
                  stream.stderr.on('data', (data) => { if (mainWindow) mainWindow.webContents.send('ssh:data:' + args.id, data.toString()); });
                  stream.on('close', () => { sshConnections.delete(args.id); if (mainWindow) mainWindow.webContents.send('ssh:data:' + args.id, '[Connection closed]\n'); });
                  sshConnections.set(args.id, { client, stream });
                });
                if (mainWindow) mainWindow.webContents.send('ssh:data:' + args.id, '[Connected to ' + args.host + ']\n');
                resolve({ content: [{ type: 'text', text: 'SSH connected to ' + args.host + ' [' + args.id + ']' }] });
              });
              client.on('error', (err) => { sshConnections.delete(args.id); resolve({ content: [{ type: 'text', text: err.message }], isError: true }); });
              client.on('close', () => sshConnections.delete(args.id));
              client.connect({ host: args.host, port: 22, username: args.username, password: args.password, readyTimeout: 20000 });
            });
          }

          case 'ssh_execute': {
            const conn = sshConnections.get(args.id);
            if (!conn) return { content: [{ type: 'text', text: 'not connected' }], isError: true };
            conn.stream.write(args.command + '\r');
            return { content: [{ type: 'text', text: 'executed' }] };
          }

          case 'ssh_disconnect': {
            const conn = sshConnections.get(args.id);
            if (conn) { try { conn.client.end(); } catch (e) {} sshConnections.delete(args.id); }
            return { content: [{ type: 'text', text: 'disconnected' }] };
          }

          case 'serial_list': {
            try {
              const { SerialPort } = require('serialport');
              const ports = await SerialPort.list();
              const comPorts = ports.map(p => p.path).filter(p => p.startsWith('COM'));
              return { content: [{ type: 'text', text: comPorts.join('\n') || 'No COM ports found' }] };
            } catch (e) {
              return { content: [{ type: 'text', text: 'Error: ' + e.message }], isError: true };
            }
          }

          case 'serial_connect': {
            if (serialConnections.has(args.port)) return { content: [{ type: 'text', text: 'port in use' }], isError: true };
            return new Promise((resolve) => {
              try {
                const { SerialPort } = require('serialport');
                const sp = new SerialPort({ path: args.port, baudRate: parseInt(args.baudRate) || 115200, dataBits: 8, parity: 'none', stopBits: 1 });
                sp.on('open', () => {
                  serialConnections.set(args.port, { port: sp, connId: args.id, baudRate: args.baudRate });
                  if (mainWindow) mainWindow.webContents.send('serial:data:' + args.id, '[Connected to ' + args.port + ' at ' + args.baudRate + ']\r\n');
                  resolve({ content: [{ type: 'text', text: 'Serial ' + args.port + ' connected [' + args.id + ']' }] });
                });
                sp.on('data', (data) => { if (mainWindow) mainWindow.webContents.send('serial:data:' + args.id, data.toString()); });
                sp.on('error', (e) => { if (mainWindow) mainWindow.webContents.send('serial:data:' + args.id, '[Error] ' + e.message + '\r\n'); });
                sp.on('close', () => { serialConnections.delete(args.port); if (mainWindow) mainWindow.webContents.send('serial:data:' + args.id, '[Disconnected]\r\n'); });
              } catch (e) { resolve({ content: [{ type: 'text', text: e.message }], isError: true }); }
            });
          }

          case 'serial_send': {
            let foundPort = null;
            for (const [port, info] of serialConnections) { if (info.connId === args.id) { foundPort = port; break; } }
            if (!foundPort) return { content: [{ type: 'text', text: 'not connected' }], isError: true };
            const data = args.newline ? args.data + '\r\n' : args.data;
            serialConnections.get(foundPort).port.write(data);
            return { content: [{ type: 'text', text: 'sent' }] };
          }

          case 'serial_disconnect': {
            for (const [port, info] of serialConnections) {
              if (info.connId === args.id) { info.port.close(); serialConnections.delete(port); break; }
            }
            return { content: [{ type: 'text', text: 'disconnected' }] };
          }

          default:
            return { content: [{ type: 'text', text: 'Unknown tool: ' + name }], isError: true };
        }
      } catch (err) {
        return { content: [{ type: 'text', text: err.message }], isError: true };
      }
    });

    // HTTP server for MCP
    const server = http.createServer((req, res) => {
      // CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, MCP-Session-ID');
      if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', service: 'SeeleLink MCP' }));
        return;
      }

      // Let MCP transport handle the rest
      transport.handleRequest(req, res);
    });

    server.on('error', (e) => { log('MCP HTTP server error:', e.message); });
    server.listen(cfg.port, cfg.host, () => {
      log('MCP server listening on ' + cfg.host + ':' + cfg.port + ' (HTTP+SSE)');
    });

    mcpServer = transport;
    mcpHttpServer = server;
  } catch (e) {
    log('MCP server start error:', e.message);
  }
}

function stopMcpServer() {
  if (mcpHttpServer) {
    try { mcpHttpServer.close(); } catch (e) {}
    mcpHttpServer = null;
  }
  if (mcpServer) {
    try { mcpServer.close(); } catch (e) {}
    mcpServer = null;
    log('MCP server stopped');
  }
}

// ============================================================
// Control API Command Handler
// ============================================================
function handleControlCommand(req) {
  const { cmd, args = [] } = req;

  switch (cmd) {
    case 'ping': return 'pong';

    case 'status': {
      return {
        ssh: Array.from(sshConnections.keys()),
        ps: Array.from(psConnections.keys()),
        cmd: Array.from(cmdConnections.keys()),
        serial: Array.from(serialConnections.keys()).map(k => ({ port: k, connId: serialConnections.get(k).connId })),
        ws: Array.from(wsConnections.keys()).map(id => ({ id, url: wsConnections.get(id).url })),
      };
    }

    case 'list': {
      const results = [];
      for (const [id] of sshConnections) results.push({ type: 'ssh', id });
      for (const [id] of psConnections) results.push({ type: 'ps', id });
      for (const [id] of cmdConnections) results.push({ type: 'cmd', id });
      for (const [port, info] of serialConnections) results.push({ type: 'serial', id: port, connId: info.connId });
      for (const [id] of wsConnections) results.push({ type: 'ws', id, url: wsConnections.get(id).url });
      return results;
    }

    case 'serial:list': {
      return new Promise((resolve) => {
        const { SerialPort } = require('serialport');
        SerialPort.list().then(ports => {
          resolve(ports.map(p => p.path).filter(p => p.startsWith('COM')));
        }).catch(() => resolve([]));
      });
    }

    case 'ps:connect': {
      const [connId] = args;
      if (!nodePty) return 'node-pty not available';
      if (psConnections.has(connId)) return 'already connected';
      const pty = nodePty.spawn('powershell.exe', ['-NoLogo', '-NoExit', '-ExecutionPolicy', 'Bypass'], {
        name: 'xterm-256color', cols: 120, rows: 30, cwd: os.homedir(), env: process.env, conpty: true,
      });
      pty.onData((data) => { if (mainWindow) mainWindow.webContents.send('ps:data:' + connId, data); });
      pty.onExit(() => {
        psConnections.delete(connId);
        if (mainWindow) mainWindow.webContents.send('ps:data:' + connId, '\r\n[PowerShell exited]\r\n');
      });
      psConnections.set(connId, { pty, connId });
      return 'connected';
    }

    case 'ps:send': {
      const [connId, cmdText] = args;
      const conn = psConnections.get(connId);
      if (!conn) return 'not connected';
      conn.pty.write(cmdText);
      return 'executed';
    }

    case 'ps:disconnect': {
      const [connId] = args;
      const conn = psConnections.get(connId);
      if (conn) { try { conn.pty.kill(); } catch (e) {} psConnections.delete(connId); }
      return 'disconnected';
    }

    case 'cmd:connect': {
      const [connId] = args;
      if (!nodePty) return 'node-pty not available';
      if (cmdConnections.has(connId)) return 'already connected';
      const pty = nodePty.spawn('cmd.exe', [], {
        name: 'xterm-256color', cols: 120, rows: 30, cwd: os.homedir(), env: process.env, conpty: true,
      });
      pty.onData((data) => { if (mainWindow) mainWindow.webContents.send('cmd:data:' + connId, data); });
      pty.onExit(() => {
        cmdConnections.delete(connId);
        if (mainWindow) mainWindow.webContents.send('cmd:data:' + connId, '\r\n[Command Prompt exited]\r\n');
      });
      cmdConnections.set(connId, { pty, connId });
      return 'connected';
    }

    case 'cmd:send': {
      const [connId, cmdText] = args;
      const conn = cmdConnections.get(connId);
      if (!conn) return 'not connected';
      conn.pty.write(cmdText);
      return 'executed';
    }

    case 'cmd:disconnect': {
      const [connId] = args;
      const conn = cmdConnections.get(connId);
      if (conn) { try { conn.pty.kill(); } catch (e) {} cmdConnections.delete(connId); }
      return 'disconnected';
    }

    case 'ssh:connect': {
      const [connId, host, username, password] = args;
      return new Promise((resolve, reject) => {
        if (sshConnections.has(connId)) return resolve('already connected');
        const { Client } = require('ssh2');
        const client = new Client();
        client.on('ready', () => {
          client.shell((err, stream) => {
            if (err) { reject(err); return; }
            stream.on('data', (data) => { if (mainWindow) mainWindow.webContents.send('ssh:data:' + connId, data.toString()); });
            stream.stderr.on('data', (data) => { if (mainWindow) mainWindow.webContents.send('ssh:data:' + connId, data.toString()); });
            stream.on('close', () => {
              sshConnections.delete(connId);
              if (mainWindow) mainWindow.webContents.send('ssh:data:' + connId, '[Connection closed]\n');
            });
            sshConnections.set(connId, { client, stream });
            if (mainWindow) mainWindow.webContents.send('ssh:data:' + connId, '[Connected to ' + host + ']\n');
            resolve('connected');
          });
        });
        client.on('error', (err) => { sshConnections.delete(connId); reject(err); });
        client.on('close', () => sshConnections.delete(connId));
        client.connect({ host, port: 22, username, password, readyTimeout: 20000 });
      });
    }

    case 'ssh:send': {
      const [connId, cmdText] = args;
      const conn = sshConnections.get(connId);
      if (!conn) return 'not connected';
      conn.stream.write(cmdText);
      return 'executed';
    }

    case 'ssh:disconnect': {
      const [connId] = args;
      const conn = sshConnections.get(connId);
      if (conn) { try { conn.client.end(); } catch (e) {} sshConnections.delete(connId); }
      return 'disconnected';
    }

    case 'serial:connect': {
      const [connId, port, baudRate = 115200] = args;
      if (serialConnections.has(port)) return 'port in use';
      return new Promise((resolve, reject) => {
        try {
          const { SerialPort } = require('serialport');
          const sp = new SerialPort({ path: port, baudRate: parseInt(baudRate), dataBits: 8, parity: 'none', stopBits: 1 });
          sp.on('open', () => {
            serialConnections.set(port, { port: sp, connId, baudRate });
            if (mainWindow) mainWindow.webContents.send('serial:data:' + connId, '[Connected to ' + port + ' at ' + baudRate + ']\r\n');
            resolve('connected');
          });
          sp.on('data', (data) => { if (mainWindow) mainWindow.webContents.send('serial:data:' + connId, data.toString()); });
          sp.on('error', (e) => { if (mainWindow) mainWindow.webContents.send('serial:data:' + connId, '[Error] ' + e.message + '\r\n'); });
          sp.on('close', () => {
            serialConnections.delete(port);
            if (mainWindow) mainWindow.webContents.send('serial:data:' + connId, '[Disconnected]\r\n');
          });
        } catch (e) { reject(e); }
      });
    }

    case 'serial:send': {
      const [connId, data] = args;
      for (const [, info] of serialConnections) {
        if (info.connId === connId) { info.port.write(data); return 'executed'; }
      }
      return 'not connected';
    }

    case 'serial:disconnect': {
      const [connId] = args;
      for (const [port, info] of serialConnections) {
        if (info.connId === connId) { info.port.close(); serialConnections.delete(port); return 'disconnected'; }
      }
      return 'not found';
    }

    case 'ws:connect': {
      const [connId, url] = args;
      if (wsConnections.has(connId)) return 'already connected';
      return new Promise((resolve, reject) => {
        try {
          const WebSocket = require('ws');
          const ws = new WebSocket(url);
          ws.on('open', () => {
            wsConnections.set(connId, { ws, url });
            resolve('connected');
          });
          ws.on('message', (data) => { /* handled by IPC to renderer */ });
          ws.on('error', (e) => { reject(new Error(e.message)); });
          ws.on('close', () => { wsConnections.delete(connId); });
          const timeout = setTimeout(() => { ws.terminate(); reject(new Error('connection timeout')); }, 10000);
          ws.on('open', () => clearTimeout(timeout));
          ws.on('error', () => clearTimeout(timeout));
        } catch (e) { reject(e); }
      });
    }

    case 'ws:send': {
      const [connId, data] = args;
      const conn = wsConnections.get(connId);
      if (!conn) return 'not connected';
      if (conn.ws.readyState !== 1) return 'not open';
      try { conn.ws.send(data); return 'sent'; } catch (e) { return 'error: ' + e.message; }
    }

    case 'ws:disconnect': {
      const [connId] = args;
      const conn = wsConnections.get(connId);
      if (conn) { try { conn.ws.close(); } catch (e) {} wsConnections.delete(connId); }
      return 'disconnected';
    }

    case 'quit': { app.quit(); return 'goodbye'; }

    default: throw new Error('Unknown command: ' + cmd);
  }
}

// ============================================================
// App Lifecycle
// ============================================================
app.whenReady().then(() => {
  log('App ready');
  createWindow();
  startControlServer(appConfig.controlApi);
  startMcpServer(appConfig.mcpApi);
});

app.on('window-all-closed', () => {
  log('Window all closed');
  if (psProcess) psProcess.kill();
  for (const [id, conn] of sshConnections) { try { conn.client.end(); } catch (e) {} }
  sshConnections.clear();
  stopControlServer();
  stopMcpServer();
  app.quit();
});

// ============================================================
// Connection Store Helpers
// ============================================================
const connFilePath = path.join(os.homedir(), '.seelelink', 'connections.json');

function loadConnections() {
  try {
    if (fs.existsSync(connFilePath)) return JSON.parse(fs.readFileSync(connFilePath, 'utf-8'));
  } catch (e) { log('Load conns error:', e); }
  return [];
}

function saveConnections(conns) {
  try {
    const dir = path.dirname(connFilePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(connFilePath, JSON.stringify(conns, null, 2));
  } catch (e) { log('Save conns error:', e); }
}

// ============================================================
// IPC Handlers
// ============================================================

// PowerShell
ipcMain.handle('ps:connect', async (event, { connId }) => {
  log('PS connect requested:', connId);
  if (!nodePty) return 'node-pty not available';
  if (psConnections.has(connId)) return 'already connected';
  try {
    const pty = nodePty.spawn('powershell.exe', ['-NoLogo', '-NoExit', '-ExecutionPolicy', 'Bypass'], {
      name: 'xterm-256color', cols: 120, rows: 30, cwd: os.homedir(), env: process.env, conpty: true,
    });
    pty.onData((data) => { if (mainWindow) mainWindow.webContents.send('ps:data:' + connId, data); });
    pty.onExit(() => {
      psConnections.delete(connId);
      if (mainWindow) mainWindow.webContents.send('ps:data:' + connId, '\r\n[PowerShell exited]\r\n');
    });
    psConnections.set(connId, { pty, connId });
    log('PS pty spawned, pid:', pty.pid);
    return 'connected';
  } catch (e) { log('PS pty spawn error:', e.message); return 'error: ' + e.message; }
});

ipcMain.handle('ps:execute', async (event, { connId, cmd }) => {
  log('PS execute for', connId, ':', JSON.stringify(cmd));
  const conn = psConnections.get(connId);
  if (conn && conn.pty) {
    try { conn.pty.write(cmd); log('PS execute: written ok'); return 'executed'; }
    catch (e) { log('PS execute error:', e.message); return 'error: ' + e.message; }
  }
  return 'not connected';
});

ipcMain.handle('ps:disconnect', async (event, connId) => {
  log('PS disconnect:', connId);
  const conn = psConnections.get(connId);
  if (conn && conn.pty) { try { conn.pty.kill(); } catch (e) {} psConnections.delete(connId); }
  return 'disconnected';
});

// CMD
ipcMain.handle('cmd:connect', async (event, { connId }) => {
  log('CMD connect requested:', connId);
  if (!nodePty) return 'node-pty not available';
  if (cmdConnections.has(connId)) return 'already connected';
  try {
    const pty = nodePty.spawn('cmd.exe', [], {
      name: 'xterm-256color', cols: 120, rows: 30, cwd: os.homedir(), env: process.env, conpty: true,
    });
    pty.onData((data) => { if (mainWindow) mainWindow.webContents.send('cmd:data:' + connId, data); });
    pty.onExit(() => {
      cmdConnections.delete(connId);
      if (mainWindow) mainWindow.webContents.send('cmd:data:' + connId, '\r\n[Command Prompt exited]\r\n');
    });
    cmdConnections.set(connId, { pty, connId });
    log('CMD pty spawned, pid:', pty.pid);
    return 'connected';
  } catch (e) { log('CMD pty spawn error:', e.message); return 'error: ' + e.message; }
});

ipcMain.handle('cmd:execute', async (event, { connId, cmd }) => {
  log('CMD execute for', connId, ':', JSON.stringify(cmd));
  const conn = cmdConnections.get(connId);
  if (conn && conn.pty) {
    try { conn.pty.write(cmd); log('CMD execute: written ok'); return 'executed'; }
    catch (e) { log('CMD execute error:', e.message); return 'error: ' + e.message; }
  }
  return 'not connected';
});

ipcMain.handle('cmd:disconnect', async (event, connId) => {
  log('CMD disconnect:', connId);
  const conn = cmdConnections.get(connId);
  if (conn && conn.pty) { try { conn.pty.kill(); } catch (e) {} cmdConnections.delete(connId); }
  return 'disconnected';
});

// Serial
ipcMain.handle('serial:connect', async (event, { connId, port, baudRate }) => {
  log('Serial connect requested:', connId, port, baudRate);
  if (serialConnections.has(port)) return 'port in use';
  return new Promise(async (resolve, reject) => {
    try {
      const { SerialPort } = require('serialport');
      const serialPort = new SerialPort({
        path: port, baudRate: parseInt(baudRate) || 115200, dataBits: 8, parity: 'none', stopBits: 1,
      });
      serialConnections.set(port, { port: serialPort, connId, baudRate });
      serialPort.on('open', () => {
        log('Serial connected to', port);
        if (mainWindow) mainWindow.webContents.send('serial:data:' + connId, '[Connected to ' + port + ' at ' + baudRate + ']\r\n');
        resolve('connected');
      });
      serialPort.on('data', (data) => { if (mainWindow) mainWindow.webContents.send('serial:data:' + connId, data.toString()); });
      serialPort.on('error', (err) => {
        log('Serial error on', port, ':', err.message);
        if (mainWindow) mainWindow.webContents.send('serial:data:' + connId, '[Error] ' + err.message + '\r\n');
      });
      serialPort.on('close', () => {
        log('Serial closed on', port);
        serialConnections.delete(port);
        if (mainWindow) mainWindow.webContents.send('serial:data:' + connId, '[Disconnected]\r\n');
      });
    } catch (e) { log('Serial connect error:', e.message); serialConnections.delete(port); reject(e); }
  });
});

ipcMain.handle('serial:execute', async (event, { connId, data }) => {
  log('Serial execute for', connId, ':', JSON.stringify(data));
  let foundPort = null;
  for (const [port, info] of serialConnections) { if (info.connId === connId) { foundPort = port; break; } }
  if (!foundPort) return 'not connected';
  try { serialConnections.get(foundPort).port.write(data); log('Serial execute: written ok'); }
  catch (e) { log('Serial execute error:', e.message); }
  return 'executed';
});

ipcMain.handle('serial:disconnect', async (event, connId) => {
  log('Serial disconnect for', connId);
  for (const [port, info] of serialConnections) {
    if (info.connId === connId) { info.port.close(); serialConnections.delete(port); break; }
  }
  return 'disconnected';
});

ipcMain.handle('serial:list', async () => {
  log('Serial list requested');
  try {
    const { SerialPort } = require('serialport');
    const ports = await SerialPort.list();
    return ports.map(p => p.path).filter(p => p.startsWith('COM'));
  } catch (e) { log('Serial list error:', e.message); return []; }
});

// SSH
ipcMain.handle('ssh:connect', async (event, { connId, host, username, password }) => {
  log('SSH connect requested:', connId, host, username);
  if (sshConnections.has(connId)) return 'already connected';
  return new Promise((resolve, reject) => {
    try {
      const { Client } = require('ssh2');
      const client = new Client();
      client.on('ready', () => {
        log('SSH ready for', connId);
        client.shell((err, stream) => {
          if (err) { log('SSH shell error for', connId, ':', err.message); if (mainWindow) mainWindow.webContents.send('ssh:data:' + connId, '[Shell Error] ' + err.message + '\r\n'); return; }
          stream.on('data', (data) => { if (mainWindow) mainWindow.webContents.send('ssh:data:' + connId, data.toString()); });
          stream.stderr.on('data', (data) => { if (mainWindow) mainWindow.webContents.send('ssh:data:' + connId, data.toString()); });
          stream.on('close', () => {
            sshConnections.delete(connId);
            if (mainWindow) mainWindow.webContents.send('ssh:data:' + connId, '[Connection closed]\r\n');
          });
          sshConnections.set(connId, { client, stream });
        });
        if (mainWindow) mainWindow.webContents.send('ssh:data:' + connId, '[Connected to ' + host + ']\r\n');
        resolve('connected');
      });
      client.on('error', (err) => { log('SSH error for', connId, ':', err.message); if (mainWindow) mainWindow.webContents.send('ssh:data:' + connId, '[Error] ' + err.message + '\r\n'); sshConnections.delete(connId); reject(err); });
      client.on('close', () => sshConnections.delete(connId));
      log('SSH connecting to', host);
      client.connect({ host, port: 22, username, password, readyTimeout: 20000 });
    } catch (e) { log('SSH connect exception for', connId, ':', e.message); reject(e); }
  });
});

ipcMain.handle('ssh:execute', async (event, { connId, cmd }) => {
  executeCount++;
  log('SSH execute for', connId, ':', JSON.stringify(cmd), '#', executeCount);
  const conn = sshConnections.get(connId);
  if (!conn) return 'not connected';
  try { conn.stream.write(cmd); streamWriteCount++; log('SSH execute: written ok for', connId, 'streamWrites:', streamWriteCount); }
  catch (e) { log('SSH execute error for', connId, ':', e.message); }
  return 'executed';
});

ipcMain.handle('ssh:disconnect', async (event, connId) => {
  log('SSH disconnect for', connId);
  const conn = sshConnections.get(connId);
  if (conn) { try { conn.client.end(); } catch (e) {} sshConnections.delete(connId); }
  return 'disconnected';
});

// Log receiver from renderer
ipcMain.on('log', (event, ...args) => { log(...args); });

// Connection Store
ipcMain.handle('saveConnection', async (event, conn) => {
  log('Save connection:', JSON.stringify(conn));
  const conns = loadConnections();
  const idx = conns.findIndex(c => c.id === conn.id);
  if (idx >= 0) conns[idx] = conn;
  else conns.push(conn);
  saveConnections(conns);
  return 'saved';
});

ipcMain.handle('loadConnections', async () => {
  log('Load connections');
  return loadConnections();
});

ipcMain.handle('deleteConnection', async (event, id) => {
  log('Delete connection:', id);
  const conns = loadConnections().filter(c => c.id !== id);
  saveConnections(conns);
  return 'deleted';
});

// Commands Store
ipcMain.handle('saveCommands', async (event, connId, commands) => {
  try {
    const cmdsFilePath = path.join(os.homedir(), '.seelelink', 'commands.json');
    let allCmds = {};
    if (fs.existsSync(cmdsFilePath)) allCmds = JSON.parse(fs.readFileSync(cmdsFilePath, 'utf-8'));
    allCmds[connId] = commands;
    fs.writeFileSync(cmdsFilePath, JSON.stringify(allCmds, null, 2));
    return 'saved';
  } catch (e) { log('Save commands error:', e); return 'error'; }
});

ipcMain.handle('loadCommands', async (event, connId) => {
  try {
    const cmdsFilePath = path.join(os.homedir(), '.seelelink', 'commands.json');
    if (fs.existsSync(cmdsFilePath)) {
      const allCmds = JSON.parse(fs.readFileSync(cmdsFilePath, 'utf-8'));
      return allCmds[connId] || [];
    }
    return [];
  } catch (e) { log('Load commands error:', e); return []; }
});

// ============================================================
// Settings API - Control Server Management
// ============================================================

// Get current control API config
ipcMain.handle('controlApi:getConfig', async () => {
  const cfg = loadConfig().controlApi;
  return {
    enabled: cfg.enabled,
    host: cfg.host,
    port: cfg.port,
    // Determine actual listening status
    listening: controlServer !== null,
  };
});

// Update control API config and restart server
ipcMain.handle('controlApi:setConfig', async (event, { enabled, host, port }) => {
  log('controlApi:setConfig', { enabled, host, port });
  const cfg = loadConfig();
  if (enabled !== undefined) cfg.controlApi.enabled = enabled;
  if (host !== undefined) cfg.controlApi.host = host;
  if (port !== undefined) cfg.controlApi.port = port;
  saveConfig(cfg);
  appConfig = cfg;
  // Restart server with new config
  startControlServer(cfg.controlApi);
  return cfg.controlApi;
});

// Find a random available port
ipcMain.handle('controlApi:findAvailablePort', async (event, { host }) => {
  return new Promise((resolve) => {
    findAvailablePort(host || '127.0.0.1', 9000, (port) => {
      resolve(port);
    });
  });
});

// ============================================================
// WebSocket IPC Handlers
// ============================================================
ipcMain.handle('ws:connect', async (event, { connId, url }) => {
  log('WS connect requested:', connId, url);
  if (wsConnections.has(connId)) return 'already connected';
  return new Promise((resolve, reject) => {
    try {
      const WebSocket = require('ws');
      const ws = new WebSocket(url);
      
      ws.on('open', () => {
        log('WS connected:', connId, url);
        wsConnections.set(connId, { ws, url });
        if (mainWindow) mainWindow.webContents.send('ws:data:' + connId, '[Connected to ' + url + ']\n');
        resolve('connected');
      });
      
      ws.on('message', (data) => {
        const msg = data.toString();
        log('WS message for', connId, ':', msg.substring(0, 100));
        if (mainWindow) mainWindow.webContents.send('ws:data:' + connId, '< ' + msg + '\n');
      });
      
      ws.on('error', (err) => {
        log('WS error for', connId, ':', err.message);
        if (mainWindow) mainWindow.webContents.send('ws:data:' + connId, '[Error] ' + err.message + '\n');
      });
      
      ws.on('close', () => {
        log('WS closed for', connId);
        wsConnections.delete(connId);
        if (mainWindow) mainWindow.webContents.send('ws:data:' + connId, '[Connection closed]\n');
      });
      
      // Timeout after 10 seconds
      const timeout = setTimeout(() => {
        if (!ws.readyState || ws.readyState === WebSocket.CONNECTING) {
          ws.terminate();
          wsConnections.delete(connId);
          if (mainWindow) mainWindow.webContents.send('ws:data:' + connId, '[Error] Connection timeout\n');
          resolve('timeout');
        }
      }, 10000);
      
      ws.on('open', () => clearTimeout(timeout));
      ws.on('error', () => clearTimeout(timeout));
      
    } catch (e) { log('WS connect exception:', e.message); reject(e); }
  });
});

ipcMain.handle('ws:send', async (event, { connId, data }) => {
  log('WS send for', connId, ':', data.substring(0, 100));
  const conn = wsConnections.get(connId);
  if (!conn) return 'not connected';
  if (conn.ws.readyState !== 1) return 'not open (state: ' + conn.ws.readyState + ')';
  try {
    conn.ws.send(data);
    return 'sent';
  } catch (e) { log('WS send error:', e.message); return 'error: ' + e.message; }
});

ipcMain.handle('ws:disconnect', async (event, connId) => {
  log('WS disconnect for', connId);
  const conn = wsConnections.get(connId);
  if (conn) {
    try { conn.ws.close(); } catch (e) {}
    wsConnections.delete(connId);
  }
  return 'disconnected';
});

// Get app info (paths)
ipcMain.handle('app:getInfo', async () => {
  return {
    exePath: app.isPackaged
      ? process.execPath
      : path.join(__dirname, '..'),
    mdPath: app.isPackaged
      ? path.join(path.dirname(process.execPath), 'resources', 'app', 'SEELINK_CONTROL.md')
      : path.join(__dirname, '..', 'SEELINK_CONTROL.md'),
    version: app.getVersion(),
    userDataPath: app.getPath('userData'),
  };
});

// ============================================================
// Settings API - MCP Server Management
// ============================================================

// Get current MCP config
ipcMain.handle('mcpApi:getConfig', async () => {
  const cfg = loadConfig().mcpApi;
  return {
    enabled: cfg.enabled,
    host: cfg.host,
    port: cfg.port,
    listening: mcpServer !== null,
  };
});

// Update MCP config and restart server
ipcMain.handle('mcpApi:setConfig', async (event, { enabled, host, port }) => {
  log('mcpApi:setConfig', { enabled, host, port });
  const cfg = loadConfig();
  if (enabled !== undefined) cfg.mcpApi.enabled = enabled;
  if (host !== undefined) cfg.mcpApi.host = host;
  if (port !== undefined) cfg.mcpApi.port = port;
  saveConfig(cfg);
  appConfig = cfg;
  startMcpServer(cfg.mcpApi);
  return cfg.mcpApi;
});

// Find a random available port for MCP
ipcMain.handle('mcpApi:findAvailablePort', async (event, { host }) => {
  return new Promise((resolve) => {
    findAvailablePort(host || '127.0.0.1', 9100, (port) => {
      resolve(port);
    });
  });
});
