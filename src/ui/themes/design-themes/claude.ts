/**
 * Claude-inspired Design Theme
 *
 * Warm terracotta accent, clean editorial layout
 * Anthropic's AI assistant aesthetic
 */
import type { DesignTheme } from '../types';

export const claudeTheme: DesignTheme = {
  id: 'claude',
  name: 'Claude',
  description: 'Warm terracotta accent, editorial layout',
  source: 'builtin',
  swatches: ['#C9602A', '#2D5A4A', '#8B6914'],
  tokens: {
    colors: {
      bg: '#19191C',
      bgSecondary: '#222226',
      bgTertiary: '#2C2C32',
      bgElevated: '#33333B',
      bgHover: '#3A3A44',
      bgActive: '#42424D',
      bgSelected: '#C9602A15',

      surface: '#222226',
      surfaceHover: '#2C2C32',
      surfaceActive: '#33333B',

      border: '#3C3C46',
      borderLight: '#2C2C32',
      borderStrong: '#4A4A56',
      borderHover: '#444452',

      primary: '#C9602A',
      primaryHover: '#D87040',
      primaryActive: '#A85020',

      success: '#2D5A4A',
      warning: '#8B6914',
      error: '#C94040',
      danger: '#A83030',

      text: '#E8E6E3',
      textSecondary: '#9A9895',
      textTertiary: '#6A6865',
      textMuted: '#5A5855',
      textPlaceholder: '#4A4845',
      textInverse: '#FFFFFF',
      textDisabled: '#3A3835',

      input: '#2C2C32',
      inputBorder: '#3C3C46',
      inputPlaceholder: '#5A5855',

      scrollbar: '#4A4A56',
      scrollbarHover: '#5A5A65',

      focusRing: 'rgba(201, 96, 42, 0.4)',
      overlay: 'rgba(0, 0, 0, 0.6)',
    },
    font: {
      family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      size: { xs: 11, sm: 12, md: 14, lg: 15, xl: 17 },
    },
    spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20 },
    radius: { sm: 4, md: 6, lg: 8 },
  },
};

export const claudeThemeLight: DesignTheme = {
  ...claudeTheme,
  id: 'claude-light',
  name: 'Claude Light',
  description: 'Claude light mode with warm terracotta',
  tokens: {
    ...claudeTheme.tokens,
    colors: {
      bg: '#FCFCFA',
      bgSecondary: '#F7F5F2',
      bgTertiary: '#EFECE7',
      bgElevated: '#FFFFFF',
      bgHover: '#F0EDE8',
      bgActive: '#E8E4DF',
      bgSelected: '#C9602A15',

      surface: '#FFFFFF',
      surfaceHover: '#F7F5F2',
      surfaceActive: '#EFECE7',

      border: '#E0DCD4',
      borderLight: '#F0EDE8',
      borderStrong: '#C8C4BC',
      borderHover: '#D4D0C8',

      primary: '#C9602A',
      primaryHover: '#A85020',
      primaryActive: '#904015',

      success: '#2D5A4A',
      warning: '#8B6914',
      error: '#C94040',
      danger: '#A83030',

      text: '#19191C',
      textSecondary: '#6B6560',
      textTertiary: '#9A9590',
      textMuted: '#B0ABA5',
      textPlaceholder: '#C8C4BC',
      textInverse: '#FFFFFF',
      textDisabled: '#D4D0C8',

      input: '#FFFFFF',
      inputBorder: '#E0DCD4',
      inputPlaceholder: '#B0ABA5',

      scrollbar: '#C8C4BC',
      scrollbarHover: '#A8A49C',

      focusRing: 'rgba(201, 96, 42, 0.4)',
      overlay: 'rgba(0, 0, 0, 0.25)',
    },
  },
};
