/**
 * Platform Abstraction Layer
 *
 * Provides unified interface for platform-specific functionality:
 * - Mouse Control
 * - Keyboard Control
 * - Screen Capture
 *
 * Usage:
 *   const platform = require('./platform');
 *   const { mouse, keyboard, screen } = platform.createControl();
 */

const path = require('path');

/**
 * Detect current platform
 * @returns {'windows' | 'linux' | 'darwin'}
 */
function detectPlatform() {
  const platform = process.platform;
  switch (platform) {
    case 'win32': return 'windows';
    case 'linux': return 'linux';
    case 'darwin': return 'darwin';
    default: return 'unknown';
  }
}

/**
 * Create platform-specific control implementation
 * @param {Object} options
 * @param {Object} options.log - Logger function
 * @returns {Object} Control implementation
 */
function createControl(options = {}) {
  const platform = detectPlatform();
  const log = options.log || ((...args) => console.log('[Platform]', ...args));

  log(`Initializing platform control for: ${platform}`);

  let control;
  switch (platform) {
    case 'windows':
      control = require('./WindowsControl.cjs');
      break;
    case 'linux':
      control = require('./LinuxControl.cjs');
      break;
    case 'darwin':
      control = require('./DarwinControl.cjs');
      break;
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }

  return control.create(log);
}

/**
 * Get platform info
 * @returns {{ platform: string, arch: string, version: string }}
 */
function getPlatformInfo() {
  return {
    platform: detectPlatform(),
    arch: process.arch,
    version: process.release?.name || '',
  };
}

/**
 * Check if current platform supports control features
 * @returns {boolean}
 */
function isControlSupported() {
  const platform = detectPlatform();
  return ['windows', 'linux', 'darwin'].includes(platform);
}

module.exports = {
  detectPlatform,
  createControl,
  getPlatformInfo,
  isControlSupported,
};
