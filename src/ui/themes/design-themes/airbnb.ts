/**
 * Airbnb-inspired Design Theme
 *
 * Warm coral accent, rounded corners, photography-driven aesthetic
 * Based on Airbnb's design language
 */
import type { DesignTheme } from '../types';

export const airbnbTheme: DesignTheme = {
  id: 'airbnb',
  name: 'Airbnb',
  description: 'Warm coral accent, rounded UI, photography-driven',
  source: 'builtin',
  swatches: ['#FF385C', '#00A699', '#FFB400'],
  tokens: {
    colors: {
      // Dark theme colors
      bg: '#1A1A1A',
      bgSecondary: '#262626',
      bgTertiary: '#333333',
      bgElevated: '#404040',
      bgHover: '#4D4D4D',
      bgActive: '#595959',
      bgSelected: '#FF385C15',

      surface: '#262626',
      surfaceHover: '#333333',
      surfaceActive: '#404040',

      border: '#404040',
      borderLight: '#333333',
      borderStrong: '#595959',
      borderHover: '#4D4D4D',

      primary: '#FF385C',
      primaryHover: '#FF5A7A',
      primaryActive: '#E63050',

      success: '#00A699',
      warning: '#FFB400',
      error: '#FF385C',
      danger: '#C13515',

      text: '#FFFFFF',
      textSecondary: '#AAAAAA',
      textTertiary: '#737373',
      textMuted: '#595959',
      textPlaceholder: '#595959',
      textInverse: '#FFFFFF',
      textDisabled: '#4D4D4D',

      input: '#333333',
      inputBorder: '#404040',
      inputPlaceholder: '#595959',

      scrollbar: '#595959',
      scrollbarHover: '#666666',

      focusRing: 'rgba(255, 56, 92, 0.4)',
      overlay: 'rgba(0, 0, 0, 0.6)',
    },
    font: {
      family: 'Circular, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      size: { xs: 11, sm: 12, md: 14, lg: 16, xl: 18 },
    },
    spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
    radius: { sm: 8, md: 12, lg: 16 },
  },
};

// Light variant
export const airbnbThemeLight: DesignTheme = {
  ...airbnbTheme,
  id: 'airbnb-light',
  name: 'Airbnb Light',
  description: 'Airbnb light mode with warm coral',
  tokens: {
    ...airbnbTheme.tokens,
    colors: {
      bg: '#FFFFFF',
      bgSecondary: '#F7F7F7',
      bgTertiary: '#EBEBEB',
      bgElevated: '#FFFFFF',
      bgHover: '#F0F0F0',
      bgActive: '#E8E8E8',
      bgSelected: '#FF385C15',

      surface: '#FFFFFF',
      surfaceHover: '#F7F7F7',
      surfaceActive: '#EBEBEB',

      border: '#E0E0E0',
      borderLight: '#F0F0F0',
      borderStrong: '#CCCCCC',
      borderHover: '#D0D0D0',

      primary: '#FF385C',
      primaryHover: '#E63050',
      primaryActive: '#CC2040',

      success: '#00A699',
      warning: '#FFB400',
      error: '#FF385C',
      danger: '#C13515',

      text: '#1A1A1A',
      textSecondary: '#717171',
      textTertiary: '#AAAAAA',
      textMuted: '#CCCCCC',
      textPlaceholder: '#AAAAAA',
      textInverse: '#FFFFFF',
      textDisabled: '#CCCCCC',

      input: '#FFFFFF',
      inputBorder: '#E0E0E0',
      inputPlaceholder: '#AAAAAA',

      scrollbar: '#CCCCCC',
      scrollbarHover: '#AAAAAA',

      focusRing: 'rgba(255, 56, 92, 0.4)',
      overlay: 'rgba(0, 0, 0, 0.3)',
    },
  },
};
