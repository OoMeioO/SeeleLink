/**
 * Linear-inspired Design Theme
 *
 * Ultra-minimal, precise engineering aesthetic with purple accent
 * Known for its clean, distraction-free interface
 */
import type { DesignTheme } from '../types';

export const linearTheme: DesignTheme = {
  id: 'linear',
  name: 'Linear',
  description: 'Ultra-minimal, precise, purple accent',
  source: 'builtin',
  swatches: ['#5E6AD2', '#794AE4', '#10B981'],
  tokens: {
    colors: {
      bg: '#0D0D0F',
      bgSecondary: '#141417',
      bgTertiary: '#1A1A1F',
      bgElevated: '#1E1E24',
      bgHover: '#252530',
      bgActive: '#2A2A36',
      bgSelected: '#5E6AD220',

      surface: '#141417',
      surfaceHover: '#1A1A1F',
      surfaceActive: '#1E1E24',

      border: '#2A2A36',
      borderLight: '#1E1E24',
      borderStrong: '#3A3A48',
      borderHover: '#333344',

      primary: '#5E6AD2',
      primaryHover: '#7080E0',
      primaryActive: '#4A5AB8',

      success: '#10B981',
      warning: '#F59E0B',
      error: '#EF4444',
      danger: '#DC2626',

      text: '#E4E4E7',
      textSecondary: '#8A8A8E',
      textTertiary: '#5A5A5E',
      textMuted: '#4A4A4E',
      textPlaceholder: '#3A3A3E',
      textInverse: '#FFFFFF',
      textDisabled: '#2A2A2E',

      input: '#1A1A1F',
      inputBorder: '#2A2A36',
      inputPlaceholder: '#4A4A4E',

      scrollbar: '#2A2A36',
      scrollbarHover: '#3A3A48',

      focusRing: 'rgba(94, 106, 210, 0.4)',
      overlay: 'rgba(0, 0, 0, 0.7)',
    },
    font: {
      family: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      size: { xs: 11, sm: 12, md: 13, lg: 14, xl: 16 },
    },
    spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20 },
    radius: { sm: 4, md: 6, lg: 8 },
  },
};

export const linearThemeLight: DesignTheme = {
  ...linearTheme,
  id: 'linear-light',
  name: 'Linear Light',
  description: 'Linear light mode - clean and minimal',
  tokens: {
    ...linearTheme.tokens,
    colors: {
      bg: '#FFFFFF',
      bgSecondary: '#F7F7F8',
      bgTertiary: '#ECECED',
      bgElevated: '#FFFFFF',
      bgHover: '#F0F0F1',
      bgActive: '#E8E8EA',
      bgSelected: '#5E6AD220',

      surface: '#FFFFFF',
      surfaceHover: '#F7F7F8',
      surfaceActive: '#ECECED',

      border: '#E2E2E4',
      borderLight: '#ECECED',
      borderStrong: '#C8C8CC',
      borderHover: '#D8D8DC',

      primary: '#5E6AD2',
      primaryHover: '#4A5AB8',
      primaryActive: '#3A4AA0',

      success: '#10B981',
      warning: '#F59E0B',
      error: '#EF4444',
      danger: '#DC2626',

      text: '#0D0D0F',
      textSecondary: '#6B6B6F',
      textTertiary: '#9A9A9E',
      textMuted: '#BABABE',
      textPlaceholder: '#C8C8CC',
      textInverse: '#FFFFFF',
      textDisabled: '#D8D8DC',

      input: '#FFFFFF',
      inputBorder: '#E2E2E4',
      inputPlaceholder: '#C8C8CC',

      scrollbar: '#D0D0D4',
      scrollbarHover: '#B8B8BC',

      focusRing: 'rgba(94, 106, 210, 0.4)',
      overlay: 'rgba(0, 0, 0, 0.25)',
    },
  },
};
