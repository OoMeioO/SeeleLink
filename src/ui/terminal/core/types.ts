/**
 * types.ts — Core type definitions for the terminal module
 */

/** Full imperative handle exposed by TerminalCore via forwardRef + useImperativeHandle */
export interface TerminalHandle {
  write(data: string): void;
  clear(): void;
  focus(): void;
  resize(cols: number, rows: number): void;
  getAllText(): string;
  getVisibleText(): string;
  hasSelection(): boolean;
  getSelection(): string;
  copySelection(): void;
  paste(text: string): void;
  selectAll(): void;
  clearSelection(): void;
  getSize(): { cols: number; rows: number };
  scrollToBottom(): void;
}

/** Represents an active terminal session — owned by a single tab */
export interface TerminalSession {
  tabId: string;
  connId: string;
  connType: string;
  isConnected: boolean;
  handle: TerminalHandle;
}

/** Pure object returned by protocol adapters — no React dependency */
export interface ProtocolAdapter {
  send(data: string): void;
  disconnect(): void;
}

/** Props passed to each protocol adapter factory */
export interface ProtocolAdapterOptions {
  tabId: string;
  connId: string;
}
