/**
 * Control Service IPC Handlers
 * 
 * This module provides IPC handlers for mouse, keyboard, screen, and debug control.
 * It's written in CommonJS for direct integration with electron/main.cjs
 * 
 * Usage:
 *   const controlHandlers = require('./controlHandlers.cjs');
 *   controlHandlers.init(ipcMain, log);
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const execPowerShell = async (script) => {
  // Use base64 encoding to avoid escaping issues
  const encoded = Buffer.from(script, 'utf16le').toString('base64');
  const { stdout } = await execAsync(`powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encoded}`, { maxBuffer: 10 * 1024 * 1024 });
  return stdout;
};

/**
 * Mouse Control using Windows Win32 API
 */
const mouseControl = {
  async getPosition() {
    const script = `
      Add-Type -AssemblyName System.Windows.Forms
      $pos = [System.Windows.Forms.Cursor]::Position
      Write-Output "$($pos.X),$($pos.Y)"
    `;
    const output = await execPowerShell(script);
    const [x, y] = output.trim().split(',').map(Number);
    return { x, y };
  },
  
  async setPosition(x, y) {
    // Validate coordinates as safe integers
    const xn = Number(x), yn = Number(y);
    if (!Number.isSafeInteger(xn) || !Number.isSafeInteger(yn) || xn < 0 || yn < 0) {
      throw new Error('Invalid coordinates');
    }
    const script = `
      Add-Type -AssemblyName System.Windows.Forms
      [System.Windows.Forms.Cursor]::Position = [System.Drawing.Point]::new(${xn}, ${yn})
    `;
    await execPowerShell(script);
  },
  
  async click(x, y, button = 'left') {
    await this.setPosition(x, y);
    await new Promise(r => setTimeout(r, 50));
    const btnFlag = button === 'right' ? 'RIGHT' : button === 'middle' ? 'MIDDLE' : 'LEFT';
    const script = `
      Add-Type -AssemblyName System.Windows.Forms
      Add-Type @"using System;using System.Runtime.InteropServices;public class Win32{[DllImport("user32.dll")]public static extern void mouse_event(uint f,uint dx,uint dy,uint d,uint ei);}
"@
      [Win32]::mouse_event(0x2,0,0,0,0)
      Start-Sleep -Milliseconds 50
      [Win32]::mouse_event(0x4,0,0,0,0)
    `;
    await execPowerShell(script);
  },

  async drag(fromX, fromY, toX, toY) {
    await this.setPosition(fromX, fromY);
    await new Promise(r => setTimeout(r, 50));
    // Mouse down at source
    let script = `
      Add-Type @"using System;using System.Runtime.InteropServices;public class Win32{[DllImport("user32.dll")]public static extern void mouse_event(uint f,uint dx,uint dy,uint d,uint ei);} "@
      [Win32]::mouse_event(0x2,0,0,0,0)
    `;
    await execPowerShell(script);
    // Move to destination while holding left button
    script = `
      Add-Type @"using System;using System.Runtime.InteropServices;public class Win32{[DllImport("user32.dll")]public static extern void mouse_event(uint f,uint dx,uint dy,uint d,uint ei);[DllImport("user32.dll")]public static extern bool SetCursorPos(int x, int y);} "@
      [Win32]::SetCursorPos(${toX}, ${toY})
      Start-Sleep -Milliseconds 50
      [Win32]::mouse_event(0x1,0,0,0,0)
      [Win32]::mouse_event(0x4,0,0,0,0)
    `;
    await execPowerShell(script);
  },
};

/**
 * Keyboard Control using Windows SendKeys
 */
const keyboardControl = {
  async typeText(text) {
    // Validate text as a non-empty safe string (prevent template injection)
    if (typeof text !== 'string' || text.length > 1000) throw new Error('Invalid text');
    // Escape backticks and quotes to prevent string injection
    const escaped = text.replace(/`/g, '``').replace(/"/g, '`"');
    const script = `[System.Windows.Forms.SendKeys]::SendWait("${escaped}")`;
    await execPowerShell(script);
  },
  
  async pressKey(key) {
    const keyMap = {
      'Enter': '{ENTER}', 'Escape': '{ESC}', 'Tab': '{TAB}',
      'Backspace': '{BACKSPACE}', 'Delete': '{DELETE}',
      'ArrowUp': '{UP}', 'ArrowDown': '{DOWN}', 'ArrowLeft': '{LEFT}', 'ArrowRight': '{RIGHT}',
      'Home': '{HOME}', 'End': '{END}', 'PageUp': '{PGUP}', 'PageDown': '{PGDN}',
    };
    const mapped = keyMap[key];
    // Reject unknown keys to prevent template injection
    if (!mapped) throw new Error('Unknown key: ' + key);
    const script = `[System.Windows.Forms.SendKeys]::SendWait("${mapped}")`;
    await execPowerShell(script);
  },
  
  async pressKeys(keys) {
    const modifierMap = { 'ctrl': '^', 'alt': '%', 'shift': '+', 'meta': '{LWIN}' };
    const keyMap = {
      'Enter': '{ENTER}', 'Escape': '{ESC}', 'Tab': '{TAB}',
      'Backspace': '{BACKSPACE}', 'Delete': '{DELETE}',
    };
    let parts = '';
    for (const k of keys) {
      const lower = k.toLowerCase();
      if (modifierMap[lower]) {
        parts += modifierMap[lower];
      } else {
        const mapped = keyMap[k];
        if (!mapped) throw new Error('Unknown key: ' + k);
        parts += mapped;
      }
    }
    const script = `[System.Windows.Forms.SendKeys]::SendWait("${parts}")`;
    await execPowerShell(script);
  },

  async copy() {
    await execPowerShell(`[System.Windows.Forms.SendKeys]::SendWait("^c")`);
  },

  async paste() {
    await execPowerShell(`[System.Windows.Forms.SendKeys]::SendWait("^v")`);
  },

  async cut() {
    await execPowerShell(`[System.Windows.Forms.SendKeys]::SendWait("^x")`);
  },

  async selectAll() {
    await execPowerShell(`[System.Windows.Forms.SendKeys]::SendWait("^a")`);
  },
};

/**
 * Screen Capture using Windows GDI
 */
const screenControl = {
  async capture() {
    const script = `
      Add-Type -AssemblyName System.Windows.Forms
      Add-Type -AssemblyName System.Drawing
      $bmp = New-Object System.Drawing.Bitmap([System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Width, [System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Height)
      $g = [System.Drawing.Graphics]::FromImage($bmp)
      $g.CopyFromScreen([System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Location, [System.Drawing.Point]::Empty, [System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Size)
      $ms = New-Object System.IO.MemoryStream
      $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
      $base64 = [Convert]::ToBase64String($ms.ToArray())
      $bmp.Dispose(); $g.Dispose(); $ms.Dispose()
      Write-Output "$base64|$([System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Width)|$([System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Height)"
    `;
    const output = await execPowerShell(script);
    const [base64, width, height] = output.trim().split('|');
    return {
      base64: base64.trim(),
      width: parseInt(width),
      height: parseInt(height),
      format: 'png',
      timestamp: Date.now(),
    };
  },
  
  async captureRegion(x, y, width, height) {
    // Validate as safe integers
    const xn = Number(x), yn = Number(y), wn = Number(width), hn = Number(height);
    if (!Number.isSafeInteger(xn) || !Number.isSafeInteger(yn) || !Number.isSafeInteger(wn) || !Number.isSafeInteger(hn) || xn < 0 || yn < 0 || wn <= 0 || hn <= 0) {
      throw new Error('Invalid capture parameters');
    }
    const script = `
      Add-Type -AssemblyName System.Windows.Forms
      Add-Type -AssemblyName System.Drawing
      $bmp = New-Object System.Drawing.Bitmap(${wn}, ${hn})
      $g = [System.Drawing.Graphics]::FromImage($bmp)
      $g.CopyFromScreen(${xn}, ${yn}, 0, 0, [System.Drawing.Size]::new(${wn}, ${hn}))
      $ms = New-Object System.IO.MemoryStream
      $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
      $base64 = [Convert]::ToBase64String($ms.ToArray())
      $bmp.Dispose(); $g.Dispose(); $ms.Dispose()
      Write-Output $base64
    `;
    const base64 = await execPowerShell(script);
    return {
      base64: base64.trim(),
      width: wn,
      height: hn,
      format: 'png',
      timestamp: Date.now(),
    };
  },

  // Capture a specific window region by bounds (x, y, width, height)
  // Uses GDI: full-screen capture then crop to window rectangle
  async captureWindow(bounds) {
    const { x, y, width, height } = bounds;
    // Validate as safe integers
    const xn = Number(x), yn = Number(y), wn = Number(width), hn = Number(height);
    if (!Number.isSafeInteger(xn) || !Number.isSafeInteger(yn) || !Number.isSafeInteger(wn) || !Number.isSafeInteger(hn) || xn < 0 || yn < 0 || wn <= 0 || hn <= 0) {
      throw new Error('Invalid bounds');
    }
    const script = `
      Add-Type -AssemblyName System.Windows.Forms
      Add-Type -AssemblyName System.Drawing
      $fullBmp = New-Object System.Drawing.Bitmap([System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Width, [System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Height)
      $g = [System.Drawing.Graphics]::FromImage($fullBmp)
      $g.CopyFromScreen([System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Location, [System.Drawing.Point]::Empty, [System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Size)
      $crop = $fullBmp.Clone([System.Drawing.Rectangle]::new(${xn}, ${yn}, ${wn}, ${hn}), $fullBmp.PixelFormat)
      $ms = New-Object System.IO.MemoryStream
      $crop.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
      $base64 = [Convert]::ToBase64String($ms.ToArray())
      $fullBmp.Dispose(); $g.Dispose(); $crop.Dispose(); $ms.Dispose()
      Write-Output $base64
    `;
    const base64 = await execPowerShell(script);
    return {
      base64: base64.trim(),
      width: wn,
      height: hn,
      format: 'png',
      timestamp: Date.now(),
    };
  },

  // Bring the SeeleLink window to foreground using Win32 SetForegroundWindow
  async bringToForeground(hwnd) {
    let script;
    if (hwnd !== undefined) {
      // Validate hwnd as a safe numeric value to prevent template injection
      const hwndNum = Number(hwnd);
      if (!Number.isSafeInteger(hwndNum) || hwndNum < 0) {
        throw new Error('Invalid hwnd value');
      }
      script = `
        Add-Type @"using System;using System.Runtime.InteropServices;public class WF{[DllImport("user32.dll")]public static extern bool SetForegroundWindow(IntPtr hWnd);} "@
        [WF]::SetForegroundWindow([IntPtr]${hwndNum})
      `;
    } else {
      script = `
        Add-Type @"using System;using System.Diagnostics;using System.Runtime.InteropServices;public class WF{[DllImport("user32.dll")]public static extern IntPtr GetForegroundWindow();[DllImport("user32.dll")]public static extern bool SetForegroundWindow(IntPtr hWnd);} "@
        $proc = Get-Process -Id $PID
        if ($proc.MainWindowHandle -ne [IntPtr]::Zero) {
          [WF]::SetForegroundWindow($proc.MainWindowHandle)
        }
      `;
    }
    await execPowerShell(script);
    return { ok: true };
  },
};

/**
 * Debug log storage
 */
const debugLogs = [];
const MAX_LOGS = 10000;
let debugLevel = 'debug'; // 'debug' | 'info' | 'warn' | 'error'

const LEVEL_PRIORITY = { debug: 0, info: 1, warn: 2, error: 3 };

function addLog(level, service, action, params) {
  if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[debugLevel]) return;
  debugLogs.push({
    timestamp: Date.now(),
    level,
    service,
    action,
    params,
  });
  if (debugLogs.length > MAX_LOGS) {
    debugLogs.shift();
  }
}

// Export object with init function
module.exports = {
  mouse: mouseControl,
  keyboard: keyboardControl,
  screen: screenControl,
  debug: {
    getLogs: (filter) => {
      let logs = [...debugLogs];
      if (filter?.level) logs = logs.filter(l => l.level === filter.level);
      if (filter?.service) logs = logs.filter(l => l.service === filter.service);
      if (filter?.since) logs = logs.filter(l => l.timestamp >= filter.since);
      if (filter?.limit) logs = logs.slice(-filter.limit);
      return logs;
    },
    getStats: () => {
      const stats = {};
      for (const log of debugLogs) {
        if (!stats[log.service]) {
          stats[log.service] = { total: 0, byLevel: { debug: 0, info: 0, warn: 0, error: 0 } };
        }
        stats[log.service].total++;
        stats[log.service].byLevel[log.level]++;
      }
      return stats;
    },
    clear: () => { debugLogs.length = 0; },
    setLevel: (level) => {
      if (['debug', 'info', 'warn', 'error'].includes(level)) {
        debugLevel = level;
        return true;
      }
      return false;
    },
    getLevel: () => debugLevel,
    export: (format = 'json') => {
      if (format === 'json') {
        return JSON.stringify({ level: debugLevel, logs: debugLogs }, null, 2);
      } else if (format === 'text') {
        return debugLogs.map(l => `[${new Date(l.timestamp).toISOString()}] [${l.level.toUpperCase()}] [${String(l.service).replace(/`/g, '``')}] [${String(l.action).replace(/`/g, '``')}] ${JSON.stringify(l.params)}`).join('\n');
      }
      return JSON.stringify({ level: debugLevel, logs: debugLogs });
    },
    addLog,
  },
  
  // Initialize IPC handlers - call this from main.cjs
  init(ipcMain, log) {
    // Mouse handlers
    ipcMain.handle('control:mouse:position', async () => {
      try {
        const pos = await mouseControl.getPosition();
        addLog('debug', 'ControlService', 'mouse:position', pos);
        return { ok: true, result: pos };
      } catch (e) {
        addLog('error', 'ControlService', 'mouse:position', { error: e.message });
        return { ok: false, error: e.message };
      }
    });
    
    ipcMain.handle('control:mouse:move', async (_, x, y) => {
      try {
        await mouseControl.setPosition(x, y);
        addLog('debug', 'ControlService', 'mouse:move', { x, y });
        return { ok: true };
      } catch (e) {
        addLog('error', 'ControlService', 'mouse:move', { error: e.message });
        return { ok: false, error: e.message };
      }
    });
    
    ipcMain.handle('control:mouse:click', async (_, x, y, button) => {
      try {
        await mouseControl.click(x, y, button);
        addLog('info', 'ControlService', 'mouse:click', { x, y, button });
        return { ok: true };
      } catch (e) {
        addLog('error', 'ControlService', 'mouse:click', { error: e.message });
        return { ok: false, error: e.message };
      }
    });
    
    ipcMain.handle('control:mouse:doubleClick', async (_, x, y) => {
      try {
        await mouseControl.click(x, y);
        await new Promise(r => setTimeout(r, 100));
        await mouseControl.click(x, y);
        addLog('info', 'ControlService', 'mouse:doubleClick', { x, y });
        return { ok: true };
      } catch (e) {
        addLog('error', 'ControlService', 'mouse:doubleClick', { error: e.message });
        return { ok: false, error: e.message };
      }
    });

    ipcMain.handle('control:mouse:drag', async (_, fromX, fromY, toX, toY) => {
      try {
        await mouseControl.drag(fromX, fromY, toX, toY);
        addLog('info', 'ControlService', 'mouse:drag', { fromX, fromY, toX, toY });
        return { ok: true };
      } catch (e) {
        addLog('error', 'ControlService', 'mouse:drag', { error: e.message });
        return { ok: false, error: e.message };
      }
    });

    // Keyboard handlers
    ipcMain.handle('control:keyboard:type', async (_, text) => {
      try {
        await keyboardControl.typeText(text);
        addLog('info', 'ControlService', 'keyboard:type', { length: text.length });
        return { ok: true };
      } catch (e) {
        addLog('error', 'ControlService', 'keyboard:type', { error: e.message });
        return { ok: false, error: e.message };
      }
    });
    
    ipcMain.handle('control:keyboard:press', async (_, key) => {
      try {
        await keyboardControl.pressKey(key);
        addLog('debug', 'ControlService', 'keyboard:press', { key });
        return { ok: true };
      } catch (e) {
        addLog('error', 'ControlService', 'keyboard:press', { error: e.message });
        return { ok: false, error: e.message };
      }
    });
    
    ipcMain.handle('control:keyboard:pressKeys', async (_, keys) => {
      try {
        await keyboardControl.pressKeys(keys);
        addLog('info', 'ControlService', 'keyboard:pressKeys', { keys });
        return { ok: true };
      } catch (e) {
        addLog('error', 'ControlService', 'keyboard:pressKeys', { error: e.message });
        return { ok: false, error: e.message };
      }
    });

    ipcMain.handle('control:keyboard:copy', async () => {
      try {
        await keyboardControl.copy();
        addLog('info', 'ControlService', 'keyboard:copy', {});
        return { ok: true };
      } catch (e) {
        addLog('error', 'ControlService', 'keyboard:copy', { error: e.message });
        return { ok: false, error: e.message };
      }
    });

    ipcMain.handle('control:keyboard:paste', async () => {
      try {
        await keyboardControl.paste();
        addLog('info', 'ControlService', 'keyboard:paste', {});
        return { ok: true };
      } catch (e) {
        addLog('error', 'ControlService', 'keyboard:paste', { error: e.message });
        return { ok: false, error: e.message };
      }
    });

    ipcMain.handle('control:keyboard:cut', async () => {
      try {
        await keyboardControl.cut();
        addLog('info', 'ControlService', 'keyboard:cut', {});
        return { ok: true };
      } catch (e) {
        addLog('error', 'ControlService', 'keyboard:cut', { error: e.message });
        return { ok: false, error: e.message };
      }
    });

    ipcMain.handle('control:keyboard:selectAll', async () => {
      try {
        await keyboardControl.selectAll();
        addLog('info', 'ControlService', 'keyboard:selectAll', {});
        return { ok: true };
      } catch (e) {
        addLog('error', 'ControlService', 'keyboard:selectAll', { error: e.message });
        return { ok: false, error: e.message };
      }
    });

    // Screen handlers
    ipcMain.handle('control:screen:capture', async () => {
      try {
        const result = await screenControl.capture();
        addLog('info', 'ControlService', 'screen:capture', { width: result.width, height: result.height });
        return { ok: true, result };
      } catch (e) {
        addLog('error', 'ControlService', 'screen:capture', { error: e.message });
        return { ok: false, error: e.message };
      }
    });
    
    ipcMain.handle('control:screen:captureRegion', async (_, x, y, width, height) => {
      try {
        const result = await screenControl.captureRegion(x, y, width, height);
        addLog('info', 'ControlService', 'screen:captureRegion', { x, y, width, height });
        return { ok: true, result };
      } catch (e) {
        addLog('error', 'ControlService', 'screen:captureRegion', { error: e.message });
        return { ok: false, error: e.message };
      }
    });

    ipcMain.handle('control:screen:captureWindow', async (_, bounds) => {
      try {
        const result = await screenControl.captureWindow(bounds);
        addLog('info', 'ControlService', 'screen:captureWindow', { width: bounds.width, height: bounds.height });
        return { ok: true, result };
      } catch (e) {
        addLog('error', 'ControlService', 'screen:captureWindow', { error: e.message });
        return { ok: false, error: e.message };
      }
    });

    ipcMain.handle('control:screen:bringToForeground', async (_, hwnd) => {
      try {
        await screenControl.bringToForeground(hwnd);
        addLog('info', 'ControlService', 'screen:bringToForeground', { hwnd: hwnd || 'auto' });
        return { ok: true };
      } catch (e) {
        addLog('error', 'ControlService', 'screen:bringToForeground', { error: e.message });
        return { ok: false, error: e.message };
      }
    });
    
    // Debug handlers
    ipcMain.handle('control:debug:getLogs', async (_, filter) => {
      return { ok: true, result: module.exports.debug.getLogs(filter) };
    });
    
    ipcMain.handle('control:debug:getStats', async () => {
      return { ok: true, result: module.exports.debug.getStats() };
    });
    
    ipcMain.handle('control:debug:clear', async () => {
      module.exports.debug.clear();
      return { ok: true };
    });

    ipcMain.handle('control:debug:setLevel', async (_, level) => {
      const ok = module.exports.debug.setLevel(level);
      if (ok) {
        addLog('info', 'ControlService', 'debug:setLevel', { level });
      }
      return { ok, level: module.exports.debug.getLevel() };
    });

    ipcMain.handle('control:debug:export', async (_, format) => {
      try {
        const data = module.exports.debug.export(format);
        return { ok: true, data };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    });

    // Platform handler
    ipcMain.handle('control:platform:info', async () => {
      return {
        ok: true,
        result: {
          type: process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'macos' : 'linux',
          arch: process.arch,
        }
      };
    });

    // Screen list handler
    ipcMain.handle('control:screen:list', async () => {
      try {
        const { execSync } = require('child_process');
        const out = execSync('powershell -Command "[System.Windows.Forms.Screen]::AllScreens | ForEach-Object { $_.DeviceName + \"|\" + $_.Bounds.Width + \"|\" + $_.Bounds.Height + \"|\" + $_.Bounds.X + \"|\" + $_.Bounds.Y + \"|\" + $_.Primary }"', { maxBuffer: 10 * 1024 * 1024, encoding: 'utf8' });
        const screens = out.trim().split('\n').filter(Boolean).map(line => {
          const [name, w, h, x, y, primary] = line.split('|');
          return { name, width: parseInt(w), height: parseInt(h), x: parseInt(x), y: parseInt(y), primary: primary === 'True' };
        });
        return { ok: true, result: screens };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    });

    log('[ControlService] IPC handlers registered');
  },
};
