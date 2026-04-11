/**
 * TerminalPanel.tsx — Mount-all terminal container
 *
 * Responsibilities:
 * - Render all TerminalCore instances simultaneously (CSS display controls visibility)
 * - Build per-tab protocol adapters (send function)
 * - Register typed IPC listeners (onSshData, onSerialData, etc.) keyed by connId
 * - Route incoming IPC data to the correct terminal handle
 */
import React, { useEffect, useRef, useCallback } from 'react';
import { TerminalCore } from '../core/TerminalCore.js';
import { createProtocolAdapter } from '../protocols/index.js';
import { electronAPI } from '../../electronAPI.js';
import type { TerminalHandle, ProtocolAdapter } from '../core/types.js';

export interface TerminalPanelTab {
  id: string;
  connId: string;
  conn: {
    id: string;
    type: string;
    name: string;
    host?: string;
    port?: string;
    username?: string;
    password?: string;
    serialPort?: string;
    baudRate?: string;
    url?: string;
  };
  isConnected: boolean;
}

export interface TerminalPanelProps {
  connTabs: TerminalPanelTab[];
  activeConnTabId: string | null;
  onTerminalReady?: (tabId: string, connId: string, connType: string) => void;
}

export function TerminalPanel({ connTabs, activeConnTabId, onTerminalReady }: TerminalPanelProps) {
  const handleMapRef   = useRef<Map<string, TerminalHandle>>(new Map());
  const adapterMapRef  = useRef<Map<string, ProtocolAdapter>>(new Map());
  const ipcReadyRef    = useRef<Set<string>>(new Set()); // connIds that have IPC listeners
  // P1-9 fix: use ref to always access latest connTabs (avoid stale closure)
  const connTabsRef    = useRef<TerminalPanelTab[]>(connTabs);
  connTabsRef.current = connTabs;

  // Build adapters for new tabs
  useEffect(() => {
    for (const tab of connTabs) {
      if (!adapterMapRef.current.has(tab.id)) {
        const adapter = createProtocolAdapter(tab.conn.type, { tabId: tab.id, connId: tab.connId });
        if (adapter) adapterMapRef.current.set(tab.id, adapter);
      }
    }
    // P1-8 fix: call disconnect() before removing adapter to clean up resources
    for (const tabId of [...adapterMapRef.current.keys()]) {
      if (!connTabs.find(t => t.id === tabId)) {
        const adapter = adapterMapRef.current.get(tabId);
        if (adapter && typeof adapter.disconnect === 'function') {
          try { adapter.disconnect(); } catch (e) { /* ignore */ }
        }
        adapterMapRef.current.delete(tabId);
      }
    }
  }, [connTabs]);

  // Register IPC listeners for new tabs (once per unique connId)
  useEffect(() => {
    for (const tab of connTabs) {
      const key = tab.connId;
      if (ipcReadyRef.current.has(key)) continue;
      ipcReadyRef.current.add(key);

      const writeToHandle = (data: string) => {
        for (const [tid, handle] of handleMapRef.current) {
          const t = connTabs.find(c => c.id === tid);
          if (t && t.connId === tab.connId) {
            handle.write(data);
          }
        }
      };

      switch (tab.conn.type) {
        case 'ssh':
          electronAPI.onSshData(tab.connId, writeToHandle);
          break;
        case 'powershell':
          // PSReadLine is disabled at startup — no input echo, data passes through directly
          electronAPI.onPsData(tab.connId, writeToHandle);
          electronAPI.onPsError(tab.connId, (data) => writeToHandle('[ERR] ' + data));
          break;
        case 'cmd':
          electronAPI.onCmdData(tab.connId, writeToHandle);
          break;
        case 'serial':
          electronAPI.onSerialData(tab.connId, writeToHandle);
          break;
        case 'websocket':
          electronAPI.onWsData(tab.connId, writeToHandle);
          break;
      }
    }
    // P1-12 fix: clean up ipcReadyRef entries for connIds no longer in use
    for (const key of [...ipcReadyRef.current]) {
      if (!connTabs.some(t => t.connId === key)) {
        ipcReadyRef.current.delete(key);
      }
    }
  }, [connTabs]);

  // Connect a tab and register its handle
  // P1-9 fix: use connTabsRef to avoid stale closure
  const handleOnReady = useCallback(async (tabId: string, handle: TerminalHandle) => {
    handleMapRef.current.set(tabId, handle);
    const tab = connTabsRef.current.find(t => t.id === tabId);
    if (!tab) return;

    if (!tab.isConnected) {
      const { connId, conn } = tab;
      try {
        switch (conn.type) {
          case 'ssh':
            await electronAPI.sshConnect({ connId, host: conn.host!, port: conn.port, username: conn.username!, password: conn.password! });
            break;
          case 'powershell':
            await electronAPI.psConnect(connId);
            break;
          case 'cmd':
            await electronAPI.cmdConnect(connId);
            await electronAPI.cmdReady(connId);
            break;
          case 'serial':
            await electronAPI.serialConnect({ connId, port: conn.serialPort!, baudRate: conn.baudRate! });
            break;
          case 'websocket':
            await electronAPI.wsConnect(connId, conn.url!);
            break;
        }
      } catch (e) {
        handle.write(`[Connection error: ${e}]\r\n`);
      }
    }

    onTerminalReady?.(tabId, tab.connId, tab.conn.type);
  }, [onTerminalReady]);

  // Wire xterm keystrokes → adapter.send()
  useEffect(() => {
    const sendInput = (tabId: string, data: string) => {
      const adapter = adapterMapRef.current.get(tabId);
      if (adapter) adapter.send(data);
    };
    (window as any).__terminalPanelInput = sendInput;
    return () => { delete (window as any).__terminalPanelInput; };
  }, [connTabs]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {connTabs.map((tab) => (
        <TerminalCore
          key={tab.id}
          tabId={tab.id}
          visible={tab.id === activeConnTabId}
          onReady={handleOnReady}
        />
      ))}
    </div>
  );
}
