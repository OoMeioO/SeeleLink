/**
 * websocket.ts — Protocol adapter for WebSocket connections
 */
import type { ProtocolAdapter, ProtocolAdapterOptions } from '../core/types.js';
import { electronAPI } from '../../electronAPI.js';

export function createWebSocketAdapter(_options: ProtocolAdapterOptions): ProtocolAdapter {
  return {
    send: (data: string) => {
      if (!window.electronAPI) return;
      electronAPI.wsSend(_options.connId, data);
    },
    disconnect: () => {
      if (!window.electronAPI) return;
      electronAPI.wsDisconnect(_options.connId);
    },
  };
}
