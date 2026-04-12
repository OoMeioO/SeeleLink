/**
 * ssh.ts — Protocol adapter for SSH connections
 */
import type { ProtocolAdapter, ProtocolAdapterOptions } from '../core/types.js';
import { electronAPI } from '../../electronAPI.js';

export function createSshAdapter(_options: ProtocolAdapterOptions): ProtocolAdapter {
  return {
    send: (data: string) => {
      if (!window.electronAPI) return;
      electronAPI.sshExecute(_options.connId, data);
    },
    disconnect: () => {
      if (!window.electronAPI) return;
      electronAPI.sshDisconnect(_options.connId);
    },
  };
}
