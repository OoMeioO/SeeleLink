/**
 * Global Type Definitions
 */

export interface ComPortInfo {
  path: string;
  manufacturer?: string;
  serialNumber?: string;
  pnpId?: string;
  vendorId?: string;
  productId?: string;
}

export interface SavedConn {
  id: string;
  name: string;
  type: 'ssh' | 'serial' | 'powershell' | 'cmd' | 'websocket';
  host?: string;
  port?: string;
  username?: string;
  password?: string;
  serialPort?: string;
  baudRate?: string;
  url?: string;
}

export interface ConnectionTab {
  id: string;
  connId: string;
  conn: SavedConn;
  isConnected: boolean;
  isInitializing?: boolean;
}

// Android types (P2-1)
export interface AndroidDevice {
  id: string;
  ip?: string;
  port?: number;
  type: 'usb' | 'network';
  status: string;
  model?: string;
  manufacturer?: string;
  version?: string;
  error?: string;
  deviceId?: string;
}

export interface AndroidHierarchy {
  ok: boolean;
  error?: string;
  [key: string]: any;
}

export interface AndroidPageInfo {
  ok: boolean;
  package?: string;
  activity?: string;
  error?: string;
  [key: string]: any;
}

// Config types (P2-2)
export interface ControlApiConfig {
  enabled: boolean;
  host: string;
  port: number;
}

export interface McpApiConfig {
  enabled: boolean;
  host: string;
  port: number;
}

export interface LogConfig {
  enabled: boolean;
  path: string | null;
}

// IR Types
export interface IRCommandDef {
  id: string;
  name: string;
  category: string;
  deviceTypeId?: string;
  frequency?: number;
  pattern?: string;
  protocol?: string;
  repeat?: number;
  description?: string;
}

export interface IRDeviceType {
  id: string;
  name: string;
  category: string;
  description?: string;
}

export interface IRDevice {
  id: string;
  name: string;
  connectionType: 'usb-serial' | 'usb-adb' | 'network-adb';
  port?: string;
  adbDeviceId?: string;
  deviceTypeId: string;
  customCommands?: IRCommandDef[];
}

export interface IRSequence {
  id: string;
  name: string;
  deviceId: string;
  steps: { commandId: string; delayMs: number }[];
}

export interface IRData {
  deviceTypes: IRDeviceType[];
  commands: IRCommandDef[];
  devices: IRDevice[];
  sequences: IRSequence[];
}

// Command buttons
export interface CommandButton {
  id: string;
  name: string;
  commands: string[];
}

export interface WindowAPI {
  // PowerShell
  psConnect: (connId: string) => Promise<void>;
  psExecute: (connId: string, cmd: string) => Promise<void>;
  psDisconnect: (connId: string) => Promise<void>;
  onPsData: (connId: string, callback: (data: string) => void) => void;
  
  // SSH
  sshConnect: (config: { connId: string; host: string; port?: string; username: string; password?: string }) => Promise<void>;
  sshDisconnect: (connId: string) => Promise<void>;
  sshExecute: (connId: string, cmd: string) => Promise<void>;
  onSshData: (connId: string, callback: (data: string) => void) => void;
  
  // Serial
  serialConnect: (config: { connId: string; port: string; baudRate: string }) => Promise<void>;
  serialDisconnect: (connId: string) => Promise<void>;
  serialExecute: (connId: string, data: string) => Promise<void>;
  serialList: () => Promise<ComPortInfo[]>;
  onSerialData: (connId: string, callback: (data: string) => void) => void;
  
  // WebSocket
  wsConnect: (connId: string, url: string) => Promise<void>;
  wsDisconnect: (connId: string) => Promise<void>;
  wsSend: (connId: string, data: string) => Promise<void>;
  onWsData: (connId: string, callback: (data: string) => void) => void;
  
  // CMD
  cmdConnect: (connId: string) => Promise<void>;
  cmdExecute: (connId: string, cmd: string) => Promise<void>;
  cmdDisconnect: (connId: string) => Promise<void>;
  onCmdData: (connId: string, callback: (data: string) => void) => void;
  
  // Misc
  consoleLog: (...args: unknown[]) => void;
  saveConnection: (conn: SavedConn) => Promise<void>;
  loadConnections: () => Promise<SavedConn[]>;
  deleteConnection: (id: string) => Promise<void>;
  saveCommands: (connId: string, commands: CommandButton[]) => Promise<void>;
  loadCommands: (connId: string) => Promise<CommandButton[]>;
  
  // Window
  windowMinimize: () => void;
  windowMaximize: () => void;
  windowClose: () => void;
  
  // Settings
  controlApiGetConfig: () => Promise<{ enabled: boolean; host: string; port: number } | null>;
  controlApiSetConfig: (cfg: { enabled: boolean; host: string; port: number }) => Promise<void>;
  mcpApiGetConfig: () => Promise<{ enabled: boolean; host: string; port: number } | null>;
  mcpApiSetConfig: (cfg: { enabled: boolean; host: string; port: number }) => Promise<void>;

  // Android
  androidGetLocalIp: () => Promise<{ ok: boolean; ips?: { name: string; ip: string; netmask: string; mac: string }[]; error?: string }>;
  androidGetLocalIpForTarget: (targetIp: string) => Promise<{ ok: boolean; localIp?: string; interface?: string; error?: string }>;
  androidScanNetwork: (options?: { timeout?: number; targetIp?: string; port?: number }) => Promise<{
    ok: boolean;
    devices: {
      id: string;
      ip: string;
      port: number;
      type: 'network';
      status: string;
      model?: string;
      manufacturer?: string;
      version?: string;
      error?: string;
    }[];
    scanned?: number;
    error?: string;
  }>;

  // ADB
  execAdb: (args: string[]) => Promise<{ ok: boolean; stdout?: string; stderr?: string; code?: number; error?: string }>;
  execAdbScreenshot: (deviceId: string) => Promise<{ ok: boolean; screenshot?: string; error?: string }>;

  // IR Storage
  irLoad: () => Promise<unknown>;
  irSave: (data: unknown) => Promise<string>;

  // Dialog
  dialogOpenDirectory: () => Promise<string | null>;
  // Window Capture Config
  windowCaptureGetConfig: () => Promise<{ mode: 'auto' | 'foreground' | 'gdi' }>;
  windowCaptureSetConfig: (mode: { mode: 'auto' | 'foreground' | 'gdi' }) => Promise<{ mode: string } | { error: string }>;
  controlScreenCaptureWindow: (bounds: { x: number; y: number; width: number; height: number }) => Promise<{ base64?: string; width?: number; height?: number; error?: string }>;
  controlScreenBringToForeground: (hwnd?: number) => Promise<{ ok: boolean; error?: string }>;
}

declare global {
  interface Window {
    electronAPI?: WindowAPI;
  }
}
