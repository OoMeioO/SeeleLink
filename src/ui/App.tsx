import React, { useState, useEffect, useRef, useCallback } from 'react';
import '@xterm/xterm/css/xterm.css';

type TabType = 'ssh' | 'serial' | 'powershell' | 'websocket';

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
  term: any;
  containerRef: React.RefObject<HTMLDivElement>;
}

declare global {
  interface Window {
    electronAPI?: {
      psConnect: () => Promise<void>; psExecute: (cmd: string) => Promise<void>; psDisconnect: () => Promise<void>;
      onPsData: (callback: (data: string) => void) => void;
      onPsError: (callback: (data: string) => void) => void;
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

  const connectedRefs = useRef<Map<string, boolean>>(new Map());
  
  const activeTabData = connTabs.find(t => t.id === activeConnTabId);

  useEffect(() => { loadConnections(); }, []);

  useEffect(() => {
    if (activeTabData?.conn && window.electronAPI) {
      loadCommands(activeTabData.conn.id);
    }
  }, [activeTabData?.conn?.id]);

  const initTerminal = useCallback(async (tab: ConnectionTab) => {
    if (tab.term) return; // Already initialized
    
    const { Terminal } = await import('@xterm/xterm');
    const { FitAddon } = await import('@xterm/addon-fit');
    
    const term = new Terminal({ cursorBlink: true, fontSize: 14, fontFamily: 'monospace', theme: { background: '#0d0d0d', foreground: '#d4d4d4' }, rows: 24, cols: 80 });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    
    tab.term = term;
    connectedRefs.current.set(tab.id, tab.isConnected);
    
    // Handler reads from connectedRefs Map to avoid closure issues
    term.onData((data: string) => {
      const isConnected = connectedRefs.current.get(tab.id) || false;
      if (window.electronAPI && isConnected) {
        if (tab.conn.type === 'ssh') {
          window.electronAPI.sshExecute(tab.connId, data);
        } else if (tab.conn.type === 'serial') {
          window.electronAPI.serialExecute(tab.connId, data);
        }
      }
    });
    
    // Register data listeners
    if (tab.conn.type === 'ssh') {
      window.electronAPI?.onSshData(tab.connId, (data: string) => {
        if (tab.term) tab.term.write(data);
      });
    }
    
    setConnTabs(prev => prev.map(t => t.id === tab.id ? { ...t, term } : t));
  }, []);

  // Attach terminal to DOM when tab becomes active
  useEffect(() => {
    if (!activeTabData) return;
    
    const tab = activeTabData;
    const container = tab.containerRef.current;
    if (!container || !tab.term) return;
    
    // Check if terminal is already open in this container
    // If not, open it
    try {
      // xterm needs to be opened in the container
      if (!tab.term.element || tab.term.element.parentElement !== container) {
        tab.term.open(container);
      }
      tab.term.focus();
    } catch (e) {
      // Terminal might already be open elsewhere, try to focus instead
      try { tab.term.focus(); } catch (e2) {}
    }
  }, [activeConnTabId]);

  const loadConnections = async () => { if (window.electronAPI) setSavedConns(await window.electronAPI.loadConnections()); };
  const loadCommands = async (connId: string) => { if (window.electronAPI) setCommandButtons(await window.electronAPI.loadCommands(connId)); };
  const saveCommands = async (connId: string, commands: CommandButton[]) => { if (window.electronAPI) await window.electronAPI.saveCommands(connId, commands); };

  const openConnection = async (conn: SavedConn) => {
    // Always create a NEW tab for multi-instance support
    // Don't check for existing tabs with same connection
    
    const newTab: ConnectionTab = {
      id: `tab_${Date.now()}`,
      connId: `${conn.id}_${Date.now()}`, // Unique connection ID with timestamp
      conn,
      isConnected: false,
      term: null,
      containerRef: React.createRef<HTMLDivElement>(),
    };
    
    connectedRefs.current.set(newTab.id, false);
    setConnTabs(prev => [...prev, newTab]);
    setActiveConnTabId(newTab.id);
    
    // Initialize terminal async
    initTerminal(newTab);
  };

  const closeTab = async (tabId: string) => {
    const tab = connTabs.find(t => t.id === tabId);
    if (!tab) return;
    
    // Dispose terminal
    if (tab.term) {
      try { tab.term.dispose(); } catch (e) {}
    }
    
    if (tab.isConnected && window.electronAPI) {
      if (tab.conn.type === 'ssh') {
        await window.electronAPI.sshDisconnect(tab.connId); // connId is unique per tab instance
      } else if (tab.conn.type === 'powershell') {
        await window.electronAPI.psDisconnect();
      }
    }
    
    connectedRefs.current.delete(tabId);
    setConnTabs(prev => prev.filter(t => t.id !== tabId));
    if (activeConnTabId === tabId) {
      const remaining = connTabs.filter(t => t.id !== tabId);
      setActiveConnTabId(remaining.length > 0 ? remaining[remaining.length - 1].id : null);
    }
  };

  const handleConnect = async () => {
    if (!activeTabData || !window.electronAPI) return;
    const tab = activeTabData;
    
    if (tab.term) {
      tab.term.clear();
      tab.term.write('[Connecting...]\r\n');
    }
    
    try {
      if (tab.conn.type === 'ssh') {
        await window.electronAPI.sshConnect({
          connId: tab.connId,
          host: tab.conn.host || '',
          username: tab.conn.username || '',
          password: tab.conn.password || ''
        });
      } else if (tab.conn.type === 'powershell') {
        await window.electronAPI.psConnect();
      } else if (tab.conn.type === 'serial') {
        // Serial connection
        window.electronAPI.onSerialData(tab.connId, (data: string) => {
          if (tab.term) tab.term.write(data);
        });
        const result = await window.electronAPI.serialConnect({
          connId: tab.connId,
          port: tab.conn.serialPort || 'COM1',
          baudRate: tab.conn.baudRate || '115200'
        });
        if (result === 'port in use') {
          if (tab.term) tab.term.write('\r\n[Error] ' + tab.conn.serialPort + ' is already in use by another connection. Please disconnect the existing connection first.\r\n');
          return;
        }
      }
      connectedRefs.current.set(tab.id, true);
      setConnTabs(prev => prev.map(t => t.id === tab.id ? { ...t, isConnected: true } : t));
    } catch (e: any) {
      if (tab.term) tab.term.write('\r\n[Error] ' + e.message + '\r\n');
    }
  };

  const handleDisconnect = async () => {
    if (!activeTabData || !window.electronAPI) return;
    const tab = activeTabData;
    
    if (tab.conn.type === 'ssh') {
      await window.electronAPI.sshDisconnect(tab.connId);
    } else if (tab.conn.type === 'powershell') {
      await window.electronAPI.psDisconnect();
    } else if (tab.conn.type === 'serial') {
      await window.electronAPI.serialDisconnect(tab.connId);
    }
    
    connectedRefs.current.set(tab.id, false);
    if (tab.term) tab.term.write('\r\n[Disconnected]\r\n');
    setConnTabs(prev => prev.map(t => t.id === tab.id ? { ...t, isConnected: false } : t));
  };

  const handleButtonClick = async (button: CommandButton) => {
    if (!activeTabData || !window.electronAPI || !activeTabData.isConnected) return;
    for (const cmd of button.commands) {
      if (activeTabData.conn.type === 'ssh') {
        await window.electronAPI.sshExecute(activeTabData.connId, cmd + '\n');
      }
      await new Promise(r => setTimeout(r, 100));
    }
  };

  const handleSaveConn = async () => {
    if (!window.electronAPI) return;
    let id: string;
    if (activeTab === 'ssh') {
      id = `${form.host}-${form.username}`;
    } else if (activeTab === 'powershell') {
      id = 'local-powershell';
    } else if (activeTab === 'serial') {
      // For serial, use unique ID based on name + port + baudRate
      const name = form.name || `Serial on ${form.serialPort}`;
      id = `serial-${name}-${form.serialPort}-${form.baudRate}`;
    } else {
      id = `${form.url}`;
    }
    const conn: SavedConn = { 
      id, 
      name: form.name || (activeTab === 'ssh' ? `${form.host}` : activeTab === 'powershell' ? 'Local PowerShell' : activeTab === 'serial' ? `Serial on ${form.serialPort}` : form.url), 
      type: activeTab, 
      host: form.host, 
      port: form.port, 
      username: form.username, 
      password: form.password, 
      serialPort: form.serialPort, 
      baudRate: form.baudRate, 
      url: form.url 
    };
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
        <button style={activeTab === 'ssh' ? { ...styles.tab, ...styles.tabActive } : styles.tab} onClick={() => setActiveTab('ssh')}>🖥️ SSH</button>
        <button style={activeTab === 'serial' ? { ...styles.tab, ...styles.tabActive } : styles.tab} onClick={() => setActiveTab('serial')}>📡 SERIAL</button>
        <button style={activeTab === 'powershell' ? { ...styles.tab, ...styles.tabActive } : styles.tab} onClick={() => setActiveTab('powershell')}>💻 POWERSHELL</button>
        <button style={activeTab === 'websocket' ? { ...styles.tab, ...styles.tabActive } : styles.tab} onClick={() => setActiveTab('websocket')}>🌐 WEBSOCKET</button>
      </div>

      <div style={styles.main}>
        <div style={styles.sidebar}>
          <div style={styles.sidebarHeader}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>Connections</span>
            <button style={styles.addBtn} onClick={async () => { 
              if (activeTab === 'serial' && window.electronAPI) {
                const ports = await window.electronAPI.serialList();
                setAvailableComPorts(ports);
                setForm({ name: '', host: '', port: '22', username: '', password: '', serialPort: ports[0] || '', baudRate: '115200', url: 'ws://localhost:8080' });
              } else {
                setForm({ name: '', host: '', port: '22', username: '', password: '', serialPort: '', baudRate: '115200', url: 'ws://localhost:8080' });
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
                <button
                  key={tab.id}
                  style={{ ...styles.connTab, ...(activeConnTabId === tab.id ? styles.connTabActive : {}) }}
                  onClick={() => setActiveConnTabId(tab.id)}
                >
                  <span style={{ color: tab.isConnected ? '#4ade80' : '#ef4444' }}>●</span>
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
                <button style={{ ...styles.btn, backgroundColor: activeTabData.isConnected ? '#ef4444' : '#3b82f6' }} onClick={activeTabData.isConnected ? handleDisconnect : handleConnect}>
                  {activeTabData.isConnected ? 'Disconnect' : 'Connect'}
                </button>
              </div>
              
              {activeTabData.isConnected && (
                <div style={styles.cmdButtons}>
                  {commandButtons.map(btn => (
                    <button key={btn.id} style={{ backgroundColor: '#3d3d3d', border: 'none', borderRadius: 4, color: '#e5e5e5', padding: '4px 10px', fontSize: 12, cursor: 'pointer' }} onClick={() => handleButtonClick(btn)}>{btn.name}</button>
                  ))}
                  <button style={{ backgroundColor: '#3b82f6', border: 'none', borderRadius: 4, color: '#fff', padding: '4px 10px', fontSize: 12, cursor: 'pointer' }} onClick={() => { setEditingButton(null); setButtonForm({ name: '', commands: '' }); setShowCmdModal(true); }}>+ Add</button>
                </div>
              )}
              
              {/* Terminal container - render ALL tab containers, show only active */}
              <div style={styles.terminal}>
                {connTabs.map(tab => (
                  <div 
                    key={tab.id}
                    ref={tab.containerRef}
                    style={{ 
                      flex: 1, 
                      overflow: 'hidden',
                      display: tab.id === activeConnTabId ? 'flex' : 'none',
                      flexDirection: 'column'
                    }} 
                  />
                ))}
              </div>
            </>
          ) : (
            <div style={styles.noConn}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📡</div>
              <div style={{ color: '#888' }}>Click a connection to open it</div>
            </div>
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
                    <div style={{ ...styles.formGroup, width: 80 }}><label style={styles.label}>Port</label><input style={styles.input} value={form.port} onChange={e => setForm({...form, port: e.target.value})} /></div>
                  </div>
                  <div style={styles.formGroup}><label style={styles.label}>Username *</label><input style={styles.input} value={form.username} onChange={e => setForm({...form, username: e.target.value})} /></div>
                  <div style={styles.formGroup}><label style={styles.label}>Password</label><input style={styles.input} type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} /></div>
                </>
              )}
              {activeTab === 'serial' && (
                <>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Port</label>
                    <select 
                      style={styles.input} 
                      value={form.serialPort} 
                      onChange={e => setForm({...form, serialPort: e.target.value})}
                    >
                      <option value="">Select COM port...</option>
                      {availableComPorts.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                  <div style={styles.formGroup}><label style={styles.label}>Baud Rate</label><select style={styles.input} value={form.baudRate} onChange={e => setForm({...form, baudRate: e.target.value})}><option value="9600">9600</option><option value="115200">115200</option><option value="57600">57600</option><option value="38400">38400</option></select></div>
                </>
              )}
              {activeTab === 'websocket' && <div style={styles.formGroup}><label style={styles.label}>URL</label><input style={styles.input} value={form.url} onChange={e => setForm({...form, url: e.target.value})} placeholder="ws://localhost:8080" /></div>}
            </div>
            <div style={styles.modalFooter}>
              <button style={{ ...styles.btn, backgroundColor: '#666' }} onClick={() => setShowModal(false)}>Cancel</button>
              <button style={{ ...styles.btn, backgroundColor: '#22c55e' }} onClick={handleSaveConn}>Save</button>
            </div>
          </div>
        </div>
      )}

      {showCmdModal && (
        <div style={styles.modalOverlay} onClick={() => setShowCmdModal(false)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <span>Quick Command</span>
              <button style={styles.modalClose} onClick={() => setShowCmdModal(false)}>×</button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.formGroup}><label style={styles.label}>Button Name</label><input style={styles.input} value={buttonForm.name} onChange={e => setButtonForm({...buttonForm, name: e.target.value})} placeholder="ls" /></div>
              <div style={styles.formGroup}><label style={styles.label}>Commands (one per line)</label><textarea style={{ ...styles.input, height: 120, resize: 'vertical' }} value={buttonForm.commands} onChange={e => setButtonForm({...buttonForm, commands: e.target.value})} placeholder={"cd /data\nls -la"} /></div>
            </div>
            <div style={styles.modalFooter}>
              <button style={{ ...styles.btn, backgroundColor: '#666' }} onClick={() => setShowCmdModal(false)}>Cancel</button>
              <button style={{ ...styles.btn, backgroundColor: '#22c55e' }} onClick={handleSaveCommand}>{editingButton ? 'Update' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      <div style={styles.status}>
        <span>UTF-8</span><span>•</span><span>{activeTab.toUpperCase()}</span><span>•</span>
        <span style={{ color: activeTabData?.isConnected ? '#4ade80' : '#ef4444' }}>● {activeTabData?.isConnected ? 'Connected' : 'Disconnected'}</span>
        <span>•</span><span>{connTabs.length} tabs open</span>
      </div>
    </div>
  );
}
