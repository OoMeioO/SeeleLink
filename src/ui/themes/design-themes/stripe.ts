/**
 * Stripe-inspired Design Theme
 *
 * Signature purple gradients, weight-300 elegance
 * Clean, professional, developer-focused
 */
import type { DesignTheme } from '../types';

export const stripeTheme: DesignTheme = {
  id: 'stripe',
  name: 'Stripe',
  description: 'Purple gradients, elegant, developer-focused',
  source: 'builtin',
  swatches: ['#635BFF', '#00D4FF', '#7A73FF'],
  tokens: {
    colors: {
      bg: '#0A0A0F',
      bgSecondary: '#111118',
      bgTertiary: '#1A1A24',
      bgElevated: '#1F1F2C',
      bgHover: '#262636',
      bgActive: '#2D2D40',
      bgSelected: '#635BFF20',

      surface: '#111118',
      surfaceHover: '#1A1A24',
      surfaceActive: '#1F1F2C',

      border: '#2A2A3C',
      borderLight: '#1F1F2C',
      borderStrong: '#3A3A50',
      borderHover: '#333345',

      primary: '#635BFF',
      primaryHover: '#7A73FF',
      primaryActive: '#524ACC',

      success: '#00D4FF',
      warning: '#FFB547',
      error: '#FF6B6B',
      danger: '#FF5252',

      text: '#F6F9FC',
      textSecondary: '#94949F',
      textTertiary: '#6B6B78',
      textMuted: '#52525E',
      textPlaceholder: '#42424E',
      textInverse: '#FFFFFF',
      textDisabled: '#32323E',

      input: '#1A1A24',
      inputBorder: '#2A2A3C',
      inputPlaceholder: '#52525E',

      scrollbar: '#3A3A50',
      scrollbarHover: '#4A4A60',

      focusRing: 'rgba(99, 91, 255, 0.4)',
      overlay: 'rgba(0, 0, 0, 0.65)',
    },
    font: {
      family: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      size: { xs: 11, sm: 12, md: 14, lg: 15, xl: 17 },
    },
    spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
    radius: { sm: 4, md: 6, lg: 8 },
  },
};

export const stripeThemeLight: DesignTheme = {
  ...stripeTheme,
  id: 'stripe-light',
  name: 'Stripe Light',
  description: 'Stripe light mode with purple accents',
  tokens: {
    ...stripeTheme.tokens,
    colors: {
      bg: '#FFFFFF',
      bgSecondary: '#F7F8FA',
      bgTertiary: '#EEF0F5',
      bgElevated: '#FFFFFF',
      bgHover: '#F0F2F7',
      bgActive: '#E8EAF0',
      bgSelected: '#635BFF15',

      surface: '#FFFFFF',
      surfaceHover: '#F7F8FA',
      surfaceActive: '#EEF0F5',

      border: '#E2E5EA',
      borderLight: '#F0F2F7',
      borderStrong: '#C8CDD6',
      borderHover: '#D8DDE4',

      primary: '#635BFF',
      primaryHover: '#524ACC',
      primaryActive: '#453FBF',

      success: '#00C2A8',
      warning: '#FFB547',
      error: '#FF6B6B',
      danger: '#FF5252',

      text: '#0A2540',
      textSecondary: '#425466',
      textTertiary: '#8898AA',
      textMuted: '#A8B5C4',
      textPlaceholder: '#C8CDD6',
      textInverse: '#FFFFFF',
      textDisabled: '#D8DDE4',

      input: '#FFFFFF',
      inputBorder: '#E2E5EA',
      inputPlaceholder: '#A8B5C4',

      scrollbar: '#C8CDD6',
      scrollbarHover: '#A8B5C4',

      focusRing: 'rgba(99, 91, 255, 0.4)',
      overlay: 'rgba(0, 0, 0, 0.25)',
    },
  },
};
