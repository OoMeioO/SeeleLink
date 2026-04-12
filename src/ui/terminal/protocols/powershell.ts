/**
 * powershell.ts — Protocol adapter for PowerShell connections
 */
import type { ProtocolAdapter, ProtocolAdapterOptions } from '../core/types.js';
import { electronAPI } from '../../electronAPI.js';

export function createPowershellAdapter(_options: ProtocolAdapterOptions): ProtocolAdapter {
  return {
    send: (data: string) => {
      if (!window.electronAPI) return;
      electronAPI.psExecute(_options.connId, data);
    },
    disconnect: () => {
      if (!window.electronAPI) return;
      electronAPI.psDisconnect(_options.connId);
    },
  };
}
