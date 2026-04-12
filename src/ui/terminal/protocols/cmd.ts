/**
 * cmd.ts — Protocol adapter for CMD connections
 */
import type { ProtocolAdapter, ProtocolAdapterOptions } from '../core/types.js';
import { electronAPI } from '../../electronAPI.js';

export function createCmdAdapter(_options: ProtocolAdapterOptions): ProtocolAdapter {
  return {
    send: (data: string) => {
      if (!window.electronAPI) return;
      electronAPI.cmdExecute(_options.connId, data);
    },
    disconnect: () => {
      if (!window.electronAPI) return;
      electronAPI.cmdDisconnect(_options.connId);
    },
  };
}
