/**
 * Plugin System Types
 *
 * Type definitions for the plugin system.
 */

export interface PluginManifest {
  id: string;           // unique identifier (kebab-case)
  name: string;          // human-readable name
  version: string;      // semver
  description?: string;
  author?: string;
  type: 'connection' | 'tool' | 'automation' | 'ui';
  entry: string;       // relative path to entry point
  dependencies?: string[];  // plugin IDs this depends on
  configSchema?: Record<string, unknown>;  // JSON Schema for plugin config
}

export type PluginType = PluginManifest['type'];

export interface PluginContext {
  id: string;
  logger: PluginLogger;
  connections: PluginConnections;
  events: PluginEvents;
  ipc: PluginIPC;
  storage: PluginStorage;
  config: PluginConfig;
}

export interface PluginLogger {
  info: (msg: string, ...args: unknown[]) => void;
  warn: (msg: string, ...args: unknown[]) => void;
  error: (msg: string, ...args: unknown[]) => void;
  debug: (msg: string, ...args: unknown[]) => void;
}

export interface PluginConnections {
  create: (connId: string, type: string, config: Record<string, unknown>) => Promise<void>;
  destroy: (connId: string) => Promise<void>;
  list: () => { id: string; type: string; state: string }[];
  send: (connId: string, data: string) => void;
  onData: (connId: string, cb: (data: string) => void) => () => void;
  onStateChange: (cb: (connId: string, state: string) => void) => () => void;
}

export interface PluginEvents {
  emit: (topic: string, ...data: unknown[]) => void;
  on: (topic: string, cb: (...args: unknown[]) => void) => () => void;
  once: (topic: string, cb: (...args: unknown[]) => void) => void;
}

export interface PluginIPC {
  // Send message to main process
  send: (channel: string, ...args: unknown[]) => void;
  // Invoke main process handler and get result
  invoke: <T = unknown>(channel: string, ...args: unknown[]) => Promise<T>;
  // Listen for messages from main process
  on: (channel: string, cb: (...args: unknown[]) => void) => () => void;
  // Handle messages from main process (for child process only)
  handle: (channel: string, cb: (...args: unknown[]) => unknown) => void;
}

export interface PluginStorage {
  get: <T = unknown>(key: string, defaultValue?: T) => T;
  set: <T = unknown>(key: string, value: T) => void;
  delete: (key: string) => void;
  keys: () => string[];
}

export interface PluginConfig {
  get: <T = unknown>(key: string, defaultValue?: T) => T;
  set: <T = unknown>(key: string, value: T) => void;
  has: (key: string) => boolean;
}

export interface SeeleLinkPlugin {
  // Plugin identity
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly type: PluginType;

  // Lifecycle
  onLoad?(ctx: PluginContext): void | Promise<void>;
  onActivate?(ctx: PluginContext): void | Promise<void>;
  onDeactivate?(): void | Promise<void>;
  onUninstall?(): void | Promise<void>;

  // For connection-type plugins
  onConnectionRequest?: (connId: string, type: string, config: Record<string, unknown>) => Promise<void>;
  onConnectionData?: (connId: string, data: string) => void;
  onConnectionClose?: (connId: string) => void;
}

export interface LoadedPlugin {
  manifest: PluginManifest;
  instance: SeeleLinkPlugin;
  enabled: boolean;
  context: PluginContext | null;
}

// IPC channel names for plugin <-> main communication
export const PLUGIN_CHANNELS = {
  // Plugin -> Main
  REGISTRY_REGISTER: 'plugin:registry:register',
  REGISTRY_UNREGISTER: 'plugin:registry:unregister',
  CONNECTION_CREATE: 'plugin:connection:create',
  CONNECTION_DESTROY: 'plugin:connection:destroy',
  CONNECTION_LIST: 'plugin:connection:list',
  CONNECTION_SEND: 'plugin:connection:send',
  STORAGE_GET: 'plugin:storage:get',
  STORAGE_SET: 'plugin:storage:set',
  STORAGE_DELETE: 'plugin:storage:delete',
  CONFIG_GET: 'plugin:config:get',
  CONFIG_SET: 'plugin:config:set',
  EVENT_EMIT: 'plugin:event:emit',

  // Main -> Plugin
  PLUGIN_ACTIVATE: 'plugin:activate',
  PLUGIN_DEACTIVATE: 'plugin:deactivate',
  CONNECTION_DATA: 'plugin:connection:data',
  CONNECTION_STATE: 'plugin:connection:state',
  EVENT_ON: 'plugin:event:on',
} as const;
