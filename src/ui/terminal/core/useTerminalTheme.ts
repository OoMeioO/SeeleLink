/**
 * useTerminalTheme.ts — Maps flat theme colors to xterm 16-color ANSI palette
 *
 * Uses the flat theme (theme.bg, theme.primary, etc.) from the unified
 * ThemeProvider's backward-compatible `theme` field.
 */
import { useMemo } from 'react';
import { useTheme } from '../../themes';

export function useTerminalTheme() {
  const { theme, themeName } = useTheme();

  return useMemo(() => {
    const isDark = themeName === 'dark';

    return {
      background:   theme.bg,
      foreground:   theme.text,
      cursor:       theme.text,
      cursorAccent: theme.bg,

      // Normal ANSI colors
      black:   '#000000',
      red:     theme.error || '#F44336',
      green:   theme.success || '#4CAF50',
      yellow:  theme.warning || '#FF9800',
      blue:    theme.primary || '#0D7DD9',
      magenta: isDark ? '#C97AFF' : '#9C27B0',
      cyan:    isDark ? '#6BA8FF' : '#0097A7',
      white:   isDark ? '#F5F5F5' : '#E0E0E0',

      // Bright ANSI colors
      brightBlack:   isDark ? '#636366' : '#9E9E9E',
      brightRed:     theme.error || '#FF5252',
      brightGreen:   theme.success || '#69F0AE',
      brightYellow:  theme.warning || '#FFD740',
      brightBlue:    theme.primary || '#448AFF',
      brightMagenta: isDark ? '#E0AAFF' : '#EA80FC',
      brightCyan:    isDark ? '#99C9FF' : '#80DEEA',
      brightWhite:   isDark ? '#FFFFFF' : '#F5F5F5',

      selectionBackground: isDark ? 'rgba(13,125,217,0.3)' : 'rgba(0,102,204,0.3)',
      selectionForeground: theme.text,
    };
  }, [theme, themeName]);
}
