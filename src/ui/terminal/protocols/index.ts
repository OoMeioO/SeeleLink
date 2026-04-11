/**
 * index.ts — Protocol adapter factory
 */
import type { ProtocolAdapter, ProtocolAdapterOptions } from '../core/types.js';
import { createSshAdapter } from './ssh.js';
import { createPowershellAdapter } from './powershell.js';
import { createCmdAdapter } from './cmd.js';
import { createSerialAdapter } from './serial.js';
import { createWebSocketAdapter } from './websocket.js';

export type { ProtocolAdapter, ProtocolAdapterOptions } from '../core/types.js';
export { createSshAdapter } from './ssh.js';
export { createPowershellAdapter } from './powershell.js';
export { createCmdAdapter } from './cmd.js';
export { createSerialAdapter } from './serial.js';
export { createWebSocketAdapter } from './websocket.js';

/** Returns the appropriate ProtocolAdapter for the given connection type */
export function createProtocolAdapter(
  connType: string,
  options: ProtocolAdapterOptions,
): ProtocolAdapter | null {
  switch (connType) {
    case 'ssh':
      return createSshAdapter(options);
    case 'powershell':
      return createPowershellAdapter(options);
    case 'cmd':
      return createCmdAdapter(options);
    case 'serial':
      return createSerialAdapter(options);
    case 'websocket':
      return createWebSocketAdapter(options);
    default:
      return null;
  }
}
