/**
 * Control Service - Unified Control Service
 * 
 * Provides unified interface for:
 * - Mouse Control
 * - Keyboard Control
 * - Screen Capture
 * - Debug Logging
 * 
 * This service acts as a facade for all control operations.
 */

import { MouseControl, MousePosition, MouseButton } from '../mouse/MouseControl';
import { KeyboardControl } from '../keyboard/KeyboardControl';
import { ScreenCapture, ScreenInfo, ScreenshotResult } from '../screen/ScreenCapture';
import { DebugService, DebugLogEntry, DebugFilter, LogLevel } from '../debug/DebugService';
import { platform, Platform } from '../../platform';

export interface ControlServiceConfig {
  enableMouse?: boolean;
  enableKeyboard?: boolean;
  enableScreen?: boolean;
  enableDebug?: boolean;
  debugLevel?: LogLevel;
}

export class ControlService {
  readonly mouse: MouseControl;
  readonly keyboard: KeyboardControl;
  readonly screen: ScreenCapture;
  readonly debug: DebugService;
  readonly platform: Platform;
  
  constructor(config: ControlServiceConfig = {}) {
    // Initialize debug service first
    this.debug = new DebugService();
    if (config.debugLevel) {
      this.debug.setLevel(config.debugLevel);
    }
    
    // Initialize platform
    this.platform = platform;
    
    // Initialize mouse control based on platform
    this.mouse = this.createMouseControl();
    
    // Initialize keyboard control based on platform
    this.keyboard = this.createKeyboardControl();
    
    // Initialize screen capture based on platform
    this.screen = this.createScreenCapture();
    
    this.debug.info('ControlService', 'initialized', {
      platform: this.platform.type,
      arch: this.platform.arch,
    });
  }
  
  private createMouseControl(): MouseControl {
    switch (this.platform.type) {
      case 'windows':
        // Lazy load to avoid circular dependency
        const { WindowsMouse } = require('../mouse/impl/WindowsMouse');
        return new WindowsMouse(this.debug);
        
      case 'linux':
        // TODO: Implement LinuxMouse
        this.debug.warn('ControlService', 'Linux mouse not implemented, using Windows fallback');
        const { WindowsMouse: WinMouse } = require('../mouse/impl/WindowsMouse');
        return new WinMouse(this.debug);
        
      case 'darwin':
        // TODO: Implement MacMouse
        this.debug.warn('ControlService', 'macOS mouse not implemented, using Windows fallback');
        const { WindowsMouse: WinM } = require('../mouse/impl/WindowsMouse');
        return new WinM(this.debug);
        
      default:
        throw new Error(`Mouse control not supported on ${this.platform.type}`);
    }
  }
  
  private createKeyboardControl(): KeyboardControl {
    switch (this.platform.type) {
      case 'windows':
        const { WindowsKeyboard } = require('../keyboard/impl/WindowsKeyboard');
        return new WindowsKeyboard(this.debug);
        
      case 'linux':
        this.debug.warn('ControlService', 'Linux keyboard not implemented, using Windows fallback');
        const { WindowsKeyboard: WinK } = require('../keyboard/impl/WindowsKeyboard');
        return new WinK(this.debug);
        
      case 'darwin':
        this.debug.warn('ControlService', 'macOS keyboard not implemented, using Windows fallback');
        const { WindowsKeyboard: WinKB } = require('../keyboard/impl/WindowsKeyboard');
        return new WinKB(this.debug);
        
      default:
        throw new Error(`Keyboard control not supported on ${this.platform.type}`);
    }
  }
  
  private createScreenCapture(): ScreenCapture {
    switch (this.platform.type) {
      case 'windows':
        const { WindowsScreen } = require('../screen/impl/WindowsScreen');
        return new WindowsScreen(this.debug);
        
      case 'linux':
        this.debug.warn('ControlService', 'Linux screen capture not implemented, using Windows fallback');
        const { WindowsScreen: WinS } = require('../screen/impl/WindowsScreen');
        return new WinS(this.debug);
        
      case 'darwin':
        this.debug.warn('ControlService', 'macOS screen capture not implemented, using Windows fallback');
        const { WindowsScreen: WinSC } = require('../screen/impl/WindowsScreen');
        return new WinSC(this.debug);
        
      default:
        throw new Error(`Screen capture not supported on ${this.platform.type}`);
    }
  }
  
  // Convenience methods
  async getMousePosition(): Promise<MousePosition> {
    return this.mouse.getPosition();
  }
  
  async setMousePosition(x: number, y: number): Promise<void> {
    return this.mouse.setPosition(x, y);
  }
  
  async click(x: number, y: number, button?: MouseButton): Promise<void> {
    return this.mouse.click(x, y, button);
  }
  
  async typeText(text: string): Promise<void> {
    return this.keyboard.typeText(text);
  }
  
  async pressKey(key: string): Promise<void> {
    return this.keyboard.pressKey(key);
  }
  
  async captureScreen(): Promise<ScreenshotResult> {
    return this.screen.capture();
  }
  
  async captureAndSave(path: string): Promise<string> {
    return this.screen.captureAndSave(path);
  }
  
  // Debug convenience methods
  setDebugLevel(level: LogLevel): void {
    this.debug.setLevel(level);
  }
  
  getDebugLogs(filter?: DebugFilter): DebugLogEntry[] {
    return this.debug.getLogs(filter);
  }
  
  clearDebugLogs(): void {
    this.debug.clearLogs();
  }
}

// Singleton instance
let instance: ControlService | null = null;

export function getControlService(): ControlService {
  if (!instance) {
    instance = new ControlService();
  }
  return instance;
}

export function resetControlService(): void {
  instance = null;
}
