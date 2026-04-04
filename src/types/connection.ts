export type ConnectionType = 'ssh' | 'serial' | 'powershell' | 'websocket';
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface SSHConfig {
  type: 'ssh';
  host: string;
  port?: number;
  username: string;
  password?: string;
  privateKey?: string;
  passphrase?: string;
}

export interface SerialConfig {
  type: 'serial';
  port: string;
  baudRate?: number;
  dataBits?: 5 | 6 | 7 | 8;
  stopBits?: 1 | 1.5 | 2;
  parity?: 'none' | 'odd' | 'even';
}

export interface PowerShellConfig {
  type: 'powershell';
  shell?: 'powershell' | 'pwsh';
}

export interface WebSocketConfig {
  type: 'websocket';
  url: string;
}

export type ConnectionConfig = SSHConfig | SerialConfig | PowerShellConfig | WebSocketConfig;

export interface Connection {
  id: string;
  name: string;
  config: ConnectionConfig;
  state: ConnectionState;
}
