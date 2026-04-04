import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { WebSocketConfig } from '../../types/connection.js';
import { logger } from '../../utils/logger.js';

export class WebSocketClient extends EventEmitter {
  private ws?: WebSocket;
  private connected = false;
  constructor(private config: WebSocketConfig) { super(); }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.config.url);
      this.ws.on('open', () => { this.connected = true; this.emit('connected'); resolve(); });
      this.ws.on('message', (d) => this.emit('data', d.toString()));
      this.ws.on('error', (e) => { logger.error(`WS: ${e.message}`); this.emit('error', e); if (!this.connected) reject(e); });
      this.ws.on('close', () => { this.connected = false; this.emit('disconnected'); });
    });
  }

  async disconnect() { this.ws?.close(); this.connected = false; }
  send(data: string) { this.ws?.send(data); }
  isConnected() { return this.connected; }
}
