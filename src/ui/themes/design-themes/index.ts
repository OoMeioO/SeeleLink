/**
 * Built-in Design Themes
 *
 * Export all available built-in themes
 */
import type { DesignTheme } from '../types';

import { airbnbTheme, airbnbThemeLight } from './airbnb';
import { linearTheme, linearThemeLight } from './linear';
import { stripeTheme, stripeThemeLight } from './stripe';
import { claudeTheme, claudeThemeLight } from './claude';

export const builtinDesignThemes: DesignTheme[] = [
  airbnbTheme,
  airbnbThemeLight,
  linearTheme,
  linearThemeLight,
  stripeTheme,
  stripeThemeLight,
  claudeTheme,
  claudeThemeLight,
];

export { airbnbTheme, airbnbThemeLight } from './airbnb';
export { linearTheme, linearThemeLight } from './linear';
export { stripeTheme, stripeThemeLight } from './stripe';
export { claudeTheme, claudeThemeLight } from './claude';
