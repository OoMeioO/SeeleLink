/**
 * Windows Keyboard Control Implementation
 * 
 * Uses PowerShell SendKeys for keyboard control.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { KeyboardControl } from '../KeyboardControl';
import { DebugService } from '../../debug/DebugService';

const execAsync = promisify(exec);

// Key code mapping for SendKeys
const keyMap: Record<string, string> = {
  // Control keys
  'Enter': '{ENTER}',
  'Escape': '{ESC}',
  'Tab': '{TAB}',
  'Backspace': '{BACKSPACE}',
  'Delete': '{DELETE}',
  'Insert': '{INSERT}',
  
  // Arrow keys
  'ArrowUp': '{UP}',
  'ArrowDown': '{DOWN}',
  'ArrowLeft': '{LEFT}',
  'ArrowRight': '{RIGHT}',
  
  // Function keys
  'F1': '{F1}',
  'F2': '{F2}',
  'F3': '{F3}',
  'F4': '{F4}',
  'F5': '{F5}',
  'F6': '{F6}',
  'F7': '{F7}',
  'F8': '{F8}',
  'F9': '{F9}',
  'F10': '{F10}',
  'F11': '{F11}',
  'F12': '{F12}',
  
  // Special keys
  'Home': '{HOME}',
  'End': '{END}',
  'PageUp': '{PGUP}',
  'PageDown': '{PGDN}',
  'Pause': '{BREAK}',
  'CapsLock': '{CAPSLOCK}',
  'NumLock': '{NUMLOCK}',
  'ScrollLock': '{SCROLLLOCK}',
  
  // Modifier keys (for pressKeys only)
  'ctrl': '^',
  'alt': '%',
  'shift': '+',
  'meta': '{LWIN}',
};

// Modifiers for pressKeys
const modifierMap: Record<string, string> = {
  'ctrl': '^',
  'alt': '%',
  'shift': '+',
  'meta': '{LWIN}',
};

export class WindowsKeyboard implements KeyboardControl {
  private debug: DebugService;
  
  constructor(debug: DebugService) {
    this.debug = debug;
  }
  
  private async sendKeys(keys: string): Promise<void> {
    try {
      // Escape special characters for PowerShell
      const escaped = keys.replace(/"/g, '`"');
      const script = `[System.Windows.Forms.SendKeys]::SendWait("${escaped}")`;
      await execAsync(`powershell -Command "${script}"`);
      this.debug.debug('WindowsKeyboard', 'sendKeys', { keys });
    } catch (error) {
      this.debug.error('WindowsKeyboard', 'sendKeys', error);
      throw error;
    }
  }
  
  async typeText(text: string): Promise<void> {
    try {
      // Escape special characters that SendKeys interprets
      let escaped = text
        .replace(/"/g, '`"')
        .replace(/'/g, "''")
        .replace(/\{/g, '{{}')
        .replace(/\}/g, '{}}');
      
      const script = `[System.Windows.Forms.SendKeys]::SendWait("${escaped}")`;
      await execAsync(`powershell -Command "${script}"`);
      this.debug.info('WindowsKeyboard', 'typeText', { length: text.length });
    } catch (error) {
      this.debug.error('WindowsKeyboard', 'typeText', error);
      throw error;
    }
  }
  
  async pressKey(key: string): Promise<void> {
    const mappedKey = keyMap[key] || `{${key}}`;
    await this.sendKeys(mappedKey);
    this.debug.debug('WindowsKeyboard', 'pressKey', { key });
  }
  
  async pressKeys(keys: (string | string)[]): Promise<void> {
    const parts: string[] = [];
    
    for (const key of keys) {
      const lower = key.toLowerCase();
      if (modifierMap[lower]) {
        parts.push(modifierMap[lower]);
      } else {
        parts.push(keyMap[key] || `{${key}}`);
      }
    }
    
    await this.sendKeys(parts.join(''));
    this.debug.info('WindowsKeyboard', 'pressKeys', { keys });
  }
  
  async copy(): Promise<void> {
    await this.pressKeys(['ctrl', 'c']);
    this.debug.info('WindowsKeyboard', 'copy');
  }
  
  async paste(): Promise<void> {
    await this.pressKeys(['ctrl', 'v']);
    this.debug.info('WindowsKeyboard', 'paste');
  }
  
  async cut(): Promise<void> {
    await this.pressKeys(['ctrl', 'x']);
    this.debug.info('WindowsKeyboard', 'cut');
  }
  
  async selectAll(): Promise<void> {
    await this.pressKeys(['ctrl', 'a']);
    this.debug.info('WindowsKeyboard', 'selectAll');
  }
  
  async enter(): Promise<void> {
    await this.pressKey('Enter');
  }
  
  async escape(): Promise<void> {
    await this.pressKey('Escape');
  }
  
  async tab(): Promise<void> {
    await this.pressKey('Tab');
  }
  
  async backspace(): Promise<void> {
    await this.pressKey('Backspace');
  }
  
  async delete(): Promise<void> {
    await this.pressKey('Delete');
  }
  
  async arrowUp(): Promise<void> {
    await this.pressKey('ArrowUp');
  }
  
  async arrowDown(): Promise<void> {
    await this.pressKey('ArrowDown');
  }
  
  async arrowLeft(): Promise<void> {
    await this.pressKey('ArrowLeft');
  }
  
  async arrowRight(): Promise<void> {
    await this.pressKey('ArrowRight');
  }
  
  async functionKey(n: number): Promise<void> {
    if (n < 1 || n > 24) throw new Error('Function key number must be 1-24');
    await this.pressKey(`F${n}`);
  }
  
  async holdKey(key: string): Promise<void> {
    // Note: Hold is not directly supported by SendKeys
    // This is a placeholder - would need to use keybd_event or SendInput
    this.debug.warn('WindowsKeyboard', 'holdKey', { key, note: 'Not directly supported by SendKeys' });
  }
  
  async releaseKey(key: string): Promise<void> {
    this.debug.warn('WindowsKeyboard', 'releaseKey', { key, note: 'Not directly supported by SendKeys' });
  }
}
