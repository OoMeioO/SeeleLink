import { Connection, ConnectionConfig } from '../types/connection.js';
import { eventBus } from './EventBus.js';
import { logger } from '../utils/logger.js';
import { SSHClient } from '../protocols/ssh/SSHClient.js';
import { SerialClient } from '../protocols/serial/SerialClient.js';
import { PowerShellClient } from '../protocols/powershell/PSClient.js';
import { WebSocketClient } from '../protocols/websocket/WSClient.js';

type Client = SSHClient | SerialClient | PowerShellClient | WebSocketClient;

export class ConnectionManager {
  private connections = new Map<string, Connection>();
  private clients = new Map<string, Client>();

  async connect(id: string, config: ConnectionConfig): Promise<void> {
    const conn: Connection = { id, name: config.type, config, state: 'connecting' };
    this.connections.set(id, conn);
    eventBus.emit('connection:connecting', conn);
    try {
      const client = this.createClient(config);
      this.clients.set(id, client);
      await client.connect();
      conn.state = 'connected';
      eventBus.emit('connection:connected', conn);
      logger.info(`Connected to ${id}`);
    } catch (err) {
      conn.state = 'error';
      eventBus.emit('connection:error', conn, err);
      this.connections.delete(id);
      throw err;
    }
  }

  async disconnect(id: string): Promise<void> {
    const client = this.clients.get(id);
    const conn = this.connections.get(id);
    if (client && conn) {
      await client.disconnect();
      conn.state = 'disconnected';
      eventBus.emit('connection:disconnected', conn);
    }
    this.clients.delete(id);
    this.connections.delete(id);
  }

  getConnection(id: string) { return this.connections.get(id); }
  getClient(id: string) { return this.clients.get(id); }
  getAllConnections() { return Array.from(this.connections.values()); }

  private createClient(config: ConnectionConfig): Client {
    switch (config.type) {
      case 'ssh': return new SSHClient(config);
      case 'serial': return new SerialClient(config);
      case 'powershell': return new PowerShellClient(config);
      case 'websocket': return new WebSocketClient(config);
      default: throw new Error('Unknown type');
    }
  }
}

export const connectionManager = new ConnectionManager();
