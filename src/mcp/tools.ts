// MCP tool definitions for SeeleLink
import { SSHConfig, SerialConfig, PowerShellConfig, WebSocketConfig } from '../types/connection.js';

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: object;
}

// SSH Tools
export const sshTools: MCPTool[] = [
  {
    name: 'ssh_connect',
    description: 'Connect to a SSH server',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Connection ID' },
        host: { type: 'string', description: 'SSH host' },
        port: { type: 'number', description: 'SSH port', default: 22 },
        username: { type: 'string', description: 'Username' },
        password: { type: 'string', description: 'Password' },
        privateKey: { type: 'string', description: 'Private key content' },
      },
      required: ['host', 'username'],
    },
  },
  {
    name: 'ssh_execute',
    description: 'Execute a command on SSH server',
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
    name: 'ssh_shell',
    description: 'Open interactive SSH shell',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Connection ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'ssh_disconnect',
    description: 'Disconnect from SSH server',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Connection ID' },
      },
      required: ['id'],
    },
  },
];

// Serial Tools
export const serialTools: MCPTool[] = [
  {
    name: 'serial_connect',
    description: 'Connect to a serial port',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Connection ID' },
        port: { type: 'string', description: 'Serial port (e.g., COM9)' },
        baudRate: { type: 'number', description: 'Baud rate', default: 115200 },
        dataBits: { type: 'number', description: 'Data bits', default: 8 },
        stopBits: { type: 'number', description: 'Stop bits', default: 1 },
        parity: { type: 'string', description: 'Parity', default: 'none' },
      },
      required: ['port'],
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
        newline: { type: 'boolean', description: 'Add newline at end', default: false },
      },
      required: ['id', 'data'],
    },
  },
  {
    name: 'serial_read',
    description: 'Read data from serial port',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Connection ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'serial_disconnect',
    description: 'Disconnect from serial port',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Connection ID' },
      },
      required: ['id'],
    },
  },
];

// PowerShell Tools
export const psTools: MCPTool[] = [
  {
    name: 'ps_connect',
    description: 'Connect to PowerShell',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Connection ID' },
        shell: { type: 'string', description: 'Shell type (powershell|pwsh)', default: 'powershell' },
      },
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
    description: 'Disconnect from PowerShell',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Connection ID' },
      },
      required: ['id'],
    },
  },
];

// WebSocket Tools
export const wsTools: MCPTool[] = [
  {
    name: 'ws_connect',
    description: 'Connect to WebSocket server',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Connection ID' },
        url: { type: 'string', description: 'WebSocket URL' },
        protocols: { type: 'array', description: 'WebSocket protocols' },
      },
      required: ['url'],
    },
  },
  {
    name: 'ws_send',
    description: 'Send message to WebSocket',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Connection ID' },
        message: { type: 'string', description: 'Message to send' },
      },
      required: ['id', 'message'],
    },
  },
  {
    name: 'ws_disconnect',
    description: 'Disconnect from WebSocket',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Connection ID' },
      },
      required: ['id'],
    },
  },
];

// All tools
export const allTools = [...sshTools, ...serialTools, ...psTools, ...wsTools];
