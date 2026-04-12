/**
 * webAPI.ts — WebSocket-based API client for browser environments
 *
 * This module provides the same ElectronAPI interface but uses WebSocket
 * to communicate with the WebBridge server running in the Electron main process.
 *
 * Usage:
 *   import { webAPI } from './webAPI';
 *   // Or auto-detected in App.tsx
 */

import type { SavedConn, ComPortInfo, AndroidDevice, AndroidHierarchy, AndroidPageInfo, ControlApiConfig, McpApiConfig, LogConfig } from './types.js';

export type { SavedConn, ComPortInfo, AndroidDevice, AndroidHierarchy, AndroidPageInfo, ControlApiConfig, McpApiConfig, LogConfig };

interface WebAPI {
  // --- Connection management ---
  saveConnection: (conn: SavedConn) => Promise<void>;
  loadConnections: () => Promise<SavedConn[]>;
  deleteConnection: (id: string) => Promise<void>;

  // --- PowerShell ---
  psConnect: (connId: string) => Promise<void>;
  psExecute: (connId: string, cmd: string) => Promise<void>;
  psDisconnect: (connId: string) => Promise<void>;
  onPsData: (connId: string, cb: (data: string) => void) => void;
  onPsError: (connId: string, cb: (data: string) => void) => void;

  // --- CMD ---
  cmdConnect: (connId: string) => Promise<void>;
  cmdExecute: (connId: string, cmd: string) => Promise<void>;
  cmdDisconnect: (connId: string) => Promise<void>;
  cmdReady: (connId: string) => Promise<void>;
  onCmdData: (connId: string, cb: (data: string) => void) => void;

  // --- SSH ---
  sshConnect: (config: { connId: string; host: string; port?: string; username: string; password: string }) => Promise<void>;
  sshDisconnect: (connId: string) => Promise<void>;
  sshExecute: (connId: string, cmd: string) => Promise<void>;
  onSshData: (connId: string, cb: (data: string) => void) => void;

  // --- Serial ---
  serialList: () => Promise<ComPortInfo[]>;
  serialConnect: (config: { connId: string; port: string; baudRate: string }) => Promise<void>;
  serialDisconnect: (connId: string) => Promise<void>;
  serialExecute: (connId: string, data: string) => Promise<void>;
  onSerialData: (connId: string, cb: (data: string) => void) => void;

  // --- WebSocket ---
  wsConnect: (connId: string, url: string) => Promise<void>;
  wsDisconnect: (connId: string) => Promise<void>;
  wsSend: (connId: string, data: string) => Promise<void>;
  onWsData: (connId: string, cb: (data: string) => void) => void;

  // --- Android ---
  androidDevices: () => Promise<AndroidDevice[]>;
  androidConnect: (connId: string, deviceId: string) => Promise<void>;
  androidDisconnect: (connId: string) => Promise<void>;
  androidScreenshot: (connId: string) => Promise<{ ok: boolean; screenshot?: string; error?: string }>;
  androidHierarchy: (connId: string) => Promise<AndroidHierarchy>;
  androidPageInfo: (connId: string) => Promise<AndroidPageInfo>;
  androidTap: (connId: string, x: number, y: number) => Promise<void>;
  androidSwipe: (connId: string, sx: number, sy: number, ex: number, ey: number, dur?: number) => Promise<void>;
  androidText: (connId: string, text: string) => Promise<void>;
  androidKey: (connId: string, keycode: number) => Promise<void>;
  androidGetLocalIp: () => Promise<{ name: string; ip: string; netmask: string; mac: string }[]>;
  androidScanNetwork: (options: { timeout?: number }) => Promise<{ ok: boolean; devices: AndroidDevice[]; scanned?: number; error?: string }>;
  onAndroidData: (connId: string, cb: (data: string) => void) => void;

  // --- Window ---
  windowMinimize: () => void;
  windowMaximize: () => void;
  windowClose: () => void;
  windowIsMaximized: () => Promise<boolean>;
  windowCapture: () => Promise<string>;
  windowGetBounds: () => Promise<{ x: number; y: number; width: number; height: number }>;
  windowClick: (x: number, y: number, button?: number) => void;
  windowMoveMouse: (x: number, y: number) => void;
  windowSendKeys: (keys: string[]) => void;
  windowSwitchTab: (tab: string) => void;
  onWindowSwitchTab: (cb: (tab: string) => void) => void;
  windowStartDebug: () => void;
  windowStopDebug: () => void;
  onDebugMouseClick: (cb: (data: any) => void) => void;
  onDebugMouseMove: (cb: (data: any) => void) => void;
  onDebugKeyDown: (cb: (data: any) => void) => void;

  // --- Control ---
  controlMousePosition: () => Promise<{ x: number; y: number }>;
  controlMouseMove: (x: number, y: number) => void;
  controlMouseClick: (x: number, y: number, button?: number) => void;
  controlMouseDoubleClick: (x: number, y: number) => void;
  controlMouseDrag: (fx: number, fy: number, tx: number, ty: number) => void;
  controlKeyboardType: (text: string) => void;
  controlKeyboardPress: (key: string) => void;
  controlKeyboardPressKeys: (keys: string[]) => void;
  controlKeyboardCopy: () => void;
  controlKeyboardPaste: () => void;
  controlKeyboardCut: () => void;
  controlKeyboardSelectAll: () => void;
  controlScreenList: () => Promise<{ ok: boolean; screens?: unknown[]; error?: string }>;
  controlScreenCapture: (screen?: number) => Promise<string>;
  controlScreenCaptureRegion: (x: number, y: number, w: number, h: number) => Promise<string>;
  controlScreenCaptureAndSave: (path: string, fmt?: string) => Promise<string>;
  controlScreenCaptureWindow: (bounds: { x: number; y: number; width: number; height: number }) => Promise<{ base64: string; width: number; height: number }>;
  controlScreenBringToForeground: (hwnd?: number) => Promise<void>;
  controlDebugGetLogs: (filter?: string) => Promise<{ ok: boolean; result?: unknown[] }>;
  controlDebugGetStats: () => Promise<{ ok: boolean; result?: unknown }>;
  controlDebugClear: () => void;
  controlDebugSetLevel: (level: string) => void;
  controlDebugExport: (format: string) => Promise<string>;
  controlPlatformInfo: () => Promise<{ ok: boolean; result?: { type: string; arch: string } }>;

  // --- Config ---
  controlApiGetConfig: () => Promise<ControlApiConfig | null>;
  controlApiSetConfig: (cfg: ControlApiConfig) => Promise<void>;
  controlApiFindAvailablePort: (host: string) => Promise<number>;
  mcpApiGetConfig: () => Promise<McpApiConfig | null>;
  mcpApiSetConfig: (cfg: McpApiConfig) => Promise<void>;
  mcpApiFindAvailablePort: (host: string) => Promise<number>;
  windowCaptureGetConfig: () => Promise<{ mode: 'auto' | 'foreground' | 'gdi' }>;
  windowCaptureSetConfig: (cfg: { mode: 'auto' | 'foreground' | 'gdi' }) => Promise<{ mode: string } | { error: string }>;
  logGetConfig: () => Promise<LogConfig | null>;
  logSetConfig: (cfg: LogConfig) => Promise<void>;
  logGetDir: () => Promise<string>;
  logOpenFolder: (logId: string | null) => Promise<void>;

  // --- ADB ---
  execAdb: (args: string[]) => Promise<string>;
  execAdbScreenshot: (deviceId: string) => Promise<string>;

  // --- IR ---
  irLoad: () => Promise<unknown>;
  irSave: (data: unknown) => Promise<string>;

  // --- Dialog ---
  dialogOpenDirectory: () => Promise<string | null>;

  // --- Console ---
  consoleLog: (...args: unknown[]) => void;

  // --- App Info ---
  appGetInfo: () => Promise<{ version: string; webBridgeClients: number; webBridgeEnabled: boolean }>;

  // --- WebBridge specific ---
  connect: (url: string) => Promise<void>;
  disconnect: () => void;
  isConnected: () => boolean;
}

type MessageHandler = (data: any) => void;
type ResponseHandler = (result: any) => void;

class WebAPIClient {
  private ws: WebSocket | null = null;
  private url: string = '';
  private clientId: number | null = null;
  private connected: boolean = false;
  private pendingRequests: Map<string, ResponseHandler> = new Map();
  private dataHandlers: Map<string, MessageHandler[]> = new Map();
  private messageIdCounter: number = 1;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect: boolean = true;

  connect(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.url = url;
      this.shouldReconnect = true;

      try {
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
          console.log('[WebAPI] Connected to WebBridge');
          this.connected = true;
          // Dispatch event to notify that we reconnected - useful for refreshing state
          window.dispatchEvent(new CustomEvent('seelelink:connected'));
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            this.handleMessage(msg);
          } catch (e) {
            console.error('[WebAPI] Failed to parse message:', e);
          }
        };

        this.ws.onclose = () => {
          console.log('[WebAPI] Disconnected from WebBridge');
          this.connected = false;
          this.clientId = null;

          // Clean up pending requests
          for (const [id, handler] of this.pendingRequests) {
            handler({ error: 'Disconnected' });
          }
          this.pendingRequests.clear();

          // Attempt reconnect if should
          if (this.shouldReconnect) {
            console.log('[WebAPI] Reconnecting in 3 seconds...');
            this.reconnectTimer = setTimeout(() => {
              this.connect(this.url).catch(() => {});
            }, 3000);
          }
        };

        this.ws.onerror = (error) => {
          console.error('[WebAPI] WebSocket error:', error);
          if (!this.connected) {
            reject(new Error('Failed to connect to WebBridge'));
          }
        };
      } catch (e) {
        reject(e);
      }
    });
  }

  disconnect() {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  private handleMessage(msg: any) {
    // Handle connection confirmation
    if (msg.type === 'connected') {
      this.clientId = msg.clientId;
      console.log('[WebAPI] Assigned client ID:', this.clientId);
      return;
    }

    // Handle responses to our requests
    if (msg.type === 'response' && msg.id) {
      const handler = this.pendingRequests.get(msg.id);
      if (handler) {
        handler(msg.result);
        this.pendingRequests.delete(msg.id);
      }
      return;
    }

    // Handle errors
    if (msg.type === 'error') {
      console.error('[WebAPI] Server error:', msg.error);
      return;
    }

    // Handle connections changed broadcast
    if (msg.type === 'connections:changed') {
      console.log('[WebAPI] Connections changed event received, dispatching seelelink:connections-changed');
      window.dispatchEvent(new CustomEvent('seelelink:connections-changed'));
      return;
    }

    // Handle data events - try multiple key formats
    if (msg.type === 'data' || msg.type === 'session:data') {
      const connId = msg.connId || msg.sessionId || '';
      // Try different key formats that might be registered
      const keys = [
        connId,
        `cmd:${connId}`,
        `ps:${connId}`,
        `ssh:${connId}`,
        `serial:${connId}`,
        `ws:${connId}`,
        `android:${connId}`,
      ];
      for (const key of keys) {
        const handlers = this.dataHandlers.get(key);
        if (handlers) {
          for (const handler of handlers) {
            handler(msg.data);
          }
        }
      }
    }
  }

  private sendMessage(type: string, action: string, data: any = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      // Wait for connection if not yet connected
      const waitForConnection = () => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.sendMessageInternal(type, action, data, resolve, reject);
        } else if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
          // Try to reconnect
          this.connect(this.url).then(() => {
            this.sendMessageInternal(type, action, data, resolve, reject);
          }).catch(reject);
        } else {
          // CONNECTING or CLOSING - wait a bit and check again
          setTimeout(waitForConnection, 100);
        }
      };
      waitForConnection();
    });
  }

  private sendMessageInternal(type: string, action: string, data: any, resolve: (result: any) => void, reject: (error: any) => void): void {
    const id = `req-${this.messageIdCounter++}`;
    const message = { type, action, id, data };

    this.pendingRequests.set(id, resolve);
    console.log('[WebAPI] sendMessageInternal:', action, 'id:', id, 'wsState:', this.ws?.readyState);

    this.ws!.send(JSON.stringify(message));

    // Timeout after 30 seconds
    setTimeout(() => {
      if (this.pendingRequests.has(id)) {
        this.pendingRequests.delete(id);
        reject(new Error('Request timeout'));
      }
    }, 30000);
  }

  // --- Connection management ---
  async saveConnection(conn: SavedConn): Promise<void> {
    return this.sendMessage('invoke', 'saveConnection', { conn });
  }

  async loadConnections(): Promise<SavedConn[]> {
    console.log('[WebAPI] loadConnections called');
    const result = await this.sendMessage('invoke', 'loadConnections', {});
    console.log('[WebAPI] loadConnections result:', result);
    return result;
  }

  async deleteConnection(id: string): Promise<void> {
    return this.sendMessage('invoke', 'deleteConnection', { id });
  }

  // --- PowerShell ---
  async psConnect(connId: string): Promise<void> {
    return this.sendMessage('invoke', 'ps:connect', { connId });
  }

  async psExecute(connId: string, cmd: string): Promise<void> {
    return this.sendMessage('invoke', 'ps:execute', { connId, cmd });
  }

  async psDisconnect(connId: string): Promise<void> {
    return this.sendMessage('invoke', 'ps:disconnect', { connId });
  }

  onPsData(connId: string, cb: (data: string) => void): void {
    const key = `ps:${connId}`;
    if (!this.dataHandlers.has(key)) {
      this.dataHandlers.set(key, []);
    }
    this.dataHandlers.get(key)!.push(cb);
  }

  onPsError(connId: string, cb: (data: string) => void): void {
    const key = `ps:error:${connId}`;
    if (!this.dataHandlers.has(key)) {
      this.dataHandlers.set(key, []);
    }
    this.dataHandlers.get(key)!.push(cb);
  }

  // --- CMD ---
  async cmdConnect(connId: string): Promise<void> {
    return this.sendMessage('invoke', 'cmd:connect', { connId });
  }

  async cmdExecute(connId: string, cmd: string): Promise<void> {
    return this.sendMessage('invoke', 'cmd:execute', { connId, cmd });
  }

  async cmdDisconnect(connId: string): Promise<void> {
    return this.sendMessage('invoke', 'cmd:disconnect', { connId });
  }

  async cmdReady(connId: string): Promise<void> {
    return this.sendMessage('invoke', 'cmd:ready', { connId });
  }

  onCmdData(connId: string, cb: (data: string) => void): void {
    const key = `cmd:${connId}`;
    if (!this.dataHandlers.has(key)) {
      this.dataHandlers.set(key, []);
    }
    this.dataHandlers.get(key)!.push(cb);
  }

  // --- SSH ---
  async sshConnect(config: { connId: string; host: string; port?: string; username: string; password: string }): Promise<void> {
    return this.sendMessage('invoke', 'ssh:connect', config);
  }

  async sshDisconnect(connId: string): Promise<void> {
    return this.sendMessage('invoke', 'ssh:disconnect', { connId });
  }

  async sshExecute(connId: string, cmd: string): Promise<void> {
    return this.sendMessage('invoke', 'ssh:execute', { connId, cmd });
  }

  onSshData(connId: string, cb: (data: string) => void): void {
    const key = `ssh:${connId}`;
    if (!this.dataHandlers.has(key)) {
      this.dataHandlers.set(key, []);
    }
    this.dataHandlers.get(key)!.push(cb);
  }

  // --- Serial ---
  async serialList(): Promise<ComPortInfo[]> {
    return this.sendMessage('invoke', 'serial:list', {});
  }

  async serialConnect(config: { connId: string; port: string; baudRate: string }): Promise<void> {
    return this.sendMessage('invoke', 'serial:connect', config);
  }

  async serialDisconnect(connId: string): Promise<void> {
    return this.sendMessage('invoke', 'serial:disconnect', { connId });
  }

  async serialExecute(connId: string, data: string): Promise<void> {
    return this.sendMessage('invoke', 'serial:execute', { connId, data });
  }

  onSerialData(connId: string, cb: (data: string) => void): void {
    const key = `serial:${connId}`;
    if (!this.dataHandlers.has(key)) {
      this.dataHandlers.set(key, []);
    }
    this.dataHandlers.get(key)!.push(cb);
  }

  // --- WebSocket ---
  async wsConnect(connId: string, url: string): Promise<void> {
    return this.sendMessage('invoke', 'ws:connect', { connId, url });
  }

  async wsDisconnect(connId: string): Promise<void> {
    return this.sendMessage('invoke', 'ws:disconnect', { connId });
  }

  async wsSend(connId: string, data: string): Promise<void> {
    return this.sendMessage('invoke', 'ws:send', { connId, data });
  }

  onWsData(connId: string, cb: (data: string) => void): void {
    const key = `ws:${connId}`;
    if (!this.dataHandlers.has(key)) {
      this.dataHandlers.set(key, []);
    }
    this.dataHandlers.get(key)!.push(cb);
  }

  // --- Android ---
  async androidDevices(): Promise<AndroidDevice[]> {
    return this.sendMessage('invoke', 'android:devices', {});
  }

  async androidConnect(connId: string, deviceId: string): Promise<void> {
    return this.sendMessage('invoke', 'android:connect', { connId, deviceId });
  }

  async androidDisconnect(connId: string): Promise<void> {
    return this.sendMessage('invoke', 'android:disconnect', { connId });
  }

  async androidScreenshot(connId: string): Promise<{ ok: boolean; screenshot?: string; error?: string }> {
    return this.sendMessage('invoke', 'android:screenshot', { connId });
  }

  async androidHierarchy(connId: string): Promise<AndroidHierarchy> {
    return this.sendMessage('invoke', 'android:hierarchy', { connId });
  }

  async androidPageInfo(connId: string): Promise<AndroidPageInfo> {
    return this.sendMessage('invoke', 'android:pageinfo', { connId });
  }

  async androidTap(connId: string, x: number, y: number): Promise<void> {
    return this.sendMessage('invoke', 'android:tap', { connId, x, y });
  }

  async androidSwipe(connId: string, sx: number, sy: number, ex: number, ey: number, dur?: number): Promise<void> {
    return this.sendMessage('invoke', 'android:swipe', { connId, sx, sy, ex, ey, dur });
  }

  async androidText(connId: string, text: string): Promise<void> {
    return this.sendMessage('invoke', 'android:text', { connId, text });
  }

  async androidKey(connId: string, keycode: number): Promise<void> {
    return this.sendMessage('invoke', 'android:key', { connId, keycode });
  }

  async androidGetLocalIp(): Promise<{ name: string; ip: string; netmask: string; mac: string }[]> {
    return this.sendMessage('invoke', 'android:getLocalIp', {});
  }

  async androidScanNetwork(options: { timeout?: number }): Promise<{ ok: boolean; devices: AndroidDevice[]; scanned?: number; error?: string }> {
    return this.sendMessage('invoke', 'android:scanNetwork', options);
  }

  onAndroidData(connId: string, cb: (data: string) => void): void {
    const key = `android:${connId}`;
    if (!this.dataHandlers.has(key)) {
      this.dataHandlers.set(key, []);
    }
    this.dataHandlers.get(key)!.push(cb);
  }

  // --- Window ---
  windowMinimize(): void {
    this.sendMessage('invoke', 'window:minimize', {}).catch(() => {});
  }

  windowMaximize(): void {
    this.sendMessage('invoke', 'window:maximize', {}).catch(() => {});
  }

  windowClose(): void {
    this.sendMessage('invoke', 'window:close', {}).catch(() => {});
  }

  async windowIsMaximized(): Promise<boolean> {
    const result = await this.sendMessage('invoke', 'window:isMaximized', {});
    return result?.isMaximized || false;
  }

  async windowCapture(): Promise<string> {
    return this.sendMessage('invoke', 'window:capture', {});
  }

  async windowGetBounds(): Promise<{ x: number; y: number; width: number; height: number }> {
    return this.sendMessage('invoke', 'window:getBounds', {});
  }

  windowClick(x: number, y: number, button?: number): void {
    this.sendMessage('invoke', 'window:click', { x, y, button }).catch(() => {});
  }

  windowMoveMouse(x: number, y: number): void {
    this.sendMessage('invoke', 'window:moveMouse', { x, y }).catch(() => {});
  }

  windowSendKeys(keys: string[]): void {
    this.sendMessage('invoke', 'window:sendKeys', { keys }).catch(() => {});
  }

  windowSwitchTab(tab: string): void {
    this.sendMessage('invoke', 'window:switchTab', { tab }).catch(() => {});
  }

  onWindowSwitchTab(cb: (tab: string) => void): void {
    if (!this.dataHandlers.has('window:switchTab')) {
      this.dataHandlers.set('window:switchTab', []);
    }
    this.dataHandlers.get('window:switchTab')!.push(cb);
  }

  windowStartDebug(): void {
    this.sendMessage('invoke', 'window:startDebug', {}).catch(() => {});
  }

  windowStopDebug(): void {
    this.sendMessage('invoke', 'window:stopDebug', {}).catch(() => {});
  }

  onDebugMouseClick(cb: (data: any) => void): void {
    if (!this.dataHandlers.has('debug:mouseClick')) {
      this.dataHandlers.set('debug:mouseClick', []);
    }
    this.dataHandlers.get('debug:mouseClick')!.push(cb);
  }

  onDebugMouseMove(cb: (data: any) => void): void {
    if (!this.dataHandlers.has('debug:mouseMove')) {
      this.dataHandlers.set('debug:mouseMove', []);
    }
    this.dataHandlers.get('debug:mouseMove')!.push(cb);
  }

  onDebugKeyDown(cb: (data: any) => void): void {
    if (!this.dataHandlers.has('debug:keyDown')) {
      this.dataHandlers.set('debug:keyDown', []);
    }
    this.dataHandlers.get('debug:keyDown')!.push(cb);
  }

  // --- Control ---
  async controlMousePosition(): Promise<{ x: number; y: number }> {
    return this.sendMessage('invoke', 'control:mouse:position', {});
  }

  controlMouseMove(x: number, y: number): void {
    this.sendMessage('invoke', 'control:mouse:move', { x, y }).catch(() => {});
  }

  controlMouseClick(x: number, y: number, button?: number): void {
    this.sendMessage('invoke', 'control:mouse:click', { x, y, button }).catch(() => {});
  }

  controlMouseDoubleClick(x: number, y: number): void {
    this.sendMessage('invoke', 'control:mouse:doubleClick', { x, y }).catch(() => {});
  }

  controlMouseDrag(fx: number, fy: number, tx: number, ty: number): void {
    this.sendMessage('invoke', 'control:mouse:drag', { fromX: fx, fromY: fy, toX: tx, toY: ty }).catch(() => {});
  }

  controlKeyboardType(text: string): void {
    this.sendMessage('invoke', 'control:keyboard:type', { text }).catch(() => {});
  }

  controlKeyboardPress(key: string): void {
    this.sendMessage('invoke', 'control:keyboard:press', { key }).catch(() => {});
  }

  controlKeyboardPressKeys(keys: string[]): void {
    this.sendMessage('invoke', 'control:keyboard:pressKeys', { keys }).catch(() => {});
  }

  controlKeyboardCopy(): void {
    this.sendMessage('invoke', 'control:keyboard:copy', {}).catch(() => {});
  }

  controlKeyboardPaste(): void {
    this.sendMessage('invoke', 'control:keyboard:paste', {}).catch(() => {});
  }

  controlKeyboardCut(): void {
    this.sendMessage('invoke', 'control:keyboard:cut', {}).catch(() => {});
  }

  controlKeyboardSelectAll(): void {
    this.sendMessage('invoke', 'control:keyboard:selectAll', {}).catch(() => {});
  }

  async controlScreenList(): Promise<{ ok: boolean; screens?: unknown[]; error?: string }> {
    return this.sendMessage('invoke', 'control:screen:list', {});
  }

  async controlScreenCapture(screen?: number): Promise<string> {
    return this.sendMessage('invoke', 'control:screen:capture', { screen });
  }

  async controlScreenCaptureRegion(x: number, y: number, w: number, h: number): Promise<string> {
    return this.sendMessage('invoke', 'control:screen:captureRegion', { x, y, width: w, height: h });
  }

  async controlScreenCaptureAndSave(path: string, fmt?: string): Promise<string> {
    return this.sendMessage('invoke', 'control:screen:captureAndSave', { path, format: fmt });
  }

  async controlScreenCaptureWindow(bounds: { x: number; y: number; width: number; height: number }): Promise<{ base64: string; width: number; height: number }> {
    return this.sendMessage('invoke', 'control:screen:captureWindow', { bounds });
  }

  async controlScreenBringToForeground(hwnd?: number): Promise<void> {
    return this.sendMessage('invoke', 'control:screen:bringToForeground', { hwnd });
  }

  async controlDebugGetLogs(filter?: string): Promise<{ ok: boolean; result?: unknown[] }> {
    return this.sendMessage('invoke', 'control:debug:getLogs', { filter });
  }

  async controlDebugGetStats(): Promise<{ ok: boolean; result?: unknown }> {
    return this.sendMessage('invoke', 'control:debug:getStats', {});
  }

  controlDebugClear(): void {
    this.sendMessage('invoke', 'control:debug:clear', {}).catch(() => {});
  }

  controlDebugSetLevel(level: string): void {
    this.sendMessage('invoke', 'control:debug:setLevel', { level }).catch(() => {});
  }

  async controlDebugExport(format: string): Promise<string> {
    return this.sendMessage('invoke', 'control:debug:export', { format });
  }

  async controlPlatformInfo(): Promise<{ ok: boolean; result?: { type: string; arch: string } }> {
    return this.sendMessage('invoke', 'control:platform:info', {});
  }

  // --- Config ---
  async controlApiGetConfig(): Promise<ControlApiConfig | null> {
    return this.sendMessage('invoke', 'controlApi:getConfig', {});
  }

  async controlApiSetConfig(cfg: ControlApiConfig): Promise<void> {
    return this.sendMessage('invoke', 'controlApi:setConfig', { cfg });
  }

  async controlApiFindAvailablePort(host: string): Promise<number> {
    return this.sendMessage('invoke', 'controlApi:findAvailablePort', { host });
  }

  async mcpApiGetConfig(): Promise<McpApiConfig | null> {
    return this.sendMessage('invoke', 'mcpApi:getConfig', {});
  }

  async mcpApiSetConfig(cfg: McpApiConfig): Promise<void> {
    return this.sendMessage('invoke', 'mcpApi:setConfig', { cfg });
  }

  async mcpApiFindAvailablePort(host: string): Promise<number> {
    return this.sendMessage('invoke', 'mcpApi:findAvailablePort', { host });
  }

  async windowCaptureGetConfig(): Promise<{ mode: 'auto' | 'foreground' | 'gdi' }> {
    return this.sendMessage('invoke', 'windowCapture:getConfig', {});
  }

  async windowCaptureSetConfig(cfg: { mode: 'auto' | 'foreground' | 'gdi' }): Promise<{ mode: string } | { error: string }> {
    return this.sendMessage('invoke', 'windowCapture:setConfig', { mode: cfg.mode });
  }

  async logGetConfig(): Promise<LogConfig | null> {
    return this.sendMessage('invoke', 'log:getConfig', {});
  }

  async logSetConfig(cfg: LogConfig): Promise<void> {
    return this.sendMessage('invoke', 'log:setConfig', { config: cfg });
  }

  async logGetDir(): Promise<string> {
    return this.sendMessage('invoke', 'log:getDir', {});
  }

  async logOpenFolder(logId: string | null): Promise<void> {
    return this.sendMessage('invoke', 'log:openFolder', { logId });
  }

  // --- ADB ---
  async execAdb(args: string[]): Promise<string> {
    return this.sendMessage('invoke', 'exec:adb', { args });
  }

  async execAdbScreenshot(deviceId: string): Promise<string> {
    return this.sendMessage('invoke', 'exec:adb:screenshot', { deviceId });
  }

  // --- IR ---
  async irLoad(): Promise<unknown> {
    return this.sendMessage('invoke', 'ir:load', {});
  }

  async irSave(data: unknown): Promise<string> {
    return this.sendMessage('invoke', 'ir:save', { data });
  }

  // --- Dialog ---
  async dialogOpenDirectory(): Promise<string | null> {
    return this.sendMessage('invoke', 'dialog:openDirectory', {});
  }

  // --- Console ---
  consoleLog(...args: unknown[]): void {
    console.log('[WebAPI Console]', ...args);
  }

  // --- App Info ---
  async appGetInfo(): Promise<{ version: string; webBridgeClients: number; webBridgeEnabled: boolean }> {
    return this.sendMessage('invoke', 'app:getInfo', {});
  }
}

// Singleton instance
let webAPIInstance: WebAPIClient | null = null;

export function createWebAPI(wsUrl: string = 'ws://localhost:9382'): WebAPI {
  if (!webAPIInstance) {
    webAPIInstance = new WebAPIClient();
  }
  // Initiate connection (non-blocking)
  webAPIInstance.connect(wsUrl).catch(console.error);
  return webAPIInstance as unknown as WebAPI;
}

export function getWebAPI(): WebAPI | null {
  return webAPIInstance as unknown as WebAPI;
}

export function disconnectWebAPI(): void {
  if (webAPIInstance) {
    webAPIInstance.disconnect();
    webAPIInstance = null;
  }
}
