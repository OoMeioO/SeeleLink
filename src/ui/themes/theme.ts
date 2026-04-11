/**
 * theme.ts — SeeleLink Unified Theme System
 *
 * 统一 Theme 接口 + 完整的 darkTheme/lightTheme 数据 + CSS 变量生成。
 *
 * 三套来源已合并：
 *  - types.ts (旧): surface, surfaceHover, borderLight  …
 *  - theme.ts (旧): bgSecondary, textSecondary, input*, scrollbar … (generateCSSVariables)
 *  - src/ui/theme.ts (VSCode 风格): createStyles, colors 对象 (独立存在)
 *
 * 现在：darkTheme / lightTheme 包含完整的 color token，
 * generateCSSVariables 生成所有 CSS 变量供 primitives 使用，
 * useThemeStyles 读取 theme.colors.* 供 App.tsx 使用。
 */
import type { Theme } from './types';

// ── Dark Theme ──────────────────────────────────────────────────────────────
export const darkTheme: Theme = {
  name: 'dark',
  colors: {
    // Background layers
    bg: '#1C1C1E',
    bgSecondary: '#252526',
    bgTertiary: '#2D2D2F',
    bgElevated: '#333333',
    bgHover: '#2A2D2E',
    bgActive: '#37373D',
    bgSelected: '#0D7DD920',

    // Surface (component-level)
    surface: '#252526',
    surfaceHover: '#2A2D2E',
    surfaceActive: '#37373D',

    // Border
    border: '#3C3C3C',
    borderLight: '#2D2D2F',
    borderStrong: '#505050',
    borderHover: '#4E4E4E',

    // Primary
    primary: '#4A9EFF',
    primaryHover: '#6BB3FF',
    primaryActive: '#3D8BE0',

    // Semantic
    success: '#4CAF50',
    warning: '#F5A623',
    error: '#E53935',
    danger: '#E53935',

    // Text
    text: '#E5E5E5',
    textSecondary: '#ABABAB',
    textTertiary: '#6E6E6E',
    textMuted: '#858585',
    textPlaceholder: '#666666',
    textInverse: '#FFFFFF',
    textDisabled: '#4E4E4E',

    // Input / Form
    input: '#2D2D2F',
    inputBorder: '#3C3C3C',
    inputPlaceholder: '#666666',

    // Scrollbar
    scrollbar: '#4A4A4A',
    scrollbarHover: '#5A5A5A',

    // Overlay
    focusRing: 'rgba(14, 99, 156, 0.5)',
    overlay: 'rgba(0, 0, 0, 0.5)',

    // Terminal (always dark)
    terminal: {
      bg: '#0D0D0D',
      text: '#D4D4D4',
    },
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
  },
  radius: {
    sm: 4,
    md: 6,
    lg: 8,
  },
  font: {
    family: 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    size: {
      xs: 11,
      sm: 12,
      md: 13,
      lg: 14,
      xl: 16,
    },
  },
};

// ── Light Theme ─────────────────────────────────────────────────────────────
export const lightTheme: Theme = {
  name: 'light',
  colors: {
    // Background layers
    bg: '#FFFFFF',
    bgSecondary: '#F3F3F3',
    bgTertiary: '#EBEBEB',
    bgElevated: '#FFFFFF',
    bgHover: '#E8E8E8',
    bgActive: '#DCDCDC',
    bgSelected: '#0066CC15',

    // Surface (component-level)
    surface: '#FFFFFF',
    surfaceHover: '#E8E8E8',
    surfaceActive: '#DCDCDC',

    // Border
    border: '#AAAAAA',
    borderLight: '#CCCCCC',
    borderStrong: '#888888',
    borderHover: '#999999',

    // Primary
    primary: '#0078D4',
    primaryHover: '#106EBE',
    primaryActive: '#005A9E',

    // Semantic
    success: '#107C10',
    warning: '#CA5017',
    error: '#D13438',
    danger: '#D13438',

    // Text
    text: '#333333',
    textSecondary: '#616161',
    textTertiary: '#A0A0A0',
    textMuted: '#6E6E6E',
    textPlaceholder: '#A0A0A0',
    textInverse: '#FFFFFF',
    textDisabled: '#BEBEBE',

    // Input / Form
    input: '#FFFFFF',
    inputBorder: '#A0A0A0',
    inputPlaceholder: '#A0A0A0',

    // Scrollbar
    scrollbar: '#C1C1C1',
    scrollbarHover: '#A8A8A8',

    // Overlay
    focusRing: 'rgba(0, 120, 212, 0.3)',
    overlay: 'rgba(0, 0, 0, 0.3)',

    // Terminal (always dark)
    terminal: {
      bg: '#1A1A1A',
      text: '#D4D4D4',
    },
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
  },
  radius: {
    sm: 4,
    md: 6,
    lg: 8,
  },
  font: {
    family: 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    size: {
      xs: 11,
      sm: 12,
      md: 13,
      lg: 14,
      xl: 16,
    },
  },
};

// ── CSS Variable Generator ─────────────────────────────────────────────────────
// Generates CSS custom properties for primitives.tsx which uses var(--xxx) directly.
export function generateCSSVariables(theme: Theme): Record<string, string> {
  const vars: Record<string, string> = {};
  const c = theme.colors;

  // Background
  vars['--bg'] = c.bg;
  vars['--bg-secondary'] = c.bgSecondary;
  vars['--bg-tertiary'] = c.bgTertiary;
  vars['--bg-elevated'] = c.bgElevated;
  vars['--bg-hover'] = c.bgHover;
  vars['--bg-active'] = c.bgActive;
  vars['--bg-selected'] = c.bgSelected;

  // Surface (expose for consistency even though primitives use bg variants)
  vars['--surface'] = c.surface;
  vars['--surface-hover'] = c.surfaceHover;
  vars['--surface-active'] = c.surfaceActive;

  // Border
  vars['--border'] = c.border;
  vars['--border-light'] = c.borderLight;
  vars['--border-strong'] = c.borderStrong;
  vars['--border-hover'] = c.borderHover;

  // Primary
  vars['--primary'] = c.primary;
  vars['--primary-hover'] = c.primaryHover;
  vars['--primary-active'] = c.primaryActive;

  // Semantic
  vars['--success'] = c.success;
  vars['--warning'] = c.warning;
  vars['--error'] = c.error;
  vars['--danger'] = c.danger;

  // Text
  vars['--text'] = c.text;
  vars['--text-secondary'] = c.textSecondary;
  vars['--text-tertiary'] = c.textTertiary;
  vars['--text-muted'] = c.textMuted;
  vars['--text-placeholder'] = c.textPlaceholder;
  vars['--text-inverse'] = c.textInverse;
  vars['--text-disabled'] = c.textDisabled;

  // Input
  vars['--input'] = c.input;
  vars['--input-border'] = c.inputBorder;
  vars['--input-placeholder'] = c.inputPlaceholder;

  // Scrollbar
  vars['--scrollbar'] = c.scrollbar;
  vars['--scrollbar-hover'] = c.scrollbarHover;

  // Overlay
  vars['--focus-ring'] = c.focusRing;
  vars['--overlay'] = c.overlay;

  // Spacing
  Object.entries(theme.spacing).forEach(([key, value]) => {
    vars[`--spacing-${key}`] = `${value}px`;
  });

  // Border radius
  Object.entries(theme.radius).forEach(([key, value]) => {
    vars[`--radius-${key}`] = `${value}px`;
  });

  // Font
  vars['--font-family'] = theme.font.family;
  vars['--font-family-mono'] = '"SF Mono", "Fira Code", "Consolas", "Monaco", monospace';

  // Font sizes
  Object.entries(theme.font.size).forEach(([key, value]) => {
    vars[`--font-size-${key}`] = `${value}px`;
  });

  return vars;
}

// Re-export type for consumers
export type { Theme } from './types';

// ── Old Design Tokens (for compatibility with App.tsx createStyles) ─────────────────────
// These tokens were in the original src/ui/theme.ts
export const typography = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  fontFamilyMono: '"SF Mono", "Cascadia Code", Consolas, monospace',
  size: { xs: 10, sm: 11, base: 12, md: 13, lg: 14, xl: 16, xxl: 18, title: 20 },
  weight: { regular: 400, medium: 500, semibold: 600, bold: 700 },
  lineHeight: { tight: 1.2, normal: 1.5, relaxed: 1.75 },
};

export const spacing = {
  xxs: 4, xs: 6, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28,
};

export const radius = {
  sm: 3,
  md: 4,
  lg: 6,
  full: 9999,
};

export const shadows = {
  sm: '0 1px 4px rgba(0,0,0,0.1)',
  md: '0 2px 8px rgba(0,0,0,0.15)',
  lg: '0 4px 16px rgba(0,0,0,0.2)',
};

export const transitions = {
  fast: '0.08s ease',
  normal: '0.12s ease',
  slow: '0.2s ease',
};

// Re-export aliases for consumers that use Typography/Spacing naming
export const Typography = {
  fontSize: typography.size,
  fontWeight: typography.weight,
  lineHeight: typography.lineHeight,
};

export const Spacing = spacing;
export const BorderRadius = radius;
export const Shadows = shadows;
export const Transitions = transitions;

// ── Backward-compatible color objects (used by App.tsx + createStyles) ─────────────────────
// Values are now synced with darkTheme/lightTheme to ensure single source of truth.
export const colors = {
  light: {
    bg: '#FFFFFF',
    bgSecondary: '#F3F3F3',
    bgTertiary: '#EBEBEB',
    bgElevated: '#FFFFFF',
    bgHover: '#E8E8E8',
    bgActive: '#DCDCDC',
    bgSelected: '#0066CC15',
    surface: '#FFFFFF',
    surfaceHover: '#E8E8E8',
    text: '#333333',
    textSecondary: '#616161',
    textTertiary: '#A0A0A0',
    textMuted: '#6E6E6E',
    textPlaceholder: '#A0A0A0',
    textInverse: '#FFFFFF',
    textDisabled: '#BEBEBE',
    border: '#D4D4D4',
    borderLight: '#E8E8E8',
    borderStrong: '#A0A0A0',
    borderHover: '#BEBEBE',
    primary: '#0078D4',
    primaryHover: '#106EBE',
    primaryActive: '#005A9E',
    success: '#107C10',
    warning: '#CA5017',
    error: '#D13438',
    danger: '#D13438',
    focusRing: 'rgba(0, 120, 212, 0.3)',
    overlay: 'rgba(0, 0, 0, 0.3)',
    input: '#FFFFFF',
    inputBorder: '#D4D4D4',
    inputPlaceholder: '#A0A0A0',
    scrollbar: '#C1C1C1',
    scrollbarHover: '#A8A8A8',
  },
  dark: {
    bg: '#1C1C1E',
    bgSecondary: '#252526',
    bgTertiary: '#2D2D2F',
    bgElevated: '#333333',
    bgHover: '#2A2D2E',
    bgActive: '#37373D',
    bgSelected: '#0D7DD920',
    surface: '#252526',
    surfaceHover: '#2A2D2E',
    text: '#E5E5E5',
    textSecondary: '#ABABAB',
    textTertiary: '#6E6E6E',
    textMuted: '#858585',
    textPlaceholder: '#666666',
    textInverse: '#FFFFFF',
    textDisabled: '#4E4E4E',
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
    focusRing: 'rgba(14, 99, 156, 0.5)',
    overlay: 'rgba(0, 0, 0, 0.5)',
    input: '#2D2D2F',
    inputBorder: '#3C3C3C',
    inputPlaceholder: '#666666',
    scrollbar: '#4A4A4A',
    scrollbarHover: '#5A5A5A',
  },
};

// ── createStyles (App.tsx relies on this) ───────────────────────────────────────────
export function createStyles(theme: Theme['colors']) {
  // Uses unified Theme['colors'] to match darkTheme/lightTheme values
  const t = theme as typeof colors.light;
  return {
    container: {
      display: 'flex', flexDirection: 'column' as const, height: '100vh',
      backgroundColor: t.bg, color: t.text,
      fontFamily: typography.fontFamily, fontSize: typography.size.base, overflow: 'hidden',
    },
    titleBar: {
      height: 32, backgroundColor: t.bgSecondary, borderBottom: `1px solid ${t.border}`,
      display: 'flex', alignItems: 'center', padding: `0 ${spacing.sm}`,
      gap: spacing.xs, WebkitAppRegion: 'drag' as const, userSelect: 'none' as const,
    },
    logo: {
      display: 'flex', alignItems: 'center', gap: spacing.xxs,
      fontSize: typography.size.sm, fontWeight: typography.weight.medium, color: t.text,
    },
    menuBar: { display: 'flex', alignItems: 'center', gap: 1, marginLeft: spacing.md, WebkitAppRegion: 'no-drag' as const },
    menuItem: {
      padding: `${spacing.xxs}px ${spacing.sm}px`, fontSize: typography.size.sm,
      color: t.textSecondary, borderRadius: radius.sm, cursor: 'pointer',
      transition: transitions.fast, border: 'none', background: 'transparent',
    },
    content: { flex: 1, display: 'flex', overflow: 'hidden' },
    sidebar: {
      width: 200, backgroundColor: t.bgSecondary, borderRight: `1px solid ${t.border}`,
      display: 'flex', flexDirection: 'column' as const, overflow: 'hidden',
    },
    sidebarHeader: {
      height: 36, padding: `0 ${spacing.sm}`, borderBottom: `1px solid ${t.border}`,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    },
    sidebarTitle: {
      fontSize: typography.size.xs, fontWeight: typography.weight.semibold,
      color: t.textSecondary, textTransform: 'uppercase' as const, letterSpacing: '0.5px',
    },
    sidebarContent: { flex: 1, overflow: 'auto', padding: `${spacing.xxs}px 0` },
    searchBar: { padding: `${spacing.xs}px ${spacing.sm}px`, borderBottom: `1px solid ${t.border}` },
    searchInput: {
      width: '100%', padding: `${spacing.xxs}px ${spacing.xs}px`, height: 24,
      fontSize: typography.size.sm, fontFamily: 'inherit',
      backgroundColor: t.bg, color: t.text, border: `1px solid ${t.border}`,
      borderRadius: radius.sm, outline: 'none', transition: transitions.fast,
      boxSizing: 'border-box' as const,
    },
    connectionItem: {
      display: 'flex', alignItems: 'center', gap: spacing.sm,
      padding: `${spacing.xs}px ${spacing.sm}px`, cursor: 'pointer',
      transition: 'background-color 0.08s', backgroundColor: 'transparent',
      border: 'none', width: '100%', textAlign: 'left' as const, color: t.text,
    },
    connectionItemHover: { backgroundColor: t.bgHover },
    connectionItemActive: { backgroundColor: t.bgSelected },
    connectionName: {
      fontSize: typography.size.sm, fontWeight: typography.weight.regular,
      color: 'inherit', flex: 1, overflow: 'hidden',
      textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
    },
    connectionStatus: { width: 6, height: 6, borderRadius: '50%', flexShrink: 0 },
    tabBar: {
      display: 'flex', backgroundColor: t.bgSecondary, borderBottom: `1px solid ${t.border}`,
      padding: `0 ${spacing.xxs}`, gap: 1, overflowX: 'auto', overflowY: 'hidden', minHeight: 36,
    },
    tab: {
      display: 'flex', alignItems: 'center', gap: spacing.xs,
      padding: `${spacing.xs}px ${spacing.md}px`, fontSize: typography.size.sm,
      color: t.textSecondary, cursor: 'pointer', borderBottom: '2px solid transparent',
      transition: transitions.fast, whiteSpace: 'nowrap' as const, height: 35,
    },
    tabHover: { backgroundColor: t.bgHover },
    tabActive: { color: t.text, borderBottomColor: t.primary, backgroundColor: t.bg },
    tabClose: {
      width: 14, height: 14, borderRadius: radius.sm, display: 'flex',
      alignItems: 'center', justifyContent: 'center', fontSize: 9,
    },
    mainArea: { flex: 1, display: 'flex', flexDirection: 'column' as const, overflow: 'hidden' },
    terminalContainer: { flex: 1, overflow: 'hidden', backgroundColor: t.bg, borderTop: `1px solid ${t.border}` },
    statusBar: {
      height: 22, backgroundColor: t.bgSecondary, borderTop: `1px solid ${t.border}`,
      display: 'flex', alignItems: 'center', padding: `0 ${spacing.sm}`, gap: spacing.lg,
      fontSize: typography.size.xs, color: t.textSecondary,
    },
    statusItem: { display: 'flex', alignItems: 'center', gap: spacing.xxs },
    button: {
      padding: `${spacing.xs}px ${spacing.sm}px`, fontSize: typography.size.sm,
      backgroundColor: t.bgSecondary, color: t.text, border: `1px solid ${t.border}`,
      borderRadius: radius.sm, cursor: 'pointer', transition: transitions.fast,
    },
    buttonPrimary: {
      padding: `${spacing.xs}px ${spacing.sm}px`, fontSize: typography.size.sm,
      backgroundColor: t.primary, color: '#FFFFFF', border: 'none',
      borderRadius: radius.sm, cursor: 'pointer', transition: transitions.fast,
    },
    buttonSecondary: {
      padding: `${spacing.xs}px ${spacing.sm}px`, fontSize: typography.size.sm,
      backgroundColor: 'transparent', color: t.text, border: `1px solid ${t.border}`,
      borderRadius: radius.sm, cursor: 'pointer', transition: transitions.fast,
    },
    buttonAdd: {
      padding: `${spacing.xxs}px ${spacing.xs}px`, fontSize: typography.size.xs,
      backgroundColor: 'transparent', color: t.textSecondary,
      border: `1px dashed ${t.border}`, borderRadius: radius.sm,
      cursor: 'pointer', transition: transitions.fast,
    },
    input: {
      width: '100%', padding: `${spacing.xs}px ${spacing.sm}px`,
      fontSize: typography.size.sm, fontFamily: 'inherit',
      backgroundColor: t.bg, color: t.text, border: `1px solid ${t.border}`,
      borderRadius: radius.sm, outline: 'none', transition: transitions.fast,
      boxSizing: 'border-box' as const,
    },
    select: {
      width: '100%', padding: `${spacing.xs}px ${spacing.sm}px`,
      fontSize: typography.size.sm, fontFamily: 'inherit',
      backgroundColor: t.bg, color: t.text, border: `1px solid ${t.border}`,
      borderRadius: radius.sm, outline: 'none', cursor: 'pointer',
      boxSizing: 'border-box' as const,
    },
    modal: {
      position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: t.overlay, display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 1000,
    },
    modalContent: {
      backgroundColor: t.surface, border: `1px solid ${t.border}`,
      borderRadius: radius.md, padding: spacing.lg,
      minWidth: 400, maxWidth: 600, boxShadow: shadows.lg,
    },
    modalTitle: {
      fontSize: typography.size.lg, fontWeight: typography.weight.semibold,
      color: t.text, marginBottom: spacing.md,
    },
    modalFooter: {
      display: 'flex', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.lg,
    },
  };
}

export type ThemeColors = typeof colors.light;
export type ThemeName = 'light' | 'dark';

// ── Morandi Color Schemes ─────────────────────────────────────────────────────────

export interface MorandiScheme {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Short label shown in UI */
  label: string;
  /** Description */
  description: string;
  /**
   * Color swatch preview (3 dots: primary, success, warning).
   * error = shift(primary, +180°), danger = darker(shift(primary, +180°)).
   */
  swatches: [string, string, string];
  /** Three core colors for dark theme */
  dark: {
    /** Scheme's primary hue — used for primary, primaryHover, primaryActive */
    primary: string;
    primaryHover: string;
    primaryActive: string;
    /** Complementary of primary — used for success */
    success: string;
    /** Triadic of primary — used for warning */
    warning: string;
    /** Complementary of primary — used for error */
    error: string;
    /** Darker complementary — used for danger */
    danger: string;
  };
  /** Three core colors for light theme */
  light: {
    primary: string;
    primaryHover: string;
    primaryActive: string;
    success: string;
    warning: string;
    error: string;
    danger: string;
  };
}

export const MORANDI_SCHEMES: MorandiScheme[] = [
  {
    id: 'default',
    name: '希儿',
    label: '希儿',
    description: '薰衣草紫 — 默认色系',
    swatches: ['#9878D8', '#D06888', '#58A898'],
    dark:  { primary: '#A888E8', primaryHover: '#C0A0F2', primaryActive: '#8060D0', success: '#D06888', warning: '#58A898', error: '#E07848', danger: '#D05838' },
    light: { primary: '#6040B8', primaryHover: '#5030A8', primaryActive: '#402098', success: '#A84060', warning: '#308878', error: '#B82020', danger: '#981010' },
  },
  {
    id: 'blue',
    name: 'Blue',
    label: '纯蓝',
    description: '纯净蓝色 — 经典沉稳',
    swatches: ['#5888E0', '#E08848', '#88E0B8'],
    dark:  { primary: '#7090F0', primaryHover: '#90A8F8', primaryActive: '#5078D8', success: '#E08848', warning: '#88E0B8', error: '#E05858', danger: '#C83838' },
    light: { primary: '#2848C0', primaryHover: '#1838B0', primaryActive: '#0828A0', success: '#A06818', warning: '#288878', error: '#A82020', danger: '#881010' },
  },
];

/** Get a Morandi scheme by id */
export function getMorandiScheme(id: string): MorandiScheme {
  return MORANDI_SCHEMES.find(s => s.id === id) ?? MORANDI_SCHEMES[0];
}

/**
 * Apply Morandi accent colors to a base theme.
 * Returns a new colors object with primary/success/warning/error/danger overridden.
 */
export function applyMorandi(
  baseColors: Theme['colors'],
  scheme: MorandiScheme
): Theme['colors'] {
  const isDark = baseColors.bg === darkTheme.colors.bg;
  const ac = isDark ? scheme.dark : scheme.light;
  return {
    ...baseColors,
    primary: ac.primary,
    primaryHover: ac.primaryHover,
    primaryActive: ac.primaryActive,
    success: ac.success,
    warning: ac.warning,
    error: ac.error,
    danger: ac.danger,
  };
}

/**
 * Determine if a background color needs white or dark text.
 * Uses perceived luminance formula (ITU-R BT.709).
 */
export function textColorForBg(bg: string): string {
  const hex = bg.replace('#', '');
  if (hex.length !== 6) return '#FFFFFF';
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  // Perceived luminance
  const lum = 0.2126 * (r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4))
             + 0.7152 * (g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4))
             + 0.0722 * (b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4));
  return lum > 0.35 ? '#333333' : '#FFFFFF';
}
