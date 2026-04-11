/**
 * Plugin Process
 *
 * Handles spawning and IPC communication with plugin child processes.
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs';
import { LoadedPlugin, PluginContext, PluginIPC, SeeleLinkPlugin, PLUGIN_CHANNELS } from './types.js';

const PLUGIN_ENTRY_FILE = 'index.js';

export class PluginProcess extends EventEmitter {
  private child: ChildProcess | null = null;
  private pluginId: string;
  private pluginDir: string;
  private connected = false;
  private pendingRequests = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  private requestId = 0;

  constructor(pluginId: string, pluginDir: string) {
    super();
    this.pluginId = pluginId;
    this.pluginDir = pluginDir;
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      const entryPath = path.join(this.pluginDir, PLUGIN_ENTRY_FILE);
      if (!fs.existsSync(entryPath)) {
        reject(new Error(`Plugin entry not found: ${entryPath}`));
        return;
      }

      this.child = spawn('node', [entryPath], {
        stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
        env: {
          ...process.env,
          SEELINK_PLUGIN_ID: this.pluginId,
          SEELINK_PLUGIN_DIR: this.pluginDir,
        },
      });

      this.child.on('message', (msg: any) => this.handleMessage(msg));
      this.child.on('error', (err) => {
        this.emit('error', err);
        this.connected = false;
      });
      this.child.on('exit', (code) => {
        this.emit('exit', code);
        this.connected = false;
      });
      this.child.stderr?.on('data', (data) => {
        console.error(`[Plugin:${this.pluginId}] stderr:`, data.toString());
      });

      // Wait for ready signal
      const timeout = setTimeout(() => {
        reject(new Error('Plugin startup timeout'));
        this.stop();
      }, 10000);

      this.once('ready', () => {
        clearTimeout(timeout);
        this.connected = true;
        resolve();
      });
    });
  }

  stop(): void {
    if (this.child) {
      this.child.kill();
      this.child = null;
    }
    this.connected = false;
    this.pendingRequests.clear();
  }

  private handleMessage(msg: any): void {
    if (msg.type === 'ready') {
      this.emit('ready');
      return;
    }

    if (msg.type === 'response') {
      const pending = this.pendingRequests.get(msg.id);
      if (pending) {
        this.pendingRequests.delete(msg.id);
        if (msg.error) {
          pending.reject(new Error(msg.error));
        } else {
          pending.resolve(msg.result);
        }
      }
      return;
    }

    if (msg.type === 'event') {
      this.emit('event', msg.channel, msg.data);
      return;
    }

    this.emit('message', msg);
  }

  send(channel: string, ...args: unknown[]): void {
    if (!this.child || !this.connected) return;
    this.child.send({ type: 'invoke', channel, args, id: `req-${++this.requestId}` });
  }

  async invoke<T = unknown>(channel: string, ...args: unknown[]): Promise<T> {
    if (!this.child || !this.connected) {
      throw new Error('Plugin not connected');
    }

    return new Promise((resolve, reject) => {
      const id = `req-${++this.requestId}`;
      this.pendingRequests.set(id, { resolve: resolve as (v: unknown) => void, reject });
      this.child!.send({ type: 'invoke', channel, args, id });

      // Timeout after 30s
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Plugin request timeout'));
        }
      }, 30000);
    });
  }

  isConnected(): boolean {
    return this.connected;
  }
}

// Creates a PluginContext for use inside the plugin child process
export function createPluginContext(pluginId: string, sendFn: (channel: string, ...args: unknown[]) => void): PluginContext {
  const storage = new Map<string, unknown>();
  const config = new Map<string, unknown>();

  const ipc: PluginIPC = {
    send: (channel, ...args) => sendFn(channel, ...args),
    invoke: async (channel, ...args) => {
      return new Promise((resolve, reject) => {
        const id = `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        sendFn('__request__', { id, channel, args });
        // The response will come back via 'message' event with type: 'response'
      });
    },
    on: (channel, cb) => {
      const handler = (msg: any) => {
        // Only handle messages for this specific channel
        if (msg && msg.channel === channel) {
          cb(...(msg.data || []));
        }
      };
      process.on('message' as any, handler);
      return () => process.off('message' as any, handler);
    },
    handle: (channel, cb) => {
      // In child process, we don't need to handle - parent sends via 'message'
    },
  };

  return {
    id: pluginId,
    logger: {
      info: (msg, ...args) => console.log(`[${pluginId}]`, msg, ...args),
      warn: (msg, ...args) => console.warn(`[${pluginId}]`, msg, ...args),
      error: (msg, ...args) => console.error(`[${pluginId}]`, msg, ...args),
      debug: (msg, ...args) => console.debug(`[${pluginId}]`, msg, ...args),
    },
    connections: {
      create: async (connId, type, config) => {
        return ipc.invoke('plugin:connection:create', connId, type, config);
      },
      destroy: async (connId) => {
        return ipc.invoke('plugin:connection:destroy', connId);
      },
      list: () => {
        return ipc.invoke('plugin:connection:list');
      },
      send: (connId, data) => {
        ipc.send('plugin:connection:send', connId, data);
      },
      onData: (connId, cb) => {
        const handler = (data: string) => cb(data);
        process.on('message' as any, handler);
        return () => process.off('message' as any, handler);
      },
      onStateChange: (cb) => {
        const handler = (connId: string, state: string) => cb(connId, state);
        process.on('message' as any, handler);
        return () => process.off('message' as any, handler);
      },
    },
    events: {
      emit: (topic, ...data) => ipc.send('plugin:event:emit', topic, ...data),
      on: (topic, cb) => {
        const handler = (...args: unknown[]) => cb(...args);
        process.on('message' as any, handler);
        return () => process.off('message' as any, handler);
      },
      once: (topic, cb) => {
        const handler = (...args: unknown[]) => {
          process.off('message' as any, handler);
          cb(...args);
        };
        process.on('message' as any, handler);
      },
    },
    ipc,
    storage: {
      get: (key, defaultValue) => storage.get(key) ?? defaultValue,
      set: (key, value) => storage.set(key, value),
      delete: (key) => storage.delete(key),
      keys: () => Array.from(storage.keys()),
    },
    config: {
      get: (key, defaultValue) => config.get(key) ?? defaultValue,
      set: (key, value) => config.set(key, value),
      has: (key) => config.has(key),
    },
  };
}
