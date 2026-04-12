/**
 * ThemeProvider - Unified Theme System
 *
 * Features:
 * - Design Theme based theming (Airbnb, Linear, Stripe, Claude, etc.)
 * - CSS Variables for ALL properties (colors, spacing, radius, font)
 * - Persistent preference
 * - Backward compatible: exports theme/styles interfaces for existing components
 */
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  generateCSSVariables,
  colors, createStyles,
  type Theme,
} from './theme.js';
import { builtinDesignThemes } from './design-themes';
import type { DesignTheme, DesignThemeColors } from './types';

interface UnifiedContextValue {
  // Theme state
  designTheme: DesignTheme | null;
  setDesignTheme: (theme: DesignTheme | null) => void;
  availableDesignThemes: DesignTheme[];
  // Computed theme for components
  theme: Theme;
  colors: Theme['colors'];
  styles: ReturnType<typeof createStyles>;
}

const ThemeContext = createContext<UnifiedContextValue | null>(null);
const DESIGN_THEME_KEY = 'seelelink-design-theme';

// Default theme when none is selected
const defaultTheme: Theme = {
  name: 'dark',
  colors: {
    bg: '#1C1C1E',
    bgSecondary: '#252526',
    bgTertiary: '#2D2D2F',
    bgElevated: '#333333',
    bgHover: '#2A2D2E',
    bgActive: '#37373D',
    bgSelected: '#0D7FD920',
    surface: '#252526',
    surfaceHover: '#2A2D2E',
    surfaceActive: '#37373D',
    border: '#3C3C3C',
    borderLight: '#2D2D2F',
    borderStrong: '#505050',
    borderHover: '#4E4E4E',
    primary: '#4A9EFF',
    primaryHover: '#6BB3FF',
    primaryActive: '#3D8BE0',
    success: '#4CAF50',
    warning: '#F5A623',
    error: '#E53935',
    danger: '#E53935',
    text: '#E5E5E5',
    textSecondary: '#ABABAB',
    textTertiary: '#6E6E6E',
    textMuted: '#858585',
    textPlaceholder: '#666666',
    textInverse: '#FFFFFF',
    textDisabled: '#4E4E4E',
    input: '#2D2D2F',
    inputBorder: '#3C3C3C',
    inputPlaceholder: '#666666',
    scrollbar: '#4A4A4A',
    scrollbarHover: '#5A5A5A',
    focusRing: 'rgba(14, 99, 156, 0.5)',
    overlay: 'rgba(0, 0, 0, 0.5)',
    terminal: { bg: '#0D0D0D', text: '#D4D4D4' },
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20 },
  radius: { sm: 4, md: 6, lg: 8 },
  font: {
    family: 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    size: { xs: 11, sm: 12, md: 13, lg: 14, xl: 16 },
  },
};

/** Apply design theme colors to base theme */
function applyDesignThemeColors(
  base: Theme['colors'],
  designColors: DesignThemeColors
): Theme['colors'] {
  const result = { ...base };

  Object.entries(designColors).forEach(([key, value]) => {
    if (value !== undefined) {
      (result as Record<string, unknown>)[key] = value;
    }
  });

  return result;
}

/** Get theme from design theme */
function getThemeFromDesignTheme(designTheme: DesignTheme | null): Theme {
  if (!designTheme) return defaultTheme;

  const base = defaultTheme;

  // Apply design theme colors
  const themeColors = designTheme.tokens.colors
    ? applyDesignThemeColors(base.colors, designTheme.tokens.colors)
    : base.colors;

  // Apply design theme spacing (with defaults)
  const spacing = designTheme.tokens.spacing || base.spacing;

  // Apply design theme radius (with defaults)
  const radius = designTheme.tokens.radius || base.radius;

  // Apply design theme font (with defaults)
  const font = designTheme.tokens.font
    ? {
        family: designTheme.tokens.font.family || base.font.family,
        size: { ...base.font.size, ...designTheme.tokens.font.size },
      }
    : base.font;

  return {
    name: 'dark',
    colors: themeColors,
    spacing,
    radius,
    font,
  };
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Design theme state
  const [designTheme, setDesignThemeState] = useState<DesignTheme | null>(() => {
    const stored = localStorage.getItem(DESIGN_THEME_KEY);
    if (stored) {
      const builtin = builtinDesignThemes.find(t => t.id === stored);
      if (builtin) return builtin;
      return null;
    }
    // Default to first builtin theme (airbnb dark)
    return builtinDesignThemes[0] || null;
  });

  // Compute full theme from design theme
  const theme = useMemo(() => {
    return getThemeFromDesignTheme(designTheme);
  }, [designTheme]);

  // Old color palette for App.tsx (backward compat)
  const oldColors = useMemo(() => {
    const c = theme.colors;
    return {
      bg: c.bg,
      bgSecondary: c.bgSecondary,
      bgTertiary: c.bgTertiary,
      bgElevated: c.bgElevated,
      bgHover: c.bgHover,
      bgActive: c.bgActive,
      bgSelected: c.bgSelected,
      surface: c.surface,
      surfaceHover: c.surfaceHover,
      text: c.text,
      textSecondary: c.textSecondary,
      textTertiary: c.textTertiary,
      textMuted: c.textMuted,
      textPlaceholder: c.textPlaceholder,
      textInverse: c.textInverse,
      textDisabled: c.textDisabled,
      border: c.border,
      borderLight: c.borderLight,
      borderStrong: c.borderStrong,
      borderHover: c.borderHover,
      primary: c.primary,
      primaryHover: c.primaryHover,
      primaryActive: c.primaryActive,
      success: c.success,
      warning: c.warning,
      error: c.error,
      danger: c.danger,
      focusRing: c.focusRing,
      overlay: c.overlay,
      input: c.input,
      inputBorder: c.inputBorder,
      inputPlaceholder: c.inputPlaceholder,
      scrollbar: c.scrollbar,
      scrollbarHover: c.scrollbarHover,
    };
  }, [theme]);

  const styles = useMemo(() => createStyles(oldColors), [oldColors]);

  // Set design theme and persist
  const setDesignTheme = useCallback((newTheme: DesignTheme | null) => {
    setDesignThemeState(newTheme);
    if (newTheme) {
      localStorage.setItem(DESIGN_THEME_KEY, newTheme.id);
    } else {
      localStorage.removeItem(DESIGN_THEME_KEY);
    }
  }, []);

  // Apply ALL CSS variables to :root
  useEffect(() => {
    const vars = generateCSSVariables(theme);
    const root = document.documentElement;

    // Remove all existing CSS variables
    const allVars = Object.keys(vars);
    allVars.forEach(k => root.style.removeProperty(k));

    // Set new CSS variables
    Object.entries(vars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    root.setAttribute('data-theme', 'dark');
    root.setAttribute('data-design-theme', designTheme?.id || 'default');
  }, [theme, designTheme]);

  const value = useMemo(() => ({
    designTheme,
    setDesignTheme,
    availableDesignThemes: builtinDesignThemes,
    theme,
    colors: theme.colors,
    styles,
  }), [designTheme, setDesignTheme, theme, styles]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

// Hook to use theme
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}

// Alias: returns theme colors (backward compat)
export function useColors() {
  const { colors } = useTheme();
  return colors;
}
