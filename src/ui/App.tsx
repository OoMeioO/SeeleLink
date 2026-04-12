/**
 * SeeleLink - Main Application
 * 
 * VSCode + OpenClaw inspired minimalist design
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import '@xterm/xterm/css/xterm.css';
import './index.css';
import { useTheme } from './themes';
import { TerminalPanel, type TerminalPanelTab } from './terminal';
import { AndroidPage } from './components/AndroidPage';
import type { ConnectionTab } from './components/AndroidPage';
import { IRPage } from './components/IRPage';
import type { SavedConn, ComPortInfo, IRData } from './types';

// Lucide icons for consistent icon set
import {
  Monitor, Terminal as TerminalIcon, Cable, Command, Globe, Smartphone, Tv, Settings,
  Plus, Search, X, Minus, Square, Activity, FileText, Folder, LogOut, Info,
  ZoomIn, ZoomOut, RefreshCw, RotateCcw, Server, Database, Monitor as MonitorIcon, TerminalSquare, Hash,
  Palette,
} from 'lucide-react';

// Tab type
export type TabType = 'ssh' | 'serial' | 'powershell' | 'cmd' | 'websocket' | 'android' | 'ir' | 'settings';

// Helper: wrap Lucide icon in a fixed-size centering box
// Lucide SVG content sits slightly high within the 24x24 viewBox.
// paddingTop shifts icon down to align visual center with text baseline.
const iconWrap = (icon: React.ReactNode, color?: string) => (
  <span style={{ width: 16, height: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
    <span style={{ paddingTop: 0.8, color: color || 'inherit' }}>{icon}</span>
  </span>
);

// Tab config with Lucide icon components (not pre-rendered, to allow dynamic coloring)
const TABS: { id: TabType; label: string; IconComponent: React.ComponentType<{size: number}> }[] = [
  { id: 'ssh', label: 'SSH', IconComponent: Monitor },
  { id: 'serial', label: 'Serial', IconComponent: Cable },
  { id: 'powershell', label: 'PowerShell', IconComponent: TerminalIcon },
  { id: 'cmd', label: 'Bash', IconComponent: Command },
  { id: 'websocket', label: 'WebSocket', IconComponent: Globe },
  { id: 'android', label: 'Android', IconComponent: Smartphone },
  { id: 'ir', label: 'IR', IconComponent: Tv },
  { id: 'settings', label: 'Settings', IconComponent: Settings },
];

// ============================================================
// Main App Component
// ============================================================

export default function App() {
  const { theme, styles, designTheme, setDesignTheme, availableDesignThemes } = useTheme();
  // Destructure colors for convenience - theme.colors has all color tokens
  const colors = theme.colors;
  
  // State
  const [activeTab, setActiveTab] = useState<TabType>('ssh');
  const [savedConns, setSavedConns] = useState<SavedConn[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    name: '', host: '', port: '22', username: '', password: '',
    serialPort: '', baudRate: '115200', url: 'ws://localhost:8080'
  });
  const [availableComPorts, setAvailableComPorts] = useState<ComPortInfo[]>([]);
  const [connTabs, setConnTabs] = useState<TerminalPanelTab[]>([]);
  const [activeConnTabId, setActiveConnTabId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [apiReady, setApiReady] = useState(false);

  // Android page state - lifted here so it survives tab switches
  const [androidTabs, setAndroidTabs] = useState<ConnectionTab[]>([]);
  const [androidActiveTab, setAndroidActiveTab] = useState<ConnectionTab | null>(null);

  // IR page state - lifted here so it survives tab switches
  const [irData, setIrData] = useState<IRData>({
    deviceTypes: [],
    commands: [],
    devices: [],
    sequences: [],
  });

  // Auto-detect environment and initialize API
  useEffect(() => {
    // If window.electronAPI already exists (Electron), do nothing
    if (window.electronAPI) {
      console.log('[App] Using Electron API');
      return;
    }

    // Otherwise, we're in browser mode - use WebBridge API
    // Get WebBridge URL from query param or use default
    const params = new URLSearchParams(window.location.search);
    const wsUrl = params.get('ws') || 'ws://localhost:9382';
    console.log('[App] Browser mode detected, connecting to WebBridge:', wsUrl);

    // Dynamically import and initialize webAPI
    import('./webAPI').then(({ createWebAPI }) => {
      const api = createWebAPI(wsUrl);
      // @ts-ignore - we're setting a runtime property
      window.electronAPI = api;
      setApiReady(true);
      console.log('[App] WebBridge API initialized');
    }).catch(err => {
      console.error('[App] Failed to initialize WebBridge API:', err);
    });
  }, []);

  // Load IR data on mount
  useEffect(() => {
    window.electronAPI?.irLoad().then(data => {
      if (data) setIrData(data);
    }).catch(console.error);
  }, []);

  // Expose app state to window for Control API / MCP debug access
  useEffect(() => {
    (window as any).__seelelink_tabs = connTabs;
    (window as any).__seelelink_active_tab = activeConnTabId;
    (window as any).__seelelink_active_tab_id = activeConnTabId;
    (window as any).__seelelink_conn_tabs = connTabs;
    (window as any).__seelelink_active_tab_type = activeTab;
  }, [connTabs, activeConnTabId, activeTab]);

  // Global keyboard shortcuts for menu actions
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key === 'n') {
        e.preventDefault();
        setShowModal(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const [windowCaptureMode, setWindowCaptureMode] = useState<'auto' | 'foreground' | 'gdi'>('auto');

  // Zoom state (50-200, default 100) — zoom implementation pending
  const [zoom, setZoom] = useState(() => {
    const stored = localStorage.getItem('seelelink-zoom');
    return stored ? parseInt(stored, 10) : 100;
  });

  // Menu state
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [editMenuOpen, setEditMenuOpen] = useState(false);

  // Status bar time — update every minute
  const [currentTime, setCurrentTime] = useState(() => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  useEffect(() => {
    const id = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, 30000);
    return () => clearInterval(id);
  }, []);
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const [helpMenuOpen, setHelpMenuOpen] = useState(false);

  // Terminal refs - kept for backward compat, actual refs are in TerminalPanel

  // Load saved connections
  useEffect(() => {
    window.electronAPI?.loadConnections().then(conns => {
      console.log('[App] loadConnections returned:', conns?.length, 'connections');
      setSavedConns(conns || []);
    }).catch(e => console.error('[App] loadConnections error:', e));
    window.electronAPI?.windowCaptureGetConfig().then(cfg => {
      if (cfg?.mode) setWindowCaptureMode(cfg.mode);
    }).catch(console.error);

    // Listen for connection changes from other clients (Web-App sync)
    const handleConnectionsChanged = () => {
      console.log('[App] connections changed event received');
      window.electronAPI?.loadConnections().then(setSavedConns).catch(console.error);
    };
    // Browser/WebBridge path: custom event dispatched by webAPI
    window.addEventListener('seelelink:connections-changed', handleConnectionsChanged);
    // Also reload connections when WebSocket reconnects (e.g., after page refresh)
    window.addEventListener('seelelink:connected', handleConnectionsChanged);
    // Electron renderer path: IPC listener from main process
    window.electronAPI?.onConnectionsChanged?.(handleConnectionsChanged);
    return () => {
      window.removeEventListener('seelelink:connections-changed', handleConnectionsChanged);
      window.removeEventListener('seelelink:connected', handleConnectionsChanged);
    };
  }, []);

  // Window capture mode handler
  const handleWindowCaptureModeChange = async (mode: 'auto' | 'foreground' | 'gdi') => {
    setWindowCaptureMode(mode);
    await window.electronAPI?.windowCaptureSetConfig({ mode } as any);
  };

  // Handle terminal input — delegate to TerminalPanel via global
  const handleTerminalInput = useCallback((tabId: string, data: string) => {
    const send = (window as any).__terminalPanelInput;
    if (send) send(tabId, data);
  }, []);

  // Open connection
  const openConnection = useCallback(async (conn: SavedConn) => {
    const tabId = `tab-${Date.now()}`;
    // Generate unique connId per tab instance to allow multiple tabs for the same saved connection
    const connId = `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const newTab: TerminalPanelTab = {
      id: tabId,
      connId,
      conn,
      isConnected: false,
    };

    setConnTabs(prev => [...prev, newTab]);
    setActiveConnTabId(tabId);
  }, []);

  // Close tab
  const closeTab = useCallback((tabId: string) => {
    setConnTabs(prev => {
      const tab = prev.find(t => t.id === tabId);
      if (tab) {
        switch (tab.conn.type) {
          case 'ssh': window.electronAPI?.sshDisconnect(tab.connId); break;
          case 'serial': window.electronAPI?.serialDisconnect(tab.connId); break;
          case 'powershell': window.electronAPI?.psDisconnect(tab.connId); break;
          case 'cmd': window.electronAPI?.cmdDisconnect(tab.connId); break;
          case 'websocket': window.electronAPI?.wsDisconnect(tab.connId); break;
        }
      }
      const remaining = prev.filter(t => t.id !== tabId);
      // If closing active tab, switch to first remaining tab
      setActiveConnTabId(cur => cur === tabId ? (remaining[0]?.id ?? null) : cur);
      return remaining;
    });
  }, []);

  // Delete connection
  const deleteConnection = useCallback(async (id: string) => {
    await window.electronAPI?.deleteConnection(id);
    setSavedConns(prev => prev.filter(c => c.id !== id));
  }, []);

  // Get active tab connections (filtered by search)
  const activeTabConns = savedConns
    .filter(c => c.type === activeTab)
    .filter(c => !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase()));

  // Close menus when clicking outside or pressing Escape
  useEffect(() => {
    const handleClick = () => {
      setFileMenuOpen(false);
      setEditMenuOpen(false);
      setViewMenuOpen(false);
      setHelpMenuOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFileMenuOpen(false);
        setEditMenuOpen(false);
        setViewMenuOpen(false);
        setHelpMenuOpen(false);
      }
    };
    document.addEventListener('click', handleClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('click', handleClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Get the active connection tab
  const activeConnTab = connTabs.find(t => t.id === activeConnTabId);

  // Render empty state content
  const renderEmptyContent = () => (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center',
      height: '100%',
      color: colors.textTertiary,
    }}>
      <Activity size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
      <div style={{ fontSize: 14, marginBottom: 4 }}>Select a connection to get started</div>
      <div style={{ fontSize: 12, opacity: 0.7 }}>Or click + to add a new connection</div>
    </div>
  );

  // Settings row helper — consistent visual pattern for Settings page
  function SettingsRow({ icon, label, description, children }: {
    icon: React.ReactNode; label: string; description: string; children: React.ReactNode;
  }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: `1px solid ${colors.border}` }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ color: colors.textSecondary, marginTop: 2, flexShrink: 0 }}>{icon}</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: colors.text }}>{label}</div>
            <div style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>{description}</div>
          </div>
        </div>
        <div style={{ flexShrink: 0, marginLeft: 16 }}>{children}</div>
      </div>
    );
  }

  // Render Settings content
  const renderSettings = () => (
    <div style={{ padding: '24px 32px', flex: 1, overflow: 'auto' }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20, color: colors.text, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Settings size={20} style={{ verticalAlign: 'middle' }} /> Settings
      </h2>

      {/* Design Theme - 4 row layout */}
      <div style={{ padding: '12px 0', borderBottom: `1px solid ${colors.border}` }}>
        {/* Row 1: Label with icon */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <Palette size={16} style={{ color: colors.textSecondary, flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 500, color: colors.text }}>Design Theme</span>
        </div>
        {/* Row 2: Description */}
        <div style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 10, paddingLeft: 28 }}>
          Choose a design theme for the interface
        </div>
        {/* Row 3: Dark Themes */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingLeft: 28, marginBottom: 8 }}>
          {availableDesignThemes.filter(t => !t.id.includes('light')).map(t => {
            const isActive = designTheme?.id === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setDesignTheme(t)}
                title={t.description}
                style={{
                  padding: '6px 14px',
                  fontSize: 12,
                  border: `1px solid ${isActive ? colors.primary : colors.border}`,
                  borderRadius: theme.radius.md,
                  backgroundColor: isActive ? colors.primary + '25' : colors.bgTertiary,
                  color: isActive ? colors.primary : colors.text,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  transition: 'all 0.15s',
                  fontWeight: isActive ? 600 : 400,
                  boxShadow: isActive ? `0 0 0 2px ${colors.primary}35` : 'none',
                }}
              >
                <span style={{ display: 'flex', gap: 3 }}>
                  {t.swatches.map((color, i) => (
                    <span
                      key={i}
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: color,
                        display: 'inline-block',
                        border: '1px solid rgba(128,128,128,0.4)',
                      }}
                    />
                  ))}
                </span>
                {t.name}
              </button>
            );
          })}
        </div>
        {/* Row 4: Light Themes */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingLeft: 28 }}>
          {availableDesignThemes.filter(t => t.id.includes('light')).map(t => {
            const isActive = designTheme?.id === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setDesignTheme(t)}
                title={t.description}
                style={{
                  padding: '6px 14px',
                  fontSize: 12,
                  border: `1px solid ${isActive ? colors.primary : colors.border}`,
                  borderRadius: theme.radius.md,
                  backgroundColor: isActive ? colors.primary + '25' : colors.bgTertiary,
                  color: isActive ? colors.primary : colors.text,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  transition: 'all 0.15s',
                  fontWeight: isActive ? 600 : 400,
                  boxShadow: isActive ? `0 0 0 2px ${colors.primary}35` : 'none',
                }}
              >
                <span style={{ display: 'flex', gap: 3 }}>
                  {t.swatches.map((color, i) => (
                    <span
                      key={i}
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: color,
                        display: 'inline-block',
                        border: '1px solid rgba(128,128,128,0.4)',
                      }}
                    />
                  ))}
                </span>
                {t.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Zoom */}
      <SettingsRow icon={<ZoomIn size={16} style={{ verticalAlign: 'middle' }} />} label="Zoom" description="Adjust UI scale">
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button type="button" title="Zoom out" onClick={() => { const v = Math.max(50, zoom - 10); setZoom(v); localStorage.setItem('seelelink-zoom', String(v)); }} style={{ ...styles.button, width: 28, height: 28, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ZoomOut size={14} style={{ verticalAlign: 'middle' }} /></button>
          <span style={{ fontSize: 12, color: colors.text, minWidth: 40, textAlign: 'center' }}>{zoom}%</span>
          <button type="button" title="Zoom in" onClick={() => { const v = Math.min(200, zoom + 10); setZoom(v); localStorage.setItem('seelelink-zoom', String(v)); }} style={{ ...styles.button, width: 28, height: 28, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ZoomIn size={14} style={{ verticalAlign: 'middle' }} /></button>
          <button type="button" title="Reset zoom" onClick={() => { setZoom(100); localStorage.setItem('seelelink-zoom', '100'); }} style={{ ...styles.button, width: 28, height: 28, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 4 }}><Minus size={14} style={{ verticalAlign: 'middle' }} /></button>
        </div>
      </SettingsRow>

      {/* Control API */}
      <SettingsRow icon={<Server size={16} style={{ verticalAlign: 'middle' }} />} label="Control API" description="Remote control endpoint (127.0.0.1:9380)">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, backgroundColor: colors.success + '22', color: colors.success }}>Enabled</span>
          <button type="button" title="Restart Control API" style={{ ...styles.button, height: 26, padding: '0 8px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => {
            window.electronAPI?.controlApiRestart?.();
          }}><RotateCcw size={11} style={{ verticalAlign: 'middle' }} /> Restart</button>
        </div>
      </SettingsRow>

      {/* MCP Server */}
      <SettingsRow icon={<TerminalSquare size={16} style={{ verticalAlign: 'middle' }} />} label="MCP Server" description="Model Context Protocol server (127.0.0.1:9381)">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, backgroundColor: colors.success + '22', color: colors.success }}>Enabled</span>
          <button type="button" title="Restart MCP Server" style={{ ...styles.button, height: 26, padding: '0 8px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => {
            window.electronAPI?.mcpApiRestart?.();
          }}><RotateCcw size={11} style={{ verticalAlign: 'middle' }} /> Restart</button>
        </div>
      </SettingsRow>

      {/* WebBridge - Web UI Access */}
      <WebBridgeSettings />

      {/* Session Logs */}
      <SessionLogSettings />

      {/* Window Capture */}
      <SettingsRow icon={<MonitorIcon size={16} style={{ verticalAlign: 'middle' }} />} label="Window Capture" description="How to capture the SeeleLink window screenshot">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {([
            { key: 'auto', label: 'Auto' },
            { key: 'foreground', label: 'Foreground' },
            { key: 'gdi', label: 'GDI' },
          ] as const).map(({ key, label }) => (
            <button
              type="button"
              key={key}
              onClick={() => handleWindowCaptureModeChange(key)}
              style={{
                padding: '4px 10px',
                fontSize: 11,
                border: `1px solid ${windowCaptureMode === key ? colors.primary || '#4a9eff' : colors.border}`,
                borderRadius: 4,
                backgroundColor: windowCaptureMode === key ? (colors.primary || '#4a9eff') + '22' : colors.bg,
                color: windowCaptureMode === key ? (colors.primary || '#4a9eff') : colors.text,
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </SettingsRow>

      {/* About */}
      <SettingsRow icon={<Info size={16} style={{ verticalAlign: 'middle' }} />} label="About" description="SeeleLink v0.1.0">
        <></>
      </SettingsRow>
    </div>
  );

  // Render Protocol page content
  const renderProtocolPage = (tabId: TabType) => {
    switch (tabId) {
      case 'android':
        return (
          <div style={{ padding: '24px 32px', maxWidth: 600 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20, color: colors.text, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Smartphone size={20} /> Android
            </h2>
            <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', color: colors.textSecondary }}>
              <Smartphone size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
              <div style={{ fontSize: 14, marginBottom: 8 }}>Android ADB Connection</div>
              <div style={{ fontSize: 12, color: colors.textTertiary }}>Connect via ADB (Android Debug Bridge)</div>
            </div>
          </div>
        );
      case 'ir':
        return (
          <div style={{ padding: '24px 32px', maxWidth: 600 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20, color: colors.text, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Tv size={20} /> IR Control
            </h2>
            <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', color: colors.textSecondary }}>
              <Tv size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
              <div style={{ fontSize: 14, marginBottom: 8 }}>IR Infrared Control</div>
              <div style={{ fontSize: 12, color: colors.textTertiary }}>Control devices via infrared signals</div>
            </div>
          </div>
        );
      case 'websocket':
        return (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            height: '100%', color: colors.textSecondary,
          }}>
            <Globe size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
            <div style={{ fontSize: 14, marginBottom: 4 }}>WebSocket Connection</div>
            <div style={{ fontSize: 12, color: colors.textTertiary }}>Connect to WebSocket servers</div>
          </div>
        );
      default:
        return null;
    }
  };

  // Render
  return (
    <div style={styles.container}>
      {/* Loading screen when API is not ready in browser mode */}
      {!apiReady && !window.electronAPI && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16 }}>
          <Activity size={48} style={{ color: colors.primary, animation: 'pulse 1.5s infinite' }} />
          <div style={{ fontSize: 14, color: colors.textSecondary }}>Connecting to WebBridge...</div>
          <div style={{ fontSize: 11, color: colors.textTertiary }}>ws://localhost:9382</div>
        </div>
      )}

      {/* Title Bar */}
      <div style={{ ...styles.titleBar, padding: '0 16px' }}>
        <div style={styles.logo}>
          <Activity size={16} style={{ color: colors.primary }} />
          <span>SeeleLink</span>
        </div>
        
        <div style={{ ...styles.menuBar, marginLeft: 24 }} role="menubar">
          <div style={{ position: 'relative' }}>
            <button role="menuitem" aria-haspopup="true" aria-expanded={fileMenuOpen ? "true" : "false"} style={{ ...styles.menuItem, backgroundColor: fileMenuOpen ? colors.bgHover : 'transparent' }} onClick={(e) => { e.stopPropagation(); setFileMenuOpen(!fileMenuOpen); setEditMenuOpen(false); setViewMenuOpen(false); setHelpMenuOpen(false); }}>File</button>
            {fileMenuOpen && (
              <div role="menu" style={{ position: 'absolute', top: '100%', left: 0, backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 6, padding: 4, minWidth: 200, zIndex: 1000, boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}>
                <MenuButton label="New Connection" shortcut="Ctrl+N" icon={<Plus size={14} style={{ verticalAlign: 'middle' }} />} onClick={() => { setShowModal(true); setFileMenuOpen(false); }} />
                <MenuButton label="Import Connections..." icon={<Folder size={14} style={{ verticalAlign: 'middle' }} />} onClick={() => setFileMenuOpen(false)} />
                <MenuButton label="Export Connections..." icon={<FileText size={14} style={{ verticalAlign: 'middle' }} />} onClick={() => setFileMenuOpen(false)} />
                <div style={{ height: 1, backgroundColor: colors.border, margin: '4px 0' }} />
                <MenuButton label="Exit" shortcut="Alt+F4" icon={<LogOut size={14} style={{ verticalAlign: 'middle' }} />} onClick={() => window.electronAPI?.windowClose()} />
              </div>
            )}
          </div>

          <div style={{ position: 'relative' }}>
            <button role="menuitem" aria-haspopup="true" aria-expanded={editMenuOpen ? "true" : "false"} style={{ ...styles.menuItem, backgroundColor: editMenuOpen ? colors.bgHover : 'transparent' }} onClick={(e) => { e.stopPropagation(); setEditMenuOpen(!editMenuOpen); setFileMenuOpen(false); setViewMenuOpen(false); setHelpMenuOpen(false); }}>Edit</button>
            {editMenuOpen && (
              <div role="menu" style={{ position: 'absolute', top: '100%', left: 0, backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 6, padding: 4, minWidth: 180, zIndex: 1000, boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}>
                <MenuButton label="Copy" shortcut="Ctrl+C" />
                <MenuButton label="Paste" shortcut="Ctrl+V" />
                <div style={{ height: 1, backgroundColor: colors.border, margin: '4px 0' }} />
                <MenuButton label="Select All" shortcut="Ctrl+A" />
              </div>
            )}
          </div>

          <div style={{ position: 'relative' }}>
            <button role="menuitem" aria-haspopup="true" aria-expanded={viewMenuOpen ? "true" : "false"} style={{ ...styles.menuItem, backgroundColor: viewMenuOpen ? colors.bgHover : 'transparent' }} onClick={(e) => { e.stopPropagation(); setViewMenuOpen(!viewMenuOpen); setFileMenuOpen(false); setEditMenuOpen(false); setHelpMenuOpen(false); }}>View</button>
            {viewMenuOpen && (
              <div role="menu" style={{ position: 'absolute', top: '100%', left: 0, backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 6, padding: 4, minWidth: 180, zIndex: 1000, boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}>
                <MenuButton label="Settings" onClick={() => { setActiveTab('settings'); setViewMenuOpen(false); }} />
              </div>
            )}
          </div>

          <div style={{ position: 'relative' }}>
            <button role="menuitem" aria-haspopup="true" aria-expanded={helpMenuOpen ? "true" : "false"} style={{ ...styles.menuItem, backgroundColor: helpMenuOpen ? colors.bgHover : 'transparent' }} onClick={(e) => { e.stopPropagation(); setHelpMenuOpen(!helpMenuOpen); setFileMenuOpen(false); setEditMenuOpen(false); setViewMenuOpen(false); }}>Help</button>
            {helpMenuOpen && (
              <div role="menu" style={{ position: 'absolute', top: '100%', left: 0, backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 6, padding: 4, minWidth: 180, zIndex: 1000, boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}>
                <MenuButton label="Documentation" />
                <MenuButton label="Report Issue" />
                <div style={{ height: 1, backgroundColor: colors.border, margin: '4px 0' }} />
                <MenuButton label="About SeeleLink" icon={<Info size={14} style={{ verticalAlign: 'middle' }} />} />
              </div>
            )}
          </div>
        </div>
        
        <div style={{ flex: 1 }} />
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, WebkitAppRegion: 'no-drag' as const }}>
          <button className="window-control-btn" onClick={() => window.electronAPI?.windowMinimize()} title="Minimize"><Minus size={16} /></button>
          <button className="window-control-btn" onClick={() => window.electronAPI?.windowMaximize()} title="Maximize"><Square size={14} /></button>
          <button className="window-control-btn close" onClick={() => window.electronAPI?.windowClose()} title="Close"><X size={16} /></button>
        </div>
      </div>

      {/* Protocol Tab Bar */}
      <div role="tablist" aria-label="Connection type" style={{ display: 'flex', backgroundColor: colors.bgSecondary, borderBottom: `1px solid ${colors.border}`, padding: '0 16px', gap: 2, overflowX: 'auto' }}>
        {TABS.map(tab => {
          const Icon = tab.IconComponent;
          return (
            <button role="tab" key={tab.id} aria-selected={activeTab === tab.id ? "true" : "false"} onClick={() => setActiveTab(tab.id)} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '0 16px', fontSize: 13, color: colors.primary, backgroundColor: activeTab === tab.id ? colors.bg : 'transparent', border: 'none', borderBottom: activeTab === tab.id ? `2px solid ${colors.primary}` : '2px solid transparent', cursor: 'pointer', transition: 'all 0.1s ease', height: 40, whiteSpace: 'nowrap' as const }}>
              <Icon size={16} color={colors.primary} />
              <span style={{ lineHeight: 1 }}>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Content */}
      <div style={styles.content}>
        {/* Sidebar - only for connection tabs, hidden for android/ir */}
        {activeTab !== 'settings' && !['android', 'ir'].includes(activeTab) && (
          <div style={styles.sidebar}>
            <div style={{ ...styles.sidebarHeader, padding: '0 16px' }}>
              <span style={styles.sidebarTitle}>{activeTab.toUpperCase()}</span>
              <button style={styles.buttonAdd} onClick={() => setShowModal(true)} title="New Connection"><Plus size={14} /></button>
            </div>

            <div style={{ padding: '8px 12px', borderBottom: `1px solid ${colors.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: colors.bg, border: `1px solid ${colors.border}`, borderRadius: 4, padding: '4px 8px' }}>
                <Search size={14} style={{ color: colors.textTertiary }} />
                <input type="text" placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 12, color: colors.text }} />
              </div>
            </div>
            <div style={styles.sidebarContent}>
              {activeTabConns.length === 0 ? (
                <div style={{ padding: '20px 16px', textAlign: 'center' as const }}>
                  <div style={{ fontSize: 12, color: colors.textTertiary, marginBottom: 12 }}>{searchQuery ? 'No matches found' : 'No connections'}</div>
                  <button style={{ ...styles.button, width: '100%', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => setShowModal(true)}><Plus size={14} style={{ verticalAlign: 'middle' }} /> Add Connection</button>
                </div>
              ) : (
                <div role="list">
                  {activeTabConns.map(conn => (
                    <div role="listitem" key={conn.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', cursor: 'pointer', backgroundColor: 'transparent', transition: 'background-color 0.1s' }} onClick={() => openConnection(conn)}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: connTabs.some(t => t.conn.id === conn.id && t.isConnected) ? colors.success : colors.textTertiary, flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: 13, color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{conn.name}</span>
                      <button aria-label="Delete connection" onClick={e => { e.stopPropagation(); deleteConnection(conn.id); }} style={{ width: 20, height: 20, border: 'none', borderRadius: 4, backgroundColor: 'transparent', color: colors.textTertiary, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={12} style={{ verticalAlign: 'middle' }} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Main Area */}
        <div style={styles.mainArea}>
          {/* Connection tab bar — always rendered to keep tab state */}
          {connTabs.length > 0 && (
            <div style={{ ...styles.tabBar, padding: '0 16px', minHeight: 40 }}>
              {connTabs.map(tab => {
                const isActive = activeConnTabId === tab.id;
                return (
                  <div
                    key={tab.id}
                    onClick={() => setActiveConnTabId(tab.id)}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = colors.bgHover; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'; }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 16px', fontSize: 12,
                      color: isActive ? colors.text : colors.textSecondary,
                      borderBottom: isActive ? `2px solid ${colors.primary}` : '2px solid transparent',
                      cursor: 'pointer', whiteSpace: 'nowrap', height: 40,
                      backgroundColor: isActive ? colors.bg : 'transparent',
                      transition: 'background-color 0.1s, color 0.1s',
                    }}
                  >
                    <span>{tab.conn.name}</span>
                    <span
                      onClick={e => { e.stopPropagation(); closeTab(tab.id); }}
                      style={{ width: 14, height: 14, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, flexShrink: 0 }}
                    ><X size={12} style={{ verticalAlign: 'middle' }} /></span>
                  </div>
                );
              })}
            </div>
          )}

          {/* TerminalPanel is ALWAYS mounted — hidden via display:none when viewing other tabs */}
          <div style={{ ...styles.terminalContainer, display: ['android', 'ir', 'settings'].includes(activeTab) || (activeTab === 'websocket' && connTabs.length === 0) ? 'none' : undefined }}>
            <TerminalPanel
              connTabs={connTabs}
              activeConnTabId={activeConnTabId}
              onTerminalReady={(tabId, connId, connType) => {
                // Kept for external notification; IPC routing is internal to TerminalPanel
              }}
            />
          </div>

          {/* Settings / Android / IR rendered in same space as terminal */}
          {activeTab === 'settings' && renderSettings()}
          {activeTab === 'android' && (
            <AndroidPage
              androidTabs={androidTabs}
              setAndroidTabs={setAndroidTabs}
              androidActiveTab={androidActiveTab}
              setAndroidActiveTab={setAndroidActiveTab}
            />
          )}
          {activeTab === 'ir' && (
            <IRPage irData={irData} onIrDataChange={(data) => {
              setIrData(data);
              window.electronAPI?.irSave(data);
            }} />
          )}
          {activeTab === 'websocket' && connTabs.length === 0 && renderProtocolPage('websocket')}
          {!['settings', 'android', 'ir'].includes(activeTab) && !(activeTab === 'websocket' && connTabs.length === 0) && connTabs.length === 0 && renderEmptyContent()}
        </div>
      </div>

      {/* Status Bar */}
      <div style={{ ...styles.statusBar, padding: '0 16px' }}>
        <span style={styles.statusItem}>{currentTime}</span>
        <span>•</span>
        <span style={styles.statusItem}>UTF-8</span>
        <span>•</span>
        <span style={styles.statusItem}>{activeTab.toUpperCase()}</span>
        <span>•</span>
        <span style={{ ...styles.statusItem, color: connTabs.length > 0 ? colors.success : colors.textTertiary }}>● {connTabs.length > 0 ? 'Connected' : 'Disconnected'}</span>
        <div style={{ flex: 1 }} />
        <span style={styles.statusItem}>{designTheme?.name || 'Default'}</span>
        <span>•</span>
        <span style={styles.statusItem}>{zoom}%</span>
        <span>•</span>
        <span style={styles.statusItem}>{connTabs.length} tabs</span>
        <span>•</span>
        <span style={styles.statusItem}>{savedConns.length} connections</span>
      </div>

      {/* Modal */}
      {showModal && (
        <NewConnectionModal
          activeTab={activeTab}
          form={form}
          setForm={setForm}
          availableComPorts={availableComPorts}
          setAvailableComPorts={setAvailableComPorts}
          onSave={async (conn) => {
            if (!window.electronAPI) return;
            await window.electronAPI.saveConnection(conn);
            setSavedConns(prev => [...prev, conn]);
            setShowModal(false);
            setForm({ name: '', host: '', port: '22', username: '', password: '', serialPort: '', baudRate: '115200', url: 'ws://localhost:8080' });
          }}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}

// ============================================================
// Session Log Settings Component
// ============================================================
function SessionLogSettings() {
  const { theme, styles } = useTheme();
  const colors = theme.colors;
  const [enabled, setEnabled] = React.useState(true);
  const [logPath, setLogPath] = React.useState('');
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    window.electronAPI?.logGetConfig().then(cfg => {
      if (cfg) {
        setEnabled(cfg.enabled !== false);
        setLogPath(cfg.path || '');
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const save = React.useCallback((patch: { enabled?: boolean; path?: string }) => {
    const next = { enabled, path: logPath, ...patch };
    setEnabled(next.enabled);
    if (next.path !== undefined) setLogPath(next.path);
    window.electronAPI?.logSetConfig({ enabled: next.enabled, path: next.path || null });
  }, [enabled, logPath]);

  const handleBrowse = async () => {
    const dir = await window.electronAPI?.dialogOpenDirectory();
    if (dir) save({ path: dir });
  };

  return (
    <div style={{ padding: '12px 0', borderBottom: `1px solid ${colors.border}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: colors.text }}>Session Logs</div>
          <div style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>Record session output to log files</div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={e => save({ enabled: e.target.checked })}
            style={{ marginRight: 8, width: 16, height: 16 }}
          />
          <span style={{ fontSize: 12 }}>Enabled</span>
        </label>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, color: colors.textSecondary }}>Log Path:</span>
        <input
          type="text"
          value={logPath}
          onChange={e => save({ path: e.target.value })}
          placeholder="默认: ~/.seelelink/logs"
          style={{ flex: 1, padding: '6px 10px', fontSize: 12, backgroundColor: colors.bg, color: colors.text, border: `1px solid ${colors.border}`, borderRadius: 4, outline: 'none' }}
        />
        <button onClick={handleBrowse} style={{ ...styles.button, height: 28 }}>Browse</button>
        <button
          onClick={() => window.electronAPI?.logOpenFolder(null)}
          style={{ ...styles.button, height: 28 }}
          title="打开日志目录"
        >📂</button>
      </div>
    </div>
  );
}

// ============================================================
// WebBridge Settings Component
// ============================================================
function WebBridgeSettings() {
  const { theme, styles } = useTheme();
  const colors = theme.colors;
  const [connectedClients, setConnectedClients] = React.useState(0);
  const isElectron = typeof window !== 'undefined' && window.navigator.userAgent.includes('Electron');

  React.useEffect(() => {
    // Poll for connected clients count every 5 seconds
    const interval = setInterval(async () => {
      try {
        const info = await window.electronAPI?.appGetInfo?.();
        if (info && info.webBridgeClients !== undefined) {
          setConnectedClients(info.webBridgeClients);
        }
      } catch (e) {
        // Ignore errors
      }
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
  };

  return (
    <div style={{ padding: '12px 0', borderBottom: `1px solid ${colors.border}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Globe size={16} style={{ color: colors.textSecondary, verticalAlign: 'middle' }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: colors.text }}>WebBridge</div>
            <div style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>ws://localhost:9382</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, backgroundColor: colors.success + '22', color: colors.success }}>Enabled</span>
          {connectedClients > 0 && (
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, backgroundColor: colors.primary + '22', color: colors.primary }}>
              {connectedClients} client{connectedClients !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Web UI Access - always show in both Electron and Browser */}
      <div style={{ marginTop: 12, padding: '8px 12px', backgroundColor: colors.bgSecondary, borderRadius: 6 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: colors.text, marginBottom: 6 }}>Web UI 访问 / Web UI Access</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <code style={{ fontSize: 11, padding: '2px 6px', backgroundColor: colors.bg, borderRadius: 3, color: colors.primary }}>http://localhost:9383</code>
          <button
            type="button"
            title="Copy URL"
            onClick={() => copyToClipboard('http://localhost:9383')}
            style={{ ...styles.button, height: 22, padding: '0 8px', fontSize: 10, display: 'flex', alignItems: 'center', gap: 3 }}
          >
            <span style={{ fontSize: 10 }}>复制</span>
          </button>
        </div>
        <div style={{ fontSize: 10, color: colors.textTertiary, marginTop: 4 }}>
          在浏览器中打开此地址访问 SeeleLink Web UI / Open this URL in browser to access SeeleLink Web UI
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Sub Components
// ============================================================

function MenuButton({ label, shortcut, icon, onClick }: { label: string; shortcut?: string; icon?: React.ReactNode; onClick?: () => void }) {
  const { theme } = useTheme();
  const colors = theme.colors;
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '8px 12px', textAlign: 'left' as const, background: 'none', border: 'none', color: colors.text, fontSize: 13, borderRadius: 4, cursor: 'pointer' }}
      onMouseEnter={e => (e.currentTarget.style.backgroundColor = colors.bgHover)}
      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>{icon}<span>{label}</span></span>
      {shortcut && <span style={{ color: colors.textTertiary, fontSize: 11 }}>{shortcut}</span>}
    </button>
  );
}


function NewConnectionModal({ activeTab, form, setForm, availableComPorts, setAvailableComPorts, onSave, onClose }: {
  activeTab: TabType; form: SavedConn; setForm: React.Dispatch<React.SetStateAction<SavedConn | null>>; availableComPorts: ComPortInfo[]; setAvailableComPorts: (ports: ComPortInfo[]) => void; onSave: (conn: SavedConn) => void; onClose: () => void;
}) {
  const { theme, styles } = useTheme();
  const colors = theme.colors;
  const [localForm, setLocalForm] = useState(form);
  const [refreshing, setRefreshing] = useState(false);

  const refreshPorts = useCallback(() => {
    if (activeTab !== 'serial') return;
    setRefreshing(true);
    window.electronAPI?.serialList().then(ports => {
      setAvailableComPorts(ports);
    }).catch(console.error).finally(() => setRefreshing(false));
  }, [activeTab, setAvailableComPorts]);

  useEffect(() => {
    if (activeTab === 'serial') {
      refreshPorts();
    }
    setLocalForm(form);
  }, [activeTab, form, refreshPorts]);

  const handleSave = () => {
    const conn: SavedConn = {
      id: `conn-${Date.now()}`, name: localForm.name || `${localForm.host || localForm.serialPort || localForm.url}`,
      type: activeTab, host: localForm.host, port: localForm.port, username: localForm.username, password: localForm.password,
      serialPort: localForm.serialPort, baudRate: localForm.baudRate, url: localForm.url,
    };
    onSave(conn);
  };

  return (
    <div style={styles.modal} onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
        <h2 id="modal-title" style={styles.modalTitle}>New Connection</h2>

        <SimpleInput label="Name" icon={<Activity size={11} />} value={localForm.name} onChange={v => setLocalForm({ ...localForm, name: v })} placeholder="My Server" />

        {(activeTab === 'ssh' || activeTab === 'websocket') && (
          <>
            <SimpleInput label="Host" icon={<Globe size={11} />} value={localForm.host} onChange={v => setLocalForm({ ...localForm, host: v })} placeholder="192.168.1.100" />
            {activeTab === 'ssh' && <>
              <SimpleInput label="Port" icon={<Hash size={11} />} value={localForm.port} onChange={v => setLocalForm({ ...localForm, port: v })} placeholder="22" />
              <SimpleInput label="Username" icon={<Monitor size={11} />} value={localForm.username} onChange={v => setLocalForm({ ...localForm, username: v })} />
              <SimpleInput label="Password" icon={<Command size={11} />} type="password" value={localForm.password} onChange={v => setLocalForm({ ...localForm, password: v })} />
            </>}
            {activeTab === 'websocket' && <SimpleInput label="URL" icon={<Globe size={11} />} value={localForm.url} onChange={v => setLocalForm({ ...localForm, url: v })} placeholder="ws://localhost:8080" />}
          </>
        )}

        {activeTab === 'serial' && (
          <>
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: colors.textSecondary, display: 'flex', alignItems: 'center', gap: 6 }}><Cable size={11} style={{ opacity: 0.7, verticalAlign: 'middle' }} /> Port</div>
                <button
                  type="button"
                  title="Refresh ports"
                  onClick={refreshPorts}
                  disabled={refreshing}
                  style={{ width: 26, height: 26, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'none', border: `1px solid ${colors.border}`, borderRadius: 4, color: refreshing ? colors.textTertiary : colors.textSecondary }}
                >
                  <RefreshCw size={13} style={refreshing ? { animation: 'spin 1s linear infinite', verticalAlign: 'middle' } : { verticalAlign: 'middle' }} />
                </button>
              </div>
              <select
                id="serial-port-select"
                title="COM Port"
                value={localForm.serialPort}
                onChange={e => setLocalForm({ ...localForm, serialPort: e.target.value })}
                style={styles.select}
              >
                <option value="">Select...</option>
                {availableComPorts.map(port => (
                  <option key={port.path} value={port.path}>
                    {port.path}{port.manufacturer ? ` (${port.manufacturer})` : ''}
                    {port.serialNumber ? ` #${port.serialNumber}` : ''}
                  </option>
                ))}
              </select>
              {availableComPorts.length === 0 && (
                <div style={{ fontSize: 10, color: colors.textTertiary, marginTop: 4 }}>No COM ports found</div>
              )}
            </div>
            <SimpleInput label="Baud Rate" icon={<Hash size={11} />} value={localForm.baudRate} onChange={v => setLocalForm({ ...localForm, baudRate: v })} placeholder="115200" />
          </>
        )}

        <div style={styles.modalFooter}>
          <button type="button" style={styles.buttonSecondary} onClick={onClose}>Cancel</button>
          <button type="button" style={styles.buttonPrimary} onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  );
}

function SimpleInput({ label, value, onChange, placeholder, type = 'text', icon }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; icon?: React.ReactNode;
}) {
  const { theme, styles } = useTheme();
  const colors = theme.colors;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 500, color: colors.textSecondary, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>{icon && <span style={{ opacity: 0.7 }}>{icon}</span>}{label}</div>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={styles.input} />
    </div>
  );
}

function SimpleSelect({ label, value, onChange, options, icon }: {
  label: string; value: string; onChange: (v: string) => void; options: string[]; icon?: React.ReactNode;
}) {
  const { theme, styles } = useTheme();
  const colors = theme.colors;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 500, color: colors.textSecondary, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>{icon && <span style={{ opacity: 0.7 }}>{icon}</span>}{label}</div>
      <select aria-label={label} value={value} onChange={e => onChange(e.target.value)} style={styles.select}>
        <option value="">Select...</option>
        {options.map(port => <option key={port} value={port}>{port}</option>)}
      </select>
    </div>
  );
}

