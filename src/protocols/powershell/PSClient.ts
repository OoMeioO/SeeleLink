import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { EventEmitter } from 'events';
import { PowerShellConfig } from '../../types/connection.js';
import { logger } from '../../utils/logger.js';

export class PowerShellClient extends EventEmitter {
  private proc?: ChildProcessWithoutNullStreams;
  private connected = false;
  constructor(private config: PowerShellConfig) { super(); }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const shell = this.config.shell === 'pwsh' ? 'pwsh' : 'powershell.exe';
      this.proc = spawn(shell, ['-NoLogo', '-NoProfile'], { stdio: ['pipe', 'pipe', 'pipe'] });
      this.proc.stdout?.on('data', (d: Buffer) => this.emit('data', d.toString()));
      this.proc.stderr?.on('data', (d: Buffer) => this.emit('error', new Error(d.toString())));
      this.proc.on('error', (e) => { logger.error(`PS: ${e.message}`); this.emit('error', e); reject(e); });
      this.proc.on('close', (c) => { this.connected = false; this.emit('close', c); });
      setTimeout(() => { this.connected = true; this.emit('connected'); resolve(); }, 500);
    });
  }

  async disconnect() { return new Promise<void>((r) => { this.proc?.kill(); this.connected = false; r(); }); }
  write(data: string) { this.proc?.stdin?.write(data); }
  execute(cmd: string): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.proc || !this.connected) return reject(new Error('Not connected'));
      const out: string[] = [];
      const handler = (d: string) => out.push(d);
      this.on('data', handler);
      this.proc!.stdin?.write(cmd + '\n');
      setTimeout(() => { this.off('data', handler); resolve(out.join('')); }, 1000);
    });
  }
  isConnected() { return this.connected; }
}
