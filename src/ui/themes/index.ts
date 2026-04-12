// Theme System Exports
export { ThemeProvider, useTheme, useColors } from './ThemeProvider';
export { DesignThemeGallery } from './DesignThemeGallery';
export {
  // Unified theme (for reference)
  lightTheme, darkTheme, generateCSSVariables,
  type Theme,
  // Design tokens (shared)
  typography, spacing, radius, shadows, transitions,
  Typography, Spacing, BorderRadius, Shadows, Transitions,
  // Old color palette (for App.tsx compatibility)
  colors, createStyles,
  // Utility functions
  textColorForBg,
} from './theme';
// DESIGN.md Theme types and built-in themes
export type { DesignTheme, DesignThemeColors, DesignThemeSource, DesignThemeFont, DesignThemeSpacing, DesignThemeRadius } from './types';
export { builtinDesignThemes } from './design-themes';
