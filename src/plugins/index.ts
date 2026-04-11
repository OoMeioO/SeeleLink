/**
 * Built-in Plugins Registry
 *
 * Registers built-in plugins (SSH, Serial, PowerShell, etc.) that are
 * compiled into the app and provide core functionality.
 */

import { SeeleLinkPlugin, PluginManifest, PluginType } from './types.js';

// Built-in plugins provide core functionality
export const builtinPlugins: (PluginManifest & { instance: SeeleLinkPlugin })[] = [];

// Plugin type definitions for built-in capabilities
export const builtinCapabilities: Record<PluginType, string[]> = {
  connection: ['ssh', 'serial', 'powershell', 'cmd', 'websocket', 'android'],
  tool: ['mcp', 'control'],
  automation: ['control'],
  ui: [],
};

// Check if a plugin ID is a built-in
export function isBuiltinPlugin(id: string): boolean {
  return builtinPlugins.some(p => p.id === id);
}

// Get built-in plugin by ID
export function getBuiltinPlugin(id: string) {
  return builtinPlugins.find(p => p.id === id);
}

// Register a built-in plugin
export function registerBuiltinPlugin(plugin: PluginManifest & { instance: SeeleLinkPlugin }) {
  if (builtinPlugins.some(p => p.id === plugin.id)) {
    console.warn('Builtin plugin already registered:', plugin.id);
    return;
  }
  builtinPlugins.push(plugin);
  console.log('Builtin plugin registered:', plugin.id, plugin.version);
}
