/**
 * useSessionRegistry.ts — Global session registry (Map<tabId, TerminalSession>)
 *
 * Module-level singleton so sessions persist across component re-renders.
 * The hook wraps it with React state for reactive updates.
 */
import { useState, useCallback, useRef } from 'react';
import type { TerminalSession } from '../core/types.js';

/** Module-level singleton — survives React re-renders */
const globalSessionRegistry = new Map<string, TerminalSession>();

export function useSessionRegistry() {
  const [sessions, setSessions] = useState<Map<string, TerminalSession>>(globalSessionRegistry);

  const register = useCallback((session: TerminalSession) => {
    globalSessionRegistry.set(session.tabId, session);
    setSessions(new Map(globalSessionRegistry));
  }, []);

  const unregister = useCallback((tabId: string) => {
    globalSessionRegistry.delete(tabId);
    setSessions(new Map(globalSessionRegistry));
  }, []);

  const getSession = useCallback((tabId: string): TerminalSession | undefined => {
    return globalSessionRegistry.get(tabId);
  }, []);

  const hasSession = useCallback((tabId: string): boolean => {
    return globalSessionRegistry.has(tabId);
  }, []);

  const updateSession = useCallback((tabId: string, patch: Partial<TerminalSession>) => {
    const existing = globalSessionRegistry.get(tabId);
    if (!existing) return;
    const updated = { ...existing, ...patch };
    globalSessionRegistry.set(tabId, updated);
    setSessions(new Map(globalSessionRegistry));
  }, []);

  const clearAll = useCallback(() => {
    globalSessionRegistry.clear();
    setSessions(new Map(globalSessionRegistry));
  }, []);

  return {
    sessions,
    register,
    unregister,
    getSession,
    hasSession,
    updateSession,
    clearAll,
  };
}
