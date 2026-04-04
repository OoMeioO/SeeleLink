import { Client } from 'ssh2';
import { EventEmitter } from 'events';
import { SSHConfig } from '../../types/connection.js';
import { logger } from '../../utils/logger.js';

export class SSHClient extends EventEmitter {
  private client = new Client();
  private connected = false;
  constructor(private config: SSHConfig) { super(); this.setupEvents(); }

  private setupEvents() {
    this.client.on('ready', () => { this.connected = true; this.emit('connected'); })
               .on('error', (e) => { logger.error(`SSH: ${e.message}`); this.emit('error', e); })
               .on('close', () => { this.connected = false; this.emit('disconnected'); });
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client.once('ready', () => resolve());
      this.client.once('error', (e) => reject(e));
      this.client.connect({ host: this.config.host, port: this.config.port || 22, username: this.config.username, password: this.config.password });
    });
  }

  async disconnect() { return new Promise<void>((r) => { this.connected = false; this.client.end(); r(); }); }

  async execute(cmd: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.client.exec(cmd, (err, stream) => {
        if (err) return reject(err);
        let out = '', errOut = '';
        stream.on('close', (c: number) => { if (c !== 0 && errOut) reject(new Error(errOut)); else resolve(out); })
              .on('data', (d: Buffer) => { out += d.toString(); })
              .stderr.on('data', (d: Buffer) => { errOut += d.toString(); });
      });
    });
  }

  isConnected() { return this.connected; }
}
