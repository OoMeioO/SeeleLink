const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { fork } = require('child_process');
const fs = require('fs');
const os = require('os');

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

let executeCount = 0;
let streamWriteCount = 0;

const logFile = path.join(os.homedir(), '.seelelink', 'electron.log');
const debugLogFile = path.join(os.homedir(), '.seelelink', 'debug.log');

function log(...args) {
  const msg = new Date().toISOString() + ' ' + args.join(' ');
  console.log(msg);
  try {
    const dir = path.dirname(logFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(logFile, msg + '\n');
    // Also write to debug log
    fs.appendFileSync(debugLogFile, msg + '\n');
  } catch (e) { console.error('log error:', e); }
}

function createWindow() {
  // Clear debug log on startup
  try {
    fs.writeFileSync(debugLogFile, '');
  } catch (e) {}
  
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

app.whenReady().then(() => {
  log('App ready');
  createWindow();
});

app.on('window-all-closed', () => {
  log('Window all closed');
  if (psProcess) psProcess.kill();
  // Clean up all SSH connections
  for (const [id, conn] of sshConnections) {
    try { conn.client.end(); } catch (e) {}
  }
  sshConnections.clear();
  app.quit();
});

// Connection Store
const connFilePath = path.join(os.homedir(), '.seelelink', 'connections.json');

function loadConnections() {
  try {
    if (fs.existsSync(connFilePath)) {
      return JSON.parse(fs.readFileSync(connFilePath, 'utf-8'));
    }
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

// PowerShell - using node-pty for proper PTY support
const psConnections = new Map(); // connId -> { pty, connId }

// Windows Terminal API support - using node-pty with ConPTY
ipcMain.handle('ps:connect', async (event, { connId }) => {
  log('PS connect requested:', connId);
  
  if (!nodePty) {
    log('PS error: node-pty not loaded');
    return 'node-pty not available';
  }
  
  // Check if already connected with this connId
  if (psConnections.has(connId)) {
    log('PS: already connected');
    return 'already connected';
  }
  
  try {
    log('PS: spawning PowerShell with ConPTY (Windows Terminal backend)');
    
    // Use ConPTY - this is what Windows Terminal uses internally
    // ConPTY provides proper PTY emulation for Windows console apps
    const pty = nodePty.spawn('powershell.exe', [
      '-NoLogo', 
      '-NoExit', 
      '-ExecutionPolicy', 'Bypass'
    ], {
      name: 'xterm-256color',
      cols: 120,
      rows: 30,
      cwd: os.homedir(),
      env: process.env,
      conpty: true, // Use ConPTY - this is the Windows Terminal backend
    });
    
    // Note: We don't set localEcho to false here because node-pty doesn't support it
    // Instead, we filter the echo in the renderer
    
    psConnections.set(connId, { pty, connId });
    
    // Handle PTY output - send to renderer
    pty.onData((data) => {
      if (mainWindow) {
        mainWindow.webContents.send('ps:data:' + connId, data);
      }
    });
    
    pty.onExit(({ exitCode, signal }) => {
      log('PS pty exit:', exitCode, signal);
      psConnections.delete(connId);
      if (mainWindow) {
        mainWindow.webContents.send('ps:data:' + connId, '\r\n[PowerShell exited]\r\n');
      }
    });
    
    log('PS pty spawned, pid:', pty.pid);
    return 'connected';
    
  } catch (e) {
    log('PS pty spawn error:', e.message);
    return 'error: ' + e.message;
  }
});

ipcMain.handle('ps:execute', async (event, { connId, cmd }) => {
  log('PS execute for', connId, ':', JSON.stringify(cmd));
  const conn = psConnections.get(connId);
  if (conn && conn.pty) {
    try {
      // Write directly to PTY
      conn.pty.write(cmd);
      log('PS execute: written ok');
      return 'executed';
    } catch (e) {
      log('PS execute error:', e.message);
      return 'error: ' + e.message;
    }
  } else {
    log('PS execute: not connected');
  }
  return 'not connected';
});

ipcMain.handle('ps:disconnect', async (event, connId) => {
  log('PS disconnect:', connId);
  const conn = psConnections.get(connId);
  if (conn && conn.pty) {
    try {
      conn.pty.kill();
    } catch (e) {}
    psConnections.delete(connId);
  }
  return 'disconnected';
});

// CMD.exe support
const cmdConnections = new Map(); // connId -> { pty, connId }

ipcMain.handle('cmd:connect', async (event, { connId }) => {
  log('CMD connect requested:', connId);
  
  if (!nodePty) {
    log('CMD error: node-pty not loaded');
    return 'node-pty not available';
  }
  
  if (cmdConnections.has(connId)) {
    log('CMD: already connected');
    return 'already connected';
  }
  
  try {
    log('CMD: spawning cmd.exe with ConPTY');
    
    const pty = nodePty.spawn('cmd.exe', [], {
      name: 'xterm-256color',
      cols: 120,
      rows: 30,
      cwd: os.homedir(),
      env: process.env,
      conpty: true,
    });
    
    cmdConnections.set(connId, { pty, connId });
    
    pty.onData((data) => {
      if (mainWindow) {
        mainWindow.webContents.send('cmd:data:' + connId, data);
      }
    });
    
    pty.onExit(({ exitCode, signal }) => {
      log('CMD pty exit:', exitCode, signal);
      cmdConnections.delete(connId);
      if (mainWindow) {
        mainWindow.webContents.send('cmd:data:' + connId, '\r\n[Command Prompt exited]\r\n');
      }
    });
    
    log('CMD pty spawned, pid:', pty.pid);
    return 'connected';
    
  } catch (e) {
    log('CMD pty spawn error:', e.message);
    return 'error: ' + e.message;
  }
});

ipcMain.handle('cmd:execute', async (event, { connId, cmd }) => {
  log('CMD execute for', connId, ':', JSON.stringify(cmd));
  const conn = cmdConnections.get(connId);
  if (conn && conn.pty) {
    try {
      conn.pty.write(cmd);
      log('CMD execute: written ok');
      return 'executed';
    } catch (e) {
      log('CMD execute error:', e.message);
      return 'error: ' + e.message;
    }
  } else {
    log('CMD execute: not connected');
  }
  return 'not connected';
});

ipcMain.handle('cmd:disconnect', async (event, connId) => {
  log('CMD disconnect:', connId);
  const conn = cmdConnections.get(connId);
  if (conn && conn.pty) {
    try {
      conn.pty.kill();
    } catch (e) {}
    cmdConnections.delete(connId);
  }
  return 'disconnected';
});

// Serial
ipcMain.handle('serial:connect', async (event, { connId, port, baudRate }) => {
  log('Serial connect requested:', connId, port, baudRate);
  
  // Check if this port is already in use
  if (serialConnections.has(port)) {
    log('Serial: port', port, 'already in use');
    return 'port in use';
  }
  
  return new Promise(async (resolve, reject) => {
    try {
      const { SerialPort } = require('serialport');
      const serialPort = new SerialPort({
        path: port,
        baudRate: parseInt(baudRate) || 115200,
        dataBits: 8,
        parity: 'none',
        stopBits: 1,
      });
      
      // Store the connection info
      serialConnections.set(port, { port: serialPort, connId, baudRate });
      
      serialPort.on('open', () => {
        log('Serial connected to', port);
        if (mainWindow) mainWindow.webContents.send('serial:data:' + connId, '[Connected to ' + port + ' at ' + baudRate + ']\r\n');
        resolve('connected');
      });
      
      serialPort.on('data', (data) => {
        if (mainWindow) mainWindow.webContents.send('serial:data:' + connId, data.toString());
      });
      
      serialPort.on('error', (err) => {
        log('Serial error on', port, ':', err.message);
        if (mainWindow) mainWindow.webContents.send('serial:data:' + connId, '[Error] ' + err.message + '\r\n');
      });
      
      serialPort.on('close', () => {
        log('Serial closed on', port);
        serialConnections.delete(port);
        if (mainWindow) mainWindow.webContents.send('serial:data:' + connId, '[Disconnected]\r\n');
      });
      
    } catch (e) {
      log('Serial connect error:', e.message);
      serialConnections.delete(port);
      reject(e);
    }
  });
});

ipcMain.handle('serial:execute', async (event, { connId, data }) => {
  log('Serial execute for', connId, ':', JSON.stringify(data));
  // Find the connection with this connId
  let foundPort = null;
  for (const [port, info] of serialConnections) {
    if (info.connId === connId) {
      foundPort = port;
      break;
    }
  }
  if (!foundPort) {
    log('Serial execute: not connected');
    return 'not connected';
  }
  try {
    serialConnections.get(foundPort).port.write(data);
    log('Serial execute: written ok');
  } catch (e) {
    log('Serial execute error:', e.message);
  }
  return 'executed';
});

ipcMain.handle('serial:disconnect', async (event, connId) => {
  log('Serial disconnect for', connId);
  // Find and close the connection with this connId
  for (const [port, info] of serialConnections) {
    if (info.connId === connId) {
      info.port.close();
      serialConnections.delete(port);
      break;
    }
  }
  return 'disconnected';
});

// List available serial ports
ipcMain.handle('serial:list', async () => {
  log('Serial list requested');
  try {
    const { SerialPort } = require('serialport');
    const ports = await SerialPort.list();
    const comPorts = ports.map(p => p.path).filter(p => p.startsWith('COM'));
    log('Available COM ports:', comPorts.join(', '));
    return comPorts;
  } catch (e) {
    log('Serial list error:', e.message);
    return [];
  }
});

// SSH - Now supports multiple connections
ipcMain.handle('ssh:connect', async (event, { connId, host, username, password }) => {
  log('SSH connect requested:', connId, host, username);
  
  // Check if already connected
  if (sshConnections.has(connId)) {
    log('SSH: already connected, returning');
    return 'already connected';
  }
  
  return new Promise((resolve, reject) => {
    try {
      const { Client } = require('ssh2');
      const client = new Client();
      let shellStreamCount = 0;
      
      client.on('ready', () => {
        log('SSH ready for', connId);
        
        client.shell((err, stream) => {
          const thisShellId = ++shellStreamCount;
          log('SSH shell started for', connId, 'shellId:', thisShellId);
          
          if (err) {
            log('SSH shell error for', connId, ':', err.message);
            if (mainWindow) mainWindow.webContents.send('ssh:data:' + connId, '[Shell Error] ' + err.message + '\r\n');
            return;
          }
          
          stream.on('data', (data) => {
            if (mainWindow) {
              mainWindow.webContents.send('ssh:data:' + connId, data.toString());
              log('SSH stream data for', connId, 'len:', data.length);
            }
          });
          
          stream.stderr.on('data', (data) => {
            if (mainWindow) mainWindow.webContents.send('ssh:data:' + connId, data.toString());
          });
          
          stream.on('close', () => {
            log('SSH shell closed for', connId);
            if (mainWindow) mainWindow.webContents.send('ssh:data:' + connId, '[Connection closed]\r\n');
            sshConnections.delete(connId);
          });
          
          // Store this connection
          sshConnections.set(connId, { client, stream });
        });
        
        if (mainWindow) mainWindow.webContents.send('ssh:data:' + connId, '[Connected to ' + host + ']\r\n');
        resolve('connected');
      });
      
      client.on('error', (err) => {
        log('SSH error for', connId, ':', err.message);
        if (mainWindow) mainWindow.webContents.send('ssh:data:' + connId, '[Error] ' + err.message + '\r\n');
        sshConnections.delete(connId);
        reject(err);
      });
      
      client.on('close', () => {
        log('SSH closed for', connId);
        sshConnections.delete(connId);
      });

      log('SSH connecting to', host);
      client.connect({
        host,
        port: 22,
        username,
        password,
        readyTimeout: 20000,
      });
    } catch (e) {
      log('SSH connect exception for', connId, ':', e.message);
      reject(e);
    }
  });
});

ipcMain.handle('ssh:execute', async (event, { connId, cmd }) => {
  executeCount++;
  log('SSH execute for', connId, ':', JSON.stringify(cmd), '#', executeCount);
  
  const conn = sshConnections.get(connId);
  if (!conn) { 
    log('SSH execute: no connection for', connId); 
    return 'not connected'; 
  }
  
  try {
    conn.stream.write(cmd);
    streamWriteCount++;
    log('SSH execute: written ok for', connId, 'streamWrites:', streamWriteCount);
  } catch (e) {
    log('SSH execute error for', connId, ':', e.message);
  }
  return 'executed';
});

ipcMain.handle('ssh:disconnect', async (event, connId) => {
  log('SSH disconnect for', connId);
  const conn = sshConnections.get(connId);
  if (conn) {
    try { conn.client.end(); } catch (e) {}
    sshConnections.delete(connId);
  }
  return 'disconnected';
});

// Log receiver from renderer
ipcMain.on('log', (event, ...args) => {
  log(...args);
});

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
    if (fs.existsSync(cmdsFilePath)) {
      allCmds = JSON.parse(fs.readFileSync(cmdsFilePath, 'utf-8'));
    }
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
