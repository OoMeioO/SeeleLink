/**
 * DesignThemeParser - Parse DESIGN.md files into Theme tokens
 *
 * Supports the Google Stitch DESIGN.md format with sections:
 * 1. Visual Theme & Atmosphere
 * 2. Color Palette & Roles
 * 3. Typography Rules
 * 4. Component Stylings
 * 5. Layout Principles
 * 6. Depth & Elevation
 * 7. Do's and Don'ts
 * 8. Responsive Behavior
 * 9. Agent Prompt Guide
 */

import type { DesignTheme, DesignThemeColors } from './types';

/**
 * Parse a DESIGN.md markdown content into a DesignTheme object
 */
export function parseDesignMd(content: string, source: 'uploaded' | 'imported' = 'uploaded'): DesignTheme | null {
  try {
    // Extract theme name from first H1
    const nameMatch = content.match(/^#\s+(.+)$/m);
    const name = nameMatch ? nameMatch[1].replace(/ Inspired Design System$/i, '').trim() : 'Custom Theme';

    // Extract description from README if present
    const descMatch = content.match(/Design system details.*?:\s*(.+)/i);
    const description = descMatch ? descMatch[1].trim() : `Custom ${name} theme`;

    // Parse color palette from the content
    const colors = parseColorPalette(content);

    // Parse typography
    const font = parseTypography(content);

    // Parse spacing and radius
    const spacing = parseSpacing(content);
    const radius = parseRadius(content);

    // Extract color swatches for preview (first 3 accent colors found)
    const swatches = extractSwatches(colors);

    return {
      id: `custom-${Date.now()}`,
      name,
      description,
      source,
      swatches,
      tokens: {
        colors,
        font,
        spacing,
        radius,
      },
      raw: content,
    };
  } catch (error) {
    console.error('Failed to parse DESIGN.md:', error);
    return null;
  }
}

/**
 * Parse color palette from DESIGN.md content
 */
function parseColorPalette(content: string): DesignThemeColors {
  const colors: DesignThemeColors = {};

  // Common color extraction patterns
  const colorPatterns: Array<[string, keyof DesignThemeColors]> = [
    // Primary colors
    [/(?:primary|accent)[\s:]+(?:rgba?\()?#?([0-9A-Fa-f]{6})/i, 'primary'],
    [/(?:primary|accent)[\s:]+(?:rgba?\()?#?([0-9A-Fa-f]{3,4})/i, 'primaryHover'],
    [/(?:primary|accent)[\s:]+(?:rgba?\()?#?([0-9A-Fa-f]{3,4})/i, 'primaryActive'],

    // Background colors
    [/(?:background|bg)[\s:]+(?:rgba?\()?#?([0-9A-Fa-f]{6})/i, 'bg'],
    [/(?:background|bg)[\s:]+(?:rgba?\()?#?([0-9A-Fa-f]{3,4})/i, 'bgSecondary'],
    [/(?:background|bg)[\s:]+(?:rgba?\()?#?([0-9A-Fa-f]{3,4})/i, 'bgTertiary'],

    // Surface colors
    [/(?:surface)[\s:]+(?:rgba?\()?#?([0-9A-Fa-f]{6})/i, 'surface'],

    // Text colors
    [/(?:text|foreground)[\s:]+(?:rgba?\()?#?([0-9A-Fa-f]{6})/i, 'text'],
    [/(?:text\s+secondary|muted)[\s:]+(?:rgba?\()?#?([0-9A-Fa-f]{6})/i, 'textSecondary'],

    // Border colors
    [/(?:border)[\s:]+(?:rgba?\()?#?([0-9A-Fa-f]{6})/i, 'border'],

    // Semantic colors
    [/(?:success|green)[\s:]+(?:rgba?\()?#?([0-9A-Fa-f]{6})/i, 'success'],
    [/(?:warning|yellow|amber)[\s:]+(?:rgba?\()?#?([0-9A-Fa-f]{6})/i, 'warning'],
    [/(?:error|red)[\s:]+(?:rgba?\()?#?([0-9A-Fa-f]{6})/i, 'error'],
    [/(?:danger)[\s:]+(?:rgba?\()?#?([0-9A-Fa-f]{6})/i, 'danger'],
  ];

  // Extract hex colors from content
  const hexMatches = content.matchAll(/#([0-9A-Fa-f]{6})/g);
  const hexColors: string[] = [];
  for (const match of hexMatches) {
    hexColors.push('#' + match[1]);
  }

  // If we found colors but no specific patterns, try to infer
  if (hexColors.length >= 3) {
    // Try to identify primary from common brand patterns
    const primaryGuess = hexColors.find(c =>
      isLikelyPrimary(c) || isLikelyAccent(c)
    );
    if (primaryGuess) colors.primary = primaryGuess;

    // Try to find a background color (usually darker or very light)
    const bgGuess = hexColors.find(c => isLikelyBackground(c));
    if (bgGuess) colors.bg = bgGuess;

    // Try to find text color
    const textGuess = hexColors.find(c => isLikelyText(c));
    if (textGuess) colors.text = textGuess;
  }

  // Apply default fallbacks
  return applyDefaults(colors);
}

/**
 * Check if a color is likely a primary/accent color
 */
function isLikelyPrimary(color: string): boolean {
  const hex = color.replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);

  // Vibrant, saturated colors are likely primary
  const saturation = Math.max(r, g, b) - Math.min(r, g, b);
  return saturation > 100;
}

/**
 * Check if a color is likely an accent color
 */
function isLikelyAccent(color: string): boolean {
  const hex = color.replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);

  // Blues and purples are often accent
  return (b > r && b > g) || (r > 200 && g < 150 && b > 200);
}

/**
 * Check if a color is likely a background
 */
function isLikelyBackground(color: string): boolean {
  const hex = color.replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);

  // Very dark or very light colors are likely backgrounds
  const brightness = (r + g + b) / 3;
  return brightness < 50 || brightness > 220;
}

/**
 * Check if a color is likely text
 */
function isLikelyText(color: string): boolean {
  const hex = color.replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);

  // Medium brightness, often near grayscale
  const brightness = (r + g + b) / 3;
  const saturation = Math.max(r, g, b) - Math.min(r, g, b);
  return brightness > 50 && brightness < 200 && saturation < 100;
}

/**
 * Apply default colors for missing values
 */
function applyDefaults(colors: DesignThemeColors): DesignThemeColors {
  return {
    // Backgrounds
    bg: colors.bg || '#1C1C1E',
    bgSecondary: colors.bgSecondary || '#252526',
    bgTertiary: colors.bgTertiary || '#2D2D2F',
    bgElevated: colors.bgElevated || '#333333',
    bgHover: colors.bgHover || '#2A2D2E',
    bgActive: colors.bgActive || '#37373D',
    bgSelected: colors.bgSelected || '#0D7FD920',

    // Surface
    surface: colors.surface || '#252526',
    surfaceHover: colors.surfaceHover || '#2A2D2E',
    surfaceActive: colors.surfaceActive || '#37373D',

    // Border
    border: colors.border || '#3C3C3C',
    borderLight: colors.borderLight || '#2D2D2F',
    borderStrong: colors.borderStrong || '#505050',
    borderHover: colors.borderHover || '#4E4E4E',

    // Primary
    primary: colors.primary || '#4A9EFF',
    primaryHover: colors.primaryHover || '#6BB3FF',
    primaryActive: colors.primaryActive || '#3D8BE0',

    // Semantic
    success: colors.success || '#4CAF50',
    warning: colors.warning || '#F5A623',
    error: colors.error || '#E53935',
    danger: colors.danger || '#E53935',

    // Text
    text: colors.text || '#E5E5E5',
    textSecondary: colors.textSecondary || '#ABABAB',
    textTertiary: colors.textTertiary || '#6E6E6E',
    textMuted: colors.textMuted || '#858585',
    textPlaceholder: colors.textPlaceholder || '#666666',
    textInverse: colors.textInverse || '#FFFFFF',
    textDisabled: colors.textDisabled || '#4E4E4E',

    // Input
    input: colors.input || '#2D2D2F',
    inputBorder: colors.inputBorder || '#3C3C3C',
    inputPlaceholder: colors.inputPlaceholder || '#666666',

    // Scrollbar
    scrollbar: colors.scrollbar || '#4A4A4A',
    scrollbarHover: colors.scrollbarHover || '#5A5A5A',

    // Overlay
    focusRing: colors.focusRing || 'rgba(14, 99, 156, 0.5)',
    overlay: colors.overlay || 'rgba(0, 0, 0, 0.5)',
  };
}

/**
 * Parse typography from DESIGN.md content
 */
function parseTypography(content: string) {
  const font: DesignTheme['tokens'] extends { font: infer F } ? F : never = {
    family: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    size: { xs: 11, sm: 12, md: 13, lg: 14, xl: 16 },
  };

  // Try to find font family
  const fontMatch = content.match(/(?:font|font-family)[\s:]+["']?([^"'\n,]+)["']?/i);
  if (fontMatch) {
    font.family = fontMatch[1].trim();
  }

  return font;
}

/**
 * Parse spacing from DESIGN.md content
 */
function parseSpacing(content: string) {
  return {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
  };
}

/**
 * Parse radius from DESIGN.md content
 */
function parseRadius(content: string) {
  return {
    sm: 4,
    md: 6,
    lg: 8,
  };
}

/**
 * Extract 3 color swatches for preview
 */
function extractSwatches(colors: DesignThemeColors): [string, string, string] {
  return [
    colors.primary || '#4A9EFF',
    colors.success || '#4CAF50',
    colors.warning || '#F5A623',
  ];
}

/**
 * Validate if content appears to be a valid DESIGN.md
 */
export function isValidDesignMd(content: string): boolean {
  if (!content || content.length < 100) return false;

  // Check for common DESIGN.md patterns
  const hasHeaders = /^#+/.test(content);
  const hasColors = /#[0-9A-Fa-f]{3,8}/.test(content);

  return hasHeaders && hasColors;
}

/**
 * Create a DesignTheme from user-uploaded file
 */
export async function parseUploadedDesignMd(file: File): Promise<DesignTheme | null> {
  try {
    const content = await file.text();
    if (!isValidDesignMd(content)) {
      console.error('Invalid DESIGN.md format');
      return null;
    }
    return parseDesignMd(content, 'uploaded');
  } catch (error) {
    console.error('Failed to read uploaded file:', error);
    return null;
  }
}

/**
 * Fetch and parse DESIGN.md from a URL
 */
export async function fetchDesignMd(url: string): Promise<DesignTheme | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }
    const content = await response.text();
    if (!isValidDesignMd(content)) {
      console.error('Invalid DESIGN.md format from URL');
      return null;
    }
    return parseDesignMd(content, 'imported');
  } catch (error) {
    console.error('Failed to fetch DESIGN.md:', error);
    return null;
  }
}
