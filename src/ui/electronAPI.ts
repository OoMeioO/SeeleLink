/**
 * electronAPI.ts — Type-safe shim over window.electronAPI (preload.js contextBridge)
 *
 * All IPC communication flows through this module. Shared types (SavedConn,
 * ComPortInfo) are imported from ./types.ts to avoid duplication.
 */
import type { SavedConn, ComPortInfo, AndroidDevice, AndroidHierarchy, AndroidPageInfo, ControlApiConfig, McpApiConfig, LogConfig } from './types.js';

export type { SavedConn, ComPortInfo, AndroidDevice, AndroidHierarchy, AndroidPageInfo, ControlApiConfig, McpApiConfig, LogConfig };

export interface ElectronAPI {
  // --- Connection management ---
  saveConnection: (conn: SavedConn) => Promise<void>;
  loadConnections: () => Promise<SavedConn[]>;
  deleteConnection: (id: string) => Promise<void>;
  onConnectionsChanged: (callback: () => void) => void;

  // --- PowerShell ---
  psConnect:      (connId: string) => Promise<void>;
  psExecute:      (connId: string, cmd: string) => Promise<void>;
  psDisconnect:   (connId: string) => Promise<void>;
  onPsData:      (connId: string, cb: (data: string) => void) => void;
  onPsError:     (connId: string, cb: (data: string) => void) => void;

  // --- CMD ---
  cmdConnect:     (connId: string) => Promise<void>;
  cmdExecute:     (connId: string, cmd: string) => Promise<void>;
  cmdDisconnect:  (connId: string) => Promise<void>;
  cmdReady:       (connId: string) => Promise<void>;
  onCmdData:      (connId: string, cb: (data: string) => void) => void;

  // --- SSH ---
  sshConnect:     (config: { connId: string; host: string; port?: string; username: string; password: string }) => Promise<void>;
  sshDisconnect:  (connId: string) => Promise<void>;
  sshExecute:     (connId: string, cmd: string) => Promise<void>;
  onSshData:     (connId: string, cb: (data: string) => void) => void;

  // --- Serial ---
  serialList:      () => Promise<ComPortInfo[]>;
  serialConnect:   (config: { connId: string; port: string; baudRate: string }) => Promise<void>;
  serialDisconnect: (connId: string) => Promise<void>;
  serialExecute:   (connId: string, data: string) => Promise<void>;
  onSerialData:    (connId: string, cb: (data: string) => void) => void;

  // --- WebSocket ---
  wsConnect:      (connId: string, url: string) => Promise<void>;
  wsDisconnect:   (connId: string) => Promise<void>;
  wsSend:        (connId: string, data: string) => Promise<void>;
  onWsData:      (connId: string, cb: (data: string) => void) => void;

  // --- Android ---
  androidDevices:       () => Promise<AndroidDevice[]>;
  androidConnect:        (connId: string, deviceId: string) => Promise<void>;
  androidDisconnect:     (connId: string) => Promise<void>;
  androidScreenshot:     (connId: string) => Promise<{ ok: boolean; screenshot?: string; error?: string }>;
  androidHierarchy:      (connId: string) => Promise<AndroidHierarchy>;
  androidPageInfo:       (connId: string) => Promise<AndroidPageInfo>;
  androidTap:           (connId: string, x: number, y: number) => Promise<void>;
  androidSwipe:          (connId: string, sx: number, sy: number, ex: number, ey: number, dur?: number) => Promise<void>;
  androidText:           (connId: string, text: string) => Promise<void>;
  androidKey:            (connId: string, keycode: number) => Promise<void>;
  androidGetLocalIp:     () => Promise<{ name: string; ip: string; netmask: string; mac: string }[]>;
  androidScanNetwork:    (options: { timeout?: number }) => Promise<{ ok: boolean; devices: AndroidDevice[]; scanned?: number; error?: string }>;
  onAndroidData:        (connId: string, cb: (data: string) => void) => void;

  // --- Window ---
  windowMinimize:    () => void;
  windowMaximize:     () => void;
  windowClose:       () => void;
  windowIsMaximized: () => Promise<boolean>;
  windowCapture:     () => Promise<string>; // base64 PNG
  windowGetBounds:   () => Promise<{ x: number; y: number; width: number; height: number }>;
  windowClick:       (x: number, y: number, button?: number) => void;
  windowMoveMouse:   (x: number, y: number) => void;
  windowSendKeys:    (keys: string[]) => void;
  windowSwitchTab:   (tab: string) => void;
  onWindowSwitchTab: (cb: (tab: string) => void) => void;
  windowStartDebug:  () => void;
  windowStopDebug:   () => void;
  onDebugMouseClick: (cb: (data: any) => void) => void;
  onDebugMouseMove:  (cb: (data: any) => void) => void;
  onDebugKeyDown:    (cb: (data: any) => void) => void;

  // --- Control ---
  controlMousePosition:          () => Promise<{ x: number; y: number }>;
  controlMouseMove:              (x: number, y: number) => void;
  controlMouseClick:             (x: number, y: number, button?: number) => void;
  controlMouseDoubleClick:       (x: number, y: number) => void;
  controlMouseDrag:              (fx: number, fy: number, tx: number, ty: number) => void;
  controlKeyboardType:           (text: string) => void;
  controlKeyboardPress:          (key: string) => void;
  controlKeyboardPressKeys:      (keys: string[]) => void;
  controlKeyboardCopy:           () => void;
  controlKeyboardPaste:          () => void;
  controlKeyboardCut:            () => void;
  controlKeyboardSelectAll:      () => void;
  controlScreenList:            () => Promise<{ ok: boolean; screens?: unknown[]; error?: string }>;
  controlScreenCapture:         (screen?: number) => Promise<string>;
  controlScreenCaptureRegion:    (x: number, y: number, w: number, h: number) => Promise<string>;
  controlScreenCaptureAndSave:  (path: string, fmt?: string) => Promise<string>;
  controlScreenCaptureWindow:    (bounds: { x: number; y: number; width: number; height: number }) => Promise<{ base64: string; width: number; height: number }>;
  controlScreenBringToForeground: (hwnd?: number) => Promise<void>;
  controlDebugGetLogs:           (filter?: string) => Promise<{ ok: boolean; result?: unknown[] }>;
  controlDebugGetStats:          () => Promise<{ ok: boolean; result?: unknown }>;
  controlDebugClear:             () => void;
  controlDebugSetLevel:          (level: string) => void;
  controlDebugExport:           (format: string) => Promise<string>;
  controlPlatformInfo:           () => Promise<{ ok: boolean; result?: { type: string; arch: string } }>;

  // --- Config ---
  controlApiGetConfig:        () => Promise<ControlApiConfig | null>;
  controlApiSetConfig:        (cfg: ControlApiConfig) => Promise<void>;
  controlApiFindAvailablePort: (host: string) => Promise<number>;
  mcpApiGetConfig:            () => Promise<McpApiConfig | null>;
  mcpApiSetConfig:            (cfg: McpApiConfig) => Promise<void>;
  mcpApiFindAvailablePort:    (host: string) => Promise<number>;
  windowCaptureGetConfig:      () => Promise<{ mode: 'auto' | 'foreground' | 'gdi' }>;
  windowCaptureSetConfig:      (cfg: { mode: 'auto' | 'foreground' | 'gdi' }) => Promise<{ mode: string } | { error: string }>;
  logGetConfig:               () => Promise<LogConfig | null>;
  logSetConfig:               (cfg: LogConfig) => Promise<void>;
  logGetDir:                  () => Promise<string>;
  logOpenFolder:              (logId: string | null) => Promise<void>;

  // --- ADB ---
  execAdb:          (args: string[]) => Promise<string>;
  execAdbScreenshot: (deviceId: string) => Promise<string>;

  // --- IR ---
  irLoad: () => Promise<unknown>;
  irSave: (data: unknown) => Promise<string>;

  // --- Dialog ---
  dialogOpenDirectory: () => Promise<string | null>;

  // --- Console ---
  consoleLog: (...args: unknown[]) => void;
}

declare global {
  interface Window { electronAPI: ElectronAPI; }
}

export const electronAPI: ElectronAPI = new Proxy({} as ElectronAPI, {
  get(_target, prop) {
    if (!window.electronAPI) {
      console.warn(`electronAPI.${String(prop)} called before API was ready`);
      return undefined;
    }
    return (window.electronAPI as ElectronAPI)[prop as keyof ElectronAPI];
  }
});
