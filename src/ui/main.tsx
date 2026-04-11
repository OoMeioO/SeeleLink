import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ThemeProvider } from './themes';
import '@xterm/xterm/css/xterm.css';

// Global error handler
window.onerror = (msg, url, line, col, error) => {
  console.error('[GLOBAL ERROR]', msg, 'at line', line, col);
  return false;
};

window.onunhandledrejection = (event) => {
  console.error('[UNHANDLED REJECTION]', event.reason);
};

// Log helper
const log = (...args: unknown[]) => {
  console.log(...args);
  if (window.electronAPI?.consoleLog) {
    window.electronAPI.consoleLog(...args);
  }
};

log('[MAIN] Starting...');

const rootElement = document.getElementById('root');
if (!rootElement) {
  log('[MAIN] ERROR: root not found');
} else {
  log('[MAIN] Found root, rendering...');

  // P3-1: Migrate from deprecated ReactDOM.render to ReactDOM.createRoot
  try {
    const root = createRoot(rootElement);
    root.render(
      <ThemeProvider>
        <App />
      </ThemeProvider>
    );
    log('[MAIN] createRoot.render called');
  } catch (e) {
    log('[MAIN] RENDER ERROR:', e instanceof Error ? e.message : String(e));
  }
}
