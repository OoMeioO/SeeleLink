/**
 * TerminalCore.tsx — Minimal xterm wrapper with theme awareness and full handle
 *
 * Exposes TerminalHandle via forwardRef + useImperativeHandle.
 * Uses CSS display (not visibility) for show/hide — visible=false → display:none.
 * Registers onReady once on mount (empty deps array), never on re-renders.
 */
import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { Terminal as XTerminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import type { TerminalHandle } from './types.js';
import { useTerminalTheme } from './useTerminalTheme.js';

interface TerminalCoreProps {
  tabId: string;
  visible?: boolean;
  /** Called once after xterm.open() — caller uses handle to write/receive data */
  onReady?: (tabId: string, handle: TerminalHandle) => void;
}

export const TerminalCore = forwardRef<TerminalHandle, TerminalCoreProps>(
  ({ tabId, visible = true, onReady }, _ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const termRef      = useRef<XTerminal | null>(null);
    const fitRef       = useRef<FitAddon | null>(null);
    const initedRef    = useRef(false);
    const xtermTheme   = useTerminalTheme();
    // P3-8: per-menu cleanup handles to prevent timer/eventListener leaks
    const menuCleanupRef = useRef<{
      timeoutId: number; outsideListener: ((ev: MouseEvent) => void) | null; keyListener: ((ev: KeyboardEvent) => void) | null;
    }>({ timeoutId: 0, outsideListener: null, keyListener: null });

    // Initialize xterm — runs once per tabId (empty deps)
    useEffect(() => {
      if (!containerRef.current || initedRef.current) return;

      // Ensure xterm modules are loaded
      if (typeof XTerminal === 'undefined' || typeof FitAddon === 'undefined') {
        console.error('[Terminal] xterm modules not loaded, retrying...');
        initedRef.current = false;
        return;
      }

      initedRef.current = true;

      let term;
      try {
        term = new XTerminal({
          cursorBlink: true,
          fontSize: 14,
          fontFamily: '"Cascadia Code", "Fira Code", Consolas, "Microsoft YaHei", monospace',
          theme: xtermTheme,
          cursorStyle: 'block',
          bellStyle: 'none',
          scrollback: 10000,
        });
      } catch (e) {
        console.error('[Terminal] Failed to create terminal:', e);
        initedRef.current = false;
        return;
      }

      const fit = new FitAddon();
      term.loadAddon(fit);
      term.open(containerRef.current);

      // Right-click context menu: copy / paste / select all
      containerRef.current.addEventListener('contextmenu', (e: MouseEvent) => {
        e.preventDefault();
        const selection = term.getSelection();
        const { clientX: x, clientY: y } = e;

        const menu = document.createElement('div');
        menu.style.cssText = [
          'position:fixed',
          `left:${x}px`,
          `top:${y}px`,
          'background:#2d2d2f',
          'border:1px solid #4e4e4e',
          'border-radius:6px',
          'padding:4px 0',
          'z-index:99999',
          'font-family:system-ui,sans-serif',
          'font-size:13px',
          'color:#e5e5e5',
          'min-width:140px',
          'box-shadow:0 4px 12px rgba(0,0,0,0.4)',
        ].join(';');

        const items = [
          {
            label: 'Copy',
            enabled: !!selection,
            action: () => { if (selection) { navigator.clipboard.writeText(selection); term.clearSelection(); } },
          },
          {
            label: 'Paste',
            enabled: true,
            action: () => {
              navigator.clipboard.readText().then(text => { if (text) term.paste(text); });
            },
          },
          { label: '', divider: true },
          {
            label: 'Select All',
            enabled: true,
            action: () => term.selectAll(),
          },
        ];

        items.forEach(item => {
          if (item.divider) {
            const sep = document.createElement('div');
            sep.style.cssText = 'height:1px;background:#4e4e4e;margin:4px 8px';
            menu.appendChild(sep);
            return;
          }
          const btn = document.createElement('div');
          btn.textContent = item.label;
          btn.style.cssText = [
            'padding:6px 16px',
            'cursor:pointer',
            'transition:background 0.1s',
            item.enabled ? '' : 'opacity:0.4;cursor:default',
          ].join(';');
          if (item.enabled) {
            btn.addEventListener('mouseenter', () => { btn.style.background = '#3d3d40'; });
            btn.addEventListener('mouseleave', () => { btn.style.background = 'transparent'; });
          }
          btn.addEventListener('click', () => {
            item.action();
            closeMenu();
          });
          menu.appendChild(btn);
        });

        const closeMenu = () => {
          if (!document.body.contains(menu)) return;
          menu.remove();
          if (menuCleanupRef.current.timeoutId) { clearTimeout(menuCleanupRef.current.timeoutId); menuCleanupRef.current.timeoutId = 0; }
          if (menuCleanupRef.current.outsideListener) { document.removeEventListener('mousedown', menuCleanupRef.current.outsideListener); menuCleanupRef.current.outsideListener = null; }
          if (menuCleanupRef.current.keyListener) { document.removeEventListener('keydown', menuCleanupRef.current.keyListener); menuCleanupRef.current.keyListener = null; }
        };

        // Close on outside click or Escape
        menuCleanupRef.current.outsideListener = (ev: MouseEvent) => {
          if (!menu.contains(ev.target as Node)) closeMenu();
        };
        menuCleanupRef.current.keyListener = (ev: KeyboardEvent) => { if (ev.key === 'Escape') closeMenu(); };
        document.addEventListener('mousedown', menuCleanupRef.current.outsideListener);
        document.addEventListener('keydown', menuCleanupRef.current.keyListener);

        // Auto-close after 10s
        menuCleanupRef.current.timeoutId = window.setTimeout(closeMenu, 10000);

        document.body.appendChild(menu);
      });

      // Fit after DOM paint
      requestAnimationFrame(() => requestAnimationFrame(() => {
        try { fit.fit(); term.focus(); } catch { /* container may be hidden */ }
      }));

      termRef.current = term;
      fitRef.current  = fit;

      // Handle user keyboard input — route to panel
      term.onData((data: string) => {
        // Strip ALL ConPTY/VT100 focus tracking sequences.
        // CSI sequences starting with ESC[ that end in I (focus-in) or O (focus-out)
        // must NOT be sent to the shell backend — they are terminal-local events.
        if (data.startsWith('\x1b[') && (data.endsWith('I') || data.endsWith('O'))) return;
        // VT100 two-byte focus sequences (ESC I = INDEX, ESC O = RI)
        if (data === '\x1bI' || data === '\x1bO') return;
        // Bracketed paste mode enable/disable (ConPTY enables this for PowerShell)
        if (data === '\x1b[?2026h' || data === '\x1b[?2026l') return;
        // Any lone ESC[ — partial CSI prefix that leaked through
        if (data === '\x1b[') return;
        // Route to panel
        const sendInput = (window as any).__terminalPanelInput;
        if (sendInput) sendInput(tabId, data);
      });

      // ResizeObserver for visible containers
      const ro = new ResizeObserver(() => {
        if (containerRef.current && containerRef.current.style.display !== 'none') {
          try { fit.fit(); } catch { /* ignore */ }
        }
      });
      ro.observe(containerRef.current);

      // Build the handle
      const handle: TerminalHandle = {
        write:         (data) => { try { term?.write(data); } catch (e) { console.error('[Terminal] write error:', e); } },
        clear:         ()    => { try { term?.clear(); } catch { /* ignore */ } },
        focus:         ()    => { try { term?.focus(); } catch { /* ignore */ } },
        resize:        ()    => { try { fit?.fit(); } catch { /* ignore */ } },
        getAllText:    ()    => { try { return term?.buffer?.active?.getLine(0)?.translateToString(true) ?? ''; } catch { return ''; } },
        getVisibleText: ()   => { try { return term?.buffer?.active?.viewportElement?.textContent ?? ''; } catch { return ''; } },
        hasSelection:   ()    => { try { return term?.hasSelection() ?? false; } catch { return false; } },
        getSelection:  ()    => { try { return term?.getSelection() ?? ''; } catch { return ''; } },
        copySelection: ()    => { try { term?.copySelection(); } catch { /* ignore */ } },
        paste:         (text) => { try { term?.paste(text); } catch { /* ignore */ } },
        selectAll:     ()    => { try { term?.selectAll(); } catch { /* ignore */ } },
        clearSelection:()    => { try { term?.clearSelection(); } catch { /* ignore */ } },
        getSize:       ()    => ({ cols: term?.cols ?? 80, rows: term?.rows ?? 24 }),
        scrollToBottom:()    => { try { term?.scrollToBottom(); } catch { /* ignore */ } },
      };

      if (onReady) onReady(tabId, handle);

      return () => {
        ro.disconnect();
        // P3-8: clean up any open context menu resources
        if (menuCleanupRef.current.timeoutId) clearTimeout(menuCleanupRef.current.timeoutId);
        if (menuCleanupRef.current.outsideListener) document.removeEventListener('mousedown', menuCleanupRef.current.outsideListener);
        if (menuCleanupRef.current.keyListener) document.removeEventListener('keydown', menuCleanupRef.current.keyListener);
        term.dispose();
        termRef.current = null;
        fitRef.current  = null;
        initedRef.current = false;
      };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tabId]);

    // Update xterm theme when theme changes
    useEffect(() => {
      if (termRef.current) {
        termRef.current.options.theme = xtermTheme;
      }
    }, [xtermTheme]);

    useImperativeHandle(_ref, () => {
      const term = termRef.current;
      const fit  = fitRef.current;
      return {
        write:         (data) => term?.write(data),
        clear:         ()    => term?.clear(),
        focus:         ()    => term?.focus(),
        resize:        ()    => { try { fit?.fit(); } catch { /* ignore */ } },
        getAllText:    ()    => term?.buffer.active.getLine(0)?.translateToString(true) ?? '',
        getVisibleText: ()   => term?.buffer.active.viewportElement?.textContent ?? '',
        hasSelection:  ()    => term?.hasSelection() ?? false,
        getSelection:  ()    => term?.getSelection() ?? '',
        copySelection: ()    => term?.copySelection(),
        paste:         (text) => term?.paste(text),
        selectAll:     ()    => term?.selectAll(),
        clearSelection:()    => term?.clearSelection(),
        getSize:       ()    => ({ cols: term?.cols ?? 80, rows: term?.rows ?? 24 }),
        scrollToBottom:()    => term?.scrollToBottom(),
      };
    }, []);

    return (
      <div
        ref={containerRef}
        style={{
          display: visible ? 'block' : 'none',
          width:   '100%',
          height:  '100%',
          background: 'transparent',
          position: 'absolute',
          top: 0,
          left: 0,
        }}
      />
    );
  }
);

TerminalCore.displayName = 'TerminalCore';
