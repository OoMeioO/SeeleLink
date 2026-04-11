/**
 * serial.ts — Protocol adapter for Serial connections
 */
import type { ProtocolAdapter, ProtocolAdapterOptions } from '../core/types.js';
import { electronAPI } from '../../electronAPI.js';

export function createSerialAdapter(_options: ProtocolAdapterOptions): ProtocolAdapter {
  return {
    send: (data: string) => electronAPI.serialExecute(_options.connId, data),
    disconnect: () => electronAPI.serialDisconnect(_options.connId),
  };
}
