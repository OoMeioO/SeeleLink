/**
 * SeeleLink Unit Tests
 *
 * These tests cover pure utility functions that don't require Electron.
 * Integration tests (require running Electron) are in tests/integration/
 */

import { describe, it, expect } from 'vitest';

// ─────────────────────────────────────────────────────────────────
// Helper utilities (replicated here to avoid Electron dependency)
// ─────────────────────────────────────────────────────────────────

function sendControlCommand(cmd, args = []) {
  return { cmd, args };
}

function parseArgs(input) {
  if (!input) return {};
  if (typeof input === 'string') {
    const parts = input.trim().split(/\s+/);
    return { cmd: parts[0], args: parts.slice(1) };
  }
  return input;
}

function validatePort(port) {
  const n = parseInt(port, 10);
  return !isNaN(n) && n > 0 && n < 65536;
}

function sanitizeLogPath(path) {
  return path.replace(/\\/g, '/').replace(/\/\/+/g, '/');
}

// ─────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────

describe('sendControlCommand', () => {
  it('creates correct command object', () => {
    const result = sendControlCommand('ping');
    expect(result).toEqual({ cmd: 'ping', args: [] });
  });

  it('includes args when provided', () => {
    const result = sendControlCommand('window:click', [100, 200]);
    expect(result).toEqual({ cmd: 'window:click', args: [100, 200] });
  });

  it('handles string args', () => {
    const result = sendControlCommand('control:keyboard:type', ['hello']);
    expect(result.args).toEqual(['hello']);
  });
});

describe('parseArgs', () => {
  it('parses simple command', () => {
    const result = parseArgs('ping');
    expect(result).toEqual({ cmd: 'ping', args: [] });
  });

  it('parses command with args', () => {
    const result = parseArgs('window:click 100 200');
    expect(result).toEqual({ cmd: 'window:click', args: ['100', '200'] });
  });

  it('returns empty object for null', () => {
    expect(parseArgs(null)).toEqual({});
  });

  it('returns empty object for undefined', () => {
    expect(parseArgs(undefined)).toEqual({});
  });

  it('returns empty object for empty string', () => {
    expect(parseArgs('')).toEqual({});
  });
});

describe('validatePort', () => {
  it('accepts valid ports', () => {
    expect(validatePort(9380)).toBe(true);
    expect(validatePort(9381)).toBe(true);
    expect(validatePort(80)).toBe(true);
    expect(validatePort(443)).toBe(true);
    expect(validatePort(1)).toBe(true);
    expect(validatePort(65535)).toBe(true);
  });

  it('rejects invalid ports', () => {
    expect(validatePort(0)).toBe(false);
    expect(validatePort(-1)).toBe(false);
    expect(validatePort(65536)).toBe(false);
    expect(validatePort(70000)).toBe(false);
    expect(validatePort(NaN)).toBe(false);
  });

  it('handles string numbers', () => {
    expect(validatePort('9380')).toBe(true);
    expect(validatePort('abc')).toBe(false);
  });
});

describe('sanitizeLogPath', () => {
  it('normalizes backslashes', () => {
    expect(sanitizeLogPath('C:\\Users\\test\\logs')).toBe('C:/Users/test/logs');
  });

  it('collapses double slashes', () => {
    expect(sanitizeLogPath('C://Users//test//logs')).toBe('C:/Users/test/logs');
  });

  it('passes through unix paths', () => {
    expect(sanitizeLogPath('/home/user/logs')).toBe('/home/user/logs');
  });
});
