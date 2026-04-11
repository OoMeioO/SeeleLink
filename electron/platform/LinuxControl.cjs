/**
 * Linux Platform Control Implementation
 *
 * Stub implementation for Linux - not tested (no Linux device available).
 * Mouse, keyboard, and screen control use X11/Wayland APIs.
 *
 * NOTE: This is a scaffold - actual implementation requires Linux testing.
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const execXdotool = async (script) => {
  const { stdout } = await execAsync(`xdotool ${script}`, { maxBuffer: 10 * 1024 * 1024 });
  return stdout;
};

/**
 * Mouse Control using xdotool
 */
const mouseControl = {
  async getPosition() {
    const output = await execXdotool('getmouselocation');
    const match = output.match(/x:(\d+) y:(\d+)/);
    if (match) {
      return { x: parseInt(match[1]), y: parseInt(match[2]) };
    }
    throw new Error('Failed to get mouse position');
  },

  async setPosition(x, y) {
    const xn = Number(x), yn = Number(y);
    if (!Number.isSafeInteger(xn) || !Number.isSafeInteger(yn) || xn < 0 || yn < 0) {
      throw new Error('Invalid coordinates');
    }
    await execXdotool(`mousemove ${xn} ${yn}`);
  },

  async click(x, y, button = 'left') {
    await this.setPosition(x, y);
    await new Promise(r => setTimeout(r, 50));
    const btnMap = { 'left': 1, 'middle': 2, 'right': 3 };
    const btn = btnMap[button] || 1;
    await execXdotool(`click ${btn}`);
  },

  async doubleClick(x, y) {
    await this.click(x, y);
    await new Promise(r => setTimeout(r, 100));
    await this.click(x, y);
  },

  async drag(fromX, fromY, toX, toY) {
    await this.setPosition(fromX, fromY);
    await new Promise(r => setTimeout(r, 50));
    // xdotool doesn't have native drag - would need xdotool mousedown/mousemove/mouseup sequence
    await execXdotool(`mousedown 1`);
    await this.setPosition(toX, toY);
    await execXdotool(`mouseup 1`);
  },
};

/**
 * Keyboard Control using xdotool
 */
const keyboardControl = {
  async typeText(text) {
    if (typeof text !== 'string' || text.length > 1000) throw new Error('Invalid text');
    // Escape special characters for shell
    const escaped = text.replace(/'/g, "'\\''").replace(/"/g, '\\"');
    await execXdotool(`type "${escaped}"`);
  },

  async pressKey(key) {
    const keyMap = {
      'Enter': 'Return', 'Escape': 'Escape', 'Tab': 'Tab',
      'Backspace': 'BackSpace', 'Delete': 'Delete',
      'ArrowUp': 'Up', 'ArrowDown': 'Down', 'ArrowLeft': 'Left', 'ArrowRight': 'Right',
      'Home': 'Home', 'End': 'End', 'PageUp': 'Prior', 'PageDown': 'Next',
    };
    const mapped = keyMap[key];
    if (!mapped) throw new Error('Unknown key: ' + key);
    await execXdotool(`key ${mapped}`);
  },

  async pressKeys(keys) {
    const modifierMap = { 'ctrl': 'ctrl', 'alt': 'alt', 'shift': 'shift', 'meta': 'super' };
    const parts = [];
    for (const k of keys) {
      const lower = k.toLowerCase();
      if (modifierMap[lower]) {
        parts.push(modifierMap[lower]);
      } else {
        parts.push(k);
      }
    }
    if (parts.length > 0) {
      await execXdotool(`key ${parts.join('+')}`);
    }
  },

  async copy() {
    await execXdotool('key ctrl+c');
  },

  async paste() {
    await execXdotool('key ctrl+v');
  },

  async cut() {
    await execXdotool('key ctrl+x');
  },

  async selectAll() {
    await execXdotool('key ctrl+a');
  },
};

/**
 * Screen Capture using Linux tools (scrot, xwd, etc.)
 */
const screenControl = {
  async capture() {
    // Try scrot first, fallback to gnome-screenshot
    try {
      await execAsync('scrot /tmp/screen_capture.png', { maxBuffer: 50 * 1024 * 1024 });
      const { stdout } = await execAsync('cat /tmp/screen_capture.png | base64 && rm /tmp/screen_capture.png', { maxBuffer: 50 * 1024 * 1024 });
      const { stdout: dim } = await execAsync('xdotool getdisplaygeometry', { maxBuffer: 1024 });
      const [width, height] = dim.trim().split(' ').map(Number);
      return {
        base64: stdout.trim(),
        width: width || 1920,
        height: height || 1080,
        format: 'png',
        timestamp: Date.now(),
      };
    } catch {
      // Fallback to gnome-screenshot
      await execAsync('gnome-screenshot -f /tmp/screen_capture.png', { maxBuffer: 50 * 1024 * 1024 });
      const { stdout } = await execAsync('cat /tmp/screen_capture.png | base64 && rm /tmp/screen_capture.png', { maxBuffer: 50 * 1024 * 1024 });
      return {
        base64: stdout.trim(),
        width: 1920,
        height: 1080,
        format: 'png',
        timestamp: Date.now(),
      };
    }
  },

  async captureRegion(x, y, width, height) {
    const xn = Number(x), yn = Number(y), wn = Number(width), hn = Number(height);
    if (!Number.isSafeInteger(xn) || !Number.isSafeInteger(yn) || !Number.isSafeInteger(wn) || !Number.isSafeInteger(hn) || xn < 0 || yn < 0 || wn <= 0 || hn <= 0) {
      throw new Error('Invalid capture parameters');
    }
    try {
      await execAsync(`scrot /tmp/screen_region.png -a ${wn}x${hn}+${xn}+${yn}`, { maxBuffer: 50 * 1024 * 1024 });
    } catch {
      // scrot doesn't support -a on all versions, try imagemagick import
      await execAsync(`import -window root -crop ${wn}x${hn}+${xn}+${yn} /tmp/screen_region.png`, { maxBuffer: 50 * 1024 * 1024 });
    }
    const { stdout } = await execAsync('cat /tmp/screen_region.png | base64 && rm /tmp/screen_region.png', { maxBuffer: 50 * 1024 * 1024 });
    return {
      base64: stdout.trim(),
      width: wn,
      height: hn,
      format: 'png',
      timestamp: Date.now(),
    };
  },

  async captureWindow(bounds) {
    const { x, y, width, height } = bounds;
    // Capture the window containing the point (x,y) or use root window capture
    return this.captureRegion(x, y, width, height);
  },

  async bringToForeground(hwnd) {
    // Linux uses window ID (not hwnd) - try xdotool
    if (hwnd) {
      await execXdotool(`windowactivate ${hwnd}`);
    }
    return { ok: true };
  },

  async list() {
    // List displays using xrandr
    try {
      const { stdout } = await execAsync('xrandr | grep "connected"', { maxBuffer: 10 * 1024 * 1024 });
      const displays = stdout.trim().split('\n').map(line => {
        const match = line.match(/^(\S+)\s+(\d+)x(\d+)\+(\d+)\+(\d+).*?(primary)?/);
        if (match) {
          return {
            name: match[1],
            width: parseInt(match[2]),
            height: parseInt(match[3]),
            x: parseInt(match[4]),
            y: parseInt(match[5]),
            primary: !!match[6],
          };
        }
        return null;
      }).filter(Boolean);
      return displays.length > 0 ? displays : [{ name: 'default', width: 1920, height: 1080, x: 0, y: 0, primary: true }];
    } catch {
      return [{ name: 'default', width: 1920, height: 1080, x: 0, y: 0, primary: true }];
    }
  },
};

function create(log) {
  log('[Platform:linux] Control stub loaded - not tested');
  return {
    mouse: mouseControl,
    keyboard: keyboardControl,
    screen: screenControl,
    debug: {
      getLogs: () => [],
      getStats: () => ({}),
      clear: () => {},
      setLevel: () => false,
      getLevel: () => 'debug',
      export: () => '{}',
      addLog: () => {},
    },
  };
}

module.exports = { create };