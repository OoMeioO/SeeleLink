import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface SavedConnection {
  id: string;
  name: string;
  type: 'ssh' | 'serial' | 'powershell' | 'websocket';
  host?: string;
  port?: string | number;
  username?: string;
  password?: string;
  serialPort?: string;
  baudRate?: number;
  url?: string;
  lastConnected?: string;
}

class ConnectionStore {
  private filePath: string;
  private connections: Map<string, SavedConnection> = new Map();

  constructor() {
    this.filePath = path.join(os.homedir(), '.seelelink', 'connections.json');
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
        this.connections = new Map(Object.entries(data));
      }
    } catch (e) {
      console.error('Failed to load connections:', e);
    }
  }

  saveConnection(conn: SavedConnection) {
    conn.lastConnected = new Date().toISOString();
    this.connections.set(conn.id, conn);
    this.persist();
  }

  getConnection(id: string): SavedConnection | undefined {
    return this.connections.get(id);
  }

  getByHost(host: string, username?: string): SavedConnection | undefined {
    for (const conn of this.connections.values()) {
      if (conn.host === host && (!username || conn.username === username)) {
        return conn;
      }
    }
    return undefined;
  }

  deleteConnection(id: string) {
    this.connections.delete(id);
    this.persist();
  }

  listConnections(): SavedConnection[] {
    return Array.from(this.connections.values());
  }

  listByType(type: string): SavedConnection[] {
    return this.listConnections().filter(c => c.type === type);
  }

  private persist() {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const obj = Object.fromEntries(this.connections);
      fs.writeFileSync(this.filePath, JSON.stringify(obj, null, 2));
    } catch (e) {
      console.error('Failed to save connections:', e);
    }
  }
}

export const connectionStore = new ConnectionStore();
