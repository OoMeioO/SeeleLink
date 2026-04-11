// Theme System Exports
export { ThemeProvider, useTheme, useColors } from './ThemeProvider';
export {
  // Unified theme
  lightTheme, darkTheme, generateCSSVariables,
  type Theme,
  // Design tokens (shared)
  typography, spacing, radius, shadows, transitions,
  Typography, Spacing, BorderRadius, Shadows, Transitions,
  // Old color palette (for App.tsx compatibility)
  colors, createStyles,
  type ThemeColors, type ThemeName,
  // Color scheme
  MORANDI_SCHEMES, getMorandiScheme, applyMorandi, textColorForBg,
  type MorandiScheme,
} from './theme';
