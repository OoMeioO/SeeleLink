/**
 * ThemeProvider - Unified Theme System
 *
 * Features:
 * - Light/Dark mode with smooth transitions
 * - CSS Variables for runtime theming (powers var(--xxx))
 * - System preference detection
 * - Persistent preference
 * - Backward compatible: exports both new `colors` and old `theme/styles` interfaces
 */
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  lightTheme, darkTheme,
  generateCSSVariables,
  colors, createStyles,
  MORANDI_SCHEMES, getMorandiScheme, applyMorandi,
  type Theme,
  type ThemeName,
  type MorandiScheme,
} from './theme.js';

interface UnifiedContextValue {
  // New unified interface (for Sidebar, TabBar, etc.)
  themeName: ThemeName;
  colors: Theme['colors'];
  toggleTheme: () => void;
  setTheme: (name: ThemeName) => void;
  // Color scheme
  colorScheme: MorandiScheme;
  setColorScheme: (schemeId: string) => void;
  availableSchemes: MorandiScheme[];
  // Old interface (for App.tsx) — uses old color palette directly
  theme: typeof colors.light;
  styles: ReturnType<typeof createStyles>;
}

const ThemeContext = createContext<UnifiedContextValue | null>(null);
const STORAGE_KEY = 'seelelink-theme';
const SCHEME_KEY = 'seelelink-color-scheme';

/** Apply Morandi accent colors to the old flat color palette */
function applyColorSchemeToOldPalette(
  base: typeof colors.light,
  scheme: MorandiScheme
): Partial<typeof colors.light> {
  const isDark = base.bg === colors.dark.bg;
  const ac = isDark ? scheme.dark : scheme.light;
  return {
    primary: ac.primary,
    primaryHover: ac.primaryHover,
    primaryActive: ac.primaryActive,
    success: ac.success,
    warning: ac.warning,
    error: ac.error,
    danger: ac.danger,
  };
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const getInitialTheme = (): ThemeName => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
    if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
    return 'light';
  };

  const [themeName, setThemeName] = useState<ThemeName>(getInitialTheme);

  // Color scheme (Morandi)
  const [colorSchemeId, setColorSchemeId] = useState<string>(() => {
    return localStorage.getItem(SCHEME_KEY) ?? 'default';
  });

  const colorScheme = useMemo(() => getMorandiScheme(colorSchemeId), [colorSchemeId]);

  // New unified theme (base + Morandi)
  const unifiedTheme = useMemo(() => {
    const base = themeName === 'dark' ? darkTheme : lightTheme;
    return {
      ...base,
      colors: applyMorandi(base.colors, colorScheme),
    };
  }, [themeName, colorScheme]);

  // Old color palette for App.tsx (base + Morandi)
  const theme = useMemo(() => {
    const base = themeName === 'dark' ? colors.dark : colors.light;
    return { ...base, ...applyColorSchemeToOldPalette(base, colorScheme) };
  }, [themeName, colorScheme]);

  const styles = useMemo(() => createStyles(theme), [theme]);

  // Apply ALL CSS variables to :root (uses var(--xxx))
  useEffect(() => {
    const vars = generateCSSVariables(unifiedTheme);
    const root = document.documentElement;

    const keysToRemove = [
      '--bg', '--bg-secondary', '--bg-tertiary', '--bg-elevated', '--bg-hover', '--bg-active', '--bg-selected',
      '--surface', '--surface-hover', '--surface-active',
      '--border', '--border-light', '--border-strong', '--border-hover',
      '--primary', '--primary-hover', '--primary-active',
      '--success', '--warning', '--error', '--danger',
      '--text', '--text-secondary', '--text-tertiary', '--text-muted',
      '--text-placeholder', '--text-inverse', '--text-disabled',
      '--input', '--input-border', '--input-placeholder',
      '--scrollbar', '--scrollbar-hover',
      '--focus-ring', '--overlay',
    ];
    keysToRemove.forEach(k => root.style.removeProperty(k));

    Object.entries(vars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    root.setAttribute('data-theme', themeName);
  }, [unifiedTheme, themeName]);

  // Persist theme preference
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, themeName);
  }, [themeName]);

  // Persist color scheme preference
  useEffect(() => {
    localStorage.setItem(SCHEME_KEY, colorSchemeId);
  }, [colorSchemeId]);

  const setColorScheme = useCallback((schemeId: string) => {
    setColorSchemeId(schemeId);
  }, []);

  // System preference listener
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem(STORAGE_KEY)) {
        setThemeName(e.matches ? 'dark' : 'light');
      }
    };
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeName(prev => prev === 'dark' ? 'light' : 'dark');
  }, []);

  const setTheme = useCallback((name: ThemeName) => {
    setThemeName(name);
  }, []);

  const value = useMemo(() => ({
    themeName,
    colors: unifiedTheme.colors,
    toggleTheme,
    setTheme,
    colorScheme,
    setColorScheme,
    availableSchemes: MORANDI_SCHEMES,
    // Old interface
    theme,
    styles,
  }), [themeName, unifiedTheme, toggleTheme, setTheme, colorScheme, setColorScheme, theme, styles]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

// New unified interface: use colors from unified theme
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}

// Alias: returns theme colors (backward compat for components using useColors)
export function useColors() {
  const { colors } = useTheme();
  return colors;
}
