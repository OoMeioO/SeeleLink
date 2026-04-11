/**
 * Windows Platform Control Implementation
 *
 * Uses temp .ps1 files to execute PowerShell scripts reliably,
 * avoiding -EncodedCommand issues in certain environments.
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const { writeFileSync, unlinkSync, existsSync } = require('fs');
const { tmpdir } = require('os');
const { join } = require('path');
const execAsync = promisify(exec);

let scriptCounter = 0;

const execPowerShell = async (script) => {
  // Use temp file to avoid -EncodedCommand issues in some environments
  const scriptFile = join(tmpdir(), `sl_ps_${Date.now()}_${++scriptCounter}.ps1`);
  // Write with CRLF line endings and UTF-8 BOM
  const BOM = Buffer.from([0xEF, 0xBB, 0xBF]);
  const crlfScript = script.replace(/\n/g, '\r\n');
  const content = Buffer.concat([BOM, Buffer.from(crlfScript, 'utf8')]);
  writeFileSync(scriptFile, content);

  try {
    const { stdout } = await execAsync(
      `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptFile}"`,
      { maxBuffer: 10 * 1024 * 1024 }
    );
    return stdout;
  } finally {
    try { unlinkSync(scriptFile); } catch (e) {}
  }
};

// Write and compile C# code, return PowerShell lines to use the compiled type
const compileCSharp = (cSharpCode, typeName) => {
  const csFile = join(tmpdir(), `sl_cs_${Date.now()}_${++scriptCounter}.cs`);
  const psFile = join(tmpdir(), `sl_ps_${Date.now()}_${scriptCounter}.ps1`);
  writeFileSync(csFile, cSharpCode);
  const psLines = [
    `Add-Type -Path "${csFile}"`,
  ];
  return { psFile, psLines, csFile };
};

/**
 * Mouse Control using Windows Win32 API
 */
const mouseControl = {
  async getPosition() {
    const script = [
      'Add-Type -AssemblyName System.Windows.Forms',
      '$pos = [System.Windows.Forms.Cursor]::Position',
      'Write-Output ("X=" + $pos.X.ToString() + " Y=" + $pos.Y.ToString())'
    ].join('\n');
    const output = await execPowerShell(script);
    const match = output.trim().match(/X=(\d+) Y=(\d+)/);
    if (match) {
      return { x: parseInt(match[1]), y: parseInt(match[2]) };
    }
    throw new Error('Failed to get mouse position: ' + output.trim());
  },

  async setPosition(x, y) {
    const xn = Number(x), yn = Number(y);
    if (!Number.isSafeInteger(xn) || !Number.isSafeInteger(yn) || xn < 0 || yn < 0) {
      throw new Error('Invalid coordinates');
    }
    const script = [
      'Add-Type -AssemblyName System.Windows.Forms',
      `[System.Windows.Forms.Cursor]::Position = [System.Drawing.Point]::new(${xn}, ${yn})`
    ].join('\n');
    await execPowerShell(script);
  },

  async click(x, y, button = 'left') {
    const ts = Date.now();
    const n = ++scriptCounter;
    const psFile = join(tmpdir(), `sl_ps_${ts}_${n}.ps1`);
    const csFile = join(tmpdir(), `sl_cs_${ts}_${n}.cs`);
    writeFileSync(csFile, CSHARP_MOUSE);
    const psLines = [
      `Add-Type -Path "${csFile}"`,
      `[System.Windows.Forms.Cursor]::Position=[System.Drawing.Point]::new(${x},${y})`,
      'Start-Sleep -Milliseconds 50',
      '[WM]::mouse_event(0x2,0,0,0,0)',
      'Start-Sleep -Milliseconds 50',
      '[WM]::mouse_event(0x4,0,0,0,0)',
    ];
    const BOM = Buffer.from([0xEF, 0xBB, 0xBF]);
    const content = Buffer.concat([BOM, Buffer.from(psLines.join('\r\n') + '\r\n', 'utf8')]);
    writeFileSync(psFile, content);
    try {
      await execAsync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${psFile}"`, { maxBuffer: 1024 * 1024 });
    } finally {
      try { unlinkSync(csFile); } catch (e) {}
      try { unlinkSync(psFile); } catch (e) {}
    }
  },

  async doubleClick(x, y) {
    await this.click(x, y);
    await new Promise(r => setTimeout(r, 100));
    await this.click(x, y);
  },

  async drag(fromX, fromY, toX, toY) {
    const ts = Date.now();
    const n = ++scriptCounter;
    const psFile = join(tmpdir(), `sl_ps_${ts}_${n}.ps1`);
    const csFile = join(tmpdir(), `sl_cs_${ts}_${n}.cs`);
    writeFileSync(csFile, CSHARP_MOUSE);
    const psLines = [
      `Add-Type -Path "${csFile}"`,
      `[System.Windows.Forms.Cursor]::Position=[System.Drawing.Point]::new(${fromX},${fromY})`,
      '[WM]::mouse_event(0x2,0,0,0,0)',
      'Start-Sleep -Milliseconds 50',
      `[System.Windows.Forms.Cursor]::Position=[System.Drawing.Point]::new(${toX},${toY})`,
      '[WM]::mouse_event(0x4,0,0,0,0)',
    ];
    const BOM = Buffer.from([0xEF, 0xBB, 0xBF]);
    const content = Buffer.concat([BOM, Buffer.from(psLines.join('\r\n') + '\r\n', 'utf8')]);
    writeFileSync(psFile, content);
    try {
      await execAsync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${psFile}"`, { maxBuffer: 1024 * 1024 });
    } finally {
      try { unlinkSync(csFile); } catch (e) {}
      try { unlinkSync(psFile); } catch (e) {}
    }
  },
};

/**
 * Keyboard Control using Windows SendKeys
 */
const keyboardControl = {
  async typeText(text) {
    if (typeof text !== 'string' || text.length > 1000) throw new Error('Invalid text');
    // Escape special SendKeys characters
    const escaped = text
      .replace(/[+^%~(){}[\]]/g, c => '{' + c + '}')
      .replace(/"/g, '"{""}"')
      .replace(/ /g, '{SPACE}');
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
 * Screen Capture using Windows GDI BitBlt (no admin required)
 * Uses Add-Type -Path with a temp .cs file to avoid here-string issues.
 */
const CSHARP_MOUSE = [
  'using System.Runtime.InteropServices;',
  'public class WM{',
  '  [DllImport("user32.dll")]public static extern void mouse_event(uint f,uint dx,uint dy,uint d,uint ei);',
  '}',
].join('\n');

const CSHARP_WIN32 = [
  'using System;',
  'using System.Runtime.InteropServices;',
  'public class Win32{',
  '  [DllImport("user32.dll")]public static extern IntPtr GetDesktopWindow();',
  '  [DllImport("user32.dll")]public static extern IntPtr GetDC(IntPtr h);',
  '  [DllImport("user32.dll")]public static extern int ReleaseDC(IntPtr h,IntPtr d);',
  '  [DllImport("user32.dll")]public static extern bool PrintWindow(IntPtr hWnd,IntPtr hdcBlt,uint nFlags);',
  '  [DllImport("gdi32.dll")]public static extern bool BitBlt(IntPtr d,int x,int y,int w,int h,IntPtr s,int xs,int ys,int r);',
  '  [DllImport("gdi32.dll")]public static extern bool DeleteObject(IntPtr o);',
  '  [DllImport("gdi32.dll")]public static extern bool DeleteDC(IntPtr d);',
  '  [DllImport("gdi32.dll")]public static extern IntPtr CreateCompatibleDC(IntPtr h);',
  '  [DllImport("gdi32.dll")]public static extern IntPtr CreateCompatibleBitmap(IntPtr h,int w,int hh);',
  '  [DllImport("gdi32.dll")]public static extern IntPtr SelectObject(IntPtr d,IntPtr o);',
  '}',
].join('\n');

const runCaptureScript = async (psLines) => {
  const scriptFile = join(tmpdir(), `sl_ps_${Date.now()}_${++scriptCounter}.ps1`);
  const BOM = Buffer.from([0xEF, 0xBB, 0xBF]);
  const content = Buffer.concat([BOM, Buffer.from(psLines.join('\r\n') + '\r\n', 'utf8')]);
  writeFileSync(scriptFile, content);
  try {
    const { stdout } = await execAsync(
      `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptFile}"`,
      { maxBuffer: 10 * 1024 * 1024 }
    );
    return stdout;
  } finally {
    try { unlinkSync(scriptFile); } catch (e) {}
  }
};

const compileAndRun = async (cSharp, psLines) => {
  const csFile = join(tmpdir(), `sl_cs_${Date.now()}_${++scriptCounter}.cs`);
  const psFile = join(tmpdir(), `sl_ps_${Date.now()}_${scriptCounter}.ps1`);
  writeFileSync(csFile, cSharp);
  const BOM = Buffer.from([0xEF, 0xBB, 0xBF]);
  const allLines = [`Add-Type -Path "${csFile}"`, ...psLines];
  const content = Buffer.concat([BOM, Buffer.from(allLines.join('\r\n') + '\r\n', 'utf8')]);
  writeFileSync(psFile, content);
  try {
    const { stdout } = await execAsync(
      `powershell -NoProfile -ExecutionPolicy Bypass -File "${psFile}"`,
      { maxBuffer: 10 * 1024 * 1024 }
    );
    return stdout;
  } finally {
    try { unlinkSync(csFile); } catch (e) {}
    try { unlinkSync(psFile); } catch (e) {}
  }
};

const screenControl = {
  async capture() {
    const psLines = [
      'Add-Type -AssemblyName System.Drawing,System.Windows.Forms',
      '$c=[Win32]::GetDesktopWindow()',
      '$sd=[Win32]::GetDC($c)',
      '$md=[Win32]::CreateCompatibleDC($sd)',
      '$w=[System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Width',
      '$h=[System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Height',
      '$bm=[Win32]::CreateCompatibleBitmap($sd,$w,$h)',
      '$ob=[Win32]::SelectObject($md,$bm)',
      '[Win32]::BitBlt($md,0,0,$w,$h,$sd,0,0,0x00CC0020)',
      '[Win32]::SelectObject($md,$ob)',
      '$b=[System.Drawing.Image]::FromHbitmap($bm)',
      '$ms=New-Object System.IO.MemoryStream',
      '$b.Save($ms,[System.Drawing.Imaging.ImageFormat]::Png)',
      '$e=[Convert]::ToBase64String($ms.ToArray())',
      '[Win32]::DeleteObject($bm)',
      '[Win32]::DeleteDC($md)',
      '[Win32]::ReleaseDC($c,$sd)',
      '$b.Dispose();$ms.Dispose()',
      'Write-Output("BASE64:"+$e+"|W:"+$w+"|H:"+$h)',
    ];
    const output = await compileAndRun(CSHARP_WIN32, psLines);
    const match = output.trim().split('\n').pop().match(/BASE64:(.+)\|W:(\d+)\|H:(\d+)/);
    if (match) {
      return {
        base64: match[1],
        width: parseInt(match[2]),
        height: parseInt(match[3]),
        format: 'png',
        timestamp: Date.now(),
        screen: 'primary',
      };
    }
    throw new Error('Screen capture failed: ' + output.trim());
  },

  async captureRegion(x, y, width, height) {
    const psLines = [
      'Add-Type -AssemblyName System.Drawing,System.Windows.Forms',
      '$c=[Win32]::GetDesktopWindow()',
      '$sd=[Win32]::GetDC($c)',
      '$md=[Win32]::CreateCompatibleDC($sd)',
      '$bm=[Win32]::CreateCompatibleBitmap($sd,' + width + ',' + height + ')',
      '$ob=[Win32]::SelectObject($md,$bm)',
      '[Win32]::BitBlt($md,0,0,' + width + ',' + height + ',$sd,' + x + ',' + y + ',0x00CC0020)',
      '[Win32]::SelectObject($md,$ob)',
      '$b=[System.Drawing.Image]::FromHbitmap($bm)',
      '$ms=New-Object System.IO.MemoryStream',
      '$b.Save($ms,[System.Drawing.Imaging.ImageFormat]::Png)',
      '$e=[Convert]::ToBase64String($ms.ToArray())',
      '[Win32]::DeleteObject($bm)',
      '[Win32]::DeleteDC($md)',
      '[Win32]::ReleaseDC($c,$sd)',
      '$b.Dispose();$ms.Dispose()',
      'Write-Output $e',
    ];
    const output = await compileAndRun(CSHARP_WIN32, psLines);
    return {
      base64: output.trim().split('\n').pop(),
      width,
      height,
      format: 'png',
      timestamp: Date.now(),
    };
  },

  async captureWindow(bounds) {
    // For now, capture full screen
    return this.capture();
  },

  async bringToForeground() {
    const csCode = [
      'using System.Runtime.InteropServices;',
      'public class WF{',
      '  [DllImport("user32.dll")]public static extern IntPtr GetForegroundWindow();',
      '  [DllImport("user32.dll")]public static extern bool SetForegroundWindow(IntPtr hWnd);',
      '}',
    ].join('\n');
    const ts = Date.now();
    const n = ++scriptCounter;
    const psFile = join(tmpdir(), `sl_ps_${ts}_${n}.ps1`);
    const csFile = join(tmpdir(), `sl_cs_${ts}_${n}.cs`);
    writeFileSync(csFile, csCode);
    const psLines = [
      `Add-Type -Path "${csFile}"`,
      '$hwnd=[WF]::GetForegroundWindow()',
      'if($hwnd-ne[IntPtr]::Zero){[WF]::SetForegroundWindow($hwnd)}',
    ];
    const BOM = Buffer.from([0xEF, 0xBB, 0xBF]);
    const content = Buffer.concat([BOM, Buffer.from(psLines.join('\r\n') + '\r\n', 'utf8')]);
    writeFileSync(psFile, content);
    try {
      await execAsync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${psFile}"`, { maxBuffer: 1024 * 1024 });
    } finally {
      try { unlinkSync(csFile); } catch (e) {}
      try { unlinkSync(psFile); } catch (e) {}
    }
  },

  async list() {
    const script = [
      'Add-Type -AssemblyName System.Windows.Forms',
      '$screens = [System.Windows.Forms.Screen]::AllScreens',
      '$result = @()',
      'for ($i = 0; $i -lt $screens.Length; $i++) {',
      '  $s = $screens[$i]',
      '  $result += @{ id = "screen_$i"; name = if ($s.Primary) { "Primary Display" } else { "Display " + ($i + 1).ToString() }; width = $s.Bounds.Width; height = $s.Bounds.Height; x = $s.Bounds.X; y = $s.Bounds.Y; isPrimary = $s.Primary }',
      '}',
      '$result | ConvertTo-Json -Compress'
    ].join('\n');
    const output = await execPowerShell(script);
    const screens = JSON.parse(output.trim());
    return Array.isArray(screens) ? screens : [screens];
  },

  async captureAndSave(path, format = 'png') {
    const screenshot = await this.capture();
    const { writeFileSync } = require('fs');
    const buffer = Buffer.from(screenshot.base64, 'base64');
    writeFileSync(path, buffer);
    return path;
  },
};

/**
 * Debug service - in-memory log storage
 */
const debugLogs = [];
let currentLevel = 'debug';
const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const debugControl = {
  addLog(level, category, message, data) {
    if ((LEVELS[level] || 0) >= (LEVELS[currentLevel] || 0)) {
      debugLogs.push({ timestamp: Date.now(), level, category, message, data });
      if (debugLogs.length > 1000) debugLogs.shift();
    }
  },
  getLogs(filter) {
    if (!filter) return debugLogs.slice(-100);
    return debugLogs.filter(l => !filter.level || l.level === filter.level).slice(-100);
  },
  getStats() {
    const counts = { debug: 0, info: 0, warn: 0, error: 0 };
    for (const l of debugLogs) counts[l.level] = (counts[l.level] || 0) + 1;
    return { total: debugLogs.length, counts };
  },
  clear() { debugLogs.length = 0; },
  setLevel(level) {
    if (LEVELS[level] !== undefined) { currentLevel = level; return true; }
    return false;
  },
  getLevel() { return currentLevel; },
};

function create(log) {
  return {
    mouse: mouseControl,
    keyboard: keyboardControl,
    screen: screenControl,
    debug: debugControl,
  };
}

module.exports = { create };
