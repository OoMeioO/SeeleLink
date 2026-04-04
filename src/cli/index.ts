#!/usr/bin/env node
import { Command } from 'commander';
import { connectionManager } from '../core/ConnectionManager.js';
import { logger } from '../utils/logger.js';
import { SSHConfig, SerialConfig, PowerShellConfig, WebSocketConfig } from '../types/connection.js';

const program = new Command();
program.name('uc').description('SeeleLink - Unified Connector').version('0.1.0');

program.command('connect')
  .option('-t, --type <type>', 'Connection type', 'ssh')
  .option('-h, --host <host>', 'Host')
  .option('-p, --port <port>', 'Port', '22')
  .option('-u, --user <user>', 'Username')
  .option('-P, --password <pass>', 'Password')
  .option('--serial-port <port>', 'Serial port')
  .option('--baud <rate>', 'Baud rate', '115200')
  .option('--url <url>', 'WebSocket URL')
  .option('-i, --interactive', 'Interactive mode', false)
  .action(async (opts) => {
    const id = `conn_${Date.now()}`;
    try {
      switch (opts.type) {
        case 'ssh':
          await connectionManager.connect(id, { type: 'ssh', host: opts.host || 'localhost', port: parseInt(opts.port), username: opts.user || 'root', password: opts.password } as SSHConfig);
          break;
        case 'serial':
          await connectionManager.connect(id, { type: 'serial', port: opts.serialPort || 'COM1', baudRate: parseInt(opts.baud) } as SerialConfig);
          break;
        case 'powershell':
          await connectionManager.connect(id, { type: 'powershell', shell: 'powershell' } as PowerShellConfig);
          break;
        case 'websocket':
          await connectionManager.connect(id, { type: 'websocket', url: opts.url || 'ws://localhost:8080' } as WebSocketConfig);
          break;
      }
      logger.info('Connected successfully');
      if (opts.interactive) {
        process.stdin.resume();
        process.on('SIGINT', async () => { await connectionManager.disconnect(id); process.exit(0); });
      } else {
        setTimeout(async () => { await connectionManager.disconnect(id); process.exit(0); }, 1000);
      }
    } catch (err) { logger.error(`Failed: ${err}`); process.exit(1); }
  });

program.command('list').description('List connections').action(() => {
  const conns = connectionManager.getAllConnections();
  if (!conns.length) { console.log('No connections'); return; }
  conns.forEach(c => console.log(`${c.id} [${c.config.type}] ${c.name} - ${c.state}`));
});

program.command('status').description('Show status').action(() => {
  const conns = connectionManager.getAllConnections();
  console.log(`Total: ${conns.length}`);
  conns.forEach(c => { console.log(`\n${c.name}: ${c.state}`); });
});

program.parse();
