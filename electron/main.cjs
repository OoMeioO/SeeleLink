const _electron = require('electron');
const { app, BrowserWindow, ipcMain } = _electron;

// Check for debug flags before app is ready (must be before app.whenReady())
if (process.argv.includes('--debug-gpu')) {
  app.disableHardwareAcceleration();
  console.log('[Debug] Hardware acceleration disabled via --debug-gpu flag');
}

// Ensure single instance - kill old if new one starts
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}
const path = require('path');
const { fork } = require('child_process');
const fs = require('fs');
const os = require('os');
const net = require('net');
const crypto = require('crypto');
// Password encryption key derived from user-specific data
let encryptionKey = null;
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';

function getEncryptionKey() {
  if (encryptionKey) return encryptionKey;
  // Derive key from machine-specific data
  const machineId = os.homedir() + os.hostname() + os.platform();
  encryptionKey = crypto.createHash('sha256').update(machineId).digest();
  return encryptionKey;
}

function encryptPassword(plainText) {
  if (!plainText) return plainText;
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    // Format: iv:authTag:encrypted
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  } catch (e) {
    log('Encryption error:', e.message);
    return plainText;
  }
}

function decryptPassword(encryptedText) {
  if (!encryptedText || !encryptedText.includes(':')) return encryptedText;
  try {
    const key = getEncryptionKey();
    const parts = encryptedText.split(':');
    if (parts.length !== 3) return encryptedText;
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (e) {
    log('Decryption error:', e.message);
    return encryptedText;
  }
}

// ============================================================
// Config Management
// ============================================================
const configFilePath = path.join(os.homedir(), '.seelelink', 'config.json');
const defaultConfig = {
  controlApi: { enabled: true, host: '127.0.0.1', port: 9380 },
  mcpApi: { enabled: false, host: '127.0.0.1', port: 9381 },
  log: { enabled: true, path: null },
  windowCapture: { mode: 'auto' }, // "auto" | "foreground" | "gdi"
};

function loadConfig() {
  try {
    if (fs.existsSync(configFilePath)) {
      const savedConfig = JSON.parse(fs.readFileSync(configFilePath, 'utf-8'));
      // Merge with default config to ensure all fields exist
      return {
        controlApi: { ...defaultConfig.controlApi, ...savedConfig.controlApi },
        mcpApi: { ...defaultConfig.mcpApi, ...savedConfig.mcpApi },
        log: { ...defaultConfig.log, ...savedConfig.log },
        windowCapture: { ...defaultConfig.windowCapture, ...savedConfig.windowCapture },
      };
    }
  } catch (e) {
    log('Config load error, using defaults:', e.message);
  }
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
// Lazy-loaded on first use to avoid startup overhead
let nodePty = null;
let nodePtyLoadError = null;

function ensureNodePty() {
  if (nodePty !== null) return nodePty;
  // If load failed before, don't retry (avoid repeated console errors)
  if (nodePtyLoadError !== null) return null;
  try {
    nodePty = require('node-pty');
    const path = require.resolve('node-pty');
    log('node-pty path:', path);
    log('node-pty loaded successfully');
    return nodePty;
  } catch (e) {
    nodePtyLoadError = e.message;
    log('node-pty load failed:', e.message);
    return null;
  }
}

// ── Platform Control Layer (Mouse/Keyboard/Screen/Debug) ───────────────────
let controlService = null;
try {
  const platform = require('./platform/index.cjs');
  if (platform.isControlSupported()) {
    controlService = platform.createControl({ log });
    log(`[ControlService] Platform control loaded: ${platform.getPlatformInfo().platform}`);
  } else {
    log('[ControlService] Platform does not support control features');
  }
} catch (e) {
  log('[ControlService] Failed to load platform control:', e.message);
}

// Register IPC handlers for control service
function initControlIPC() {
  if (!controlService) return;

  // Mouse handlers
  ipcMain.handle('control:mouse:position', async () => {
    try {
      const pos = await controlService.mouse.getPosition();
      controlService.debug.addLog('debug', 'ControlService', 'mouse:position', pos);
      return { ok: true, result: pos };
    } catch (e) {
      controlService.debug.addLog('error', 'ControlService', 'mouse:position', { error: e.message });
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle('control:mouse:move', async (_, x, y) => {
    try {
      await controlService.mouse.setPosition(x, y);
      controlService.debug.addLog('debug', 'ControlService', 'mouse:move', { x, y });
      return { ok: true };
    } catch (e) {
      controlService.debug.addLog('error', 'ControlService', 'mouse:move', { error: e.message });
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle('control:mouse:click', async (_, x, y, button) => {
    try {
      await controlService.mouse.click(x, y, button);
      controlService.debug.addLog('info', 'ControlService', 'mouse:click', { x, y, button });
      return { ok: true };
    } catch (e) {
      controlService.debug.addLog('error', 'ControlService', 'mouse:click', { error: e.message });
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle('control:mouse:doubleClick', async (_, x, y) => {
    try {
      await controlService.mouse.doubleClick(x, y);
      controlService.debug.addLog('info', 'ControlService', 'mouse:doubleClick', { x, y });
      return { ok: true };
    } catch (e) {
      controlService.debug.addLog('error', 'ControlService', 'mouse:doubleClick', { error: e.message });
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle('control:mouse:drag', async (_, fromX, fromY, toX, toY) => {
    try {
      await controlService.mouse.drag(fromX, fromY, toX, toY);
      controlService.debug.addLog('info', 'ControlService', 'mouse:drag', { fromX, fromY, toX, toY });
      return { ok: true };
    } catch (e) {
      controlService.debug.addLog('error', 'ControlService', 'mouse:drag', { error: e.message });
      return { ok: false, error: e.message };
    }
  });

  // Keyboard handlers
  ipcMain.handle('control:keyboard:type', async (_, text) => {
    try {
      await controlService.keyboard.typeText(text);
      controlService.debug.addLog('info', 'ControlService', 'keyboard:type', { length: text.length });
      return { ok: true };
    } catch (e) {
      controlService.debug.addLog('error', 'ControlService', 'keyboard:type', { error: e.message });
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle('control:keyboard:press', async (_, key) => {
    try {
      await controlService.keyboard.pressKey(key);
      controlService.debug.addLog('debug', 'ControlService', 'keyboard:press', { key });
      return { ok: true };
    } catch (e) {
      controlService.debug.addLog('error', 'ControlService', 'keyboard:press', { error: e.message });
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle('control:keyboard:pressKeys', async (_, keys) => {
    try {
      await controlService.keyboard.pressKeys(keys);
      controlService.debug.addLog('info', 'ControlService', 'keyboard:pressKeys', { keys });
      return { ok: true };
    } catch (e) {
      controlService.debug.addLog('error', 'ControlService', 'keyboard:pressKeys', { error: e.message });
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle('control:keyboard:copy', async () => {
    try {
      await controlService.keyboard.copy();
      controlService.debug.addLog('info', 'ControlService', 'keyboard:copy', {});
      return { ok: true };
    } catch (e) {
      controlService.debug.addLog('error', 'ControlService', 'keyboard:copy', { error: e.message });
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle('control:keyboard:paste', async () => {
    try {
      await controlService.keyboard.paste();
      controlService.debug.addLog('info', 'ControlService', 'keyboard:paste', {});
      return { ok: true };
    } catch (e) {
      controlService.debug.addLog('error', 'ControlService', 'keyboard:paste', { error: e.message });
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle('control:keyboard:cut', async () => {
    try {
      await controlService.keyboard.cut();
      controlService.debug.addLog('info', 'ControlService', 'keyboard:cut', {});
      return { ok: true };
    } catch (e) {
      controlService.debug.addLog('error', 'ControlService', 'keyboard:cut', { error: e.message });
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle('control:keyboard:selectAll', async () => {
    try {
      await controlService.keyboard.selectAll();
      controlService.debug.addLog('info', 'ControlService', 'keyboard:selectAll', {});
      return { ok: true };
    } catch (e) {
      controlService.debug.addLog('error', 'ControlService', 'keyboard:selectAll', { error: e.message });
      return { ok: false, error: e.message };
    }
  });

  // Screen handlers
  ipcMain.handle('control:screen:capture', async () => {
    try {
      const result = await controlService.screen.capture();
      controlService.debug.addLog('info', 'ControlService', 'screen:capture', { width: result.width, height: result.height });
      return { ok: true, result };
    } catch (e) {
      controlService.debug.addLog('error', 'ControlService', 'screen:capture', { error: e.message });
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle('control:screen:captureRegion', async (_, x, y, width, height) => {
    try {
      const result = await controlService.screen.captureRegion(x, y, width, height);
      controlService.debug.addLog('info', 'ControlService', 'screen:captureRegion', { x, y, width, height });
      return { ok: true, result };
    } catch (e) {
      controlService.debug.addLog('error', 'ControlService', 'screen:captureRegion', { error: e.message });
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle('control:screen:captureWindow', async (_, bounds) => {
    try {
      const result = await controlService.screen.captureWindow(bounds);
      controlService.debug.addLog('info', 'ControlService', 'screen:captureWindow', { width: bounds.width, height: bounds.height });
      return { ok: true, result };
    } catch (e) {
      controlService.debug.addLog('error', 'ControlService', 'screen:captureWindow', { error: e.message });
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle('control:screen:bringToForeground', async (_, hwnd) => {
    try {
      await controlService.screen.bringToForeground(hwnd);
      controlService.debug.addLog('info', 'ControlService', 'screen:bringToForeground', { hwnd: hwnd || 'auto' });
      return { ok: true };
    } catch (e) {
      controlService.debug.addLog('error', 'ControlService', 'screen:bringToForeground', { error: e.message });
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle('control:screen:list', async () => {
    if (!controlService.screen.list) return { ok: false, error: 'not supported' };
    try {
      const result = await controlService.screen.list();
      return { ok: true, result };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  // Debug handlers
  ipcMain.handle('control:debug:getLogs', async (_, filter) => {
    return { ok: true, result: controlService.debug.getLogs(filter) };
  });

  ipcMain.handle('control:debug:getStats', async () => {
    return { ok: true, result: controlService.debug.getStats() };
  });

  ipcMain.handle('control:debug:clear', async () => {
    controlService.debug.clear();
    return { ok: true };
  });

  ipcMain.handle('control:debug:setLevel', async (_, level) => {
    const ok = controlService.debug.setLevel(level);
    if (ok) {
      controlService.debug.addLog('info', 'ControlService', 'debug:setLevel', { level });
    }
    return { ok, level: controlService.debug.getLevel() };
  });

  ipcMain.handle('control:debug:export', async (_, format) => {
    try {
      const data = controlService.debug.export(format);
      return { ok: true, data };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  // Platform handler
  ipcMain.handle('control:platform:info', async () => {
    const platform = require('./platform/index.cjs');
    const info = platform.getPlatformInfo();
    return { ok: true, result: { type: info.platform, arch: info.arch } };
  });

  log('[ControlService] IPC handlers registered');
}

initControlIPC();

// ============================================================
// Session Log Manager
// ============================================================
const sessionLogs = new Map();

function getLogDir() {
  const logPath = appConfig.log?.path;
  if (logPath) return logPath;
  return path.join(os.homedir(), '.seelelink', 'logs');
}

function sanitizeFileName(name) {
  return name.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_').substring(0, 50);
}

// Validate device ID to prevent shell injection
// Android device IDs contain only alphanumeric, hyphen, period, colon (for USB serial)
function sanitizeDeviceId(id) {
  if (!id || typeof id !== 'string') return '';
  // Allow only safe characters for device ID
  return id.replace(/[^a-zA-Z0-9._:-]/g, '');
}

// Validate and sanitize a number coordinate for Android commands
function sanitizeCoordinate(val, defaultVal = 0) {
  const num = parseInt(val, 10);
  if (isNaN(num) || num < 0 || num > 10000) return defaultVal;
  return num;
}

// Escape single argument for shell command
function shellEscape(arg) {
  if (!arg || typeof arg !== 'string') return '""';
  // Escape single quotes and wrap in single quotes
  return "'" + arg.replace(/'/g, "'\\''") + "'";
}

// Validate IPC handler params object exists
function validateParams(params, requiredFields) {
  if (!params || typeof params !== 'object') return 'invalid params';
  for (const field of requiredFields) {
    if (params[field] === undefined || params[field] === null) return `missing ${field}`;
  }
  return null;
}

function formatTimestamp(date) {
  return date.toISOString().replace(/:/g, '-').replace('T', '_').split('.')[0];
}

function formatTime(date) {
  return date.toTimeString().split(' ')[0];
}

function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}

function createSessionLog(type, name, info) {
  if (!appConfig.log?.enabled) return null;

  try {
    const logDir = getLogDir();
    const typeDir = path.join(logDir, type.charAt(0).toUpperCase() + type.slice(1));
    if (!fs.existsSync(typeDir)) {
      fs.mkdirSync(typeDir, { recursive: true });
    }

    const safeName = sanitizeFileName(name);
    const timestamp = formatTimestamp(new Date());
    const fileName = `${safeName}_${timestamp}.log`;
    const filePath = path.join(typeDir, fileName);

    // Create log header
    const header = [
      '=============================================================',
      'SeeleLink Session Log',
      '=============================================================',
      `Type:       ${type.toUpperCase()}`,
      `Name:       ${name}`,
      `Started:    ${new Date().toLocaleString()}`,
      `Session ID: log_${Date.now()}`,
    ];

    if (info) {
      for (const [key, value] of Object.entries(info)) {
        header.push(`${key}:       ${value}`);
      }
    }

    header.push('=============================================================\n');
    fs.writeFileSync(filePath, header.join('\n') + '\n', 'utf-8');

    const logId = `log_${Date.now()}_${crypto.randomUUID().replace(/-/g, '').substring(0, 9)}`;
    const stream = fs.createWriteStream(filePath, { flags: 'a', encoding: 'utf-8' });

    sessionLogs.set(logId, {
      id: logId,
      type,
      name,
      filePath,
      startTime: new Date(),
      stream,
      buffer: [],      // Buffer for batched writes
      bufferSize: 0,   // Current buffer size in bytes
      flushTimer: null // Timer for periodic flush
    });

    log('Session log created:', logId, filePath);
    return logId;
  } catch (err) {
    log('Failed to create session log:', err.message);
    return null;
  }
}

// Parse and remove ANSI escape sequences from terminal output
// ConPTY sends: CSI sequences (ESC[<params><final byte>), OSC (ESC]...), two-char sequences
// Also handles: C1 control chars (0x80-0x9F), invalid UTF-8 surrogate pairs
function stripAnsi(str) {
  if (!str) return '';
  const result = [];
  let i = 0;
  while (i < str.length) {
    const code = str.charCodeAt(i);
    // ESC - start of escape sequence
    if (code === 0x1B) {
      // CSI: ESC [ <params bytes> <intermediate bytes> <final byte>
      // Valid params bytes: 0x30-0x3F (digits, ';', ':', '<', '=', '>', '?')
      // Valid intermediate bytes: 0x20-0x2F
      // Valid final bytes: 0x40-0x7E
      if (i + 1 < str.length && str.charCodeAt(i + 1) === 0x5B) { // '['
        i += 2;
        while (i < str.length) {
          const c = str.charCodeAt(i);
          if (c >= 0x40 && c <= 0x7E) {
            // Final byte - sequence ends here
            i++;
            break;
          } else if (c >= 0x30 && c <= 0x3F) {
            i++; // params byte
          } else if (c >= 0x20 && c <= 0x2F) {
            i++; // intermediate byte
          } else {
            // Unexpected byte - discard ESC[ but keep this char
            break;
          }
        }
      }
      // OSC: ESC ] <params> BEL/ST
      else if (i + 1 < str.length && str.charCodeAt(i + 1) === 0x5D) { // ']'
        i += 2;
        while (i < str.length) {
          const c = str.charCodeAt(i);
          if (c === 0x07 || (c === 0x1B && i + 1 < str.length && str.charCodeAt(i + 1) === 0x5C)) {
            i++; // consume BEL or ESC\
            if (c === 0x1B) i++; // consume \ after ESC
            break;
          }
          i++;
        }
      }
      // Two-char sequences: ESC + letter
      else if (i + 1 < str.length) {
        const next = str.charCodeAt(i + 1);
        // Valid two-char: ESC D(M), ESC E(N), ESC H(F), ESC M(H), ESC Z(S), ESC c(R), 7/8, =, >
        if ((next >= 0x40 && next <= 0x5A) || (next >= 0x61 && next <= 0x7A) ||
            next === 0x37 || next === 0x38 || next === 0x3D || next === 0x3E) {
          i += 2;
          continue;
        }
        // Single ESC, skip it
        i++;
      } else {
        i++;
      }
    }
    // CR/LF/TAB - keep
    else if (code === 0x09 || code === 0x0A || code === 0x0D) {
      result.push(str[i]);
      i++;
    }
    // C1 control chars (0x80-0x9F) - VT100 special chars, skip (non-printable)
    else if (code >= 0x80 && code <= 0x9F) {
      i++;
    }
    // High surrogate (0xD800-0xDBFF) without low surrogate - skip
    else if (code >= 0xD800 && code <= 0xDBFF) {
      i++;
    }
    // Low surrogate (0xDC00-0xDFFF) without high surrogate - skip
    else if (code >= 0xDC00 && code <= 0xDFFF) {
      i++;
    }
    // Other control chars - skip
    else if (code <= 0x08 || (code >= 0x0B && code <= 0x0C) || (code >= 0x0E && code <= 0x1F) || code === 0x7F) {
      i++;
    }
    // Normal printable char
    else {
      result.push(str[i]);
      i++;
    }
  }
  return result.join('');
}

async function closeSessionLog(logId) {
  const sessionLog = sessionLogs.get(logId);
  if (!sessionLog) return;

  // Clear any pending flush timer
  if (sessionLog.flushTimer) {
    clearTimeout(sessionLog.flushTimer);
    sessionLog.flushTimer = null;
  }

  // Flush remaining buffer
  if (sessionLog.buffer && sessionLog.buffer.length > 0) {
    const combined = Buffer.concat(sessionLog.buffer);
    sessionLog.buffer = [];
    sessionLog.bufferSize = 0;
    if (sessionLog.stream && sessionLog.stream.writable) {
      sessionLog.stream.write(combined);
    }
  }

  return new Promise((resolve) => {
    if (sessionLog.stream) {
      const duration = formatDuration(new Date().getTime() - sessionLog.startTime.getTime());
      const footer = `\n=============================================================\nSession ended at ${new Date().toLocaleString()}\nDuration: ${duration}\n=============================================================\n`;
      sessionLog.stream.write(footer, () => {
        sessionLog.stream.end();
        sessionLogs.delete(logId);
        log('Session log closed:', logId);
        resolve();
      });
    } else {
      sessionLogs.delete(logId);
      resolve();
    }
  });
}

function getSessionLogPath(logId) {
  const sessionLog = sessionLogs.get(logId);
  return sessionLog ? sessionLog.filePath : null;
}

// IPC handlers for session logs
ipcMain.handle('log:getConfig', async () => {
  return { enabled: appConfig.log?.enabled ?? true, path: appConfig.log?.path || null };
});

ipcMain.handle('log:setConfig', async (event, config) => {
  if (!appConfig.log) appConfig.log = { enabled: true, path: null };
  if (config.enabled !== undefined) appConfig.log.enabled = config.enabled;
  if (config.path !== undefined) appConfig.log.path = config.path;
  saveConfig(appConfig);
  return 'saved';
});

// Session log auto cleanup - delete logs older than maxAgeDays
const MAX_LOG_AGE_DAYS = 7; // Default: keep logs for 7 days

function cleanupOldLogs() {
  const logDir = getLogDir();
  if (!fs.existsSync(logDir)) return;

  const maxAgeMs = MAX_LOG_AGE_DAYS * 24 * 60 * 60 * 1000;
  const now = Date.now();
  let deletedCount = 0;
  let totalSize = 0;

  try {
    const entries = fs.readdirSync(logDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const typeDir = path.join(logDir, entry.name);
      try {
        const files = fs.readdirSync(typeDir);
        for (const file of files) {
          if (!file.endsWith('.log')) continue;
          const filePath = path.join(typeDir, file);
          try {
            const stat = fs.statSync(filePath);
            const ageMs = now - stat.mtimeMs.getTime();
            if (ageMs > maxAgeMs) {
              const size = stat.size;
              fs.unlinkSync(filePath);
              deletedCount++;
              totalSize += size;
            }
          } catch (e) { /* skip unreadable files */ }
        }
      } catch (e) { /* skip unreadable dirs */ }
    }
    if (deletedCount > 0) {
      log(`[LogCleanup] Deleted ${deletedCount} old log files, freed ${(totalSize / 1024).toFixed(1)} KB`);
    }
  } catch (e) {
    log('[LogCleanup] Failed:', e.message);
  }
}

ipcMain.handle('log:getDir', async () => {
  return getLogDir();
});

ipcMain.handle('log:openFolder', async (event, logId) => {
  const { exec } = require('child_process');
  let folder;
  if (logId) {
    const logPath = getSessionLogPath(logId);
    if (logPath) {
      folder = path.dirname(logPath);
    }
  } else {
    folder = getLogDir();
  }
  if (folder && fs.existsSync(folder)) {
    if (process.platform === 'win32') {
      exec(`explorer "${folder}"`);
    }
  }
  return folder;
});

// Dialog: open directory picker
ipcMain.handle('dialog:openDirectory', async (event) => {
  const { dialog } = require('electron');
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    title: '选择日志保存目录',
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

let mainWindow;
let psProcess;

// Max connections per type to prevent resource exhaustion
const MAX_CONNECTIONS = {
  ssh: 10,
  serial: 5,
  ps: 5,
  cmd: 5,
  ws: 10,
  android: 10,
};

// Multiple SSH connections support - map of connection id -> { client, stream }
const sshConnections = new Map();

// Serial connections - Map of connId -> { port, portPath, connId, baudRate, logId }
// Shared-port guard: serialPortRefCount tracks how many connIds share each port path
const serialConnections = new Map();
const serialPortRefCount = new Map();

// PowerShell connections - Map of connId -> { pty }
const psConnections = new Map();

// CMD connections - Map of connId -> { pty }
const cmdConnections = new Map();

// WebSocket connections - Map of connId -> { ws, url }
const wsConnections = new Map();

// Android connections - Map of connId -> { deviceId, client }
const androidConnections = new Map();

// ============================================================
// Plugin System
// User plugins are loaded from ~/.seelelink/plugins/
// Each plugin runs in an isolated child process for security
// ============================================================
const PLUGIN_CONFIG_DIR = path.join(os.homedir(), '.seelelink', 'plugin-config');
const PLUGIN_DATA_DIR = path.join(os.homedir(), '.seelelink', 'plugin-data');
const PLUGINS_DIR = path.join(os.homedir(), '.seelelink', 'plugins');

// Plugin registry: pluginId -> { manifest, instance, enabled, process }
const loadedPlugins = new Map();
// Plugin child processes: pluginId -> child process
const pluginProcesses = new Map();
// Enabled plugins persistence
let enabledPlugins = new Set();

function loadEnabledPlugins() {
  try {
    const enabledFile = path.join(PLUGIN_CONFIG_DIR, 'enabled.json');
    if (fs.existsSync(enabledFile)) {
      enabledPlugins = new Set(JSON.parse(fs.readFileSync(enabledFile, 'utf-8')));
    }
  } catch (e) {
    log('Failed to load enabled plugins:', e.message);
  }
}

async function persistEnabledPlugins() {
  try {
    if (!fs.existsSync(PLUGIN_CONFIG_DIR)) {
      fs.mkdirSync(PLUGIN_CONFIG_DIR, { recursive: true });
    }
    const enabledFile = path.join(PLUGIN_CONFIG_DIR, 'enabled.json');
    fs.writeFileSync(enabledFile, JSON.stringify(Array.from(enabledPlugins)));
  } catch (e) {
    log('Failed to persist enabled plugins:', e.message);
  }
}

async function discoverPlugins() {
  if (!fs.existsSync(PLUGINS_DIR)) {
    fs.mkdirSync(PLUGINS_DIR, { recursive: true });
    return [];
  }
  const manifests = [];
  const entries = fs.readdirSync(PLUGINS_DIR, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const pluginDir = path.join(PLUGINS_DIR, entry.name);
    const manifestPath = path.join(pluginDir, 'plugin.json');
    if (fs.existsSync(manifestPath)) {
      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
        if (manifest.id && manifest.name && manifest.version && manifest.type && manifest.entry) {
          manifests.push({ manifest, dir: pluginDir });
        }
      } catch (e) {
        log('Failed to load plugin manifest:', entry.name, e.message);
      }
    }
  }
  return manifests;
}

function createPluginContext(pluginId) {
  return {
    id: pluginId,
    logger: {
      info: (msg, ...args) => log(`[Plugin:${pluginId}]`, msg, ...args),
      warn: (msg, ...args) => console.warn(`[Plugin:${pluginId}]`, msg, ...args),
      error: (msg, ...args) => console.error(`[Plugin:${pluginId}]`, msg, ...args),
      debug: (msg, ...args) => console.debug(`[Plugin:${pluginId}]`, msg, ...args),
    },
    connections: {
      // Plugins handle their own connections internally
      // This is a stub for compatibility
      create: async (connId, type, config) => {
        log(`[Plugin:${pluginId}] connection create (stub):`, type, connId);
        return { error: 'Not implemented - plugins handle connections internally' };
      },
      destroy: async (connId) => {
        log(`[Plugin:${pluginId}] connection destroy (stub):`, connId);
      },
      send: (connId, data) => {
        log(`[Plugin:${pluginId}] connection send (stub):`, connId, data.length);
      },
    },
    events: {
      emit: (topic, ...data) => {
        // Broadcast event to all other plugins
        for (const [pid, proc] of pluginProcesses) {
          if (pid !== pluginId && proc && proc.connected) {
            proc.send({ type: 'event', channel: 'events', data: { topic, args: data } });
          }
        }
      },
    },
  };
}

async function loadPlugin(pluginInfo) {
  const { manifest, dir } = pluginInfo;
  if (loadedPlugins.has(manifest.id)) {
    log('Plugin already loaded:', manifest.id);
    return;
  }
  const entryPath = path.join(dir, manifest.entry);
  if (!fs.existsSync(entryPath)) {
    log('Plugin entry not found:', entryPath);
    return;
  }
  try {
    const mod = await import(`file://${entryPath}`);
    const instance = mod.default || mod;
    loadedPlugins.set(manifest.id, { manifest, instance, dir, enabled: false });
    log('Plugin loaded:', manifest.id, manifest.version);
    if (instance.onLoad) {
      try {
        await instance.onLoad(createPluginContext(manifest.id));
      } catch (e) {
        log('Plugin', manifest.id, 'onLoad failed:', e.message);
      }
    }
  } catch (e) {
    log('Failed to load plugin:', manifest.id, e.message);
  }
}

async function enablePlugin(pluginId) {
  const plugin = loadedPlugins.get(pluginId);
  if (!plugin) {
    log('Plugin not found:', pluginId);
    return;
  }
  if (plugin.enabled) {
    log('Plugin already enabled:', pluginId);
    return;
  }
  // Spawn plugin child process with minimal environment
  const entryPath = path.join(plugin.dir, plugin.manifest.entry);
  // Only pass essential env vars, not the full process.env which may contain sensitive credentials
  let child;
  try {
    child = spawn('node', [entryPath], {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      env: {
        NODE_ENV: process.env.NODE_ENV,
        SEELINK_PLUGIN_ID: pluginId,
        SEELINK_PLUGIN_DIR: plugin.dir,
        // Pass only non-sensitive path information
        PATH: process.env.PATH,
      },
    });
  } catch (e) {
    log('Plugin spawn error:', pluginId, e.message);
    // plugin.enabled and enabledPlugins remain false — no cleanup needed
    return;
  }
  pluginProcesses.set(pluginId, child);

  // Mark as enabled BEFORE waiting for ready — needed for exit handler to distinguish
  // intentional vs. accidental exit. On failure, exit handler cleans up enabled state.
  plugin.enabled = true;
  enabledPlugins.add(pluginId);

  // Handle messages from plugin
  child.on('message', (msg) => {
    if (msg.type === 'ready') {
      log('Plugin ready:', pluginId);
    } else if (msg.type === 'log') {
      // Plugin log forwarding
      log(`[Plugin:${pluginId}]`, msg.level || 'info', msg.message);
    } else if (msg.type === 'event') {
      // Forward events to renderer or other plugins
      if (mainWindow) {
        mainWindow.webContents.send('plugin:event', pluginId, msg.channel, msg.data);
      }
    }
  });

  // Handle plugin process events
  child.on('error', (err) => log('Plugin process error:', pluginId, err.message));
  child.on('exit', (code) => {
    log('Plugin process exited:', pluginId, code);
    pluginProcesses.delete(pluginId);
    // Only reset enabled state if this was not a manual disable
    if (plugin.enabled) {
      plugin.enabled = false;
      enabledPlugins.delete(pluginId);
      persistEnabledPlugins().catch(e => log('Failed to persist plugin state:', e.message));
    }
  });
  child.stderr?.on('data', (data) => console.error(`[Plugin:${pluginId}]`, data.toString()));

  await persistEnabledPlugins();
  log('Plugin enabled:', pluginId);

  if (plugin.instance.onActivate) {
    try {
      await plugin.instance.onActivate(createPluginContext(pluginId));
    } catch (e) {
      log('Plugin', pluginId, 'onActivate failed:', e.message);
    }
  }
}

async function disablePlugin(pluginId) {
  const plugin = loadedPlugins.get(pluginId);
  if (!plugin || !plugin.enabled) {
    log('Plugin not enabled:', pluginId);
    return;
  }
  if (plugin.instance.onDeactivate) {
    try {
      await plugin.instance.onDeactivate();
    } catch (e) {
      log('Plugin', pluginId, 'onDeactivate failed:', e.message);
    }
  }
  const child = pluginProcesses.get(pluginId);
  if (child) {
    child.kill();
    // Wait for process to actually exit before continuing
    await new Promise(resolve => {
      child.on('exit', resolve);
      setTimeout(resolve, 2000); // Timeout after 2s
    });
    pluginProcesses.delete(pluginId);
  }
  plugin.enabled = false;
  enabledPlugins.delete(pluginId);
  await persistEnabledPlugins();
  log('Plugin disabled:', pluginId);
}

async function initializePlugins() {
  loadEnabledPlugins();
  log('Discovering plugins...');
  const plugins = await discoverPlugins();
  log(`Found ${plugins.length} plugins`);
  for (const pluginInfo of plugins) {
    await loadPlugin(pluginInfo);
  }
  // Enable previously enabled plugins
  for (const pluginId of enabledPlugins) {
    if (loadedPlugins.has(pluginId)) {
      try {
        await enablePlugin(pluginId);
      } catch (e) {
        log('Failed to enable plugin:', pluginId, e.message);
      }
    }
  }
}

async function shutdownPlugins() {
  for (const pluginId of enabledPlugins) {
    try {
      await disablePlugin(pluginId);
    } catch (e) {
      log('Failed to disable plugin:', pluginId, e.message);
    }
  }
  log('Plugin manager shut down');
}

// ============================================================
// Connection Manager - Unified connection helpers
// Used by both handleControlCommand and IPC handlers
// ============================================================
// Session log buffer for performance optimization
const LOG_BUFFER_INTERVAL = 100; // ms
const LOG_BUFFER_MAX_SIZE = 4096; // bytes

function writeSessionLog(logId, direction, data) {
  const sessionLog = sessionLogs.get(logId);
  if (!sessionLog || !sessionLog.stream) return;

  // Add to buffer instead of writing directly
  const time = formatTime(new Date());
  let formatted;

  if (direction === 'send') {
    const cleanData = stripAnsi(String(data));
    const cmdLine = cleanData.replace(/\r?\n/g, '').trim();
    if (!cmdLine) return;
    formatted = Buffer.from(`[${time}] ${cmdLine}\n`, 'utf8');
  } else {
    const cleanData = stripAnsi(String(data));
    if (!cleanData) return;
    const lines = cleanData.split('\n');
    formatted = Buffer.from(lines.map(line => `[${time}] ${line}`).join('\n') + '\n', 'utf8');
  }

  // Accumulate in buffer
  sessionLog.buffer.push(formatted);
  sessionLog.bufferSize += formatted.length;

  // Flush if buffer is full
  if (sessionLog.bufferSize >= LOG_BUFFER_MAX_SIZE) {
    flushSessionLogBuffer(logId);
  }

  // Schedule periodic flush if not already scheduled
  if (!sessionLog.flushTimer) {
    sessionLog.flushTimer = setTimeout(() => {
      flushSessionLogBuffer(logId);
      sessionLog.flushTimer = null;
    }, LOG_BUFFER_INTERVAL);
  }
}

function flushSessionLogBuffer(logId) {
  const sessionLog = sessionLogs.get(logId);
  if (!sessionLog || !sessionLog.stream || sessionLog.buffer.length === 0) return;

  // Clear timer if exists
  if (sessionLog.flushTimer) {
    clearTimeout(sessionLog.flushTimer);
    sessionLog.flushTimer = null;
  }

  // Concatenate and write all buffered data at once
  const combined = Buffer.concat(sessionLog.buffer);
  sessionLog.buffer = [];
  sessionLog.bufferSize = 0;

  if (sessionLog.stream.writable) {
    sessionLog.stream.write(combined);
  }
}

// ============================================================

function connectSSH(connId, host, port, username, password, existingLogId) {
  const resolvedPort = parseInt(port, 10) || 22;
  if (sshConnections.has(connId)) return Promise.resolve('already connected');
  if (sshConnections.size >= MAX_CONNECTIONS.ssh) return Promise.reject(new Error('max SSH connections reached'));

  // Use existing logId if provided (e.g., on reconnect), otherwise create new
  const logId = existingLogId || createSessionLog('ssh', `${username}@${host}`, {
    Host: host, Port: String(resolvedPort), User: username
  });

  return new Promise((resolve, reject) => {
    try {
      const { Client } = require('ssh2');
      const client = new Client();

      // Store connection info for auto-reconnect
      const connInfo = { connId, host, port: resolvedPort, username, password, client, logId, reconnectAttempts: 0, maxReconnectAttempts: 3 };

      client.on('ready', () => {
        log('SSH ready for', connId);
        client.shell((err, stream) => {
          if (err) { reject(err); return; }
          stream.on('data', (data) => {
            const str = data.toString();
            if (mainWindow) mainWindow.webContents.send('ssh:data:' + connId, str);
            if (logId) writeSessionLog(logId, 'receive', str);
          });
          stream.stderr.on('data', (data) => {
            const str = data.toString();
            if (mainWindow) mainWindow.webContents.send('ssh:data:' + connId, str);
            if (logId) writeSessionLog(logId, 'receive', str);
          });
          stream.on('close', () => {
            // Attempt auto-reconnect
            if (connInfo.reconnectAttempts < connInfo.maxReconnectAttempts) {
              connInfo.reconnectAttempts++;
              log('SSH disconnected, attempting reconnect', connInfo.reconnectAttempts, '/', connInfo.maxReconnectAttempts);
              if (mainWindow) mainWindow.webContents.send('ssh:data:' + connId, `\r\n[Connection lost, reconnecting... attempt ${connInfo.reconnectAttempts}]\r\n`);
              // Remove this (old) entry from map before reconnecting so the old
              // stream's close handler won't delete the new connection entry.
              sshConnections.delete(connId);
              setTimeout(() => {
                // Pass existing logId to continue the same session log
                connectSSH(connId, host, connInfo.port, username, password, connInfo.logId).catch((e) => {
                  log('SSH reconnect failed:', e.message);
                  if (mainWindow) mainWindow.webContents.send('ssh:data:' + connId, `\r\n[Reconnect failed: ${e.message}]\r\n`);
                  sshConnections.delete(connId);
                  if (connInfo.logId) closeSessionLog(connInfo.logId);
                });
              }, 2000);
            } else {
              sshConnections.delete(connId);
              if (mainWindow) mainWindow.webContents.send('ssh:data:' + connId, '[Connection closed]\r\n');
              if (logId) closeSessionLog(logId);
            }
          });
          sshConnections.set(connId, { client, stream, logId, connInfo });
          if (mainWindow) mainWindow.webContents.send('ssh:data:' + connId, '[Connected to ' + host + ']\r\n');
          resolve('connected');
        });
      });
      client.on('error', (err) => {
        log('SSH error for', connId, ':', err.message);
        sshConnections.delete(connId);
        if (logId) closeSessionLog(logId);
        reject(err);
      });
      client.on('close', () => {
        log('SSH closed for', connId);
        // Only delete from map if this entry is still for this attempt.
        // During reconnect, the close handler of the OLD stream fires after
        // we've already deleted from the map, so this is a no-op.
        const entry = sshConnections.get(connId);
        if (entry && entry.connInfo === connInfo) {
          sshConnections.delete(connId);
        }
        if (logId) closeSessionLog(logId);
      });
      client.connect({ host, port: resolvedPort, username, password, readyTimeout: 20000 });
    } catch (e) {
      if (logId) closeSessionLog(logId);
      reject(e);
    }
  });
}

function disconnectSSH(connId) {
  const conn = sshConnections.get(connId);
  if (conn) {
    // Prevent auto-reconnect on manual disconnect
    if (conn.connInfo) conn.connInfo.maxReconnectAttempts = 0;
    try { conn.client.end(); } catch (e) {}
    if (conn.logId) closeSessionLog(conn.logId);
    sshConnections.delete(connId);
  }
  return 'disconnected';
}

function connectPowerShell(connId) {
  if (psConnections.has(connId)) return Promise.resolve('already connected');
  if (psConnections.size >= MAX_CONNECTIONS.ps) return Promise.reject(new Error('max PowerShell connections reached'));
  const ptyLib = ensureNodePty();
  if (!ptyLib) return Promise.reject(new Error('node-pty not available'));

  const logId = createSessionLog('powershell', `PowerShell_${connId}`);

  // Remove PSReadLine at startup — prevents input echo and inline prediction rendering
  // that corrupt the terminal display. Without PSReadLine, PowerShell behaves like a
  // dumb terminal; xterm.js handles all visual echo (no double echo).
  // Use ConPTY (conpty: true) to match VSCode's approach.
  const pty = ptyLib.spawn('powershell.exe', [
    '-NoLogo', '-NoExit', '-ExecutionPolicy', 'Bypass',
    '-Command', 'try { Remove-Module PSReadLine -Force -ErrorAction SilentlyContinue } catch {}',
  ], {
    name: 'xterm-256color', cols: 120, rows: 30, cwd: os.homedir(), env: process.env, conpty: true,
  });

  // VSCode-style: node-pty's outSocket.setEncoding('utf8') handles decoding
  pty.onData((data) => {
    if (mainWindow) mainWindow.webContents.send('ps:data:' + connId, data);
    if (logId) writeSessionLog(logId, 'receive', data);
  });

  pty.onExit(() => {
    psConnections.delete(connId);
    if (mainWindow) mainWindow.webContents.send('ps:data:' + connId, '\r\n[PowerShell exited]\r\n');
    if (logId) closeSessionLog(logId);
  });
  psConnections.set(connId, { pty, connId, logId });
  return Promise.resolve('connected');
}

function disconnectPowerShell(connId) {
  const conn = psConnections.get(connId);
  if (conn) {
    try { conn.pty.kill(); } catch (e) {}
    if (conn.logId) closeSessionLog(conn.logId);
    psConnections.delete(connId);
  }
  return 'disconnected';
}

function connectCMD(connId) {
  if (cmdConnections.has(connId)) return Promise.resolve('already connected');
  if (cmdConnections.size >= MAX_CONNECTIONS.cmd) return Promise.reject(new Error('max CMD connections reached'));
  const ptyLib = ensureNodePty();
  if (!ptyLib) return Promise.reject(new Error('node-pty not available'));

  const logId = createSessionLog('bash', `Bash_${connId}`);

  // Find Git Bash / MSYS2 bash
  // Try to convert MSYS2 path to Windows path using cygpath
  let bashPath = 'bash';
  try {
    const { execSync } = require('child_process');
    // Try to get Windows path from MSYS2-style path
    const msysPath = execSync('cygpath -w /usr/bin/bash.exe 2>/dev/null', { encoding: 'utf8', timeout: 3000 }).trim();
    if (msysPath && require('fs').existsSync(msysPath)) {
      bashPath = msysPath;
    }
  } catch (e) {
    // cygpath not available or failed, try direct paths
    const possiblePaths = [
      'F:\\worksapce\\app\\Git\\usr\\bin\\bash.exe',  // Git Bash
      'C:\\Windows\\System32\\bash.exe',              // WSL bash
      'C:\\Program Files\\Git\\bin\\bash.exe',
      'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
    ];
    for (const p of possiblePaths) {
      try {
        if (require('fs').existsSync(p)) {
          bashPath = p;
          break;
        }
      } catch (e2) { /* ignore */ }
    }
  }

  log('Using bash at:', bashPath);

  // Git Bash uses MSYS2, does not support ConPTY, use WinPTY mode (conpty: false)
  // Set LC_ALL=en_US.UTF-8 / LANG=en_US.UTF-8 to ensure UTF-8 output
  // Set a simple PS1 to avoid special character rendering issues in hostname
  const env = {
    ...process.env,
    LC_ALL: 'en_US.UTF-8',
    LANG: 'en_US.UTF-8',
    MSYS: 'enablewjdriver',  // Enable wide character support
    PS1: '\\u@\\h:\\w\\$ ',  // Simple prompt: user@host:path$
  };
  const pty = ptyLib.spawn(bashPath, ['--login', '-i'], {
    name: 'xterm-256color',
    cols: 120, rows: 30,
    cwd: os.homedir(),
    env,
    conpty: false,  // Git Bash doesn't support ConPTY
  });

  // node-pty's outSocket.setEncoding('utf8') handles decoding
  pty.onData((data) => {
    if (mainWindow) mainWindow.webContents.send('cmd:data:' + connId, data);
    if (logId) writeSessionLog(logId, 'receive', data);
  });

  pty.onExit(() => {
    cmdConnections.delete(connId);
    if (mainWindow) mainWindow.webContents.send('cmd:data:' + connId, '\r\n[Bash exited]\r\n');
    if (logId) closeSessionLog(logId);
  });
  cmdConnections.set(connId, { pty, connId, logId });
  return Promise.resolve('connected');
}

function disconnectCMD(connId) {
  const conn = cmdConnections.get(connId);
  if (conn) {
    try { conn.pty.kill(); } catch (e) {}
    if (conn.logId) closeSessionLog(conn.logId);
    cmdConnections.delete(connId);
  }
  return 'disconnected';
}

// Validate serial port path - only allow safe paths
function isValidSerialPort(port) {
  if (!port || typeof port !== 'string') return false;
  // Windows: COM1, COM2, etc.
  if (/^COM\d+$/i.test(port)) return true;
  // Linux/macOS: /dev/ttyXXX, /dev/cuXXX
  if (/^\/dev\/(tty|cu|usbserial|acm)\S+$/i.test(port)) return true;
  return false;
}

function connectSerial(connId, port, baudRate = 115200) {
  if (!isValidSerialPort(port)) return Promise.reject(new Error('invalid serial port'));
  if (serialConnections.size >= MAX_CONNECTIONS.serial) return Promise.reject(new Error('max serial connections reached'));

  const logId = createSessionLog('serial', `${port}_${baudRate}`, {
    Port: port, BaudRate: String(baudRate)
  });

  // P1-17: refCount allows multiple tabs to share the same port path
  const existingCount = serialPortRefCount.get(port) || 0;

  return new Promise((resolve, reject) => {
    try {
      const { SerialPort } = require('serialport');
      const sp = new SerialPort({
        path: port, baudRate: parseInt(baudRate), dataBits: 8, parity: 'none', stopBits: 1,
      });
      const isNewPort = existingCount === 0;
      serialConnections.set(connId, { port: sp, portPath: port, connId, baudRate, logId });
      if (isNewPort) serialPortRefCount.set(port, 1);
      else serialPortRefCount.set(port, existingCount + 1);

      sp.on('open', () => {
        if (mainWindow) mainWindow.webContents.send('serial:data:' + connId, '[Connected to ' + port + ' at ' + baudRate + ']\r\n');
        resolve('connected');
      });
      sp.on('data', (data) => {
        if (mainWindow) mainWindow.webContents.send('serial:data:' + connId, data.toString());
        if (logId) writeSessionLog(logId, 'receive', data.toString());
      });
      sp.on('error', (e) => {
        log('Serial error on', port, ':', e.message);
        if (e.disconnected) {
          if (mainWindow) mainWindow.webContents.send('serial:data:' + connId, '[Device disconnected (hot unplug)]\r\n');
        } else {
          if (mainWindow) mainWindow.webContents.send('serial:data:' + connId, '[Error] ' + e.message + '\r\n');
        }
      });
      sp.on('close', (hadError) => {
        // Physical port closed — notify ALL connIds sharing this port and clear
        log('Serial close event for', port, 'hadError:', hadError);
        for (const [cid, info] of serialConnections) {
          if (info.portPath === port) {
            if (mainWindow) {
              if (hadError) mainWindow.webContents.send('serial:data:' + cid, '[Disconnected due to error]\r\n');
              else mainWindow.webContents.send('serial:data:' + cid, '[Device disconnected]\r\n');
            }
            if (info.logId) closeSessionLog(info.logId);
            serialConnections.delete(cid);
          }
        }
        serialPortRefCount.delete(port);
      });
    } catch (e) {
      if (logId) closeSessionLog(logId);
      reject(e);
    }
  });
}

function disconnectSerialByConnId(connId) {
  const info = serialConnections.get(connId);
  if (!info) return 'not found';
  const portPath = info.portPath;
  if (info.logId) closeSessionLog(info.logId);
  serialConnections.delete(connId);

  // P1-17: decrement refCount, only close port when last connId disconnects
  const remaining = (serialPortRefCount.get(portPath) || 1) - 1;
  if (remaining <= 0) {
    serialPortRefCount.delete(portPath);
    // Only close if port is not already closed/in closing state
    // sp.on('close') will also clean up, so check if port is still open
    try {
      if (info.port && !info.port.isOpen) {
        // Port already closed by sp.on('close') handler
      } else if (info.port) {
        info.port.close();
      }
    } catch (e) {
      // Port may already be closed, ignore error
    }
  } else {
    serialPortRefCount.set(portPath, remaining);
  }
  return 'disconnected';
}

// Validate WebSocket URL - only allow ws:// and wss:// protocols
function isValidWebSocketUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'ws:' || parsed.protocol === 'wss:';
  } catch {
    return false;
  }
}

function connectWebSocket(connId, url, existingLogId) {
  if (wsConnections.has(connId)) return Promise.resolve('already connected');
  if (!isValidWebSocketUrl(url)) return Promise.reject(new Error('invalid WebSocket URL'));
  if (wsConnections.size >= MAX_CONNECTIONS.ws) return Promise.reject(new Error('max WebSocket connections reached'));

  // Use existing logId if provided (e.g., on reconnect), otherwise create new
  const logId = existingLogId || createSessionLog('websocket', url.replace(/[^a-zA-Z0-9]/g, '_'), { URL: url });

  // Store connection info for auto-reconnect
  const connInfo = { connId, url, logId, reconnectAttempts: 0, maxReconnectAttempts: 3, manualDisconnect: false };

  return new Promise((resolve, reject) => {
    try {
      const WebSocket = require('ws');
      const ws = new WebSocket(url);
      let timeoutId = null;

      // Set connection timeout
      timeoutId = setTimeout(() => {
        ws.terminate();
        reject(new Error('connection timeout'));
      }, 10000);

      ws.on('open', () => {
        clearTimeout(timeoutId);
        timeoutId = null;
        connInfo.reconnectAttempts = 0; // Reset on successful connect
        wsConnections.set(connId, { ws, url, logId, connInfo });
        if (mainWindow) mainWindow.webContents.send('ws:data:' + connId, '[Connected to ' + url + ']\n');
        resolve('connected');
      });
      ws.on('message', (data) => {
        const msg = data.toString();
        if (mainWindow) mainWindow.webContents.send('ws:data:' + connId, '< ' + msg + '\n');
        if (logId) writeSessionLog(logId, 'receive', '< ' + msg);
      });
      ws.on('error', (e) => {
        if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; }
        reject(new Error(e.message));
      });
      ws.on('close', () => {
        if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; }
        // Attempt auto-reconnect if not manual disconnect
        if (!connInfo.manualDisconnect && connInfo.reconnectAttempts < connInfo.maxReconnectAttempts) {
          connInfo.reconnectAttempts++;
          log('WS disconnected, attempting reconnect', connInfo.reconnectAttempts, '/', connInfo.maxReconnectAttempts);
          if (mainWindow) mainWindow.webContents.send('ws:data:' + connId, `\r\n[Connection lost, reconnecting... attempt ${connInfo.reconnectAttempts}]\r\n`);
          setTimeout(() => {
            // Pass existing logId to continue the same session log
            connectWebSocket(connId, url, connInfo.logId).catch((e) => { log('WS reconnect error:', e.message); });
          }, 2000);
        } else {
          wsConnections.delete(connId);
          if (logId) closeSessionLog(logId);
          if (mainWindow) mainWindow.webContents.send('ws:data:' + connId, '[Connection closed]\n');
        }
      });
    } catch (e) { reject(e); }
  });
}

function disconnectWebSocket(connId) {
  const conn = wsConnections.get(connId);
  if (conn) {
    // Mark as manual disconnect to prevent auto-reconnect
    if (conn.connInfo) conn.connInfo.manualDisconnect = true;
    try { conn.ws.close(); } catch (e) {}
    if (conn.logId) closeSessionLog(conn.logId);
    wsConnections.delete(connId);
  }
  return 'disconnected';
}

let executeCount = 0;
let streamWriteCount = 0;

function createWindow() {
  // Clear debug log on startup
  try { fs.writeFileSync(debugLogFile, ''); } catch (e) {}

  log('Creating window');
  mainWindow = new BrowserWindow({
    width: 1200, height: 800, minWidth: 900, minHeight: 600,
    frame: false, backgroundColor: '#1e1e1e',
    icon: path.join(__dirname, '../assets/SeeleLinkIcon.jpg'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });

  // Show and focus window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  log('NODE_ENV:', process.env.NODE_ENV);
  log('Loading from:', path.join(__dirname, '../dist-electron/index.html'));
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist-electron/index.html'));
  }

  mainWindow.webContents.on('crashed', () => { log('Renderer crashed'); });
  mainWindow.webContents.on('render-process-gone', (_, details) => { log('Renderer process gone:', details.reason, details.exitCode); });
  mainWindow.webContents.on('console-message', (_, level, msg) => { log('[Renderer console]', level, msg); });
  mainWindow.on('closed', () => { log('Window closed'); mainWindow = null; });
  log('Window created');
}

// ============================================================
// Control API Server (TCP, dynamic start/stop)
// ============================================================
let controlServer = null;

// Rate limiting: track requests per socket connection
const rateLimitWindow = 60 * 1000; // 1 minute window
const rateLimitMax = 500; // max requests per window per socket
const rateLimitPerSocket = new WeakMap(); // socket -> { count, resetTime }

// Also track per IP as fallback for non-localhost scenarios
const rateLimitPerIP = new Map(); // IP -> { count, resetTime }

function checkRateLimit(socket, ip) {
  const now = Date.now();

  // Per-socket rate limiting (works for localhost)
  let socketEntry = rateLimitPerSocket.get(socket);
  if (!socketEntry || now > socketEntry.resetTime) {
    socketEntry = { count: 0, resetTime: now + rateLimitWindow };
    rateLimitPerSocket.set(socket, socketEntry);
  }
  socketEntry.count++;
  if (socketEntry.count > rateLimitMax) return false;

  // Per-IP rate limiting (backup for non-localhost)
  if (ip !== '127.0.0.1' && ip !== '::1') {
    let ipEntry = rateLimitPerIP.get(ip);
    if (!ipEntry || now > ipEntry.resetTime) {
      ipEntry = { count: 0, resetTime: now + rateLimitWindow };
      rateLimitPerIP.set(ip, ipEntry);
    }
    ipEntry.count++;
    if (ipEntry.count > rateLimitMax * 10) return false;
  }

  return true;
}

// Cleanup expired rate limit entries every minute
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitPerIP) {
    if (now > entry.resetTime) {
      rateLimitPerIP.delete(ip);
    }
  }
}, 60000);

function startControlServer(cfg) {
  if (controlServer) {
    try { controlServer.close(); } catch (e) {}
    controlServer = null;
  }
  if (!cfg || !cfg.enabled) { log('Control API: disabled'); return; }

  const server = net.createServer(async (socket) => {
    const remoteAddr = socket.remoteAddress;
    log('Control API: client connected from', remoteAddr);
    let buffer = '';
    const MAX_BUFFER = 100 * 1024 * 1024; // 100MB max (needed for screenshot capture responses)
    socket.on('data', async (data) => {
      // Rate limit check per socket (works for localhost)
      if (!checkRateLimit(socket, remoteAddr)) {
        try { socket.write(JSON.stringify({ ok: false, error: 'rate limit exceeded' }) + '\n'); } catch (e) {}
        return;
      }

      buffer += data.toString();
      if (buffer.length > MAX_BUFFER) {
        buffer = '';
        socket.write(JSON.stringify({ ok: false, error: 'request too large' }) + '\n');
        return;
      }
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const req = JSON.parse(line);
          const result = await handleControlCommand(req);
          try { socket.write(JSON.stringify({ ok: true, result }) + '\n'); } catch (e) {}
        } catch (e) {
          try { socket.write(JSON.stringify({ ok: false, error: e.message }) + '\n'); } catch (e2) {}
        }
      }
    });
    socket.on('error', (e) => { log('Control API: socket error:', e.message); });
    socket.on('close', () => { log('Control API: client disconnected'); rateLimitPerSocket.delete(socket); });
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
  if (startPort > 65535) { callback(null); return; }
  const server = net.createServer();
  server.listen(startPort, host, () => {
    const port = server.address().port;
    server.close(() => callback(port));
  });
  server.on('error', () => {
    findAvailablePort(host, startPort + 1, callback);
  });
}

// ============================================================
// ============================================================
// MCP Server (HTTP + SSE, native implementation)
// ============================================================
let mcpHttpServer = null;
let mcpServer = null;
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
          port: { type: 'number', description: 'SSH port', default: 22 },
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
    // ── Window Automation ──────────────────────────────────────────────
    {
      name: 'window_capture',
      description: 'Capture a screenshot of the SeeleLink window. Returns a base64-encoded PNG image.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'window_get_bounds',
      description: 'Get the SeeleLink window position and size on screen.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'window_click',
      description: 'Simulate a mouse click at window-relative coordinates (0,0 = top-left of title bar).',
      inputSchema: {
        type: 'object',
        properties: {
          x: { type: 'number', description: 'X coordinate (window-relative)' },
          y: { type: 'number', description: 'Y coordinate (window-relative)' },
          button: { type: 'string', enum: ['left', 'right'], description: 'Mouse button (default: left)' },
        },
        required: ['x', 'y'],
      },
    },
    {
      name: 'window_move_mouse',
      description: 'Move the mouse cursor to window-relative coordinates without clicking.',
      inputSchema: {
        type: 'object',
        properties: {
          x: { type: 'number', description: 'X coordinate (window-relative)' },
          y: { type: 'number', description: 'Y coordinate (window-relative)' },
        },
        required: ['x', 'y'],
      },
    },
    {
      name: 'window_send_keys',
      description: 'Send keyboard input. Supports keys: A-Z, 0-9, Enter, Tab, Escape, ArrowUp/Down/Left/Right, Backspace, Delete, F1-F12, and Ctrl+/Shift+/Alt+ modifier combinations.',
      inputSchema: {
        type: 'object',
        properties: {
          keys: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of key names, e.g. ["Enter"] or ["Ctrl","a"]',
          },
        },
        required: ['keys'],
      },
    },
    // ── Window Capture Config ──────────────────────────────────────────
    {
      name: 'window_capture_get_config',
      description: 'Get current window capture mode (auto/foreground/gdi)',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'window_capture_set_config',
      description: 'Set window capture mode: auto (page capture with GDI fallback), foreground (bring to front first), gdi (full-screen crop)',
      inputSchema: {
        type: 'object',
        properties: {
          mode: { type: 'string', enum: ['auto', 'foreground', 'gdi'], description: 'Capture mode' },
        },
        required: ['mode'],
      },
    },
    // ── WebSocket ───────────────────────────────────────────────────────
    {
      name: 'ws_connect',
      description: 'Connect to a WebSocket server',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Connection ID' },
          url: { type: 'string', description: 'WebSocket server URL (e.g. ws://host:port)' },
        },
        required: ['id', 'url'],
      },
    },
    {
      name: 'ws_send',
      description: 'Send a message over a WebSocket connection',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Connection ID' },
          data: { type: 'string', description: 'Message data to send' },
        },
        required: ['id', 'data'],
      },
    },
    {
      name: 'ws_disconnect',
      description: 'Disconnect a WebSocket connection',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Connection ID' },
        },
        required: ['id'],
      },
    },
    // ── Android ─────────────────────────────────────────────────────────
    {
      name: 'android_devices',
      description: 'List connected Android devices via ADB',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'android_connect',
      description: 'Connect to an Android device for control',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Connection ID' },
          deviceId: { type: 'string', description: 'ADB device serial (e.g. 192.168.1.100:5555)' },
        },
        required: ['id', 'deviceId'],
      },
    },
    {
      name: 'android_screenshot',
      description: 'Take a screenshot of the Android device',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Connection ID' },
        },
        required: ['id'],
      },
    },
    {
      name: 'android_hierarchy',
      description: 'Dump the Android UI hierarchy (XML)',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Connection ID' },
        },
        required: ['id'],
      },
    },
    {
      name: 'android_pageinfo',
      description: 'Get full page info: screenshot + UI hierarchy + device properties',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Connection ID' },
        },
        required: ['id'],
      },
    },
    {
      name: 'android_tap',
      description: 'Tap at screen coordinates on Android device',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Connection ID' },
          x: { type: 'number', description: 'X coordinate' },
          y: { type: 'number', description: 'Y coordinate' },
        },
        required: ['id', 'x', 'y'],
      },
    },
    {
      name: 'android_swipe',
      description: 'Swipe gesture on Android device',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Connection ID' },
          startX: { type: 'number', description: 'Start X' },
          startY: { type: 'number', description: 'Start Y' },
          endX: { type: 'number', description: 'End X' },
          endY: { type: 'number', description: 'End Y' },
          duration: { type: 'number', description: 'Duration in ms (default 300)' },
        },
        required: ['id', 'startX', 'startY', 'endX', 'endY'],
      },
    },
    {
      name: 'android_text',
      description: 'Input text into the focused field on Android',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Connection ID' },
          text: { type: 'string', description: 'Text to input' },
        },
        required: ['id', 'text'],
      },
    },
    {
      name: 'android_key',
      description: 'Send a keyevent to Android device',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Connection ID' },
          keycode: { type: 'string', description: 'Android keycode (e.g. 4=back, 3=home, 82=menu)' },
        },
        required: ['id', 'keycode'],
      },
    },
    {
      name: 'android_disconnect',
      description: 'Disconnect from Android device',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Connection ID' },
        },
        required: ['id'],
      },
    },
    // ── Control Service (Mouse / Keyboard / Screen) ─────────────────────
    {
      name: 'control_mouse_position',
      description: 'Get current mouse cursor position on screen',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'control_mouse_move',
      description: 'Move mouse cursor to absolute screen coordinates',
      inputSchema: {
        type: 'object',
        properties: {
          x: { type: 'number', description: 'X coordinate' },
          y: { type: 'number', description: 'Y coordinate' },
        },
        required: ['x', 'y'],
      },
    },
    {
      name: 'control_mouse_click',
      description: 'Click at absolute screen coordinates',
      inputSchema: {
        type: 'object',
        properties: {
          x: { type: 'number', description: 'X coordinate' },
          y: { type: 'number', description: 'Y coordinate' },
          button: { type: 'string', enum: ['left', 'right', 'middle'], description: 'Mouse button (default: left)' },
        },
        required: ['x', 'y'],
      },
    },
    {
      name: 'control_mouse_drag',
      description: 'Drag from one position to another (hold and move)',
      inputSchema: {
        type: 'object',
        properties: {
          fromX: { type: 'number', description: 'Start X coordinate' },
          fromY: { type: 'number', description: 'Start Y coordinate' },
          toX: { type: 'number', description: 'End X coordinate' },
          toY: { type: 'number', description: 'End Y coordinate' },
        },
        required: ['fromX', 'fromY', 'toX', 'toY'],
      },
    },
    {
      name: 'control_keyboard_type',
      description: 'Type a string using system keyboard input',
      inputSchema: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Text string to type' },
        },
        required: ['text'],
      },
    },
    {
      name: 'control_keyboard_press',
      description: 'Press a single special key',
      inputSchema: {
        type: 'object',
        properties: {
          key: { type: 'string', description: 'Key name: Enter, Escape, Tab, Backspace, Delete, ArrowUp/Down/Left/Right, Home, End, PageUp, PageDown' },
        },
        required: ['key'],
      },
    },
    {
      name: 'control_keyboard_press_keys',
      description: 'Press multiple keys simultaneously (modifier + key)',
      inputSchema: {
        type: 'object',
        properties: {
          keys: { type: 'array', items: { type: 'string' }, description: 'Array of keys e.g. ["Ctrl","a"] or ["Shift","x"]' },
        },
        required: ['keys'],
      },
    },
    {
      name: 'control_screen_capture',
      description: 'Capture full primary screen as PNG',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'control_screen_capture_region',
      description: 'Capture a screen region as PNG',
      inputSchema: {
        type: 'object',
        properties: {
          x: { type: 'number', description: 'X coordinate' },
          y: { type: 'number', description: 'Y coordinate' },
          width: { type: 'number', description: 'Region width' },
          height: { type: 'number', description: 'Region height' },
        },
        required: ['x', 'y', 'width', 'height'],
      },
    },
    // ── ADB ────────────────────────────────────────────────────────────
    {
      name: 'exec_adb',
      description: 'Execute an arbitrary ADB command',
      inputSchema: {
        type: 'object',
        properties: {
          args: { type: 'array', items: { type: 'string' }, description: 'ADB command arguments e.g. ["devices"] or ["-s","deviceId","shell","ls"]' },
        },
        required: ['args'],
      },
    },
    // ── App Debug ───────────────────────────────────────────────────────
    {
      name: 'app_get_state',
      description: 'Get the current state of the app tab system',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'app_send_text',
      description: 'Send text to the focused element character by character',
      inputSchema: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Text to send' },
        },
        required: ['text'],
      },
    },
    {
      name: 'app_get_connections',
      description: 'Get all saved connections',
      inputSchema: { type: 'object', properties: {} },
    },
    // ── Window Control ─────────────────────────────────────────────
    {
      name: 'window_bounds',
      description: 'Get window position, size, and content area bounds',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'window_minimize',
      description: 'Minimize the SeeleLink window',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'window_maximize',
      description: 'Maximize or restore the SeeleLink window',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'window_close',
      description: 'Close the SeeleLink window (quit app)',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'window_switch_tab',
      description: 'Switch the SeeleLink UI to a specific tab',
      inputSchema: {
        type: 'object',
        properties: {
          tab: { type: 'string', description: 'Tab name: ssh, serial, ps, cmd, ws, android, ir, settings' },
        },
        required: ['tab'],
      },
    },
    // ── Screen Control ─────────────────────────────────────────────
    {
      name: 'control_screen_capture_window',
      description: 'Capture the SeeleLink window using GDI crop',
      inputSchema: {
        type: 'object',
        properties: {
          x: { type: 'number', description: 'X coordinate of window on screen' },
          y: { type: 'number', description: 'Y coordinate of window on screen' },
          width: { type: 'number', description: 'Window width' },
          height: { type: 'number', description: 'Window height' },
        },
        required: ['x', 'y', 'width', 'height'],
      },
    },
    {
      name: 'control_screen_bring_to_foreground',
      description: 'Bring SeeleLink window to foreground',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'control_screen_list',
      description: 'List available displays/screens',
      inputSchema: { type: 'object', properties: {} },
    },
    // ── IR ─────────────────────────────────────────────────────────
    {
      name: 'ir_load',
      description: 'Load saved IR command data',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'ir_save',
      description: 'Save IR command data',
      inputSchema: {
        type: 'object',
        properties: {
          data: { type: 'string', description: 'IR data to save' },
        },
        required: ['data'],
      },
    },
    // ── Session Log ────────────────────────────────────────────────
    {
      name: 'log_get_config',
      description: 'Get current session log configuration',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'log_set_config',
      description: 'Update session log configuration',
      inputSchema: {
        type: 'object',
        properties: {
          enabled: { type: 'boolean', description: 'Enable/disable logging' },
          path: { type: 'string', description: 'Log directory path (null for default)' },
        },
      },
    },
    {
      name: 'log_get_dir',
      description: 'Get the session log directory path',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'log_open_folder',
      description: 'Open the session log folder in file explorer',
      inputSchema: {
        type: 'object',
        properties: {
          logId: { type: 'string', description: 'Optional log ID to open specific folder' },
        },
      },
    },
    // ── Settings ──────────────────────────────────────────────────
    {
      name: 'control_api_get_config',
      description: 'Get Control API server configuration',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'control_api_set_config',
      description: 'Update Control API server configuration',
      inputSchema: {
        type: 'object',
        properties: {
          enabled: { type: 'boolean', description: 'Enable/disable server' },
          host: { type: 'string', description: 'Host address' },
          port: { type: 'number', description: 'Port number' },
        },
      },
    },
    {
      name: 'mcp_api_get_config',
      description: 'Get MCP server configuration',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'mcp_api_set_config',
      description: 'Update MCP server configuration',
      inputSchema: {
        type: 'object',
        properties: {
          enabled: { type: 'boolean', description: 'Enable/disable server' },
          host: { type: 'string', description: 'Host address' },
          port: { type: 'number', description: 'Port number' },
        },
      },
    },
    // ── App Debug ─────────────────────────────────────────────────
    {
      name: 'app_focus_tab',
      description: 'Focus/activate a specific tab by ID',
      inputSchema: {
        type: 'object',
        properties: {
          tabId: { type: 'string', description: 'Tab ID to focus' },
        },
        required: ['tabId'],
      },
    },
    {
      name: 'app_get_focus',
      description: 'Get the currently focused DOM element',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'app_open_and_connect',
      description: 'Create a new connection tab and connect',
      inputSchema: {
        type: 'object',
        properties: {
          type: { type: 'string', description: 'Connection type: ssh, serial, ps, cmd, ws' },
          id: { type: 'string', description: 'Connection ID' },
          host: { type: 'string', description: 'Host/address' },
          username: { type: 'string', description: 'Username' },
          password: { type: 'string', description: 'Password' },
        },
        required: ['type', 'id'],
      },
    },
    {
      name: 'app_debug_iframes',
      description: 'Inspect iframes in the renderer (for terminal access debugging)',
      inputSchema: { type: 'object', properties: {} },
    },
    // ── Keyboard (copy/paste/cut/selectAll) ─────────────────────────────────
    {
      name: 'control_keyboard_copy',
      description: 'Copy selection (Ctrl+C)',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'control_keyboard_paste',
      description: 'Paste clipboard content (Ctrl+V)',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'control_keyboard_cut',
      description: 'Cut selection (Ctrl+X)',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'control_keyboard_select_all',
      description: 'Select all (Ctrl+A)',
      inputSchema: { type: 'object', properties: {} },
    },
    // ── Debug ────────────────────────────────────────────────────────────────
    {
      name: 'control_debug_set_level',
      description: 'Set debug log level',
      inputSchema: {
        type: 'object',
        properties: { level: { type: 'string', description: 'Level: error, warn, info, debug, trace' } },
        required: ['level'],
      },
    },
    {
      name: 'control_debug_export',
      description: 'Export debug logs as JSON or text',
      inputSchema: {
        type: 'object',
        properties: { format: { type: 'string', description: 'Format: json or text' } },
      },
    },
    // ── Window State ───────────────────────────────────────────────────────
    {
      name: 'window_is_maximized',
      description: 'Query whether the SeeleLink window is maximized',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'window_start_debug',
      description: 'Start debug mode — captures mouse clicks and key presses for coordinate discovery',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'window_stop_debug',
      description: 'Stop debug mode',
      inputSchema: { type: 'object', properties: {} },
    },
    // ── Android ─────────────────────────────────────────────────────────────
    {
      name: 'android_get_local_ip',
      description: 'Get all local IPv4 addresses of the machine',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'android_scan_network',
      description: 'Scan LAN for Android ADB devices (port 5555)',
      inputSchema: {
        type: 'object',
        properties: {
          timeout: { type: 'number', description: 'Timeout per IP in ms (default 3000)' },
          targetIp: { type: 'string', description: 'Single IP to check (optional)' },
          port: { type: 'number', description: 'Port to check (default 5555)' },
        },
      },
    },
    // ── Config ───────────────────────────────────────────────────────────────
    {
      name: 'control_api_find_available_port',
      description: 'Find an available port on the given host',
      inputSchema: {
        type: 'object',
        properties: { host: { type: 'string', description: 'Host to check (default 127.0.0.1)' } },
      },
    },
    {
      name: 'mcp_api_find_available_port',
      description: 'Find an available port on the given host',
      inputSchema: {
        type: 'object',
        properties: { host: { type: 'string', description: 'Host to check (default 127.0.0.1)' } },
      },
    },
    // ── Plugins ─────────────────────────────────────────────────────────────
    {
      name: 'plugin_list',
      description: 'List all discovered plugins',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'plugin_get',
      description: 'Get details of a specific plugin',
      inputSchema: {
        type: 'object',
        properties: { pluginId: { type: 'string', description: 'Plugin ID' } },
        required: ['pluginId'],
      },
    },
    {
      name: 'plugin_enable',
      description: 'Enable a plugin',
      inputSchema: {
        type: 'object',
        properties: { pluginId: { type: 'string', description: 'Plugin ID' } },
        required: ['pluginId'],
      },
    },
    {
      name: 'plugin_disable',
      description: 'Disable a plugin',
      inputSchema: {
        type: 'object',
        properties: { pluginId: { type: 'string', description: 'Plugin ID' } },
        required: ['pluginId'],
      },
    },
    {
      name: 'plugin_uninstall',
      description: 'Uninstall a plugin (disables and removes files)',
      inputSchema: {
        type: 'object',
        properties: { pluginId: { type: 'string', description: 'Plugin ID' } },
        required: ['pluginId'],
      },
    },
    // ── Dialog ─────────────────────────────────────────────────────────────
    {
      name: 'dialog_open_directory',
      description: 'Open a directory picker dialog and return the selected path',
      inputSchema: { type: 'object', properties: {} },
    },
    // ── App Info ───────────────────────────────────────────────────────────
    {
      name: 'app_get_info',
      description: 'Get application version and platform information',
      inputSchema: { type: 'object', properties: {} },
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
    // Load MCP SDK via ESM dynamic import (SDK is ESM-only)
    const { Server: McpServer } = await import('@modelcontextprotocol/sdk/server');
    const { StreamableHTTPServerTransport } = await import('@modelcontextprotocol/sdk/server/streamableHttp.js');
    const { ListToolsRequestSchema, CallToolRequestSchema } = await import('@modelcontextprotocol/sdk/types.js');

    // Factory: fresh McpServer per HTTP request (SDK requires separate Protocol per connection)
    function createMcpServer() {
      const srv = new McpServer(
        { name: 'SeeleLink', version: '0.1.0' },
        { capabilities: { tools: {} } }
      );
    srv.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: buildMcpTools(),
    }));


    srv.setRequestHandler(CallToolRequestSchema, async (req) => {
      try {
        const { name, arguments: args = {} } = req.params || {};
        log('MCP tool call:', name, JSON.stringify(args));

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
            const ptyLib = ensureNodePty();
            if (!ptyLib) return { content: [{ type: 'text', text: 'node-pty not available' }], isError: true };
            if (psConnections.has(args.id)) return { content: [{ type: 'text', text: 'already connected' }] };
            const pty = ptyLib.spawn('powershell.exe', [
              '-NoLogo', '-NoExit', '-ExecutionPolicy', 'Bypass',
              '-Command', 'try { Remove-Module PSReadLine -Force -ErrorAction SilentlyContinue } catch {}',
            ], {
              name: 'xterm-256color', cols: 120, rows: 30, cwd: os.homedir(), env: process.env, conpty: false,
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
            const ptyLib = ensureNodePty();
            if (!ptyLib) return { content: [{ type: 'text', text: 'node-pty not available' }], isError: true };
            if (cmdConnections.has(args.id)) return { content: [{ type: 'text', text: 'already connected' }] };
            const pty = ptyLib.spawn('cmd.exe', [], {
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
              client.connect({ host: args.host, port: args.port || 22, username: args.username, password: args.password, readyTimeout: 20000 });
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
              const comPorts = ports.map(p => ({
                path: p.path,
                manufacturer: p.manufacturer || '',
                serialNumber: p.serialNumber || '',
              })).filter(p => p.path && p.path.startsWith('COM'));
              return { content: [{ type: 'text', text: JSON.stringify(comPorts) }] };
            } catch (e) {
              return { content: [{ type: 'text', text: 'Error: ' + e.message }], isError: true };
            }
          }

          case 'serial_connect': {
            if (serialConnections.has(args.id)) return { content: [{ type: 'text', text: 'connection exists' }], isError: true };
            try {
              await connectSerial(args.id, args.port, args.baudRate || 115200);
              return { content: [{ type: 'text', text: 'Serial ' + args.port + ' connected [' + args.id + ']' }] };
            } catch (e) {
              return { content: [{ type: 'text', text: e.message }], isError: true };
            }
          }

          case 'serial_send': {
            const conn = serialConnections.get(args.id);
            if (!conn) return { content: [{ type: 'text', text: 'not connected' }], isError: true };
            const data = args.newline ? args.data + '\r\n' : args.data;
            conn.port.write(data);
            return { content: [{ type: 'text', text: 'sent' }] };
          }

          case 'serial_disconnect': {
            const result = disconnectSerialByConnId(args.id);
            return { content: [{ type: 'text', text: result }] };
          }

          // ── Window Automation ──────────────────────────────────────────────
          case 'window_capture': {
            try {
              const result = await doWindowCapture();
              if (result.error) return { content: [{ type: 'text', text: result.error }], isError: true };
              return { content: [{ type: 'image', data: result.png, mimeType: 'image/png' }] };
            } catch (e) { return { content: [{ type: 'text', text: e.message }], isError: true }; }
          }

          case 'window_get_bounds': {
            if (!mainWindow) return { content: [{ type: 'text', text: 'no window' }], isError: true };
            const b = mainWindow.getBounds();
            const c = mainWindow.getContentBounds();
            return { content: [{ type: 'text', text: JSON.stringify({ window: b, content: c, titleBarOffset: b.height - c.height }) }] };
          }

          case 'window_click': {
            if (!mainWindow) return { content: [{ type: 'text', text: 'no window' }], isError: true };
            const { x, y, button = 'left' } = args;
            const bounds = mainWindow.getBounds();
            const absX = Math.round(bounds.x + sanitizeCoordinate(x, 0));
            const absY = Math.round(bounds.y + sanitizeCoordinate(y, 0));
            if (isNaN(absX) || isNaN(absY)) return { content: [{ type: 'text', text: 'Invalid coordinates' }], isError: true };
            // Whitelist button values to prevent shell injection
            const btn = button === 'right' ? 'Right' : button === 'middle' ? 'Middle' : 'Left';
            const { exec } = require('child_process');
            exec(`powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Cursor]::Position = [System.Drawing.Point]::new(${absX},${absY}); [System.Windows.Forms.MouseEvent]::MouseDown([System.Windows.Forms.MouseButtons]::${btn}); [System.Windows.Forms.MouseEvent]::MouseUp([System.Windows.Forms.MouseButtons]::${btn});"`, (e) => { if (e) log('Mouse click exec error:', e.message); });
            return { content: [{ type: 'text', text: JSON.stringify({ ok: true, absX, absY }) }] };
          }

          case 'window_move_mouse': {
            if (!mainWindow) return { content: [{ type: 'text', text: 'no window' }], isError: true };
            const { x, y } = args;
            const bounds = mainWindow.getBounds();
            const absX = Math.round(bounds.x + sanitizeCoordinate(x, 0));
            const absY = Math.round(bounds.y + sanitizeCoordinate(y, 0));
            if (isNaN(absX) || isNaN(absY)) return { content: [{ type: 'text', text: 'Invalid coordinates' }], isError: true };
            const { exec } = require('child_process');
            exec(`powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Cursor]::Position = [System.Drawing.Point]::new(${absX},${absY})"`, (e) => { if (e) log('Mouse move exec error:', e.message); });
            return { content: [{ type: 'text', text: JSON.stringify({ ok: true, absX, absY }) }] };
          }

          case 'window_send_keys': {
            if (!mainWindow) return { content: [{ type: 'text', text: 'no window' }], isError: true };
            const { keys } = args;
            if (!Array.isArray(keys)) return { content: [{ type: 'text', text: 'keys must be an array' }], isError: true };
            try {
              for (const key of keys) {
                const kc = keyToKeyCode(key);
                if (!kc) continue;
                mainWindow.webContents.sendInputEvent({ type: 'keyDown', keyCode: kc.vk, modifiers: kc.modifiers || [] });
                mainWindow.webContents.sendInputEvent({ type: 'keyUp', keyCode: kc.vk, modifiers: kc.modifiers || [] });
              }
              return { content: [{ type: 'text', text: JSON.stringify({ ok: true, sent: keys }) }] };
            } catch (e) { return { content: [{ type: 'text', text: e.message }], isError: true }; }
          }

          // ── Window Capture Config ───────────────────────────────────────
          case 'window_capture_get_config': {
            return { content: [{ type: 'text', text: JSON.stringify(appConfig.windowCapture || { mode: 'auto' }) }] };
          }

          case 'window_capture_set_config': {
            const { mode } = args;
            if (!['auto', 'foreground', 'gdi'].includes(mode)) {
              return { content: [{ type: 'text', text: 'Invalid mode. Use: auto, foreground, gdi' }], isError: true };
            }
            const cfg = loadConfig();
            cfg.windowCapture = { mode };
            saveConfig(cfg);
            appConfig = cfg;
            log('MCP: windowCapture mode set to', mode);
            return { content: [{ type: 'text', text: JSON.stringify({ mode }) }] };
          }

          // ── WebSocket ───────────────────────────────────────────────────────
          case 'ws_connect': {
            const { id, url } = args;
            if (wsConnections.has(id)) return { content: [{ type: 'text', text: 'already connected' }] };
            try {
              const WebSocket = require('ws');
              const ws = new WebSocket(url);
              wsConnections.set(id, { ws, url });
              return new Promise((resolve) => {
                ws.on('open', () => {
                  ws.on('message', (data) => {
                    if (mainWindow) mainWindow.webContents.send('ws:data:' + id, data.toString());
                  });
                  ws.on('close', () => {
                    wsConnections.delete(id);
                    if (mainWindow) mainWindow.webContents.send('ws:data:' + id, '[Disconnected]\n');
                  });
                  if (mainWindow) mainWindow.webContents.send('ws:data:' + id, '[Connected to ' + url + ']\n');
                  resolve({ content: [{ type: 'text', text: 'WebSocket connected [' + id + '] to ' + url }] });
                });
                ws.on('error', (e) => {
                  wsConnections.delete(id);
                  resolve({ content: [{ type: 'text', text: 'WebSocket error: ' + e.message }], isError: true });
                });
                // Timeout after 10s
                setTimeout(() => {
                  if (ws.readyState !== WebSocket.OPEN) {
                    ws.terminate();
                    wsConnections.delete(id);
                    resolve({ content: [{ type: 'text', text: 'timeout connecting to ' + url }], isError: true });
                  }
                }, 10000);
              });
            } catch (e) {
              return { content: [{ type: 'text', text: e.message }], isError: true };
            }
          }

          case 'ws_send': {
            const { id, data } = args;
            const conn = wsConnections.get(id);
            if (!conn) return { content: [{ type: 'text', text: 'not connected' }], isError: true };
            if (conn.ws.readyState !== 1) return { content: [{ type: 'text', text: 'not open (state: ' + conn.ws.readyState + ')' }], isError: true };
            try {
              conn.ws.send(data);
              return { content: [{ type: 'text', text: 'sent' }] };
            } catch (e) {
              return { content: [{ type: 'text', text: 'error: ' + e.message }], isError: true };
            }
          }

          case 'ws_disconnect': {
            const { id } = args;
            const conn = wsConnections.get(id);
            if (conn) { conn.ws.close(); wsConnections.delete(id); }
            return { content: [{ type: 'text', text: 'disconnected' }] };
          }

          // ── Android ─────────────────────────────────────────────────────────
          case 'android_devices': {
            const { execSync } = require('child_process');
            try {
              const out = execSync('adb devices -l', { encoding: 'utf8', timeout: 10000 });
              const lines = out.trim().split('\n').slice(1);
              const devices = [];
              for (const line of lines) {
                const parts = line.trim().split(/\s+/);
                if (parts.length >= 2) {
                  const id = parts[0];
                  const state = parts[1];
                  const model = parts.find(p => p.startsWith('model:'))?.replace('model:', '') || null;
                  const product = parts.find(p => p.startsWith('product:'))?.replace('product:', '') || null;
                  devices.push({ id, state, model, product });
                }
              }
              return { content: [{ type: 'text', text: JSON.stringify(devices) }] };
            } catch (e) {
              return { content: [{ type: 'text', text: 'Error: ' + e.message }], isError: true };
            }
          }

          case 'android_connect': {
            const { id, deviceId } = args;
            if (!deviceId) return { content: [{ type: 'text', text: 'device ID required' }], isError: true };
            const safeDeviceId = sanitizeDeviceId(deviceId);
            if (!safeDeviceId) return { content: [{ type: 'text', text: 'Invalid device ID' }], isError: true };
            const { execSync } = require('child_process');
            try {
              execSync('adb -s ' + safeDeviceId + ' get-state', { encoding: 'utf8', timeout: 5000 });
              androidConnections.set(id, { deviceId: safeDeviceId, client: null });
              if (mainWindow) mainWindow.webContents.send('android:data:' + id, '[Android device connected: ' + safeDeviceId + ']\r\n');
              return { content: [{ type: 'text', text: 'Android device connected [' + id + ']: ' + safeDeviceId }] };
            } catch (e) {
              return { content: [{ type: 'text', text: 'Device not found or offline: ' + e.message }], isError: true };
            }
          }

          case 'android_screenshot': {
            const { id } = args;
            const conn = androidConnections.get(id);
            if (!conn) return { content: [{ type: 'text', text: 'not connected' }], isError: true };
            const { execSync } = require('child_process');
            try {
              const buf = execSync('adb -s ' + conn.deviceId + ' exec-out screencap -p', { encoding: 'binary', timeout: 10000 });
              const base64 = Buffer.from(buf, 'binary').toString('base64');
              return { content: [{ type: 'image', data: base64, mimeType: 'image/png' }] };
            } catch (e) {
              return { content: [{ type: 'text', text: 'Screenshot failed: ' + e.message }], isError: true };
            }
          }

          case 'android_hierarchy': {
            const { id } = args;
            const conn = androidConnections.get(id);
            if (!conn) return { content: [{ type: 'text', text: 'not connected' }], isError: true };
            const { execSync } = require('child_process');
            try {
              let xml;
              try {
                execSync('adb -s ' + conn.deviceId + ' shell uiautomator2 dump /sdcard/dump.xml', { encoding: 'utf8', timeout: 5000 });
                xml = execSync('adb -s ' + conn.deviceId + ' shell cat /sdcard/dump.xml', { encoding: 'utf8', timeout: 5000 });
              } catch (e2) {
                xml = execSync('adb -s ' + conn.deviceId + ' shell dumpsys uifault uihierarchy', { encoding: 'utf8', timeout: 5000 });
              }
              return { content: [{ type: 'text', text: xml }] };
            } catch (e) {
              return { content: [{ type: 'text', text: 'Hierarchy dump failed: ' + e.message }], isError: true };
            }
          }

          case 'android_pageinfo': {
            const { id } = args;
            const conn = androidConnections.get(id);
            if (!conn) return { content: [{ type: 'text', text: 'not connected' }], isError: true };
            const { execSync } = require('child_process');
            try {
              const buf = execSync('adb -s ' + conn.deviceId + ' exec-out screencap -p', { encoding: 'binary', timeout: 10000 });
              const screenshot = Buffer.from(buf, 'binary').toString('base64');
              let xml = '';
              try {
                execSync('adb -s ' + conn.deviceId + ' shell uiautomator2 dump /sdcard/dump.xml', { encoding: 'utf8', timeout: 5000 });
                xml = execSync('adb -s ' + conn.deviceId + ' shell cat /sdcard/dump.xml', { encoding: 'utf8', timeout: 5000 });
              } catch (e2) {
                xml = execSync('adb -s ' + conn.deviceId + ' shell dumpsys uifault uihierarchy', { encoding: 'utf8', timeout: 5000 });
              }
              const model = (execSync('adb -s ' + conn.deviceId + ' shell getprop ro.product.model', { encoding: 'utf8', timeout: 3000 }) || '').trim();
              const manufacturer = (execSync('adb -s ' + conn.deviceId + ' shell getprop ro.product.manufacturer', { encoding: 'utf8', timeout: 3000 }) || '').trim();
              const version = (execSync('adb -s ' + conn.deviceId + ' shell getprop ro.build.version.release', { encoding: 'utf8', timeout: 3000 }) || '').trim();
              return { content: [{ type: 'text', text: JSON.stringify({ screenshot, xml, deviceInfo: { model, manufacturer, version } }) }] };
            } catch (e) {
              return { content: [{ type: 'text', text: 'Page info failed: ' + e.message }], isError: true };
            }
          }

          case 'android_tap': {
            const { id, x, y } = args;
            const conn = androidConnections.get(id);
            if (!conn) return { content: [{ type: 'text', text: 'not connected' }], isError: true };
            const safeX = sanitizeCoordinate(x);
            const safeY = sanitizeCoordinate(y);
            const { execSync } = require('child_process');
            try {
              execSync('adb -s ' + conn.deviceId + ' shell input tap ' + safeX + ' ' + safeY, { encoding: 'utf8', timeout: 5000 });
              return { content: [{ type: 'text', text: 'ok' }] };
            } catch (e) {
              return { content: [{ type: 'text', text: e.message }], isError: true };
            }
          }

          case 'android_swipe': {
            const { id, startX, startY, endX, endY, duration } = args;
            const conn = androidConnections.get(id);
            if (!conn) return { content: [{ type: 'text', text: 'not connected' }], isError: true };
            const safeStartX = sanitizeCoordinate(startX);
            const safeStartY = sanitizeCoordinate(startY);
            const safeEndX = sanitizeCoordinate(endX);
            const safeEndY = sanitizeCoordinate(endY);
            const safeDur = sanitizeCoordinate(duration, 300);
            const { execSync } = require('child_process');
            try {
              execSync('adb -s ' + conn.deviceId + ' shell input touchscreen swipe ' + safeStartX + ' ' + safeStartY + ' ' + safeEndX + ' ' + safeEndY + ' ' + safeDur, { encoding: 'utf8', timeout: 5000 });
              return { content: [{ type: 'text', text: 'ok' }] };
            } catch (e) {
              return { content: [{ type: 'text', text: e.message }], isError: true };
            }
          }

          case 'android_text': {
            const { id, text } = args;
            const conn = androidConnections.get(id);
            if (!conn) return { content: [{ type: 'text', text: 'not connected' }], isError: true };
            if (!text || typeof text !== 'string') return { content: [{ type: 'text', text: 'Invalid text' }], isError: true };
            // Sanitize text: remove dangerous shell characters, keep only safe ones
            // Android input text uses %s for spaces
            const safeText = text.replace(/[^a-zA-Z0-9._+\-=:,@#% ]/g, '').substring(0, 500);
            const escaped = safeText.replace(/ /g, '%s');
            const { execSync } = require('child_process');
            try {
              execSync('adb -s ' + conn.deviceId + ' shell input text "' + escaped + '"', { encoding: 'utf8', timeout: 5000 });
              return { content: [{ type: 'text', text: 'ok' }] };
            } catch (e) {
              return { content: [{ type: 'text', text: e.message }], isError: true };
            }
          }

          case 'android_key': {
            const { id, keycode } = args;
            const conn = androidConnections.get(id);
            if (!conn) return { content: [{ type: 'text', text: 'not connected' }], isError: true };
            const safeKeycode = parseInt(keycode, 10);
            if (isNaN(safeKeycode) || safeKeycode < 0 || safeKeycode > 300) return { content: [{ type: 'text', text: 'Invalid keycode' }], isError: true };
            const { execSync } = require('child_process');
            try {
              execSync('adb -s ' + conn.deviceId + ' shell input keyevent ' + safeKeycode, { encoding: 'utf8', timeout: 5000 });
              return { content: [{ type: 'text', text: 'ok' }] };
            } catch (e) {
              return { content: [{ type: 'text', text: e.message }], isError: true };
            }
          }

          case 'android_disconnect': {
            const { id } = args;
            const conn = androidConnections.get(id);
            if (conn) { androidConnections.delete(id); if (mainWindow) mainWindow.webContents.send('android:data:' + id, '[Android device disconnected]\r\n'); }
            return { content: [{ type: 'text', text: 'disconnected' }] };
          }

          // ── Control Service ────────────────────────────────────────────────
          case 'control_mouse_position': {
            if (!controlService?.mouse) return { content: [{ type: 'text', text: 'control service not available' }], isError: true };
            const result = await controlService.mouse.getPosition();
            return { content: [{ type: 'text', text: JSON.stringify(result) }] };
          }

          case 'control_mouse_move': {
            if (!controlService?.mouse) return { content: [{ type: 'text', text: 'control service not available' }], isError: true };
            await controlService.mouse.setPosition(args.x, args.y);
            return { content: [{ type: 'text', text: JSON.stringify({ ok: true }) }] };
          }

          case 'control_mouse_click': {
            if (!controlService?.mouse) return { content: [{ type: 'text', text: 'control service not available' }], isError: true };
            await controlService.mouse.click(args.x, args.y, args.button);
            return { content: [{ type: 'text', text: JSON.stringify({ ok: true }) }] };
          }

          case 'control_mouse_drag': {
            if (!controlService?.mouse) return { content: [{ type: 'text', text: 'control service not available' }], isError: true };
            await controlService.mouse.drag(args.fromX, args.fromY, args.toX, args.toY);
            return { content: [{ type: 'text', text: JSON.stringify({ ok: true }) }] };
          }

          case 'control_keyboard_type': {
            if (!controlService?.keyboard) return { content: [{ type: 'text', text: 'control service not available' }], isError: true };
            await controlService.keyboard.typeText(args.text);
            return { content: [{ type: 'text', text: JSON.stringify({ ok: true }) }] };
          }

          case 'control_keyboard_press': {
            if (!controlService?.keyboard) return { content: [{ type: 'text', text: 'control service not available' }], isError: true };
            await controlService.keyboard.pressKey(args.key);
            return { content: [{ type: 'text', text: JSON.stringify({ ok: true }) }] };
          }

          case 'control_keyboard_press_keys': {
            if (!controlService?.keyboard) return { content: [{ type: 'text', text: 'control service not available' }], isError: true };
            await controlService.keyboard.pressKeys(args.keys);
            return { content: [{ type: 'text', text: JSON.stringify({ ok: true }) }] };
          }

          case 'control_screen_capture': {
            if (!mainWindow) return { content: [{ type: 'text', text: 'no window' }], isError: true };
            try {
              const img = await mainWindow.webContents.capturePage();
              return { content: [{ type: 'image', data: img.toPNG().toString('base64'), mimeType: 'image/png' }] };
            } catch (e) { return { content: [{ type: 'text', text: e.message }], isError: true }; }
          }

          case 'control_screen_capture_region': {
            if (!mainWindow) return { content: [{ type: 'text', text: 'no window' }], isError: true };
            try {
              const img = await mainWindow.webContents.capturePage();
              const size = img.getSize();
              const x = Math.max(0, Math.min(args.x || 0, size.width));
              const y = Math.max(0, Math.min(args.y || 0, size.height));
              const w = Math.max(1, Math.min(args.width || size.width, size.width - x));
              const h = Math.max(1, Math.min(args.height || size.height, size.height - y));
              const cropped = img.crop({ x, y, width: w, height: h });
              return { content: [{ type: 'image', data: cropped.toPNG().toString('base64'), mimeType: 'image/png' }] };
            } catch (e) { return { content: [{ type: 'text', text: e.message }], isError: true }; }
          }

          case 'control_screen_capture_window': {
            if (!mainWindow) return { content: [{ type: 'text', text: 'no window' }], isError: true };
            try {
              const img = await mainWindow.webContents.capturePage();
              return { content: [{ type: 'image', data: img.toPNG().toString('base64'), mimeType: 'image/png' }] };
            } catch (e) { return { content: [{ type: 'text', text: e.message }], isError: true }; }
          }

          case 'control_screen_bring_to_foreground': {
            if (!controlService?.screen) return { content: [{ type: 'text', text: 'control service not available' }], isError: true };
            await controlService.screen.bringToForeground();
            return { content: [{ type: 'text', text: JSON.stringify({ ok: true }) }] };
          }

          case 'control_screen_list': {
            if (!controlService?.screen?.list) return { content: [{ type: 'text', text: 'control service not available' }], isError: true };
            try {
              const screens = await controlService.screen.list();
              return { content: [{ type: 'text', text: JSON.stringify(screens) }] };
            } catch (e) {
              return { content: [{ type: 'text', text: 'Screen list failed: ' + e.message }], isError: true };
            }
          }

          // ── ADB ────────────────────────────────────────────────────────────
          case 'exec_adb': {
            const { args: adbArgs } = args;
            if (!Array.isArray(adbArgs)) return { content: [{ type: 'text', text: 'args must be an array' }], isError: true };
            const { spawn } = require('child_process');
            return new Promise((resolve) => {
              let stdout = '', stderr = '';
              const proc = spawn('adb', adbArgs, { timeout: 15000 });
              proc.stdout.on('data', (d) => { stdout += d.toString(); });
              proc.stderr.on('data', (d) => { stderr += d.toString(); });
              proc.on('close', (code) => { resolve({ content: [{ type: 'text', text: JSON.stringify({ ok: code === 0, stdout, stderr, code }) }] }); });
              proc.on('error', (e) => { resolve({ content: [{ type: 'text', text: JSON.stringify({ ok: false, error: e.message }) }] }); });
            });
          }

          // ── App Debug ──────────────────────────────────────────────────────
          case 'app_get_state': {
            if (!mainWindow) return { content: [{ type: 'text', text: 'no window' }], isError: true };
            try {
              const result = await mainWindow.webContents.executeJavaScript(`
                (function() {
                  const tabs = window.__seelelink_tabs || window.connTabs || [];
                  const activeId = window.__seelelink_active_tab || window.activeConnTabId || null;
                  const activeTabType = window.activeTab || null;
                  return JSON.stringify({
                    tabCount: tabs.length,
                    activeConnTabId: activeId,
                    activeTab: activeTabType,
                    tabs: tabs.map(function(t) { return { id: t.id, type: t.conn && t.conn.type, name: t.conn && t.conn.name, isConnected: t.isConnected, connId: t.connId }; })
                  });
                })()
              `, { timeout: 3000 });
              return { content: [{ type: 'text', text: result }] };
            } catch (e) {
              return { content: [{ type: 'text', text: JSON.stringify({ tabCount: 0, activeConnTabId: null, activeTab: null, error: e.message }) }] };
            }
          }

          case 'app_send_text': {
            if (!mainWindow) return { content: [{ type: 'text', text: 'no window' }], isError: true };
            for (const ch of (args.text || '')) {
              mainWindow.webContents.sendInputEvent({ type: 'keyDown', keyCode: ch, modifiers: [] });
              mainWindow.webContents.sendInputEvent({ type: 'keyUp', keyCode: ch, modifiers: [] });
            }
            return { content: [{ type: 'text', text: JSON.stringify({ ok: true, sent: args.text }) }] };
          }

          case 'app_get_connections': {
            try {
              const { execSync } = require('child_process');
              const fs2 = require('fs');
              const p = path.join(os.homedir(), '.seelelink', 'connections.json');
              if (fs2.existsSync(p)) {
                const data = JSON.parse(fs2.readFileSync(p, 'utf8'));
                return { content: [{ type: 'text', text: JSON.stringify(data) }] };
              }
              return { content: [{ type: 'text', text: '[]' }] };
            } catch (e) {
              return { content: [{ type: 'text', text: JSON.stringify([]) }] };
            }
          }

          // ── Window Control ─────────────────────────────────────────────
          case 'window_bounds': {
            if (!mainWindow) return { content: [{ type: 'text', text: 'no window' }], isError: true };
            const b = mainWindow.getBounds();
            const c = mainWindow.getContentBounds();
            return { content: [{ type: 'text', text: JSON.stringify({ window: b, content: c, titleBarOffset: b.height - c.height }) }] };
          }

          case 'window_minimize': {
            if (mainWindow) mainWindow.minimize();
            return { content: [{ type: 'text', text: JSON.stringify({ ok: true }) }] };
          }

          case 'window_maximize': {
            if (mainWindow) {
              if (mainWindow.isMaximized()) mainWindow.unmaximize();
              else mainWindow.maximize();
            }
            return { content: [{ type: 'text', text: JSON.stringify({ ok: true }) }] };
          }

          case 'window_close': {
            if (mainWindow) mainWindow.close();
            return { content: [{ type: 'text', text: JSON.stringify({ ok: true }) }] };
          }

          case 'window_switch_tab': {
            if (mainWindow) mainWindow.webContents.send('window:switchTab', args.tab);
            return { content: [{ type: 'text', text: JSON.stringify({ ok: true, tab: args.tab }) }] };
          }

          // ── IR ─────────────────────────────────────────────────────────
          case 'ir_load': {
            try {
              const data = loadIRData();
              return { content: [{ type: 'text', text: JSON.stringify(data) }] };
            } catch (e) {
              return { content: [{ type: 'text', text: e.message }], isError: true };
            }
          }

          case 'ir_save': {
            try {
              saveIRData(args.data);
              return { content: [{ type: 'text', text: 'saved' }] };
            } catch (e) {
              return { content: [{ type: 'text', text: e.message }], isError: true };
            }
          }

          // ── Session Log ────────────────────────────────────────────────
          case 'log_get_config': {
            return { content: [{ type: 'text', text: JSON.stringify({ enabled: appConfig.log?.enabled ?? true, path: appConfig.log?.path || null }) }] };
          }

          case 'log_set_config': {
            if (!appConfig.log) appConfig.log = { enabled: true, path: null };
            if (args.enabled !== undefined) appConfig.log.enabled = args.enabled;
            if (args.path !== undefined) appConfig.log.path = args.path;
            saveConfig(appConfig);
            return { content: [{ type: 'text', text: JSON.stringify(appConfig.log) }] };
          }

          case 'log_get_dir': {
            return { content: [{ type: 'text', text: getLogDir() }] };
          }

          case 'log_open_folder': {
            const { exec } = require('child_process');
            let folder;
            if (args.logId) {
              const logPath = getSessionLogPath(args.logId);
              if (logPath) folder = path.dirname(logPath);
            } else {
              folder = getLogDir();
            }
            if (folder) exec('explorer "' + folder + '"');
            return { content: [{ type: 'text', text: folder || '' }] };
          }

          // ── Settings ──────────────────────────────────────────────────
          case 'control_api_get_config': {
            const cfg = loadConfig().controlApi;
            return { content: [{ type: 'text', text: JSON.stringify({ enabled: cfg.enabled, host: cfg.host, port: cfg.port, listening: controlServer !== null }) }] };
          }

          case 'control_api_set_config': {
            const cfg = loadConfig();
            if (args.enabled !== undefined) cfg.controlApi.enabled = args.enabled;
            if (args.host !== undefined) cfg.controlApi.host = args.host;
            if (args.port !== undefined) cfg.controlApi.port = args.port;
            saveConfig(cfg);
            appConfig = cfg;
            startControlServer(cfg.controlApi);
            return { content: [{ type: 'text', text: JSON.stringify(cfg.controlApi) }] };
          }

          case 'mcp_api_get_config': {
            const cfg = loadConfig().mcpApi;
            return { content: [{ type: 'text', text: JSON.stringify({ enabled: cfg.enabled, host: cfg.host, port: cfg.port, listening: mcpServer !== null }) }] };
          }

          case 'mcp_api_set_config': {
            const cfg = loadConfig();
            if (args.enabled !== undefined) cfg.mcpApi.enabled = args.enabled;
            if (args.host !== undefined) cfg.mcpApi.host = args.host;
            if (args.port !== undefined) cfg.mcpApi.port = args.port;
            saveConfig(cfg);
            appConfig = cfg;
            startMcpServer(cfg.mcpApi);
            return { content: [{ type: 'text', text: JSON.stringify(cfg.mcpApi) }] };
          }

          // ── App Debug ─────────────────────────────────────────────────
          case 'app_focus_tab': {
            if (!mainWindow) return { content: [{ type: 'text', text: 'no window' }], isError: true };
            try {
              // Safe: pass via postMessage to avoid template injection
              mainWindow.webContents.postMessage('seelelink:focus-tab', { tabId: args.tabId });
              return { content: [{ type: 'text', text: JSON.stringify({ ok: true }) }] };
            } catch (e) {
              return { content: [{ type: 'text', text: e.message }], isError: true };
            }
          }

          case 'app_get_focus': {
            if (!mainWindow) return { content: [{ type: 'text', text: 'no window' }], isError: true };
            try {
              const result = await mainWindow.webContents.executeJavaScript(`
                (function() {
                  const el = document.activeElement;
                  if (!el) return null;
                  return { tagName: el.tagName, className: el.className || '', id: el.id || '', textContent: (el.textContent || '').slice(0, 100) };
                })()
              `, { timeout: 3000 });
              return { content: [{ type: 'text', text: result ? JSON.stringify(result) : 'null' }] };
            } catch (e) {
              return { content: [{ type: 'text', text: e.message }], isError: true };
            }
          }

          case 'app_open_and_connect': {
            if (!mainWindow) return { content: [{ type: 'text', text: 'no window' }], isError: true };
            try {
              // Safe: pass via postMessage to avoid template injection
              mainWindow.webContents.postMessage('seelelink:open-connect', args);
              return { content: [{ type: 'text', text: JSON.stringify({ ok: true }) }] };
            } catch (e) {
              return { content: [{ type: 'text', text: e.message }], isError: true };
            }
          }

          case 'app_debug_iframes': {
            if (!mainWindow) return { content: [{ type: 'text', text: 'no window' }], isError: true };
            try {
              const result = await mainWindow.webContents.executeJavaScript(`
                JSON.stringify(window.__seelelink_iframes || [])
              `, { timeout: 3000 });
              return { content: [{ type: 'text', text: result }] };
            } catch (e) {
              return { content: [{ type: 'text', text: JSON.stringify([]) }] };
            }
          }

          // ── Keyboard (copy/paste/cut/selectAll) ────────────────────────────
          case 'control_keyboard_copy': {
            if (!controlService?.keyboard) return { content: [{ type: 'text', text: 'control service not available' }], isError: true };
            try { await controlService.keyboard.copy(); return { content: [{ type: 'text', text: JSON.stringify({ ok: true }) }] }; }
            catch (e) { return { content: [{ type: 'text', text: JSON.stringify({ ok: false, error: e.message }) }] }; }
          }
          case 'control_keyboard_paste': {
            if (!controlService?.keyboard) return { content: [{ type: 'text', text: 'control service not available' }], isError: true };
            try { await controlService.keyboard.paste(); return { content: [{ type: 'text', text: JSON.stringify({ ok: true }) }] }; }
            catch (e) { return { content: [{ type: 'text', text: JSON.stringify({ ok: false, error: e.message }) }] }; }
          }
          case 'control_keyboard_cut': {
            if (!controlService?.keyboard) return { content: [{ type: 'text', text: 'control service not available' }], isError: true };
            try { await controlService.keyboard.cut(); return { content: [{ type: 'text', text: JSON.stringify({ ok: true }) }] }; }
            catch (e) { return { content: [{ type: 'text', text: JSON.stringify({ ok: false, error: e.message }) }] }; }
          }
          case 'control_keyboard_select_all': {
            if (!controlService?.keyboard) return { content: [{ type: 'text', text: 'control service not available' }], isError: true };
            try { await controlService.keyboard.selectAll(); return { content: [{ type: 'text', text: JSON.stringify({ ok: true }) }] }; }
            catch (e) { return { content: [{ type: 'text', text: JSON.stringify({ ok: false, error: e.message }) }] }; }
          }

          // ── Debug ─────────────────────────────────────────────────────────
          case 'control_debug_set_level': {
            if (!controlService?.debug) return { content: [{ type: 'text', text: 'control service not available' }], isError: true };
            const ok = controlService.debug.setLevel(args.level);
            return { content: [{ type: 'text', text: JSON.stringify({ ok, level: controlService.debug.getLevel() }) }] };
          }
          case 'control_debug_export': {
            if (!controlService?.debug) return { content: [{ type: 'text', text: 'control service not available' }], isError: true };
            try {
              const data = controlService.debug.export(args.format);
              return { content: [{ type: 'text', text: JSON.stringify({ ok: true, data }) }] };
            } catch (e) {
              return { content: [{ type: 'text', text: JSON.stringify({ ok: false, error: e.message }) }] };
            }
          }

          // ── Window State ─────────────────────────────────────────────────
          case 'window_is_maximized': {
            return { content: [{ type: 'text', text: JSON.stringify({ isMaximized: mainWindow ? mainWindow.isMaximized() : false }) }] };
          }
          case 'window_start_debug': {
            if (mainWindow) mainWindow.webContents.send('window:startDebug');
            return { content: [{ type: 'text', text: JSON.stringify({ ok: true }) }] };
          }
          case 'window_stop_debug': {
            if (mainWindow) mainWindow.webContents.send('window:stopDebug');
            return { content: [{ type: 'text', text: JSON.stringify({ ok: true }) }] };
          }

          // ── Android ───────────────────────────────────────────────────────
          case 'android_get_local_ip': {
            try {
              const interfaces = os.networkInterfaces();
              const ips = [];
              for (const [name, addrs] of Object.entries(interfaces)) {
                if (!addrs) continue;
                for (const addr of addrs) {
                  if (addr.family === 'IPv4' && !addr.internal) {
                    ips.push({ name, ip: addr.address, netmask: addr.netmask, mac: addr.mac });
                  }
                }
              }
              return { content: [{ type: 'text', text: JSON.stringify({ ok: true, ips }) }] };
            } catch (e) {
              return { content: [{ type: 'text', text: JSON.stringify({ ok: false, error: e.message }) }] };
            }
          }
          case 'android_scan_network': {
            const result = await handleControlCommand({ cmd: 'android:scanNetwork', args: [args.options || {}] });
            return { content: [{ type: 'text', text: JSON.stringify(result) }] };
          }

          // ── Config ────────────────────────────────────────────────────────
          case 'control_api_find_available_port': {
            const host = (args.host || '127.0.0.1');
            return new Promise((resolve) => {
              findAvailablePort(host, 9000, (port) => {
                resolve({ content: [{ type: 'text', text: JSON.stringify({ ok: true, port }) }] });
              });
            });
          }
          case 'mcp_api_find_available_port': {
            const host = (args.host || '127.0.0.1');
            return new Promise((resolve) => {
              findAvailablePort(host, 9100, (port) => {
                resolve({ content: [{ type: 'text', text: JSON.stringify({ ok: true, port }) }] });
              });
            });
          }

          // ── Plugins ───────────────────────────────────────────────────────
          case 'plugin_list': {
            const list = Array.from(loadedPlugins.values()).map(p => ({
              id: p.manifest.id, name: p.manifest.name, version: p.manifest.version,
              type: p.manifest.type, description: p.manifest.description || '', enabled: p.enabled,
            }));
            return { content: [{ type: 'text', text: JSON.stringify(list) }] };
          }
          case 'plugin_get': {
            const p = loadedPlugins.get(args.pluginId);
            if (!p) return { content: [{ type: 'text', text: JSON.stringify({ error: 'Plugin not found' }) }], isError: true };
            return { content: [{ type: 'text', text: JSON.stringify({
              id: p.manifest.id, name: p.manifest.name, version: p.manifest.version,
              type: p.manifest.type, description: p.manifest.description || '', enabled: p.enabled,
              hasActivate: !!p.instance.onActivate, hasDeactivate: !!p.instance.onDeactivate, hasUninstall: !!p.instance.onUninstall,
            }) }] };
          }
          case 'plugin_enable': {
            try { await enablePlugin(args.pluginId); return { content: [{ type: 'text', text: JSON.stringify({ ok: true }) }] }; }
            catch (e) { return { content: [{ type: 'text', text: JSON.stringify({ ok: false, error: e.message }) }] }; }
          }
          case 'plugin_disable': {
            try { await disablePlugin(args.pluginId); return { content: [{ type: 'text', text: JSON.stringify({ ok: true }) }] }; }
            catch (e) { return { content: [{ type: 'text', text: JSON.stringify({ ok: false, error: e.message }) }] }; }
          }
          case 'plugin_uninstall': {
            const p = loadedPlugins.get(args.pluginId);
            if (!p) return { content: [{ type: 'text', text: JSON.stringify({ error: 'Plugin not found' }) }], isError: true };
            try {
              if (p.enabled) await disablePlugin(args.pluginId);
              if (p.instance.onUninstall) { try { await p.instance.onUninstall(); } catch (e) { log('plugin uninstall hook failed:', e.message); } }
              if (fs.existsSync(p.dir)) fs.rmSync(p.dir, { recursive: true, force: true });
              loadedPlugins.delete(args.pluginId);
              const cfgFile = path.join(PLUGIN_CONFIG_DIR, `${args.pluginId}.json`);
              if (fs.existsSync(cfgFile)) fs.unlinkSync(cfgFile);
              return { content: [{ type: 'text', text: JSON.stringify({ ok: true }) }] };
            } catch (e) { return { content: [{ type: 'text', text: JSON.stringify({ ok: false, error: e.message }) }] }; }
          }

          // ── Dialog ───────────────────────────────────────────────────────
          case 'dialog_open_directory': {
            const result = await handleControlCommand({ cmd: 'dialog:openDirectory', args: [] });
            return { content: [{ type: 'text', text: JSON.stringify(result) }] };
          }

          // ── App Info ─────────────────────────────────────────────────────
          case 'app_get_info': {
            return { content: [{ type: 'text', text: JSON.stringify({
              name: 'SeeleLink',
              version: app.getVersion(),
              platform: process.platform,
              arch: process.arch,
              electron: process.versions.electron,
              node: process.versions.node,
            }) }] };
          }

          default:
            return { content: [{ type: 'text', text: 'Unknown tool: ' + name }], isError: true };
        }
      } catch (err) {
        return { content: [{ type: 'text', text: err.message }], isError: true };
      }
    });
      return srv;
    }


    // HTTP server for MCP
    const server = http.createServer(async (req, res) => {
      // CORS: restrict to configured origins or localhost when binding to localhost
      const origin = req.headers.origin || '';
      const allowedOrigins = cfg.allowedOrigins || [];
      const isAllowed = allowedOrigins.length === 0 || allowedOrigins.includes(origin) || allowedOrigins.includes('*');
      if (isAllowed) {
        res.setHeader('Access-Control-Allow-Origin', origin || (cfg.host === '127.0.0.1' || cfg.host === 'localhost' ? '*' : origin));
      }
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, MCP-Session-ID, Authorization');
      if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', service: 'SeeleLink MCP' }));
        return;
      }

      // Parse body for POST requests
      let body = null;
      if (req.method === 'POST') {
        try {
          body = await new Promise((resolve, reject) => {
            let data = '';
            req.on('data', chunk => data += chunk);
            req.on('end', () => {
              try { resolve(data ? JSON.parse(data) : null); }
              catch (e) { reject(e); }
            });
            req.on('error', reject);
          });
        } catch (e) {
          log('MCP body parse error:', e.message);
        }
      }

      log('MCP: new request, method=' + req.method + ', url=' + req.url);
      // Create fresh stateless transport per request with JSON response mode
      // JSON mode: returns all responses as JSON and closes immediately (no SSE stream left open)
      // Stateless mode: SDK enforces one-request-per-transport
      const reqTransport = new StreamableHTTPServerTransport({
        enableJsonResponse: true,
      });
      const reqServer = createMcpServer();
      try {
        await reqServer.connect(reqTransport);
        await reqTransport.handleRequest(req, res, body);
      } catch (err) {
        log('MCP error:', err.message);
        if (!res.headersSent) { res.writeHead(500); res.end(); }
      } finally {
        try { await reqServer.close(); } catch (e) {}
      }
    });

    server.on('error', (e) => { log('MCP HTTP server error:', e.message); });
    server.listen(cfg.port, cfg.host, () => {
      log('MCP server listening on ' + cfg.host + ':' + cfg.port + ' (HTTP+SSE)');
    });

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

// NOTE: Whitelist removed for debug purposes - all commands are allowed
// const ALLOWED_CONTROL_COMMANDS = new Set([...]);

async function handleControlCommand(req) {
  if (!req || typeof req !== 'object') return { error: 'invalid request' };
  const { cmd, args = [] } = req;

  // SECURITY NOTE: No command whitelist is enforced here.
  // All commands are allowed because handleControlCommand is called from
  // LOCAL TCP connections only (127.0.0.1), not from remote clients.
  // The Control API server itself enforces its own auth/rate-limit at the network layer.
  if (typeof cmd !== 'string') {
    return { error: 'command must be a string' };
  }

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

    case 'health': {
      const health = { ssh: [], ps: [], cmd: [], serial: [], ws: [], timestamp: Date.now() };

      // SSH health check - client._channel indicates if shell is active
      for (const [id, conn] of sshConnections) {
        const alive = conn.client && conn.client._channel && !conn.client._channel.destroyed;
        health.ssh.push({ id, alive });
      }

      // PowerShell health check - pty should have a pid
      for (const [id, conn] of psConnections) {
        const alive = conn.pty && conn.pty.pid > 0;
        health.ps.push({ id, alive });
      }

      // CMD health check
      for (const [id, conn] of cmdConnections) {
        const alive = conn.pty && conn.pty.pid > 0;
        health.cmd.push({ id, alive });
      }

      // Serial health check - port should be open
      for (const [port, info] of serialConnections) {
        const alive = info.port && info.port.isOpen;
        health.serial.push({ port, connId: info.connId, alive });
      }

      // WebSocket health check - readyState should be OPEN (1)
      for (const [id, conn] of wsConnections) {
        const alive = conn.ws && conn.ws.readyState === 1;
        health.ws.push({ id, url: conn.url, alive });
      }

      return health;
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
          resolve(ports.map(p => ({
            path: p.path,
            manufacturer: p.manufacturer || '',
            serialNumber: p.serialNumber || '',
            pnpId: p.pnpId || '',
          })).filter(p => p.path && p.path.startsWith('COM')));
        }).catch(() => resolve([]));
      });
    }

    case 'ps:connect': {
      // Args can be [connId] or [{ connId }] depending on caller
      let connId = args[0];
      if (typeof connId === 'object') connId = connId.connId;
      // Auto-generate connId if not provided
      if (!connId) connId = 'ps-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
      try {
        const r = await connectPowerShell(connId);
        return { connected: true, connId, message: r };
      } catch (e) {
        return { connected: false, error: e.message };
      }
    }

    case 'ps:send': {
      const [connId, cmdText] = args;
      const conn = psConnections.get(connId);
      if (!conn) return { ok: false, error: 'not connected' };
      if (conn.logId) writeSessionLog(conn.logId, 'send', cmdText);
      conn.pty.write(cmdText);
      return { ok: true, connId, sent: cmdText };
    }

    case 'ps:disconnect': {
      const [connId] = args;
      return await disconnectPowerShell(connId);
    }

    case 'cmd:connect': {
      let connId = args[0];
      if (typeof connId === 'object') connId = connId.connId;
      // Auto-generate connId if not provided
      if (!connId) connId = 'cmd-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
      try {
        const r = await connectCMD(connId);
        return { connected: true, connId, message: r };
      } catch (e) {
        return { connected: false, error: e.message };
      }
    }

    case 'cmd:send': {
      const [connId, cmdText] = args;
      const conn = cmdConnections.get(connId);
      if (!conn) return { ok: false, error: 'not connected' };
      if (conn.logId) writeSessionLog(conn.logId, 'send', cmdText);
      conn.pty.write(cmdText);
      return { ok: true, connId, sent: cmdText };
    }

    case 'cmd:disconnect': {
      const [connId] = args;
      return await disconnectCMD(connId);
    }

    case 'ssh:connect': {
      let [connId, host, port, username, password] = args;
      // Handle object format
      if (typeof connId === 'object') { username = connId.username; password = connId.password; host = connId.host; port = connId.port; connId = connId.connId; }
      if (!connId) connId = 'ssh-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
      try {
        const r = await connectSSH(connId, host, port, username, password);
        return { connected: true, connId, message: r };
      } catch (e) {
        return { connected: false, error: e.message };
      }
    }

    case 'ssh:send': {
      const [connId, cmdText] = args;
      const conn = sshConnections.get(connId);
      if (!conn) return { ok: false, error: 'not connected' };
      if (conn.logId) writeSessionLog(conn.logId, 'send', cmdText);
      conn.stream.write(cmdText);
      return { ok: true, connId, sent: cmdText };
    }

    case 'ssh:disconnect': {
      const [connId] = args;
      return await disconnectSSH(connId);
    }

    case 'serial:connect': {
      let [connId, port, baudRate = 115200] = args;
      if (typeof connId === 'object') { port = connId.port; baudRate = connId.baudRate || 115200; connId = connId.connId; }
      if (!connId) connId = 'serial-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
      try {
        const r = await connectSerial(connId, port, baudRate);
        return { connected: true, connId, port, message: r };
      } catch (e) {
        return { connected: false, error: e.message };
      }
    }

    case 'serial:send': {
      const [connId, data] = args;
      for (const [, info] of serialConnections) {
        if (info.connId === connId) { info.port.write(data); return { ok: true, connId, sent: data }; }
      }
      return { ok: false, error: 'not connected' };
    }

    case 'serial:disconnect': {
      const [connId] = args;
      return await disconnectSerialByConnId(connId);
    }

    // ── Android ────────────────────────────────────────────────────────
    case 'android:connect': {
      let [connId, rawDeviceId] = args;
      if (typeof connId === 'object') { rawDeviceId = connId.deviceId; connId = connId.connId; }
      if (!connId) connId = 'android-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
      // Sanitize deviceId to prevent shell injection
      const deviceId = sanitizeDeviceId(rawDeviceId);
      if (!deviceId) return { ok: false, error: 'device ID required' };
      if (androidConnections.size >= MAX_CONNECTIONS.android) return { ok: false, error: 'max Android connections reached' };
      try {
        // Check if device is connected
        const { execSync } = require('child_process');
        try {
          execSync(`adb -s ${deviceId} get-state`, { encoding: 'utf-8', timeout: 5000 });
        } catch (e) {
          return { ok: false, error: 'device not found or offline' };
        }

        // Store connection
        androidConnections.set(connId, { deviceId, client: null });
        if (mainWindow) mainWindow.webContents.send('android:data:' + connId, '[Android device connected: ' + deviceId + ']\r\n');
        return { ok: true, connId, deviceId };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    }

    case 'android:devices': {
      // Return list of connected Android devices
      try {
        const { execSync } = require('child_process');
        const output = execSync('adb devices -l', { encoding: 'utf-8', timeout: 10000 });
        const devices = [];
        const lines = output.split('\n').filter(l => l.trim() && !l.includes('List of devices'));
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 2 && parts[1] === 'device') {
            const deviceId = parts[0];
            const device = { id: deviceId };
            // Parse model from adb devices -l output
            const modelMatch = line.match(/model:(\S+)/);
            if (modelMatch) device.model = modelMatch[1].replace(/_/g, ' ');
            devices.push(device);
          }
        }
        return { ok: true, devices };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    }

    case 'android:screenshot': {
      const [connId] = args;
      const conn = androidConnections.get(connId);
      if (!conn) return { ok: false, error: 'not connected' };
      try {
        const { execSync } = require('child_process');
        // Take screenshot using screencap
        const buffer = execSync(`adb -s ${conn.deviceId} exec-out screencap -p`, { encoding: 'buffer', timeout: 10000 });
        const base64 = buffer.toString('base64');
        return { ok: true, screenshot: base64 };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    }

    case 'android:hierarchy': {
      const [connId] = args;
      const conn = androidConnections.get(connId);
      if (!conn) return { ok: false, error: 'not connected' };
      try {
        const { execSync } = require('child_process');
        // Try uiautomator2 first
        try {
          execSync(`adb -s ${conn.deviceId} shell uiautomator2 dump /sdcard/window_dump.xml`, { encoding: 'utf-8', timeout: 10000 });
          const xml = execSync(`adb -s ${conn.deviceId} shell cat /sdcard/window_dump.xml`, { encoding: 'utf-8', timeout: 10000 });
          return { ok: true, xml };
        } catch (e) {
          // Fallback to dumpsys
          const xml = execSync(`adb -s ${conn.deviceId} shell dumpsys uifault uihierarchy`, { encoding: 'utf-8', timeout: 10000 });
          return { ok: true, xml };
        }
      } catch (e) {
        return { ok: false, error: e.message };
      }
    }

    case 'android:pageinfo': {
      const [connId] = args;
      const conn = androidConnections.get(connId);
      if (!conn) return { ok: false, error: 'not connected' };
      try {
        const { execSync } = require('child_process');

        // Get screenshot
        let screenshot = '';
        try {
          const buffer = execSync(`adb -s ${conn.deviceId} exec-out screencap -p`, { encoding: 'buffer', timeout: 10000 });
          screenshot = buffer.toString('base64');
        } catch (e) {}

        // Get hierarchy
        let xml = '';
        try {
          execSync(`adb -s ${conn.deviceId} shell uiautomator2 dump /sdcard/window_dump.xml`, { encoding: 'utf-8', timeout: 10000 });
          xml = execSync(`adb -s ${conn.deviceId} shell cat /sdcard/window_dump.xml`, { encoding: 'utf-8', timeout: 10000 });
        } catch (e) {
          try {
            xml = execSync(`adb -s ${conn.deviceId} shell dumpsys uifault uihierarchy`, { encoding: 'utf-8', timeout: 10000 });
          } catch (e2) {}
        }

        // Get device info
        let deviceInfo = {};
        try {
          const props = execSync(`adb -s ${conn.deviceId} shell getprop ro.product.model ro.product.manufacturer ro.build.version.release`, { encoding: 'utf-8', timeout: 5000 });
          const [model, manufacturer, version] = props.trim().split('\n');
          deviceInfo = { model: model?.trim(), manufacturer: manufacturer?.trim(), version: version?.trim() };
        } catch (e) {}

        return { ok: true, screenshot, xml, deviceInfo };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    }

    case 'android:tap': {
      const [connId, x, y] = args;
      const conn = androidConnections.get(connId);
      if (!conn) return { ok: false, error: 'not connected' };
      try {
        const { execSync } = require('child_process');
        execSync(`adb -s ${conn.deviceId} shell input tap ${x} ${y}`, { encoding: 'utf-8', timeout: 5000 });
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    }

    case 'android:swipe': {
      const [connId, startX, startY, endX, endY, duration = 300] = args;
      const conn = androidConnections.get(connId);
      if (!conn) return { ok: false, error: 'not connected' };
      try {
        const { execSync } = require('child_process');
        execSync(`adb -s ${conn.deviceId} shell input touchscreen swipe ${startX} ${startY} ${endX} ${endY} ${duration}`, { encoding: 'utf-8', timeout: 5000 });
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    }

    case 'android:text': {
      const [connId, text] = args;
      const conn = androidConnections.get(connId);
      if (!conn) return { ok: false, error: 'not connected' };
      try {
        const { execSync } = require('child_process');
        // P2-12: Allow spaces in text (was rejecting them)
        if (!/^[a-zA-Z0-9., _-]+$/.test(text)) {
          return { ok: false, error: 'text contains invalid characters' };
        }
        execSync(`adb -s ${conn.deviceId} shell input text '${text.replace(/'/g, "'\\''")}'`, { encoding: 'utf-8', timeout: 5000 });
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    }

    case 'android:key': {
      const [connId, keycode] = args;
      const conn = androidConnections.get(connId);
      if (!conn) return { ok: false, error: 'not connected' };
      try {
        const { execSync } = require('child_process');
        execSync(`adb -s ${conn.deviceId} shell input keyevent ${keycode}`, { encoding: 'utf-8', timeout: 5000 });
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    }

    case 'android:disconnect': {
      const [connId] = args;
      const conn = androidConnections.get(connId);
      if (conn) {
        androidConnections.delete(connId);
        if (mainWindow) mainWindow.webContents.send('android:data:' + connId, '[Android device disconnected]\r\n');
        return { ok: true };
      }
      return { ok: false, error: 'not found' };
    }

    case 'ws:connect': {
      let [connId, url] = args;
      if (typeof connId === 'object') { url = connId.url; connId = connId.connId; }
      if (!connId) connId = 'ws-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
      try {
        const r = await connectWebSocket(connId, url);
        return { connected: true, connId, url, message: r };
      } catch (e) {
        return { connected: false, error: e.message };
      }
    }

    case 'ws:send': {
      const [connId, data] = args;
      const conn = wsConnections.get(connId);
      if (!conn) return { ok: false, error: 'not connected' };
      if (conn.ws.readyState !== 1) return { ok: false, error: 'not open' };
      try { conn.ws.send(data); return { ok: true, connId, sent: data }; } catch (e) { return { ok: false, error: e.message }; }
    }

    case 'ws:disconnect': {
      const [connId] = args;
      return await disconnectWebSocket(connId);
    }

    // ── Control Service (Mouse/Keyboard/Screen/Debug) ─────────────────
    case 'control:mouse:position': {
      if (!controlService?.mouse) return { error: 'control service not available' };
      try { return await controlService.mouse.getPosition(); } catch (e) { return { error: e.message }; }
    }
    case 'control:mouse:move': {
      if (!controlService?.mouse) return { error: 'control service not available' };
      try { await controlService.mouse.setPosition(args.x, args.y); return { ok: true }; } catch (e) { return { error: e.message }; }
    }
    case 'control:mouse:click': {
      if (!controlService?.mouse) return { error: 'control service not available' };
      try { await controlService.mouse.click(args.x, args.y, args.button); return { ok: true }; } catch (e) { return { error: e.message }; }
    }
    case 'control:mouse:doubleClick': {
      if (!controlService?.mouse) return { error: 'control service not available' };
      try { await controlService.mouse.doubleClick(args.x, args.y); return { ok: true }; } catch (e) { return { error: e.message }; }
    }
    case 'control:mouse:drag': {
      if (!controlService?.mouse) return { error: 'control service not available' };
      try { await controlService.mouse.drag(args.fromX, args.fromY, args.toX, args.toY); return { ok: true }; } catch (e) { return { error: e.message }; }
    }
    case 'control:keyboard:type': {
      if (!controlService?.keyboard) return { error: 'control service not available' };
      try { await controlService.keyboard.typeText(args.text); return { ok: true }; } catch (e) { return { error: e.message }; }
    }
    case 'control:keyboard:press': {
      if (!controlService?.keyboard) return { error: 'control service not available' };
      try { await controlService.keyboard.pressKey(args.key); return { ok: true }; } catch (e) { return { error: e.message }; }
    }
    case 'control:keyboard:pressKeys': {
      if (!controlService?.keyboard) return { error: 'control service not available' };
      try { await controlService.keyboard.pressKeys(args.keys); return { ok: true }; } catch (e) { return { error: e.message }; }
    }
    case 'control:screen:capture': {
      // Use Electron's capturePage for reliability — GDI BitBlt/PrintWindow fail in non-elevated context
      if (!mainWindow) return { error: 'no window' };
      try {
        const img = await mainWindow.webContents.capturePage();
        const png = img.toPNG();
        return { base64: png.toString('base64'), width: img.getSize().width, height: img.getSize().height, format: 'png', timestamp: Date.now(), screen: 'app' };
      } catch (e) { return { error: e.message }; }
    }
    case 'control:screen:captureRegion': {
      // Use Electron's capturePage and crop the result
      if (!mainWindow) return { error: 'no window' };
      try {
        const img = await mainWindow.webContents.capturePage();
        const size = img.getSize();
        const x = Math.max(0, Math.min(args.x || 0, size.width));
        const y = Math.max(0, Math.min(args.y || 0, size.height));
        const w = Math.max(1, Math.min(args.width || size.width, size.width - x));
        const h = Math.max(1, Math.min(args.height || size.height, size.height - y));
        const cropped = img.crop({ x, y, width: w, height: h });
        const png = cropped.toPNG();
        return { base64: png.toString('base64'), width: w, height: h, format: 'png', timestamp: Date.now() };
      } catch (e) { return { error: e.message }; }
    }
    case 'control:screen:captureWindow': {
      if (!mainWindow) return { error: 'no window' };
      try {
        const bounds = args[0] || { x: 0, y: 0, width: 800, height: 600 };
        const img = await mainWindow.webContents.capturePage({ x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height });
        const png = img.toPNG();
        return { ok: true, base64: png.toString('base64'), width: img.getSize().width, height: img.getSize().height };
      } catch (e) { return { ok: false, error: e.message }; }
    }
    case 'control:screen:bringToForeground': {
      try {
        if (controlService?.screen?.bringToForeground) {
          await controlService.screen.bringToForeground(args[0]);
        }
        return { ok: true };
      } catch (e) { return { ok: false, error: e.message }; }
    }
    case 'control:screen:list': {
      if (!controlService?.screen?.list) return { ok: false, error: 'not supported' };
      try {
        const result = await controlService.screen.list();
        return { ok: true, result };
      } catch (e) { return { ok: false, error: e.message }; }
    }
    case 'control:screen:captureAndSave': {
      if (!mainWindow) return { error: 'no window' };
      try {
        const [filePath, format = 'png'] = args;
        const img = await mainWindow.webContents.capturePage();
        const buf = format === 'jpeg' || format === 'jpg' ? img.toJPEG(90) : img.toPNG();
        const fs = require('fs');
        const path = require('path');
        const absPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
        fs.writeFileSync(absPath, buf);
        return { ok: true, path: absPath, size: buf.length };
      } catch (e) { return { ok: false, error: e.message }; }
    }
    case 'control:debug:getLogs': {
      if (!controlService?.debug) return { error: 'control service not available' };
      return controlService.debug.getLogs(args.filter);
    }
    case 'control:debug:getStats': {
      if (!controlService?.debug) return { error: 'control service not available' };
      return controlService.debug.getStats();
    }
    case 'control:debug:clear': {
      if (!controlService?.debug) return { error: 'control service not available' };
      controlService.debug.clear();
      return { ok: true };
    }
    case 'control:platform:info': {
      const platform = require('./platform/index.cjs');
      const info = platform.getPlatformInfo();
      return { type: info.platform, arch: info.arch };
    }

    case 'quit': { app.quit(); return 'goodbye'; }

    // ── Window Control ────────────────────────────────────────────────
    case 'window:capture': {
      if (!mainWindow) return { error: 'no window' };
      try {
        const img = await mainWindow.webContents.capturePage();
        const png = img.toPNG();
        return { png: png.toString('base64') };
      } catch (e) { return { error: e.message }; }
    }

    case 'window:eval': {
      // P1-6: Restrict to development mode only — arbitrary JS execution is unsafe
      if (process.env.NODE_ENV !== 'development') return { error: 'not available in production' };
      if (!mainWindow) return { error: 'no window' };
      const [script] = args;
      try {
        const result = await mainWindow.webContents.executeJavaScript(script);
        return { result: String(result) };
      } catch (e) { return { error: e.message }; }
    }

    case 'window:bounds': {
      if (!mainWindow) return { error: 'no window' };
      const b = mainWindow.getBounds();
      const c = mainWindow.getContentBounds();
      return { window: b, content: c, titleBarOffset: b.height - c.height };
    }

    case 'window:click': {
      if (!mainWindow || args.length < 2) return { error: 'requires x, y args' };
      // Focus and show window before clicking
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
      const [x, y] = args;
      const bounds = mainWindow.getBounds();
      const absX = Math.round(bounds.x + sanitizeCoordinate(x, 0));
      const absY = Math.round(bounds.y + sanitizeCoordinate(y, 0));
      if (isNaN(absX) || isNaN(absY)) return { error: 'Invalid coordinates' };
      const { exec } = require('child_process');
      const ps = [
        'Add-Type @"using System;using System.Runtime.InteropServices;public class Win32{[DllImport("user32.dll")]public static extern bool SetCursorPos(int x,int y);[DllImport("user32.dll")]public static extern void mouse_event(uint f,uint dx,uint dy,uint d,uint ei);}"@',
        '[Win32]::SetCursorPos(' + absX + ',' + absY + ')',
        'Start-Sleep -Milliseconds 100',
        '[Win32]::mouse_event(0x2,0,0,0,0)',
        'Start-Sleep -Milliseconds 50',
        '[Win32]::mouse_event(0x4,0,0,0,0)',
      ].join('; ');
      exec('powershell -Command "' + ps.replace(/"/g, '\\"') + '"', (e) => { if (e) log('Mouse move exec error:', e.message); });
      return { ok: true, absX, absY };
    }

    case 'window:switchTab': {
      if (!mainWindow) return { error: 'no window' };
      const [tab] = args;
      log('window:switchTab received, sending to renderer:', tab);
      mainWindow.webContents.send('window:switchTab', tab);
      log('window:switchTab sent successfully');
      return { ok: true, tab };
    }

    case 'window:moveMouse': {
      if (!mainWindow || args.length < 2) return { error: 'requires x, y args' };
      const [x, y] = args;
      const bounds = mainWindow.getBounds();
      const absX = Math.round(bounds.x + sanitizeCoordinate(x, 0));
      const absY = Math.round(bounds.y + sanitizeCoordinate(y, 0));
      if (isNaN(absX) || isNaN(absY)) return { error: 'Invalid coordinates' };
      const { exec } = require('child_process');
      exec('powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Cursor]::Position = [System.Drawing.Point]::new(' + absX + ',' + absY + ')"', (e) => { if (e) log('Mouse move exec error:', e.message); });
      return { ok: true, absX, absY };
    }

    case 'window:sendKeys': {
      if (!mainWindow || !args.length) return { error: 'requires keys array args' };
      try {
        for (const key of args) {
          const kc = keyToKeyCode(key);
          if (!kc) continue;
          mainWindow.webContents.sendInputEvent({ type: 'keyDown', keyCode: kc.vk, modifiers: kc.modifiers || [] });
          mainWindow.webContents.sendInputEvent({ type: 'keyUp', keyCode: kc.vk, modifiers: kc.modifiers || [] });
        }
        return { ok: true, sent: args };
      } catch (e) { return { error: e.message }; }
    }

    // ── ADB Commands ─────────────────────────────────────────────────
    case 'exec:adb': {
      const adbArgs = args;
      return new Promise((resolve) => {
        try {
          const { spawn } = require('child_process');
          let stdout = '';
          let stderr = '';
          const proc = spawn('adb', adbArgs);
          proc.stdout.on('data', (d) => { stdout += d.toString(); });
          proc.stderr.on('data', (d) => { stderr += d.toString(); });
          proc.on('close', (code) => {
            resolve({ ok: code === 0, stdout, stderr, code });
          });
          proc.on('error', (e) => resolve({ ok: false, error: e.message, stdout, stderr }));
          setTimeout(() => { try { proc.kill(); } catch {} resolve({ ok: false, error: 'timeout', stdout, stderr }); }, 20000);
        } catch (e) { resolve({ ok: false, error: e.message }); }
      });
    }

    case 'exec:adb:screenshot': {
      const deviceId = args[0];
      return new Promise((resolve) => {
        try {
          const { spawn } = require('child_process');
          const { Buffer } = require('buffer');
          const adbArgs = ['-s', deviceId, 'exec-out', 'screencap', '-p'];
          const proc = spawn('adb', adbArgs);

          const chunks = [];
          proc.stdout.on('data', (chunk) => chunks.push(chunk));

          proc.on('close', (code) => {
            if (code === 0 && chunks.length > 0) {
              const buffer = Buffer.concat(chunks);
              const base64 = buffer.toString('base64');
              resolve({ ok: true, screenshot: base64 });
            } else {
              resolve({ ok: false, error: 'screencap failed with code ' + code });
            }
          });

          proc.on('error', (e) => resolve({ ok: false, error: e.message }));
          setTimeout(() => { try { proc.kill(); } catch {} resolve({ ok: false, error: 'timeout' }); }, 15000);
        } catch (e) { resolve({ ok: false, error: e.message }); }
      });
    }

    // ── App Debug Commands ─────────────────────────────────────────────
    case 'app:getState': {
      if (!mainWindow) return { error: 'no window' };
      try {
        const state = await mainWindow.webContents.executeJavaScript(`
          (function() {
            const tabs = window.connTabs || [];
            const activeId = window.activeConnTabId;
            const activeTab = tabs.find(t => t.id === activeId);
            return {
              tabCount: tabs.length,
              activeTabId: activeId,
              tabs: tabs.map(t => ({
                id: t.id,
                type: t.conn?.type,
                name: t.conn?.name,
                isConnected: t.isConnected,
                connId: t.connId
              }))
            };
          })()
        `);
        return state;
      } catch (e) { return { error: e.message }; }
    }

    case 'app:sendText': {
      if (!mainWindow) return { error: 'no window' };
      try {
        const [text] = args;
        // Send text via keyboard events character by character
        for (const char of text) {
          const code = char.charCodeAt(0);
          let keyCode, vk;
          if (char === '\n' || char === '\r') {
            keyCode = 'Return'; vk = 0x0D;
          } else if (char === '\t') {
            keyCode = 'Tab'; vk = 0x09;
          } else if (char >= 'a' && char <= 'z') {
            keyCode = char.toUpperCase(); vk = char.toUpperCase().charCodeAt(0);
          } else if (char >= 'A' && char <= 'Z') {
            keyCode = char; vk = char.charCodeAt(0);
          } else if (char >= '0' && char <= '9') {
            keyCode = char; vk = char.charCodeAt(0);
          } else {
            keyCode = char; vk = char.charCodeAt(0);
          }
          mainWindow.webContents.sendInputEvent({ type: 'keyDown', keyCode: keyCode, modifiers: [] });
          mainWindow.webContents.sendInputEvent({ type: 'char', keyCode: keyCode, modifiers: [] });
          mainWindow.webContents.sendInputEvent({ type: 'keyUp', keyCode: keyCode, modifiers: [] });
        }
        return { ok: true, sent: text };
      } catch (e) { return { error: e.message }; }
    }

    case 'app:focusTab': {
      if (!mainWindow) return { error: 'no window' };
      try {
        const [tabId] = args;
        // Safe: use postMessage to avoid template injection
        mainWindow.webContents.postMessage('seelelink:focus-tab', { tabId });
        return { ok: true, tabId };
      } catch (e) { return { error: e.message }; }
    }

    case 'app:getFocus': {
      if (!mainWindow) return { error: 'no window' };
      try {
        const focus = await mainWindow.webContents.executeJavaScript(`
          (function() {
            const active = document.activeElement;
            if (!active) return { tagName: null, className: null };
            return {
              tagName: active.tagName,
              className: active.className,
              id: active.id,
              textContent: active.textContent?.substring(0, 100)
            };
          })()
        `);
        return focus;
      } catch (e) { return { error: e.message }; }
    }

    case 'app:openAndConnect': {
      if (!mainWindow) return { error: 'no window' };
      try {
        const [connType, connId, host, username, password] = args;
        // Safe: use postMessage to avoid template injection
        mainWindow.webContents.postMessage('seelelink:open-connect', { connType, connId, host, username, password });
        return { ok: true };
      } catch (e) { return { error: e.message }; }
    }

    case 'app:debugIframes': {
      if (!mainWindow) return { error: 'no window' };
      try {
        const debug = await mainWindow.webContents.executeJavaScript(`
          (function() {
            const frames = document.querySelectorAll('iframe');
            const result = [];
            for (const frame of frames) {
              let iframeDoc = null;
              let iframeTerminal = null;
              try {
                iframeDoc = frame.contentDocument ? 'accessible' : 'denied';
                if (frame.contentWindow && frame.contentWindow.document) {
                  const term = frame.contentWindow.document.getElementById('terminal');
                  iframeTerminal = term ? 'found' : 'not-found';
                }
              } catch (e) {
                iframeDoc = 'error: ' + e.message;
              }
              result.push({
                id: frame.id,
                name: frame.name,
                src: frame.src,
                docAccess: iframeDoc,
                terminalEl: iframeTerminal,
                readyState: frame.contentWindow?.document?.readyState
              });
            }
            return result;
          })()
        `);
        return debug;
      } catch (e) { return { error: e.message }; }
    }

    case 'app:getConnections': {
      // Return saved connections
      return loadConnections();
    }

    // ── Window Control ───────────────────────────────────────────────
    case 'window:minimize': {
      if (mainWindow) mainWindow.minimize();
      return { ok: true };
    }
    case 'window:maximize': {
      if (mainWindow) { if (mainWindow.isMaximized()) mainWindow.unmaximize(); else mainWindow.maximize(); }
      return { ok: true };
    }
    case 'window:isMaximized': {
      return { ok: true, result: mainWindow ? mainWindow.isMaximized() : false };
    }
    case 'window:startDebug': {
      if (mainWindow) mainWindow.webContents.send('window:startDebug');
      return { ok: true };
    }
    case 'window:stopDebug': {
      if (mainWindow) mainWindow.webContents.send('window:stopDebug');
      return { ok: true };
    }

    // ── Keyboard ─────────────────────────────────────────────────
    case 'control:keyboard:copy': {
      if (!controlService?.keyboard) return { ok: false, error: 'control service not available' };
      try { await controlService.keyboard.copy(); return { ok: true }; } catch (e) { return { ok: false, error: e.message }; }
    }
    case 'control:keyboard:paste': {
      if (!controlService?.keyboard) return { ok: false, error: 'control service not available' };
      try { await controlService.keyboard.paste(); return { ok: true }; } catch (e) { return { ok: false, error: e.message }; }
    }
    case 'control:keyboard:cut': {
      if (!controlService?.keyboard) return { ok: false, error: 'control service not available' };
      try { await controlService.keyboard.cut(); return { ok: true }; } catch (e) { return { ok: false, error: e.message }; }
    }
    case 'control:keyboard:selectAll': {
      if (!controlService?.keyboard) return { ok: false, error: 'control service not available' };
      try { await controlService.keyboard.selectAll(); return { ok: true }; } catch (e) { return { ok: false, error: e.message }; }
    }

    // ── Debug ──────────────────────────────────────────────────────
    case 'control:debug:setLevel': {
      if (!controlService?.debug) return { ok: false, error: 'control service not available' };
      const level = args[0];
      const ok = controlService.debug.setLevel(level);
      return { ok, level: controlService.debug.getLevel() };
    }
    case 'control:debug:export': {
      if (!controlService?.debug) return { ok: false, error: 'control service not available' };
      try { const data = controlService.debug.export(args[0]); return { ok: true, data }; } catch (e) { return { ok: false, error: e.message }; }
    }

    // ── Config ───────────────────────────────────────────────────
    case 'controlApi:getConfig': {
      return { ok: true, result: { enabled: appConfig.controlApi?.enabled ?? true, host: appConfig.controlApi?.host || '127.0.0.1', port: appConfig.controlApi?.port || 9380 } };
    }
    case 'controlApi:setConfig': {
      if (!args[0] || typeof args[0] !== 'object') return { ok: false, error: 'config object required' };
      const cfg = args[0];
      if (!appConfig.controlApi) appConfig.controlApi = {};
      if (cfg.enabled !== undefined) appConfig.controlApi.enabled = cfg.enabled;
      if (cfg.host !== undefined) appConfig.controlApi.host = cfg.host;
      if (cfg.port !== undefined) appConfig.controlApi.port = cfg.port;
      saveConfig(appConfig);
      return { ok: true, result: appConfig.controlApi };
    }
    case 'controlApi:findAvailablePort': {
      const host = (args[0] && args[0].host) ? args[0].host : '127.0.0.1';
      return new Promise((resolve) => {
        findAvailablePort(host, 9000, (port) => { resolve({ ok: true, result: { port } }); });
      });
    }
    case 'mcpApi:getConfig': {
      return { ok: true, result: { enabled: appConfig.mcpApi?.enabled ?? false, host: appConfig.mcpApi?.host || '127.0.0.1', port: appConfig.mcpApi?.port || 9381 } };
    }
    case 'mcpApi:setConfig': {
      if (!args[0] || typeof args[0] !== 'object') return { ok: false, error: 'config object required' };
      const cfg = args[0];
      if (!appConfig.mcpApi) appConfig.mcpApi = {};
      if (cfg.enabled !== undefined) appConfig.mcpApi.enabled = cfg.enabled;
      if (cfg.host !== undefined) appConfig.mcpApi.host = cfg.host;
      if (cfg.port !== undefined) appConfig.mcpApi.port = cfg.port;
      saveConfig(appConfig);
      return { ok: true, result: appConfig.mcpApi };
    }
    case 'mcpApi:findAvailablePort': {
      const host = (args[0] && args[0].host) ? args[0].host : '127.0.0.1';
      return new Promise((resolve) => {
        findAvailablePort(host, 9100, (port) => { resolve({ ok: true, result: { port } }); });
      });
    }

    // ── Log ────────────────────────────────────────────────────
    case 'log:getConfig': {
      return { ok: true, result: { enabled: appConfig.log?.enabled ?? true, path: appConfig.log?.path || null } };
    }
    case 'log:setConfig': {
      if (!appConfig.log) appConfig.log = { enabled: true, path: null };
      if (args[0] && typeof args[0] === 'object') {
        if (args[0].enabled !== undefined) appConfig.log.enabled = args[0].enabled;
        if (args[0].path !== undefined) appConfig.log.path = args[0].path;
      }
      saveConfig(appConfig);
      return { ok: true, result: appConfig.log };
    }
    case 'log:getDir': {
      return { ok: true, result: getLogDir() };
    }
    case 'log:openFolder': {
      const { exec } = require('child_process');
      const folder = getLogDir();
      if (folder) exec('explorer "' + folder + '"');
      return { ok: true };
    }

    // ── Window Capture Config ────────────────────────────────────
    case 'windowCapture:getConfig': {
      return { ok: true, result: { mode: appConfig.windowCapture?.mode || 'auto' } };
    }
    case 'windowCapture:setConfig': {
      const mode = args[0];
      if (!appConfig.windowCapture) appConfig.windowCapture = {};
      if (['auto', 'foreground', 'gdi'].includes(mode)) appConfig.windowCapture.mode = mode;
      saveConfig(appConfig);
      return { ok: true, result: appConfig.windowCapture };
    }

    // ── Dialog ─────────────────────────────────────────────────
    case 'dialog:openDirectory': {
      const { dialog } = require('electron');
      return new Promise((resolve) => {
        dialog.showOpenDialog({ properties: ['openDirectory'] }).then(({ canceled, filePaths }) => {
          resolve({ ok: !canceled, result: filePaths[0] || null });
        }).catch(e => resolve({ ok: false, error: e.message }));
      });
    }

    // ── Android ───────────────────────────────────────────────
    case 'android:getLocalIp': {
      try {
        const interfaces = os.networkInterfaces();
        const ips = [];
        for (const [name, addrs] of Object.entries(interfaces)) {
          if (!addrs) continue;
          for (const addr of addrs) {
            if (addr.family === 'IPv4' && !addr.internal) {
              ips.push({ name, ip: addr.address, netmask: addr.netmask, mac: addr.mac });
            }
          }
        }
        return { ok: true, result: ips };
      } catch (e) { return { ok: false, error: e.message }; }
    }
    case 'android:scanNetwork': {
      try {
        const result = await ipcMain.invoke('android:scanNetwork', args[0] || {});
        return result;
      } catch (e) { return { ok: false, error: e.message }; }
    }
    case 'android:getLocalIpForTarget': {
      try {
        const result = await ipcMain.invoke('android:getLocalIpForTarget', args[0] || '');
        return result;
      } catch (e) { return { ok: false, error: e.message }; }
    }

    // ── App Info ────────────────────────────────────────────────
    case 'app:getInfo': {
      return { ok: true, result: { name: 'SeeleLink', version: app.getVersion(), platform: process.platform, arch: process.arch, electron: process.versions.electron, node: process.versions.node } };
    }

    // ── Execute commands ────────────────────────────────────────
    case 'ps:execute': {
      const arg = args[0] && typeof args[0] === 'object' ? args[0] : {};
      const conn = psConnections.get(arg.connId);
      if (!conn || !conn.pty) return 'not connected';
      try { conn.pty.write(arg.cmd); if (conn.logId) writeSessionLog(conn.logId, 'send', arg.cmd); return 'executed'; }
      catch (e) { return 'error: ' + e.message; }
    }
    case 'cmd:execute': {
      const arg = args[0] && typeof args[0] === 'object' ? args[0] : {};
      const conn = cmdConnections.get(arg.connId);
      if (!conn || !conn.pty) return 'not connected';
      try { conn.pty.write(arg.cmd); if (conn.logId) writeSessionLog(conn.logId, 'send', arg.cmd); return 'executed'; }
      catch (e) { return 'error: ' + e.message; }
    }
    case 'cmd:ready': {
      const arg = args[0] && typeof args[0] === 'object' ? args[0] : {};
      return cmdConnections.has(arg.connId) ? 'ready' : 'not connected';
    }
    case 'serial:execute': {
      const arg = args[0] && typeof args[0] === 'object' ? args[0] : {};
      const info = serialConnections.get(arg.connId);
      if (!info || !info.port || !info.port.isOpen) return 'not connected';
      try { info.port.write(arg.data); return 'sent'; }
      catch (e) { return 'error: ' + e.message; }
    }
    case 'ssh:execute': {
      const arg = args[0] && typeof args[0] === 'object' ? args[0] : {};
      const conn = sshConnections.get(arg.connId);
      if (!conn || !conn.stream) return 'not connected';
      try { conn.stream.write(arg.cmd); streamWriteCount++; if (conn.logId) writeSessionLog(conn.logId, 'send', arg.cmd); return 'executed'; }
      catch (e) { return 'error: ' + e.message; }
    }
    case 'window:getBounds': {
      if (!mainWindow) return { error: 'no window' };
      const b = mainWindow.getBounds();
      const c = mainWindow.getContentBounds();
      return { window: b, content: c, titleBarOffset: b.height - c.height };
    }

    // ── Plugin commands ─────────────────────────────────────────
    case 'plugin:list': {
      return Array.from(loadedPlugins.values()).map(p => ({ id: p.manifest.id, name: p.manifest.name, version: p.manifest.version, type: p.manifest.type, description: p.manifest.description || '', enabled: p.enabled }));
    }
    case 'plugin:get': {
      const plugin = loadedPlugins.get(args[0] || '');
      if (!plugin) return null;
      return { id: plugin.manifest.id, name: plugin.manifest.name, version: plugin.manifest.version, type: plugin.manifest.type, description: plugin.manifest.description || '', enabled: plugin.enabled, hasActivate: !!plugin.instance.onActivate, hasDeactivate: !!plugin.instance.onDeactivate, hasUninstall: !!plugin.instance.onUninstall };
    }
    case 'plugin:enable': {
      try { await enablePlugin(args[0] || ''); return { ok: true }; } catch (e) { return { ok: false, error: e.message }; }
    }
    case 'plugin:disable': {
      try { await disablePlugin(args[0] || ''); return { ok: true }; } catch (e) { return { ok: false, error: e.message }; }
    }
    case 'plugin:uninstall': {
      const plugin = loadedPlugins.get(args[0] || '');
      if (!plugin) return { ok: false, error: 'Plugin not found' };
      try {
        if (plugin.enabled) await disablePlugin(args[0]);
        if (plugin.instance.onUninstall) { try { await plugin.instance.onUninstall(); } catch (e) { log('Plugin', args[0], 'onUninstall failed:', e.message); } }
        if (fs.existsSync(plugin.dir)) fs.rmSync(plugin.dir, { recursive: true, force: true });
        loadedPlugins.delete(args[0]);
        const configFile = path.join(PLUGIN_CONFIG_DIR, `${args[0]}.json`);
        if (fs.existsSync(configFile)) fs.unlinkSync(configFile);
        return { ok: true };
      } catch (e) { return { ok: false, error: e.message }; }
    }
    case 'plugin:getDir': {
      return PLUGINS_DIR;
    }
    case 'plugin:openFolder': {
      const { shell } = require('electron');
      shell.openPath(PLUGINS_DIR);
      return { ok: true };
    }

    // ── IR commands ─────────────────────────────────────────────
    case 'ir:load': {
      return loadIRData();
    }
    case 'ir:save': {
      try { saveIRData(args[0] || {}); return 'saved'; } catch (e) { return 'error: ' + e.message; }
    }

    default: throw new Error('Unknown command: ' + cmd);
  }
}

// ============================================================
// App Lifecycle
// ============================================================
app.whenReady().then(() => {
  log('App ready');

  // Ensure log directory exists on startup
  const logDir = getLogDir();
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
    log('Created log directory:', logDir);
  }

  // Cleanup old session logs on startup
  cleanupOldLogs();

  createWindow();
  startControlServer(appConfig.controlApi);
  startMcpServer(appConfig.mcpApi);

  // Initialize plugin system
  initializePlugins();
});

app.on('window-all-closed', async () => {
  log('Window all closed');
  if (psProcess) psProcess.kill();
  for (const [id, conn] of sshConnections) { try { conn.client.end(); } catch (e) {} }
  sshConnections.clear();
  // Clean up session logs
  for (const [logId, sessionLog] of sessionLogs) {
    if (sessionLog.flushTimer) clearInterval(sessionLog.flushTimer);
    try { sessionLog.stream.end(); } catch (e) {}
    sessionLogs.delete(logId);
  }
  // Clean up other connections
  for (const [id] of psConnections) { try { disconnectPowerShell(id); } catch (e) {} }
  for (const [id] of cmdConnections) { try { disconnectCMD(id); } catch (e) {} }
  for (const [id] of serialConnections) { try { disconnectSerial(id); } catch (e) {} }
  for (const [id] of wsConnections) { try { disconnectWebSocket(id); } catch (e) {} }
  await shutdownPlugins();
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
    if (fs.existsSync(connFilePath)) {
      const conns = JSON.parse(fs.readFileSync(connFilePath, 'utf-8'));
      // Decrypt passwords for each connection
      for (const conn of conns) {
        if (conn.password) conn.password = decryptPassword(conn.password);
      }
      return conns;
    }
  } catch (e) { log('Load conns error:', e); }
  return [];
}

function saveConnections(conns) {
  try {
    const dir = path.dirname(connFilePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    // Encrypt passwords before saving
    const connsToSave = conns.map(conn => ({
      ...conn,
      password: conn.password ? encryptPassword(conn.password) : conn.password
    }));
    fs.writeFileSync(connFilePath, JSON.stringify(connsToSave, null, 2));
  } catch (e) { log('Save conns error:', e); }
}

// ============================================================
// IPC Handlers
// ============================================================

// PowerShell
ipcMain.handle('ps:connect', async (event, { connId }) => {
  log('PS connect requested:', connId);
  try {
    return await connectPowerShell(connId);
  } catch (e) {
    log('PS connect error:', e.message);
    return 'error: ' + e.message;
  }
});

ipcMain.handle('ps:execute', async (event, { connId, cmd }) => {
  log('PS execute for', connId, ':', JSON.stringify(cmd));
  const conn = psConnections.get(connId);
  if (conn && conn.pty) {
    try {
      conn.pty.write(cmd);
      if (conn.logId) writeSessionLog(conn.logId, 'send', cmd);
      log('PS execute: written ok');
      return 'executed';
    }
    catch (e) { log('PS execute error:', e.message); return 'error: ' + e.message; }
  }
  return 'not connected';
});

ipcMain.handle('ps:disconnect', async (event, connId) => {
  log('PS disconnect:', connId);
  return disconnectPowerShell(connId);
});

// CMD
ipcMain.handle('cmd:connect', async (event, { connId }) => {
  log('CMD connect requested:', connId);
  try {
    return await connectCMD(connId);
  } catch (e) {
    log('CMD connect error:', e.message);
    return 'error: ' + e.message;
  }
});

ipcMain.handle('cmd:execute', async (event, { connId, cmd }) => {
  log('CMD execute for', connId, ':', JSON.stringify(cmd));
  const conn = cmdConnections.get(connId);
  if (conn && conn.pty) {
    try {
      conn.pty.write(cmd);
      if (conn.logId) writeSessionLog(conn.logId, 'send', cmd);
      log('CMD execute: written ok');
      return 'executed';
    }
    catch (e) { log('CMD execute error:', e.message); return 'error: ' + e.message; }
  }
  return 'not connected';
});

ipcMain.handle('cmd:ready', async (event, { connId }) => {
  log('CMD ready for', connId);
  return 'ready';
});

ipcMain.handle('cmd:disconnect', async (event, connId) => {
  log('CMD disconnect:', connId);
  return disconnectCMD(connId);
});

// Serial
ipcMain.handle('serial:connect', async (event, params) => {
  const validationError = validateParams(params, ['connId', 'port']);
  if (validationError) return 'error: ' + validationError;
  const { connId, port, baudRate } = params;
  log('Serial connect requested:', connId, port, baudRate);
  try {
    return await connectSerial(connId, port, baudRate);
  } catch (e) {
    log('Serial connect error:', e.message);
    return 'error: ' + e.message;
  }
});

ipcMain.handle('serial:execute', async (event, { connId, data }) => {
  log('Serial execute for', connId, ':', JSON.stringify(data));
  const conn = serialConnections.get(connId);
  if (!conn) return 'not connected';
  try {
    conn.port.write(data);
    if (conn.logId) writeSessionLog(conn.logId, 'send', data);
    log('Serial execute: written ok');
  }
  catch (e) { log('Serial execute error:', e.message); }
  return 'executed';
});

ipcMain.handle('serial:disconnect', async (event, connId) => {
  log('Serial disconnect for', connId);
  return disconnectSerialByConnId(connId);
});

ipcMain.handle('serial:list', async () => {
  log('Serial list requested');
  try {
    const { SerialPort } = require('serialport');
    const ports = await SerialPort.list();
    // Return full port info for display
    return ports.map(p => ({
      path: p.path,
      manufacturer: p.manufacturer || '',
      serialNumber: p.serialNumber || '',
      pnpId: p.pnpId || '',
      vendorId: p.vendorId || '',
      productId: p.productId || '',
    })).filter(p => p.path && p.path.startsWith('COM'));
  } catch (e) { log('Serial list error:', e.message); return []; }
});

// SSH
ipcMain.handle('ssh:connect', async (event, params) => {
  const validationError = validateParams(params, ['connId', 'host', 'username', 'password']);
  if (validationError) return 'error: ' + validationError;
  const { connId, host, port, username, password } = params;
  log('SSH connect requested:', connId, host, port || 22, username);
  try {
    return await connectSSH(connId, host, port, username, password);
  } catch (e) {
    log('SSH connect error:', e.message);
    return 'error: ' + e.message;
  }
});

ipcMain.handle('ssh:execute', async (event, { connId, cmd }) => {
  executeCount++;
  log('SSH execute for', connId, ':', JSON.stringify(cmd), '#', executeCount);
  const conn = sshConnections.get(connId);
  if (!conn) return 'not connected';
  if (!conn.stream) return 'connection not ready';
  try {
    conn.stream.write(cmd);
    streamWriteCount++;
    if (conn.logId) writeSessionLog(conn.logId, 'send', cmd);
    log('SSH execute: written ok for', connId, 'streamWrites:', streamWriteCount);
  }
  catch (e) { log('SSH execute error for', connId, ':', e.message); }
  return 'executed';
});

ipcMain.handle('ssh:disconnect', async (event, connId) => {
  log('SSH disconnect for', connId);
  return disconnectSSH(connId);
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
// IR Storage
// ============================================================
const irDataFilePath = path.join(os.homedir(), '.seelelink', 'ir-data.json');

const defaultIRData = {
  deviceTypes: [
    { id: 'dt-ac', name: '通用空调', category: '空调', description: '支持常见品牌空调' },
    { id: 'dt-tv', name: '通用电视', category: '电视', description: '支持常见品牌电视' },
    { id: 'dt-fan', name: '通用风扇', category: '风扇', description: '支持常见品牌风扇' },
    { id: 'dt-stb', name: '通用机顶盒', category: '机顶盒', description: '支持常见品牌机顶盒' },
    { id: 'dt-projector', name: '通用投影仪', category: '投影仪', description: '支持常见品牌投影仪' },
  ],
  commands: [
    // 空调命令
    { id: 'cmd-ac-power', name: '电源', category: '空调', deviceTypeId: 'dt-ac', frequency: 38000, pattern: 'IR_POWER_PATTERN', protocol: 'nec', description: '开关机' },
    { id: 'cmd-ac-cool', name: '制冷', category: '空调', deviceTypeId: 'dt-ac', frequency: 38000, pattern: 'IR_COOL_PATTERN', protocol: 'nec', description: '制冷模式' },
    { id: 'cmd-ac-heat', name: '制热', category: '空调', deviceTypeId: 'dt-ac', frequency: 38000, pattern: 'IR_HEAT_PATTERN', protocol: 'nec', description: '制热模式' },
    { id: 'cmd-ac-temp-up', name: '温度+', category: '空调', deviceTypeId: 'dt-ac', frequency: 38000, pattern: 'IR_TEMP_UP_PATTERN', protocol: 'nec', description: '温度升高' },
    { id: 'cmd-ac-temp-down', name: '温度-', category: '空调', deviceTypeId: 'dt-ac', frequency: 38000, pattern: 'IR_TEMP_DOWN_PATTERN', protocol: 'nec', description: '温度降低' },
    { id: 'cmd-ac-fan', name: '风扇', category: '空调', deviceTypeId: 'dt-ac', frequency: 38000, pattern: 'IR_FAN_PATTERN', protocol: 'nec', description: '送风模式' },
    // 电视命令
    { id: 'cmd-tv-power', name: '电源', category: '电视', deviceTypeId: 'dt-tv', frequency: 38000, pattern: 'TV_POWER', protocol: 'nec', description: '开关机' },
    { id: 'cmd-tv-vol-up', name: '音量+', category: '电视', deviceTypeId: 'dt-tv', frequency: 38000, pattern: 'TV_VOL_UP', protocol: 'nec', description: '音量增加' },
    { id: 'cmd-tv-vol-down', name: '音量-', category: '电视', deviceTypeId: 'dt-tv', frequency: 38000, pattern: 'TV_VOL_DOWN', protocol: 'nec', description: '音量减少' },
    { id: 'cmd-tv-ch-up', name: '频道+', category: '电视', deviceTypeId: 'dt-tv', frequency: 38000, pattern: 'TV_CH_UP', protocol: 'nec', description: '频道增加' },
    { id: 'cmd-tv-ch-down', name: '频道-', category: '电视', deviceTypeId: 'dt-tv', frequency: 38000, pattern: 'TV_CH_DOWN', protocol: 'nec', description: '频道减少' },
    // 风扇命令
    { id: 'cmd-fan-power', name: '电源', category: '风扇', deviceTypeId: 'dt-fan', frequency: 38000, pattern: 'FAN_POWER', protocol: 'nec', description: '开关机' },
    { id: 'cmd-fan-speed', name: '档位', category: '风扇', deviceTypeId: 'dt-fan', frequency: 38000, pattern: 'FAN_SPEED', protocol: 'nec', description: '切换档位' },
    // 机顶盒命令
    { id: 'cmd-stb-power', name: '电源', category: '机顶盒', deviceTypeId: 'dt-stb', frequency: 38000, pattern: 'STB_POWER', protocol: 'nec', description: '开关机' },
    { id: 'cmd-stb-ok', name: '确认', category: '机顶盒', deviceTypeId: 'dt-stb', frequency: 38000, pattern: 'STB_OK', protocol: 'nec', description: '确认' },
    // 投影仪命令
    { id: 'cmd-proj-power', name: '电源', category: '投影仪', deviceTypeId: 'dt-projector', frequency: 38000, pattern: 'PROJ_POWER', protocol: 'nec', description: '开关机' },
  ],
  devices: [],
  sequences: [],
};

function loadIRData() {
  try {
    if (fs.existsSync(irDataFilePath)) {
      const data = JSON.parse(fs.readFileSync(irDataFilePath, 'utf-8'));
      return {
        deviceTypes: data.deviceTypes || defaultIRData.deviceTypes,
        commands: data.commands || defaultIRData.commands,
        devices: data.devices || [],
        sequences: data.sequences || [],
      };
    }
  } catch (e) { log('Load IR data error:', e); }
  return { ...defaultIRData };
}

function saveIRData(data) {
  try {
    const dir = path.dirname(irDataFilePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(irDataFilePath, JSON.stringify(data, null, 2));
  } catch (e) { log('Save IR data error:', e); }
}

ipcMain.handle('ir:load', async () => {
  return loadIRData();
});

ipcMain.handle('ir:save', async (event, data) => {
  saveIRData(data);
  return 'saved';
});

// ============================================================
// Window Controls (for frameless window)
// ============================================================
ipcMain.on('window:minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window:maximize', () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});

ipcMain.on('window:close', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.handle('window:isMaximized', () => {
  return mainWindow ? mainWindow.isMaximized() : false;
});

// ============================================================
// Window Control & Automation API
// ============================================================

// Check if a captured NativeImage is blank (e.g. minimized/background window returns black pixels)
function isImageBlank(img) {
  if (img.isEmpty()) return true;
  const size = img.getSize();
  if (size.width === 0 || size.height === 0) return true;
  try {
    const buf = img.toBitmap();
    // BGRA format, sample every 10th pixel for speed
    const stride = size.width * 4;
    let nonBlackPixels = 0;
    for (let y = 0; y < size.height; y += 10) {
      for (let x = 0; x < size.width; x += 10) {
        const offset = y * stride + x * 4;
        if (buf[offset] > 5 || buf[offset + 1] > 5 || buf[offset + 2] > 5) {
          nonBlackPixels++;
        }
      }
    }
    return nonBlackPixels === 0;
  } catch (e) {
    return true;
  }
}

// Multi-mode window capture: respects appConfig.windowCapture.mode
// mode: "auto" (page capture, fallback to GDI if blank)
//       "foreground" (SetForegroundWindow then page capture)
//       "gdi" (GDI full-screen crop to window bounds)
async function doWindowCapture() {
  if (!mainWindow) return { error: 'no window' };
  const mode = appConfig.windowCapture?.mode || 'auto';

  // Foreground mode: bring window to front first
  if (mode === 'foreground') {
    try {
      const { exec } = require('child_process');
      // Use Get-Process to get current process HWND and call SetForegroundWindow
      const psScript = `
        Add-Type @"using System;using System.Diagnostics;using System.Runtime.InteropServices;public class WF{[DllImport("user32.dll")]public static extern IntPtr GetForegroundWindow();[DllImport("user32.dll")]public static extern bool SetForegroundWindow(IntPtr hWnd);} "@
        $proc = Get-Process -Id $PID
        if ($proc.MainWindowHandle -ne [IntPtr]::Zero) {
          [WF]::SetForegroundWindow($proc.MainWindowHandle)
        }
      `;
      exec(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${psScript.replace(/"/g, '\\"')}"`, (e) => { if (e) log('bringToForeground exec error:', e.message); });
      await new Promise(r => setTimeout(r, 200)); // allow window to come forward
    } catch (e) {
      log('bringToForeground error:', e.message);
    }
  }

  // GDI mode: capture full screen then crop to window bounds
  if (mode === 'gdi') {
    if (controlService?.screen) {
      try {
        const bounds = mainWindow.getBounds();
        const result = await controlService.screen.captureWindow(bounds);
        return { png: result.base64, mode: 'gdi', width: result.width, height: result.height };
      } catch (e) {
        log('GDI capture error:', e.message);
        return { error: 'GDI capture failed: ' + e.message };
      }
    }
    return { error: 'GDI capture unavailable (control handlers not loaded)' };
  }

  // Default: page capture (with auto fallback)
  try {
    const img = await mainWindow.webContents.capturePage();
    if (isImageBlank(img) && mode === 'auto') {
      // Auto fallback: page was blank, use GDI crop
      if (controlService?.screen) {
        try {
          const bounds = mainWindow.getBounds();
          const result = await controlService.screen.captureWindow(bounds);
          return { png: result.base64, mode: 'gdi-fallback', width: result.width, height: result.height };
        } catch (e) {
          log('GDI fallback error:', e.message);
        }
      }
    }
    return { png: img.toPNG().toString('base64'), mode: 'page' };
  } catch (e) {
    return { error: e.message };
  }
}

// Capture screenshot of the window (multi-mode)
ipcMain.handle('window:capture', async () => {
  return doWindowCapture();
});

// Execute JavaScript in renderer and return result
ipcMain.handle('window:eval', async (_, script) => {
  // P1-6: Restrict to development mode only — arbitrary JS execution is unsafe
  if (process.env.NODE_ENV !== 'development') return { error: 'not available in production' };
  if (!mainWindow) return { error: 'no window' };
  if (typeof script !== 'string' || !script.trim()) return { error: 'invalid script' };
  try {
    const result = await mainWindow.webContents.executeJavaScript(script);
    return { result };
  } catch (e) { return { error: e.message }; }
});

// Execute adb command via IPC
ipcMain.handle('exec:adb', async (_, args) => {
  return await handleControlCommand({ cmd: 'exec:adb', args });
});

// Execute adb screenshot via IPC
ipcMain.handle('exec:adb:screenshot', async (_, deviceId) => {
  return await handleControlCommand({ cmd: 'exec:adb:screenshot', args: [deviceId] });
});

// Get window bounds on screen
ipcMain.handle('window:getBounds', () => {
  if (!mainWindow) return null;
  const b = mainWindow.getBounds();
  const c = mainWindow.getContentBounds(); // viewable content area
  return {
    window: b,          // full window including title bar
    content: c,         // content area only
    // offset = title bar height
    titleBarOffset: b.height - c.height,
  };
});

// Switch to a specific tab (sent to renderer)
ipcMain.on('window:switchTab', (event, tab) => {
  if (!mainWindow) return;
  mainWindow.webContents.send('window:switchTab', tab);
});

// Click at window-relative coordinates
ipcMain.on('window:click', (event, params) => {
  if (!params || typeof params !== 'object') return;
  const { x, y, button } = params;
  if (!mainWindow) return;
  const bounds = mainWindow.getBounds();
  const absX = bounds.x + Math.round(sanitizeCoordinate(x, 0));
  const absY = bounds.y + Math.round(sanitizeCoordinate(y, 0));
  if (isNaN(absX) || isNaN(absY)) return;
  // Validate button parameter - only allow 'left' or 'right'
  const isRight = button === 'right';
  const btnName = isRight ? 'Right' : 'Left';
  const { execSync } = require('child_process');
  try {
    execSync(`powershell -Command "
      Add-Type -AssemblyName System.Windows.Forms
      [System.Windows.Forms.Cursor]::Position = [System.Drawing.Point]::new(${absX}, ${absY})
      Start-Sleep -Milliseconds 10
      [System.Windows.Forms.MouseEvent]::MouseDown([System.Windows.Forms.MouseButtons]::${btnName})
      [System.Windows.Forms.MouseEvent]::MouseUp([System.Windows.Forms.MouseButtons]::${btnName})
    "`);
  } catch (e) { log('Click error:', e); }
});

// Move mouse to window-relative coordinates
ipcMain.on('window:moveMouse', (event, params) => {
  if (!params || typeof params !== 'object') return;
  const { x, y } = params;
  if (!mainWindow) return;
  const bounds = mainWindow.getBounds();
  const absX = Math.round(bounds.x + sanitizeCoordinate(x, 0));
  const absY = Math.round(bounds.y + sanitizeCoordinate(y, 0));
  if (isNaN(absX) || isNaN(absY)) return;
  const { execSync } = require('child_process');
  try {
    execSync(`powershell -Command "[System.Windows.Forms.Cursor]::Position = [System.Drawing.Point]::new(${absX}, ${absY})"`);
  } catch (e) { log('MoveMouse error:', e); }
});

// Send keyboard keys
ipcMain.on('window:sendKeys', (event, keys) => {
  if (!mainWindow || !keys || !Array.isArray(keys)) return;
  for (const key of keys) {
    const keyCode = keyToKeyCode(key);
    if (!keyCode) continue;
    mainWindow.webContents.sendInputEvent({ type: 'keyDown', keyCode: keyCode.vk, modifiers: keyCode.modifiers || [] });
    mainWindow.webContents.sendInputEvent({ type: 'keyUp', keyCode: keyCode.vk, modifiers: keyCode.modifiers || [] });
  }
});

// Debug mode: forward all input events from webContents to renderer
let debugMode = false;
let debugRegistered = false;

function ensureDebugListener() {
  if (!mainWindow || debugRegistered) return;
  debugRegistered = true;
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (!debugMode) return;
    if (input.type === 'mouseClicked') {
      mainWindow.webContents.send('debug:mouseClick', { x: input.x, y: input.y, button: input.button });
    } else if (input.type === 'mouseMoved') {
      mainWindow.webContents.send('debug:mouseMove', { x: input.x, y: input.y });
    } else if (input.type === 'keyDown') {
      mainWindow.webContents.send('debug:keyDown', { key: input.key, code: input.code });
    }
  });
}

ipcMain.on('window:startDebug', () => {
  ensureDebugListener();
  debugMode = true;
  log('Debug mode started');
});
ipcMain.on('window:stopDebug', () => { debugMode = false; log('Debug mode stopped'); });

// Key string to keyCode helper
function keyToKeyCode(key) {
  const map = {
    'Enter': { vk: 'Enter' }, 'Tab': { vk: 'Tab' }, 'Escape': { vk: 'Escape' },
    'Backspace': { vk: 'Back' }, 'Delete': { vk: 'Delete' },
    'ArrowUp': { vk: 'Up' }, 'ArrowDown': { vk: 'Down' },
    'ArrowLeft': { vk: 'Left' }, 'ArrowRight': { vk: 'Right' },
    ' ': { vk: 'Space' }, 'Home': { vk: 'Home' }, 'End': { vk: 'End' },
    'PageUp': { vk: 'PageUp' }, 'PageDown': { vk: 'PageDown' },
    'F1': { vk: 'F1' }, 'F2': { vk: 'F2' }, 'F3': { vk: 'F3' },
    'F4': { vk: 'F4' }, 'F5': { vk: 'F5' }, 'F6': { vk: 'F6' },
    'F7': { vk: 'F7' }, 'F8': { vk: 'F8' }, 'F9': { vk: 'F9' },
    'F10': { vk: 'F10' }, 'F11': { vk: 'F11' }, 'F12': { vk: 'F12' },
  };
  if (map[key]) return map[key];
  // Single character A-Z, 0-9
  if (/^[A-Za-z0-9]$/.test(key)) return { vk: key.toUpperCase() };
  // Ctrl/Shift/Alt combinations: "Ctrl+a", "Shift+b", etc.
  const lower = key.toLowerCase();
  if (lower.startsWith('ctrl+')) {
    const inner = keyToKeyCode(key.slice(5));
    if (inner) return { vk: inner.vk, modifiers: ['control'] };
  }
  if (lower.startsWith('shift+')) {
    const inner = keyToKeyCode(key.slice(6));
    if (inner) return { vk: inner.vk, modifiers: ['shift'] };
  }
  if (lower.startsWith('alt+')) {
    const inner = keyToKeyCode(key.slice(4));
    if (inner) return { vk: inner.vk, modifiers: ['alt'] };
  }
  return null;
}

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
ipcMain.handle('ws:connect', async (event, params) => {
  const validationError = validateParams(params, ['connId', 'url']);
  if (validationError) return 'error: ' + validationError;
  const { connId, url } = params;
  log('WS connect requested:', connId, url);
  try {
    return await connectWebSocket(connId, url);
  } catch (e) {
    log('WS connect error:', e.message);
    return 'error: ' + e.message;
  }
});

ipcMain.handle('ws:send', async (event, { connId, data }) => {
  log('WS send for', connId, ':', data.substring(0, 100));
  const conn = wsConnections.get(connId);
  if (!conn) return 'not connected';
  if (conn.ws.readyState !== 1) return 'not open (state: ' + conn.ws.readyState + ')';
  try {
    conn.ws.send(data);
    if (conn.logId) writeSessionLog(conn.logId, 'send', '> ' + data);
    return 'sent';
  } catch (e) { log('WS send error:', e.message); return 'error: ' + e.message; }
});

ipcMain.handle('ws:disconnect', async (event, connId) => {
  log('WS disconnect for', connId);
  return disconnectWebSocket(connId);
});

// ============================================================
// Plugin Management IPC Handlers
// ============================================================

// Get list of all discovered plugins
ipcMain.handle('plugin:list', async () => {
  return Array.from(loadedPlugins.values()).map(p => ({
    id: p.manifest.id,
    name: p.manifest.name,
    version: p.manifest.version,
    type: p.manifest.type,
    description: p.manifest.description || '',
    enabled: p.enabled,
  }));
});

// Get plugin details
ipcMain.handle('plugin:get', async (event, pluginId) => {
  const plugin = loadedPlugins.get(pluginId);
  if (!plugin) return null;
  return {
    id: plugin.manifest.id,
    name: plugin.manifest.name,
    version: plugin.manifest.version,
    type: plugin.manifest.type,
    description: plugin.manifest.description || '',
    enabled: plugin.enabled,
    hasActivate: !!plugin.instance.onActivate,
    hasDeactivate: !!plugin.instance.onDeactivate,
    hasUninstall: !!plugin.instance.onUninstall,
  };
});

// Enable a plugin
ipcMain.handle('plugin:enable', async (event, pluginId) => {
  try {
    await enablePlugin(pluginId);
    return { ok: true };
  } catch (e) {
    return { error: e.message };
  }
});

// Disable a plugin
ipcMain.handle('plugin:disable', async (event, pluginId) => {
  try {
    await disablePlugin(pluginId);
    return { ok: true };
  } catch (e) {
    return { error: e.message };
  }
});

// Uninstall a plugin (disable first, then remove files)
ipcMain.handle('plugin:uninstall', async (event, pluginId) => {
  const plugin = loadedPlugins.get(pluginId);
  if (!plugin) return { error: 'Plugin not found' };
  try {
    if (plugin.enabled) {
      await disablePlugin(pluginId);
    }
    if (plugin.instance.onUninstall) {
      try {
        await plugin.instance.onUninstall();
      } catch (e) {
        log('Plugin', pluginId, 'onUninstall failed:', e.message);
      }
    }
    // Remove plugin directory
    if (fs.existsSync(plugin.dir)) {
      fs.rmSync(plugin.dir, { recursive: true, force: true });
    }
    loadedPlugins.delete(pluginId);
    // Remove plugin config
    const configFile = path.join(PLUGIN_CONFIG_DIR, `${pluginId}.json`);
    if (fs.existsSync(configFile)) {
      fs.unlinkSync(configFile);
    }
    return { ok: true };
  } catch (e) {
    return { error: e.message };
  }
});

// Get plugin directory path
ipcMain.handle('plugin:getDir', async () => {
  return PLUGINS_DIR;
});

// Open plugins folder in file explorer
ipcMain.handle('plugin:openFolder', async () => {
  const { shell } = require('electron');
  shell.openPath(PLUGINS_DIR);
  return { ok: true };
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

// ============================================================
// Android - Local IP & LAN Discovery
// ============================================================

// Get local machine IP addresses
ipcMain.handle('android:getLocalIp', async () => {
  const { execSync } = require('child_process');
  try {
    const interfaces = os.networkInterfaces();
    const ips = [];

    for (const [name, addrs] of Object.entries(interfaces)) {
      if (!addrs) continue;
      for (const addr of addrs) {
        if (addr.family === 'IPv4' && !addr.internal) {
          ips.push({
            name,
            ip: addr.address,
            netmask: addr.netmask,
            mac: addr.mac,
          });
        }
      }
    }
    return { ok: true, ips };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// Get the local IP that would be used to reach an Android device at given IP
ipcMain.handle('android:getLocalIpForTarget', async (event, targetIp) => {
  try {
    const interfaces = os.networkInterfaces();
    const targetParts = targetIp.split('.').map(Number);
    const targetSubnet = targetParts.slice(0, 3).join('.');

    for (const [name, addrs] of Object.entries(interfaces)) {
      if (!addrs) continue;
      for (const addr of addrs) {
        if (addr.family === 'IPv4' && !addr.internal) {
          const localParts = addr.address.split('.').map(Number);
          const localSubnet = localParts.slice(0, 3).join('.');
          if (localSubnet === targetSubnet) {
            return { ok: true, localIp: addr.address, interface: name };
          }
        }
      }
    }
    // Fallback: return first non-internal IPv4
    for (const [, addrs] of Object.entries(interfaces)) {
      if (!addrs) continue;
      for (const addr of addrs) {
        if (addr.family === 'IPv4' && !addr.internal) {
          return { ok: true, localIp: addr.address, interface: 'fallback' };
        }
      }
    }
    return { ok: false, error: 'No suitable network interface found' };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// Scan LAN for Android devices via port 5555 + ADB mDNS discovery
ipcMain.handle('android:scanNetwork', async (event, options = {}) => {
  const { timeout = 3000, targetIp = null, port = 5555 } = options;
  const { spawn, exec } = require('child_process');
  const dns = require('dns');
  const net = require('net');

  const results = [];
  const localIps = [];

  // Step 1: Get local IPs to determine subnet(s)
  try {
    const interfaces = os.networkInterfaces();
    for (const [, addrs] of Object.entries(interfaces)) {
      if (!addrs) continue;
      for (const addr of addrs) {
        if (addr.family === 'IPv4' && !addr.internal) {
          localIps.push(addr.address);
        }
      }
    }
  } catch (e) { log('scanNetwork: failed to get interfaces:', e.message); }

  if (localIps.length === 0) {
    return { ok: false, error: 'No local IP found', devices: [] };
  }

  // Step 2: If a specific target IP is given, check that single IP
  const subnetsToScan = [];
  if (targetIp) {
    const parts = targetIp.split('.').map(Number);
    const subnet = parts.slice(0, 3).join('.');
    subnetsToScan.push({ subnet, prefix: subnet + '.', start: parts[3], end: parts[3] });
  } else {
    // Collect unique subnets
    for (const localIp of localIps) {
      const parts = localIp.split('.').map(Number);
      const subnet = parts.slice(0, 3).join('.');
      if (!subnetsToScan.find(s => s.subnet === subnet)) {
        subnetsToScan.push({ subnet, prefix: subnet + '.', start: 1, end: 254 });
      }
    }
  }

  // Step 3: TCP port scan for port 5555 on each subnet
  const scanPort = (ip, portNum, timeoutMs) => {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      let resolved = false;
      const timer = setTimeout(() => {
        if (!resolved) { resolved = true; socket.destroy(); resolve(false); }
      }, timeoutMs);
      socket.connect(portNum, ip, () => {
        if (!resolved) { resolved = true; clearTimeout(timer); socket.destroy(); resolve(true); }
      });
      socket.on('error', () => {
        if (!resolved) { resolved = true; clearTimeout(timer); socket.destroy(); resolve(false); }
      });
      socket.on('timeout', () => {
        if (!resolved) { resolved = true; clearTimeout(timer); socket.destroy(); resolve(false); }
      });
    });
  };

  // Step 4: For each potential device found, try adb connect
  const tryConnect = (ip, portNum) => {
    return new Promise((resolve) => {
      exec(`adb connect ${ip}:${portNum}`, { timeout: 8000 }, (err, stdout, stderr) => {
        if (err) {
          // Timeout or network error - skip this IP, it's not a working ADB device
          resolve({ ip, port: portNum, connected: false, skipped: true, error: err.message });
          return;
        }
        const out = stdout.toLowerCase();
        if (out.includes('connected') || out.includes('already connected')) {
          resolve({ ip, port: portNum, connected: true, skipped: false });
        } else if (out.includes('unauthorized')) {
          // Device needs authorization - report as discovered but needs auth
          resolve({ ip, port: portNum, connected: false, skipped: false, unauthorized: true, error: stdout.trim() });
        } else {
          // Other failure (e.g., "failed to authenticate", etc.) - skip
          resolve({ ip, port: portNum, connected: false, skipped: true, error: stdout.trim() });
        }
      });
    });
  };

  // Step 5: Get device info after successful connection
  const getDeviceInfo = (deviceId) => {
    return new Promise((resolve) => {
      exec(`adb -s ${deviceId} shell getprop ro.product.model`, { timeout: 5000 }, (err, stdout) => {
        const model = err ? null : stdout.trim() || null;
        exec(`adb -s ${deviceId} shell getprop ro.product.manufacturer`, { timeout: 5000 }, (err2, stdout2) => {
          const manufacturer = err2 ? null : stdout2.trim() || null;
          exec(`adb -s ${deviceId} shell getprop ro.build.version.release`, { timeout: 5000 }, (err3, stdout3) => {
            const version = err3 ? null : stdout3.trim() || null;
            resolve({ model, manufacturer, version });
          });
        });
      });
    });
  };

  try {
    const found = [];
    const scanTimeout = parseInt(timeout) || 3000;
    const scanCount = subnetsToScan.reduce((sum, s) => sum + (s.end - s.start + 1), 0);
    log(`[AndroidScan] Scanning ${scanCount} IPs across ${subnetsToScan.length} subnet(s), timeout=${scanTimeout}ms`);

    // Scan all IPs concurrently with a limit
    const concurrency = 50;
    for (const subnetInfo of subnetsToScan) {
      const ips = [];
      for (let i = subnetInfo.start; i <= subnetInfo.end; i++) {
        ips.push(subnetInfo.prefix + i);
      }

      // Process in batches
      for (let batch = 0; batch < ips.length; batch += concurrency) {
        const batch_ips = ips.slice(batch, batch + concurrency);
        const batchResults = await Promise.all(
          batch_ips.map(ip => scanPort(ip, port, scanTimeout))
        );
        for (let j = 0; j < batch_ips.length; j++) {
          if (batchResults[j]) {
            found.push(batch_ips[j]);
          }
        }
      }
    }

    log(`[AndroidScan] Found ${found.length} IPs with port ${port} open`);

    // Step 6: Try adb connect on found IPs
    const connectResults = await Promise.all(found.map(ip => tryConnect(ip, port)));

    // Step 7: Filter to successful connections and get device info
    for (const result of connectResults) {
      // Skip devices that couldn't connect (timeout, network error, etc.)
      if (result.skipped) {
        log(`[AndroidScan] Skipped ${result.ip}:${result.port} - ${result.error || 'connection failed'}`);
        continue;
      }
      if (result.unauthorized) {
        // Device found but needs authorization
        results.push({
          id: `${result.ip}:${result.port}`,
          ip: result.ip,
          port: result.port,
          type: 'network',
          status: 'unauthorized',
          error: result.error,
        });
        continue;
      }
      if (result.connected) {
        const deviceId = `${result.ip}:${result.port}`;
        const info = await getDeviceInfo(deviceId);
        results.push({
          id: deviceId,
          ip: result.ip,
          port: result.port,
          type: 'network',
          status: 'discovered',
          ...info,
        });
      }
    }

    log(`[AndroidScan] ${results.length} devices discovered`);
    return { ok: true, devices: results, scanned: found.length };

  } catch (e) {
    log('android:scanNetwork error:', e.message);
    return { ok: false, error: e.message, devices: [] };
  }
});

// ── Window Capture Config ─────────────────────────────────────────────────

// Get current window capture mode
ipcMain.handle('windowCapture:getConfig', async () => {
  return appConfig.windowCapture || { mode: 'auto' };
});

// Set window capture mode: "auto" | "foreground" | "gdi"
ipcMain.handle('windowCapture:setConfig', async (event, { mode }) => {
  if (!['auto', 'foreground', 'gdi'].includes(mode)) {
    return { error: 'Invalid mode. Use: auto, foreground, gdi' };
  }
  const cfg = loadConfig();
  cfg.windowCapture = { mode };
  saveConfig(cfg);
  appConfig = cfg;
  log('windowCapture: mode set to', mode);
  return cfg.windowCapture;
});
