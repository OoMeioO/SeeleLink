/**
 * Debug Service - Unified Debug Logging
 * 
 * Features:
 * - Multiple log levels (debug, info, warn, error)
 * - Service-based logging
 * - Log persistence and querying
 * - Export capabilities
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface DebugLogEntry {
  timestamp: number;
  level: LogLevel;
  service: string;
  action: string;
  params?: Record<string, unknown>;
  result?: unknown;
  duration?: number;
  error?: string;
  stack?: string;
}

export interface DebugFilter {
  level?: LogLevel;
  service?: string;
  since?: number;
  until?: number;
  limit?: number;
  search?: string;
}

export class DebugService {
  private logs: DebugLogEntry[] = [];
  private maxLogs: number = 10000;
  private currentLevel: LogLevel = 'debug';
  private listeners: Set<(entry: DebugLogEntry) => void> = new Set();
  
  private levelPriority: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };
  
  // ============================================
  // Configuration
  // ============================================
  
  setLevel(level: LogLevel): void {
    this.currentLevel = level;
  }
  
  getLevel(): LogLevel {
    return this.currentLevel;
  }
  
  clearLogs(): void {
    this.logs = [];
  }
  
  // ============================================
  // Logging Methods
  // ============================================
  
  debug(service: string, action: string, params?: Record<string, unknown>): void {
    this.log('debug', service, action, params);
  }
  
  info(service: string, action: string, params?: Record<string, unknown>): void {
    this.log('info', service, action, params);
  }
  
  warn(service: string, action: string, params?: Record<string, unknown>): void {
    this.log('warn', service, action, params);
  }
  
  error(service: string, action: string, error?: Error | string, stack?: string): void {
    const errorMsg = typeof error === 'string' ? error : error?.message || 'Unknown error';
    const errorStack = typeof error === 'string' ? undefined : error?.stack;
    this.log('error', service, action, { error: errorMsg }, undefined, errorStack || stack);
  }
  
  // Generic log with timing
  log(
    level: LogLevel,
    service: string,
    action: string,
    params?: Record<string, unknown>,
    duration?: number,
    stack?: string
  ): void {
    // Skip if below current level
    if (this.levelPriority[level] < this.levelPriority[this.currentLevel]) {
      return;
    }
    
    const entry: DebugLogEntry = {
      timestamp: Date.now(),
      level,
      service,
      action,
      params,
      duration,
      stack,
    };
    
    this.logs.push(entry);
    
    // Trim if over max
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
    
    // Notify listeners
    this.notifyListeners(entry);
    
    // Console output in development
    if (process.env.NODE_ENV !== 'production') {
      const time = new Date(entry.timestamp).toLocaleTimeString();
      const prefix = `[${time}] [${level.toUpperCase()}] [${service}]`;
      const message = `${action}${params ? ` ${JSON.stringify(params)}` : ''}`;
      
      switch (level) {
        case 'debug':
          console.debug(prefix, message);
          break;
        case 'info':
          console.info(prefix, message);
          break;
        case 'warn':
          console.warn(prefix, message);
          break;
        case 'error':
          console.error(prefix, message, stack || '');
          break;
      }
    }
  }
  
  // ============================================
  // Query Methods
  // ============================================
  
  getLogs(filter?: DebugFilter): DebugLogEntry[] {
    let result = [...this.logs];
    
    if (filter?.level) {
      result = result.filter(l => l.level === filter.level);
    }
    
    if (filter?.service) {
      result = result.filter(l => l.service === filter.service);
    }
    
    if (filter?.since) {
      result = result.filter(l => l.timestamp >= filter.since!);
    }
    
    if (filter?.until) {
      result = result.filter(l => l.timestamp <= filter.until!);
    }
    
    if (filter?.search) {
      const search = filter.search.toLowerCase();
      result = result.filter(l => 
        l.action.toLowerCase().includes(search) ||
        l.service.toLowerCase().includes(search) ||
        JSON.stringify(l.params).toLowerCase().includes(search)
      );
    }
    
    if (filter?.limit) {
      result = result.slice(-filter.limit);
    }
    
    return result;
  }
  
  getServices(): string[] {
    const services = new Set(this.logs.map(l => l.service));
    return Array.from(services).sort();
  }
  
  getStats(): Record<string, { total: number; byLevel: Record<LogLevel, number> }> {
    const stats: Record<string, { total: number; byLevel: Record<LogLevel, number> }> = {};
    
    for (const log of this.logs) {
      if (!stats[log.service]) {
        stats[log.service] = { total: 0, byLevel: { debug: 0, info: 0, warn: 0, error: 0 } };
      }
      stats[log.service].total++;
      stats[log.service].byLevel[log.level]++;
    }
    
    return stats;
  }
  
  // ============================================
  // Export Methods
  // ============================================
  
  exportJSON(): string {
    return JSON.stringify(this.logs, null, 2);
  }
  
  exportText(): string {
    return this.logs.map(l => {
      const time = new Date(l.timestamp).toISOString();
      const params = l.params ? ` ${JSON.stringify(l.params)}` : '';
      const error = l.error ? ` ERROR: ${l.error}` : '';
      return `[${time}] [${l.level.toUpperCase()}] [${l.service}] ${l.action}${params}${error}`;
    }).join('\n');
  }
  
  // ============================================
  // Listener Methods
  // ============================================
  
  addListener(callback: (entry: DebugLogEntry) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }
  
  private notifyListeners(entry: DebugLogEntry): void {
    for (const listener of this.listeners) {
      try {
        listener(entry);
      } catch (e) {
        console.error('Debug listener error:', e);
      }
    }
  }
  
  // ============================================
  // Timing Utilities
  // ============================================
  
  async time<T>(service: string, action: string, fn: () => Promise<T>, params?: Record<string, unknown>): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      const duration = Date.now() - start;
      this.log('info', service, action, { ...params, success: true }, duration);
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.error(service, action, error as Error);
      throw error;
    }
  }
  
  timeSync<T>(service: string, action: string, fn: () => T, params?: Record<string, unknown>): T {
    const start = Date.now();
    try {
      const result = fn();
      const duration = Date.now() - start;
      this.log('info', service, action, { ...params, success: true }, duration);
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.error(service, action, error as Error);
      throw error;
    }
  }
}

// Singleton export
export const debugService = new DebugService();
