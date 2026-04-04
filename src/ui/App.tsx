import React, { useState, useEffect, useRef, useCallback } from 'react';
import '@xterm/xterm/css/xterm.css';

type TabType = 'ssh' | 'serial' | 'powershell' | 'cmd' | 'websocket';

interface SavedConn {
  id: string; name: string; type: TabType;
  host?: string; port?: string; username?: string; password?: string;
  serialPort?: string; baudRate?: string; url?: string;
}

interface CommandButton {
  id: string; name: string; commands: string[];
}

interface ConnectionTab {
  id: string;
  connId: string;
  conn: SavedConn;
  isConnected: boolean;
  isInitializing?: boolean;
  term: any;
  fitAddon: any;
  containerRef: React.RefObject<HTMLDivElement>;
}

declare global {
  interface Window {
    electronAPI?: {
      psConnect: (connId: string) => Promise<void>; psExecute: (connId: string, cmd: string) => Promise<void>; psDisconnect: (connId: string) => Promise<void>;
      onPsData: (connId: string, callback: (data: string) => void) => void;
      onPsError: (connId: string, callback: (data: string) => void) => void;
      cmdConnect: (connId: string) => Promise<void>; cmdExecute: (connId: string, cmd: string) => Promise<void>; cmdDisconnect: (connId: string) => Promise<void>;
      onCmdData: (connId: string, callback: (data: string) => void) => void;
      sshConnect: (config: { connId: string; host: string; username: string; password?: string }) => Promise<void>;
      sshDisconnect: (connId: string) => Promise<void>; 
      sshExecute: (connId: string, cmd: string) => Promise<void>;
      onSshData: (connId: string, callback: (data: string) => void) => void;
      serialConnect: (config: { connId: string; port: string; baudRate: string }) => Promise<void>;
      serialDisconnect: (connId: string) => Promise<void>;
      serialExecute: (connId: string, data: string) => Promise<void>;
      onSerialData: (connId: string, callback: (data: string) => void) => void;
      serialList: () => Promise<string[]>;
      consoleLog: (...args: any[]) => void;
      saveConnection: (conn: SavedConn) => Promise<void>; loadConnections: () => Promise<SavedConn[]>;
      deleteConnection: (id: string) => Promise<void>;
      saveCommands: (connId: string, commands: CommandButton[]) => Promise<void>;
      loadCommands: (connId: string) => Promise<CommandButton[]>;
    };
  }
}

const styles = {
  container: { display: 'flex', flexDirection: 'column' as const, height: '100vh', backgroundColor: '#1e1e1e', color: '#e5e5e5', fontFamily: 'system-ui' },
  header: { padding: '10px 20px', backgroundColor: '#2d2d2d', borderBottom: '1px solid #404040', display: 'flex', alignItems: 'center', gap: 8, fontSize: 18, fontWeight: 600 },
  logo: { fontSize: 20 },
  tabBar: { display: 'flex', backgroundColor: '#252525', borderBottom: '1px solid #404040', padding: '0 12px' },
  tab: { display: 'flex', alignItems: 'center', padding: '10px 20px', backgroundColor: 'transparent', border: 'none', borderBottom: '2px solid transparent', color: '#888', cursor: 'pointer', fontSize: 14 },
  tabActive: { color: '#fff', borderBottomColor: '#3b82f6' },
  main: { display: 'flex', flex: 1, overflow: 'hidden' },
  sidebar: { width: 220, backgroundColor: '#252525', borderRight: '1px solid #404040', display: 'flex', flexDirection: 'column' as const },
  sidebarHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #333' },
  addBtn: { backgroundColor: '#3b82f6', border: 'none', borderRadius: 6, color: '#fff', padding: '4px 10px', fontSize: 12, cursor: 'pointer' },
  connList: { flex: 1, overflow: 'auto', padding: 8 },
  empty: { padding: 20, textAlign: 'center' as const, color: '#666', fontSize: 13 },
  connItem: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 8, cursor: 'pointer', marginBottom: 4 },
  connItemActive: { backgroundColor: '#3d3d3d' },
  connInfo: { flex: 1, minWidth: 0 },
  connName: { fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' },
  connDetail: { fontSize: 12, color: '#888', whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' },
  delBtn: { background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 18, padding: '0 4px' },
  content: { flex: 1, display: 'flex', flexDirection: 'column' as const, overflow: 'hidden' },
  panelHeader: { padding: '10px 16px', borderBottom: '1px solid #404040', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#2d2d2d' },
  btn: { padding: '6px 14px', borderRadius: 6, border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500 },
  noConn: { flex: 1, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center' },
  status: { padding: '6px 16px', backgroundColor: '#252525', borderTop: '1px solid #404040', display: 'flex', gap: 12, fontSize: 12, color: '#888' },
  modalOverlay: { position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modal: { backgroundColor: '#2d2d2d', borderRadius: 12, width: 420, maxHeight: '80vh', display: 'flex', flexDirection: 'column' as const, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' },
  modalHeader: { padding: '16px 20px', borderBottom: '1px solid #404040', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 600 },
  modalClose: { background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 20 },
  modalBody: { padding: 20, overflow: 'auto', display: 'flex', flexDirection: 'column' as const, gap: 16 },
  formGroup: { display: 'flex', flexDirection: 'column' as const, gap: 6 },
  formRow: { display: 'flex', gap: 12 },
  label: { fontSize: 13, color: '#888' },
  input: { padding: '10px 12px', backgroundColor: '#1e1e1e', border: '1px solid #404040', borderRadius: 8, color: '#e5e5e5', fontSize: 14, outline: 'none' },
  modalFooter: { padding: '16px 20px', borderTop: '1px solid #404040', display: 'flex', justifyContent: 'flex-end', gap: 12 },
  connTabBar: { display: 'flex', backgroundColor: '#1e1e1e', borderBottom: '1px solid #404040', overflow: 'auto' },
  connTab: { display: 'flex', alignItems: 'center', padding: '8px 16px', backgroundColor: '#252525', border: 'none', borderRight: '1px solid #333', color: '#888', cursor: 'pointer', fontSize: 13, gap: 8 },
  connTabActive: { backgroundColor: '#2d2d2d', color: '#fff' },
  connTabClose: { background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 14, padding: '0 4px', marginLeft: 4 },
  terminal: { flex: 1, backgroundColor: '#0d0d0d', padding: 8, overflow: 'hidden', cursor: 'text', display: 'flex', flexDirection: 'column' as const },
  cmdButtons: { backgroundColor: '#252525', borderBottom: '1px solid #404040', padding: '8px 12px', display: 'flex', gap: 6, flexWrap: 'wrap' as const },
};

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('ssh');
  const [savedConns, setSavedConns] = useState<SavedConn[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', host: '', port: '22', username: '', password: '', serialPort: '', baudRate: '115200', url: 'ws://localhost:8080' });
  const [availableComPorts, setAvailableComPorts] = useState<string[]>([]);
  
  const [connTabs, setConnTabs] = useState<ConnectionTab[]>([]);
  const [activeConnTabId, setActiveConnTabId] = useState<string | null>(null);
  const [commandButtons, setCommandButtons] = useState<CommandButton[]>([]);
  const [showCmdModal, setShowCmdModal] = useState(false);
  const [editingButton, setEditingButton] = useState<CommandButton | null>(null);
  const [buttonForm, setButtonForm] = useState({ name: '', commands: '' });
  
  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; visible: boolean }>({ x: 0, y: 0, visible: false });

  // Use refs to avoid stale closure issues
  const connectedRefs = useRef<Map<string, boolean>>(new Map());
  const connTabsRef = useRef(connTabs);
  const initRef = useRef<Set<string>>(new Set());
  
  // Keep connTabsRef in sync
  useEffect(() => {
    connTabsRef.current = connTabs;
  }, [connTabs]);

  const activeTabData = connTabs.find(t => t.id === activeConnTabId);

  useEffect(() => { loadConnections(); }, []);

  useEffect(() => {
    if (activeTabData?.conn && window.electronAPI) {
      loadCommands(activeTabData.conn.id);
    }
  }, [activeTabData?.conn?.id]);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClick = () => setContextMenu(prev => ({ ...prev, visible: false }));
    if (contextMenu.visible) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [contextMenu.visible]);

  // Handle Ctrl+Shift+C for copy
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'C') {
        const selection = window.getSelection()?.toString() || '';
        if (selection && activeTabData?.term) {
          navigator.clipboard.writeText(selection);
          e.preventDefault();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [activeTabData]);

  // Context menu handler for terminal
  const handleTerminalContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    // Get selection from xterm
    const selection = activeTabData?.term?.getSelection?.() || '';
    if (selection) {
      setContextMenu({ x: e.clientX, y: e.clientY, visible: true });
    }
  };

  const handleCopySelection = () => {
    const selection = activeTabData?.term?.getSelection?.() || '';
    if (selection) {
      navigator.clipboard.writeText(selection);
    }
    setContextMenu(prev => ({ ...prev, visible: false }));
  };

  const initTerminal = useCallback(async (tab: ConnectionTab) => {
    const tabId = tab.id;
    if (initRef.current.has(tabId)) return; // Already initializing
    if (tab.term) return; // Already has terminal
    initRef.current.add(tabId);
    
    const container = tab.containerRef?.current;
    if (!container) {
      initRef.current.delete(tabId);
      return;
    }
    
    try {
      const { Terminal } = await import('@xterm/xterm');
      const { FitAddon } = await import('@xterm/addon-fit');
      
      const term = new Terminal({ 
        cursorBlink: true, 
        fontSize: 14, 
        fontFamily: 'Consolas, monospace', 
        theme: { background: '#0d0d0d', foreground: '#d4d4d4' }, 
        allowTransparency: false,
        cursorStyle: 'block',
        cursorInactiveStyle: 'blink',
        bellStyle: 'none',
        enableBold: true,
        drawBoldTextInBrightColors: true,
        convertEol: true,
        windowsMode: true,
      });
      
      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      
      // Update the tab in state with term and fitAddon
      setConnTabs(prev => prev.map(t => t.id === tabId ? { ...t, term, fitAddon } : t));
      connectedRefs.current.set(tabId, tab.isConnected);
      
      // PowerShell input - pass keystrokes directly to PTY backend
      term.onData((data: string) => {
        const isConnected = connectedRefs.current.get(tabId) || false;
        if (window.electronAPI && isConnected) {
          if (tab.conn.type === 'ssh') {
            window.electronAPI.sshExecute(tab.connId, data);
          } else if (tab.conn.type === 'serial') {
            window.electronAPI.serialExecute(tab.connId, data);
          } else if (tab.conn.type === 'powershell') {
            // Direct passthrough to PTY
            window.electronAPI.psExecute(tab.connId, data);
          } else if (tab.conn.type === 'cmd') {
            // Direct passthrough to PTY
            window.electronAPI.cmdExecute(tab.connId, data);
          }
        }
      });
      
      if (tab.conn.type === 'ssh') {
        window.electronAPI?.onSshData(tab.connId, (data: string) => { if (term) term.write(data); });
      }
      
      term.open(container);
      fitAddon.fit();
      term.focus();
      
    } catch (e) {
      console.error('Terminal init error:', e);
      initRef.current.delete(tabId);
    }
  }, []);

  // Initialize terminal when active tab changes
  useEffect(() => {
    if (activeConnTabId) {
      const tab = connTabs.find(t => t.id === activeConnTabId);
      if (tab) {
        initTerminal(tab);
      }
    }
  }, [activeConnTabId, initTerminal, connTabs]);

  const loadConnections = async () => { if (window.electronAPI) setSavedConns(await window.electronAPI.loadConnections()); };
  const loadCommands = async (connId: string) => { if (window.electronAPI) setCommandButtons(await window.electronAPI.loadCommands(connId)); };
  const saveCommands = async (connId: string, commands: CommandButton[]) => { if (window.electronAPI) await window.electronAPI.saveCommands(connId, commands); };

  const openConnection = async (conn: SavedConn) => {
    const newTab: ConnectionTab = {
      id: `tab_${Date.now()}`,
      connId: `${conn.id}_${Date.now()}`,
      conn,
      isConnected: false,
      term: null,
      fitAddon: null,
      containerRef: React.createRef<HTMLDivElement>(),
    };
    
    connectedRefs.current.set(newTab.id, false);
    setConnTabs(prev => [...prev, newTab]);
    setActiveConnTabId(newTab.id);
  };

  const closeTab = async (tabId: string) => {
    const tab = connTabsRef.current.find(t => t.id === tabId);
    if (!tab) return;
    
    if (tab.term) {
      try { tab.term.dispose(); } catch (e) {}
    }
    initRef.current.delete(tabId);
    
    if (tab.isConnected && window.electronAPI) {
      if (tab.conn.type === 'ssh') await window.electronAPI.sshDisconnect(tab.connId);
      else if (tab.conn.type === 'powershell') await window.electronAPI.psDisconnect(tab.connId);
      else if (tab.conn.type === 'serial') await window.electronAPI.serialDisconnect(tab.connId);
    }
    
    connectedRefs.current.delete(tabId);
    setConnTabs(prev => prev.filter(t => t.id !== tabId));
    const remaining = connTabsRef.current.filter(t => t.id !== tabId);
    setActiveConnTabId(remaining.length > 0 ? remaining[remaining.length - 1].id : null);
  };

  const handleConnect = useCallback(async () => {
    if (!activeTabData || !window.electronAPI) return;
    const tab = activeTabData;
    
    if (tab.term) {
      tab.term.clear();
      tab.term.write('[Connecting...]\r\n');
    }
    
    try {
      if (tab.conn.type === 'ssh') {
        window.electronAPI.onSshData(tab.connId, (data: string) => {
          const currentTab = connTabsRef.current.find(t => t.id === tab.id);
          if (currentTab?.term) currentTab.term.write(data);
        });
        await window.electronAPI.sshConnect({ connId: tab.connId, host: tab.conn.host || '', username: tab.conn.username || '', password: tab.conn.password || '' });
      } else if (tab.conn.type === 'powershell') {
        // Register listeners BEFORE connect
        window.electronAPI.onPsData(tab.connId, (data: string) => {
          const currentTab = connTabsRef.current.find(t => t.id === tab.id);
          if (currentTab?.term) {
            // For PowerShell: remove backspace and bell characters that cause display issues
            // but let xterm handle ANSI colors and cursor positioning
            const clean = data
              .replace(/\x08/g, '') // Remove backspace
              .replace(/\x07/g, ''); // Remove bell
            currentTab.term.write(clean);
            // Auto-scroll to bottom
            currentTab.term.scrollToBottom();
          }
        });
        window.electronAPI.onPsError(tab.connId, (data: string) => {
          const currentTab = connTabsRef.current.find(t => t.id === tab.id);
          if (currentTab?.term) currentTab.term.write('[ERR] ' + data);
        });
        await window.electronAPI.psConnect(tab.connId);
      } else if (tab.conn.type === 'cmd') {
        window.electronAPI.onCmdData(tab.connId, (data: string) => {
          const currentTab = connTabsRef.current.find(t => t.id === tab.id);
          if (currentTab?.term) {
            const clean = data.replace(/\x08/g, '').replace(/\x07/g, '');
            currentTab.term.write(clean);
            currentTab.term.scrollToBottom();
          }
        });
        await window.electronAPI.cmdConnect(tab.connId);
      } else if (tab.conn.type === 'serial') {
        window.electronAPI.onSerialData(tab.connId, (data: string) => {
          const currentTab = connTabsRef.current.find(t => t.id === tab.id);
          if (currentTab?.term) currentTab.term.write(data);
        });
        const result = await window.electronAPI.serialConnect({ connId: tab.connId, port: tab.conn.serialPort || 'COM1', baudRate: tab.conn.baudRate || '115200' });
        if (result === 'port in use') {
          if (tab.term) tab.term.write('\r\n[Error] ' + tab.conn.serialPort + ' is already in use\r\n');
          return;
        }
      }
      connectedRefs.current.set(tab.id, true);
      setConnTabs(prev => prev.map(t => t.id === tab.id ? { ...t, isConnected: true } : t));
    } catch (e: any) {
      if (tab.term) tab.term.write('\r\n[Error] ' + e.message + '\r\n');
    }
  }, [activeTabData]);

  const handleDisconnect = useCallback(async () => {
    if (!activeTabData || !window.electronAPI) return;
    const tab = activeTabData;
    
    if (tab.conn.type === 'ssh') await window.electronAPI.sshDisconnect(tab.connId);
    else if (tab.conn.type === 'powershell') await window.electronAPI.psDisconnect(tab.connId);
    else if (tab.conn.type === 'cmd') await window.electronAPI.cmdDisconnect(tab.connId);
    else if (tab.conn.type === 'serial') await window.electronAPI.serialDisconnect(tab.connId);
    
    connectedRefs.current.set(tab.id, false);
    if (tab.term) tab.term.write('\r\n[Disconnected]\r\n');
    setConnTabs(prev => prev.map(t => t.id === tab.id ? { ...t, isConnected: false } : t));
  }, [activeTabData]);

  const handleButtonClick = async (button: CommandButton) => {
    if (!activeTabData || !window.electronAPI || !activeTabData.isConnected) return;
    for (const cmd of button.commands) {
      if (activeTabData.conn.type === 'ssh') await window.electronAPI.sshExecute(activeTabData.connId, cmd + '\n');
      else if (activeTabData.conn.type === 'powershell') await window.electronAPI.psExecute(activeTabData.connId, cmd + '\n');
      await new Promise(r => setTimeout(r, 100));
    }
  };

  const handleSaveConn = async () => {
    if (!window.electronAPI) return;
    let id: string;
    if (activeTab === 'ssh') id = `${form.host}-${form.username}`;
    else if (activeTab === 'powershell') id = 'local-powershell';
    else if (activeTab === 'serial') id = `serial-${form.name || 'untitled'}-${form.serialPort}-${form.baudRate}`;
    else id = form.url;
    
    const conn: SavedConn = { id, name: form.name || (activeTab === 'ssh' ? form.host : activeTab === 'serial' ? `Serial on ${form.serialPort}` : form.url), type: activeTab, host: form.host, port: form.port, username: form.username, password: form.password, serialPort: form.serialPort, baudRate: form.baudRate, url: form.url };
    await window.electronAPI.saveConnection(conn);
    await loadConnections();
    setShowModal(false);
  };

  const handleSaveCommand = async () => {
    const commands = buttonForm.commands.split('\n').filter(c => c.trim());
    if (!commands.length || !buttonForm.name.trim() || !activeTabData) return;
    const newButton: CommandButton = { id: editingButton?.id || `btn_${Date.now()}`, name: buttonForm.name, commands };
    let updated = editingButton ? commandButtons.map(b => b.id === editingButton.id ? newButton : b) : [...commandButtons, newButton];
    setCommandButtons(updated);
    await saveCommands(activeTabData.conn.id, updated);
    setShowCmdModal(false);
  };

  const handleDeleteCommand = async (id: string) => {
    if (!activeTabData) return;
    const updated = commandButtons.filter(b => b.id !== id);
    setCommandButtons(updated);
    await saveCommands(activeTabData.conn.id, updated);
  };

  const filterConns = savedConns.filter(c => c.type === activeTab);

  return (
    <div style={styles.container}>
      <div style={styles.header}><span style={styles.logo}>⚡</span><span>SeeleLink</span></div>
      
      <div style={styles.tabBar}>
        {(['ssh', 'serial', 'powershell', 'cmd', 'websocket'] as TabType[]).map(t => (
          <button key={t} style={activeTab === t ? { ...styles.tab, ...styles.tabActive } : styles.tab} onClick={() => { setActiveTab(t); setActiveConnTabId(null); }}>{t === 'ssh' && '🖥️'} {t === 'serial' && '📡'} {t === 'powershell' && '💻'} {t === 'cmd' && '📝'} {t === 'websocket' && '🌐'} <span style={{marginLeft: 6}}>{t.toUpperCase()}</span></button>
        ))}
      </div>

      <div style={styles.main}>
        <div style={styles.sidebar}>
          <div style={styles.sidebarHeader}>
            <span style={{fontWeight: 600, fontSize: 13}}>Connections</span>
            <button style={styles.addBtn} onClick={async () => {
              if (activeTab === 'serial' && window.electronAPI) {
                const ports = await window.electronAPI.serialList();
                setAvailableComPorts(ports);
                setForm({...form, serialPort: ports[0] || ''});
              }
              setShowModal(true);
            }}>+ New</button>
          </div>
          <div style={styles.connList}>
            {filterConns.length === 0 && <div style={styles.empty}>No saved connections</div>}
            {filterConns.map(c => (
              <div key={c.id} style={styles.connItem} onClick={() => openConnection(c)}>
                <div style={styles.connInfo}>
                  <div style={styles.connName}>{c.name}</div>
                  <div style={styles.connDetail}>{c.type === 'ssh' && `${c.host}:${c.port}`}{c.type === 'powershell' && 'Local'}{c.type === 'serial' && `${c.serialPort} @ ${c.baudRate}`}{c.type === 'websocket' && c.url}</div>
                </div>
                <button style={styles.delBtn} onClick={(e) => { e.stopPropagation(); window.electronAPI?.deleteConnection(c.id).then(loadConnections); }}>×</button>
              </div>
            ))}
          </div>
        </div>

        <div style={styles.content}>
          {connTabs.length > 0 && (
            <div style={styles.connTabBar}>
              {connTabs.map(tab => (
                <button key={tab.id} style={activeConnTabId === tab.id ? {...styles.connTab, ...styles.connTabActive} : styles.connTab} onClick={() => setActiveConnTabId(tab.id)}>
                  <span style={{color: tab.isConnected ? '#4ade80' : '#ef4444'}}>●</span>
                  <span>{tab.conn.name}</span>
                  <button style={styles.connTabClose} onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}>×</button>
                </button>
              ))}
            </div>
          )}

          {activeTabData ? (
            <>
              <div style={styles.panelHeader}>
                <span>{activeTabData.conn.name}</span>
                <button style={{...styles.btn, backgroundColor: activeTabData.isConnected ? '#ef4444' : '#3b82f6'}} onClick={activeTabData.isConnected ? handleDisconnect : handleConnect}>
                  {activeTabData.isConnected ? 'Disconnect' : 'Connect'}
                </button>
              </div>
              
              {activeTabData.isConnected && (
                <div style={styles.cmdButtons}>
                  {commandButtons.map(btn => (
                    <button key={btn.id} style={{backgroundColor: '#3d3d3d', border: 'none', borderRadius: 4, color: '#e5e5e5', padding: '4px 10px', fontSize: 12, cursor: 'pointer'}} onClick={() => handleButtonClick(btn)}>{btn.name}</button>
                  ))}
                  <button style={{backgroundColor: '#3b82f6', border: 'none', borderRadius: 4, color: '#fff', padding: '4px 10px', fontSize: 12, cursor: 'pointer'}} onClick={() => { setEditingButton(null); setButtonForm({name: '', commands: ''}); setShowCmdModal(true); }}>+ Add</button>
                </div>
              )}
              
              <div style={styles.terminal} onContextMenu={handleTerminalContextMenu}>
                {connTabs.map(tab => (
                  <div key={tab.id} ref={el => { if (el && tab.containerRef) (tab.containerRef as any).current = el; }} style={{flex: 1, overflow: 'hidden', display: tab.id === activeConnTabId ? 'flex' : 'none', flexDirection: 'column'}} />
                ))}
                {contextMenu.visible && (
                  <div style={{
                    position: 'fixed',
                    left: contextMenu.x,
                    top: contextMenu.y,
                    backgroundColor: '#2d2d2d',
                    border: '1px solid #404040',
                    borderRadius: 6,
                    padding: '4px 0',
                    zIndex: 1000,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                  }}>
                    <button
                      onClick={handleCopySelection}
                      style={{
                        display: 'block',
                        width: '100%',
                        padding: '8px 16px',
                        background: 'none',
                        border: 'none',
                        color: '#e5e5e5',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontSize: 13,
                      }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#3d3d3d')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      📋 Copy
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div style={styles.noConn}><div style={{fontSize: 48, marginBottom: 16}}>📡</div><div style={{color: '#888'}}>Click a connection to open it</div></div>
          )}
        </div>
      </div>

      {showModal && (
        <div style={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <span>New {activeTab.toUpperCase()} Connection</span>
              <button style={styles.modalClose} onClick={() => setShowModal(false)}>×</button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.formGroup}><label style={styles.label}>Name</label><input style={styles.input} value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="My Server" /></div>
              {activeTab === 'ssh' && (
                <>
                  <div style={styles.formRow}>
                    <div style={styles.formGroup}><label style={styles.label}>Host *</label><input style={styles.input} value={form.host} onChange={e => setForm({...form, host: e.target.value})} placeholder="10.18.224.177" /></div>
                    <div style={{...styles.formGroup, width: 80}}><label style={styles.label}>Port</label><input style={styles.input} value={form.port} onChange={e => setForm({...form, port: e.target.value})} /></div>
                  </div>
                  <div style={styles.formGroup}><label style={styles.label}>Username *</label><input style={styles.input} value={form.username} onChange={e => setForm({...form, username: e.target.value})} /></div>
                  <div style={styles.formGroup}><label style={styles.label}>Password</label><input style={styles.input} type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} /></div>
                </>
              )}
              {activeTab === 'serial' && (
                <>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Port</label>
                    <select style={styles.input} value={form.serialPort} onChange={e => setForm({...form, serialPort: e.target.value})}>
                      <option value="">Select COM port...</option>
                      {availableComPorts.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div style={styles.formGroup}><label style={styles.label}>Baud Rate</label>
                    <select style={styles.input} value={form.baudRate} onChange={e => setForm({...form, baudRate: e.target.value})}>
                      <option value="9600">9600</option><option value="115200">115200</option><option value="57600">57600</option><option value="38400">38400</option><option value="256000">256000</option>
                    </select>
                  </div>
                </>
              )}
              {activeTab === 'websocket' && <div style={styles.formGroup}><label style={styles.label}>URL</label><input style={styles.input} value={form.url} onChange={e => setForm({...form, url: e.target.value})} placeholder="ws://localhost:8080" /></div>}
            </div>
            <div style={styles.modalFooter}>
              <button style={{...styles.btn, backgroundColor: '#666'}} onClick={() => setShowModal(false)}>Cancel</button>
              <button style={{...styles.btn, backgroundColor: '#22c55e'}} onClick={handleSaveConn}>Save</button>
            </div>
          </div>
        </div>
      )}

      {showCmdModal && (
        <div style={styles.modalOverlay} onClick={() => setShowCmdModal(false)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}><span>Quick Command</span><button style={styles.modalClose} onClick={() => setShowCmdModal(false)}>×</button></div>
            <div style={styles.modalBody}>
              <div style={styles.formGroup}><label style={styles.label}>Button Name</label><input style={styles.input} value={buttonForm.name} onChange={e => setButtonForm({...buttonForm, name: e.target.value})} placeholder="ls" /></div>
              <div style={styles.formGroup}><label style={styles.label}>Commands (one per line)</label><textarea style={{...styles.input, height: 120, resize: 'vertical'}} value={buttonForm.commands} onChange={e => setButtonForm({...buttonForm, commands: e.target.value})} placeholder={"cd /data\nls -la"} /></div>
            </div>
            <div style={styles.modalFooter}>
              <button style={{...styles.btn, backgroundColor: '#666'}} onClick={() => setShowCmdModal(false)}>Cancel</button>
              <button style={{...styles.btn, backgroundColor: '#22c55e'}} onClick={handleSaveCommand}>{editingButton ? 'Update' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      <div style={styles.status}>
        <span>UTF-8</span><span>•</span><span>{activeTab.toUpperCase()}</span><span>•</span>
        <span style={{color: activeTabData?.isConnected ? '#4ade80' : '#ef4444'}}>● {activeTabData?.isConnected ? 'Connected' : 'Disconnected'}</span>
        <span>•</span><span>{connTabs.length} tabs</span>
      </div>
    </div>
  );
}
