import { EventEmitter } from 'events';
import { SerialConfig } from '../../types/connection.js';

export class SerialClient extends EventEmitter {
  private port: any;
  private connected = false;
  constructor(private config: SerialConfig) { super(); }

  async connect(): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        const mod = await import('@serialport/stream');
        const SerialPortStream = mod.SerialPortStream;
        this.port = new SerialPortStream({
          path: this.config.port,
          baudRate: this.config.baudRate || 115200,
          dataBits: this.config.dataBits || 8,
          stopBits: this.config.stopBits || 1,
          parity: this.config.parity || 'none',
        } as any);
        this.port.on('open', () => { this.connected = true; this.emit('connected'); resolve(); });
        this.port.on('error', (e: Error) => { this.emit('error', e); reject(e); });
        this.port.on('close', () => { this.connected = false; this.emit('disconnected'); });
        this.port.on('data', (d: Buffer) => this.emit('data', d.toString()));
      } catch (e) { reject(e); }
    });
  }

  async disconnect(): Promise<void> { return new Promise<void>((r) => { if (this.port) this.port.close(() => r()); else r(); this.connected = false; }); }
  write(data: string) { this.port?.write(data); }
  isConnected() { return this.connected; }
}
