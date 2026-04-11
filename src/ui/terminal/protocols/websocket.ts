/**
 * websocket.ts — Protocol adapter for WebSocket connections
 */
import type { ProtocolAdapter, ProtocolAdapterOptions } from '../core/types.js';
import { electronAPI } from '../../electronAPI.js';

export function createWebSocketAdapter(_options: ProtocolAdapterOptions): ProtocolAdapter {
  return {
    send: (data: string) => electronAPI.wsSend(_options.connId, data),
    disconnect: () => electronAPI.wsDisconnect(_options.connId),
  };
}
