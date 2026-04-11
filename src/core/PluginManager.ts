/**
 * Plugin Manager
 *
 * Manages plugin lifecycle: discovery, loading, enabling, disabling, uninstalling.
 * Plugins run in isolated child processes for security.
 */

import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { EventEmitter } from 'events';
import { PluginProcess, createPluginContext } from '../plugins/PluginProcess.js';
import {
  PluginManifest,
  LoadedPlugin,
  SeeleLinkPlugin,
  PluginContext,
  PLUGIN_CHANNELS,
} from '../plugins/types.js';

const PLUGIN_CONFIG_DIR = '.seelelink/plugin-config';
const PLUGIN_DATA_DIR = '.seelelink/plugin-data';
const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_DELAY = 2000;

export class PluginManager extends EventEmitter {
  private plugins = new Map<string, LoadedPlugin>();
  private processes = new Map<string, PluginProcess>();
  private enabledPlugins = new Set<string>();
  private pluginDirs = new Map<string, string>();  // pluginId -> pluginDir

  constructor() {
    super();
    this.loadEnabledPlugins();
  }

  // Get the plugins directory path
  private getPluginsDir(): string {
    return path.join(os.homedir(), '.seelelink', 'plugins');
  }

  // Get plugin config directory
  private getPluginConfigDir(): string {
    return path.join(os.homedir(), PLUGIN_CONFIG_DIR);
  }

  // Get plugin data directory
  private getPluginDataDir(): string {
    return path.join(os.homedir(), PLUGIN_DATA_DIR);
  }

  // Load list of enabled plugins from config
  private loadEnabledPlugins(): void {
    try {
      const configDir = this.getPluginConfigDir();
      const enabledFile = path.join(configDir, 'enabled.json');
      if (fs.existsSync(enabledFile)) {
        const enabled = JSON.parse(fs.readFileSync(enabledFile, 'utf-8'));
        this.enabledPlugins = new Set(enabled);
      }
    } catch (e) {
      console.error('Failed to load enabled plugins:', e);
    }
  }

  // Save enabled plugins list to config
  private async persistEnabledPlugins(): Promise<void> {
    try {
      const configDir = this.getPluginConfigDir();
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      const enabledFile = path.join(configDir, 'enabled.json');
      fs.writeFileSync(enabledFile, JSON.stringify(Array.from(this.enabledPlugins)));
    } catch (e) {
      console.error('Failed to persist enabled plugins:', e);
    }
  }

  // Load a plugin manifest from a directory
  async loadManifest(pluginDir: string): Promise<PluginManifest | null> {
    const manifestPath = path.join(pluginDir, 'plugin.json');
    if (!fs.existsSync(manifestPath)) {
      return null;
    }
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      // Validate required fields
      if (!manifest.id || !manifest.name || !manifest.version || !manifest.type || !manifest.entry) {
        console.error('Plugin manifest missing required fields:', manifest.id);
        return null;
      }
      return manifest;
    } catch (e) {
      console.error('Failed to load plugin manifest:', e);
      return null;
    }
  }

  // Discover all plugins in the plugins directory
  async discoverPlugins(): Promise<PluginManifest[]> {
    const pluginsDir = this.getPluginsDir();
    if (!fs.existsSync(pluginsDir)) {
      fs.mkdirSync(pluginsDir, { recursive: true });
      return [];
    }

    const manifests: PluginManifest[] = [];
    const entries = fs.readdirSync(pluginsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const pluginDir = path.join(pluginsDir, entry.name);
      const manifest = await this.loadManifest(pluginDir);
      if (manifest) {
        manifests.push(manifest);
        this.pluginDirs.set(manifest.id, pluginDir);
      }
    }

    return manifests;
  }

  // Load a plugin (code not executed yet)
  async loadPlugin(manifest: PluginManifest): Promise<void> {
    if (this.plugins.has(manifest.id)) {
      console.warn('Plugin already loaded:', manifest.id);
      return;
    }

    const pluginDir = this.pluginDirs.get(manifest.id) || path.join(this.getPluginsDir(), manifest.id);
    const entryPath = path.join(pluginDir, manifest.entry);

    if (!fs.existsSync(entryPath)) {
      throw new Error(`Plugin entry not found: ${entryPath}`);
    }

    // Load the plugin module
    let instance: SeeleLinkPlugin;
    try {
      const mod = await import(`file://${entryPath}`);
      instance = mod.default || mod;
    } catch (e) {
      throw new Error(`Failed to load plugin: ${e}`);
    }

    const loadedPlugin: LoadedPlugin = {
      manifest,
      instance,
      enabled: false,
      context: null,
    };

    this.plugins.set(manifest.id, loadedPlugin);
    console.log('Plugin loaded:', manifest.id, manifest.version);

    // Call onLoad if present
    if (instance.onLoad) {
      try {
        await instance.onLoad(this.createContext(manifest.id));
      } catch (e) {
        console.error(`Plugin ${manifest.id} onLoad failed:`, e);
      }
    }
  }

  // Create a plugin context for a specific plugin
  private createContext(pluginId: string): PluginContext {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) throw new Error('Plugin not found: ' + pluginId);

    const ctx = createPluginContext(pluginId, (channel, ...args) => {
      const process = this.processes.get(pluginId);
      if (process) {
        process.send(channel, ...args);
      }
    });

    return ctx;
  }

  // Enable a plugin (starts its process)
  async enablePlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) throw new Error('Plugin not found: ' + pluginId);

    if (plugin.enabled) {
      console.warn('Plugin already enabled:', pluginId);
      return;
    }

    // Check dependencies
    if (plugin.manifest.dependencies) {
      for (const depId of plugin.manifest.dependencies) {
        if (!this.enabledPlugins.has(depId)) {
          throw new Error(`Plugin ${pluginId} depends on ${depId} which is not enabled`);
        }
      }
    }

    const pluginDir = this.pluginDirs.get(pluginId) || path.join(this.getPluginsDir(), pluginId);

    // Create and start plugin process
    const process = new PluginProcess(pluginId, pluginDir);
    this.processes.set(pluginId, process);

    try {
      await process.start();
    } catch (e) {
      this.processes.delete(pluginId);
      throw e;
    }

    // Create context and call onActivate
    plugin.context = this.createContext(pluginId);
    plugin.enabled = true;
    this.enabledPlugins.add(pluginId);
    await this.persistEnabledPlugins();

    if (plugin.instance.onActivate) {
      try {
        await plugin.instance.onActivate(plugin.context);
      } catch (e) {
        console.error(`Plugin ${pluginId} onActivate failed:`, e);
      }
    }

    // Setup connection event forwarding
    this.setupConnectionForwarding(pluginId);

    console.log('Plugin enabled:', pluginId);
  }

  // Disable a plugin (stops its process)
  async disablePlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return;

    if (!plugin.enabled) {
      console.warn('Plugin not enabled:', pluginId);
      return;
    }

    // Call onDeactivate if present
    if (plugin.instance.onDeactivate) {
      try {
        await plugin.instance.onDeactivate();
      } catch (e) {
        console.error(`Plugin ${pluginId} onDeactivate failed:`, e);
      }
    }

    // Stop the process
    const process = this.processes.get(pluginId);
    if (process) {
      process.stop();
      this.processes.delete(pluginId);
    }

    plugin.enabled = false;
    plugin.context = null;
    this.enabledPlugins.delete(pluginId);
    await this.persistEnabledPlugins();

    console.log('Plugin disabled:', pluginId);
  }

  // Setup forwarding of connection events to plugins
  private setupConnectionForwarding(pluginId: string): void {
    const plugin = this.plugins.get(pluginId);
    const process = this.processes.get(pluginId);
    if (!plugin || !process) return;

    // Forward connection data to plugin
    // This would be connected to the connection manager's event bus
  }

  // Uninstall a plugin (removes files)
  async uninstallPlugin(pluginId: string): Promise<void> {
    // Must disable first
    if (this.enabledPlugins.has(pluginId)) {
      await this.disablePlugin(pluginId);
    }

    const plugin = this.plugins.get(pluginId);
    if (!plugin) return;

    // Call onUninstall if present
    if (plugin.instance.onUninstall) {
      try {
        await plugin.instance.onUninstall();
      } catch (e) {
        console.error(`Plugin ${pluginId} onUninstall failed:`, e);
      }
    }

    // Remove from registry
    this.plugins.delete(pluginId);
    this.pluginDirs.delete(pluginId);

    // Remove config
    try {
      const configDir = this.getPluginConfigDir();
      const configFile = path.join(configDir, `${pluginId}.json`);
      if (fs.existsSync(configFile)) {
        fs.unlinkSync(configFile);
      }
    } catch (e) {
      console.error('Failed to remove plugin config:', e);
    }

    // Remove plugin directory
    const pluginDir = this.pluginDirs.get(pluginId) || path.join(this.getPluginsDir(), pluginId);
    try {
      if (fs.existsSync(pluginDir)) {
        fs.rmSync(pluginDir, { recursive: true, force: true });
      }
    } catch (e) {
      console.error('Failed to remove plugin directory:', e);
    }

    console.log('Plugin uninstalled:', pluginId);
  }

  // Load and enable all plugins
  async initialize(): Promise<void> {
    console.log('Discovering plugins...');
    const manifests = await this.discoverPlugins();

    console.log(`Found ${manifests.length} plugins`);

    // Load all plugins
    for (const manifest of manifests) {
      try {
        await this.loadPlugin(manifest);
      } catch (e) {
        console.error(`Failed to load plugin ${manifest.id}:`, e);
      }
    }

    // Enable plugins that were previously enabled
    for (const pluginId of this.enabledPlugins) {
      try {
        await this.enablePlugin(pluginId);
      } catch (e) {
        console.error(`Failed to enable plugin ${pluginId}:`, e);
      }
    }

    console.log('Plugin manager initialized');
  }

  // Get all loaded plugins
  getPlugins(): LoadedPlugin[] {
    return Array.from(this.plugins.values());
  }

  // Get a specific plugin
  getPlugin(pluginId: string): LoadedPlugin | undefined {
    return this.plugins.get(pluginId);
  }

  // Check if plugin is enabled
  isEnabled(pluginId: string): boolean {
    return this.enabledPlugins.has(pluginId);
  }

  // Shutdown all plugins
  async shutdown(): Promise<void> {
    for (const pluginId of this.enabledPlugins) {
      try {
        await this.disablePlugin(pluginId);
      } catch (e) {
        console.error(`Failed to disable plugin ${pluginId}:`, e);
      }
    }
    console.log('Plugin manager shut down');
  }
}

export const pluginManager = new PluginManager();
