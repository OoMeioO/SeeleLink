/**
 * types.ts — Unified Theme Type System
 *
 * 合并了两套 Theme 定义：
 *  - 旧 Theme 接口 (dark.ts/light.ts): surface, surfaceHover, borderLight 等
 *  - 新 Theme 接口 (theme.ts): textSecondary, bgSecondary, input*, scrollbar 等
 * 统一为完整的颜色 token 集，供 App.tsx 和 useThemeStyles.ts 共用。
 */

export type ThemeName = 'dark' | 'light';

export interface Theme {
  name: ThemeName;
  colors: {
    // ── Background layers ───────────────────────────────────────────
    bg: string;              // 根背景
    bgSecondary: string;     // 次级背景（标题栏、Tab栏）
    bgTertiary: string;      // 三级背景
    bgElevated: string;      // 浮层/卡片背景
    bgHover: string;          // hover 背景
    bgActive: string;         // active/pressed 背景
    bgSelected: string;       // selected 背景

    // ── Surface (component-level backgrounds) ───────────────────────
    surface: string;
    surfaceHover: string;
    surfaceActive: string;

    // ── Border ──────────────────────────────────────────────────────
    border: string;
    borderLight: string;
    borderStrong: string;
    borderHover: string;

    // ── Primary ─────────────────────────────────────────────────────
    primary: string;
    primaryHover: string;
    primaryActive: string;

    // ── Semantic ────────────────────────────────────────────────────
    success: string;
    warning: string;
    error: string;
    danger: string;

    // ── Text ───────────────────────────────────────────────────────
    text: string;
    textSecondary: string;
    textTertiary: string;
    textMuted: string;
    textPlaceholder: string;
    textInverse: string;
    textDisabled: string;

    // ── Input / Form ────────────────────────────────────────────────
    input: string;
    inputBorder: string;
    inputPlaceholder: string;

    // ── Scrollbar ──────────────────────────────────────────────────
    scrollbar: string;
    scrollbarHover: string;

    // ── Overlay ───────────────────────────────────────────────────
    focusRing: string;
    overlay: string;

    // ── Terminal (always dark) ──────────────────────────────────────
    terminal: {
      bg: string;
      text: string;
    };
  };
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
  radius: {
    sm: number;
    md: number;
    lg: number;
  };
  font: {
    family: string;
    size: {
      xs: number;
      sm: number;
      md: number;
      lg: number;
      xl: number;
    };
  };
}
