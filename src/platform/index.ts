/**
 * Platform Abstraction Layer
 * 
 * Provides unified interface for platform-specific functionality:
 * - OS detection
 * - Shell paths
 * - Serial port normalization
 * - Platform-specific implementations
 */

export type PlatformType = 'windows' | 'linux' | 'darwin' | 'unknown';

export interface Platform {
  readonly type: PlatformType;
  readonly arch: string;
  readonly version: string;
  
  // Detection helpers
  isWindows(): boolean;
  isLinux(): boolean;
  isMacOS(): boolean;
  
  // Shell paths
  getDefaultShell(): string;
  getShells(): ShellInfo[];
  
  // Serial port normalization
  normalizeSerialPath(path: string): string;
  listSerialPorts(): Promise<string[]>;
}

export interface ShellInfo {
  name: string;
  path: string;
  args?: string[];
}

// Singleton instance
let platformInstance: Platform | null = null;

function detectPlatform(): PlatformType {
  if (typeof process !== 'undefined' && process.platform) {
    switch (process.platform) {
      case 'win32': return 'windows';
      case 'linux': return 'linux';
      case 'darwin': return 'darwin';
    }
  }
  return 'unknown';
}

function createPlatform(): Platform {
  const type = detectPlatform();
  
  const commonPlatform: Pick<Platform, 
    | 'isWindows' 
    | 'isLinux' 
    | 'isMacOS' 
    | 'normalizeSerialPath'
  > = {
    isWindows: () => type === 'windows',
    isLinux: () => type === 'linux',
    isMacOS: () => type === 'darwin',
    
    normalizeSerialPath(path: string): string {
      // Windows: COM1, COM2, etc. - already normalized
      // Linux/macOS: /dev/ttyUSB0, /dev/tty.usbserial, etc.
      return path;
    },
  };
  
  switch (type) {
    case 'windows':
      return {
        type: 'windows',
        arch: process.arch || 'x64',
        version: '',
        ...commonPlatform,
        
        getDefaultShell(): string {
          return 'powershell.exe';
        },
        
        getShells(): ShellInfo[] {
          return [
            { name: 'PowerShell', path: 'powershell.exe', args: ['-NoLogo', '-NoExit'] },
            { name: 'CMD', path: 'cmd.exe', args: [] },
            { name: 'Windows Terminal', path: 'wt.exe', args: [] },
          ];
        },
        
        async listSerialPorts(): Promise<string[]> {
          // Will be implemented by SerialService
          return [];
        },
      };
      
    case 'linux':
      return {
        type: 'linux',
        arch: process.arch || 'x64',
        version: '',
        ...commonPlatform,
        
        getDefaultShell(): string {
          return process.env.SHELL || '/bin/bash';
        },
        
        getShells(): ShellInfo[] {
          return [
            { name: 'Bash', path: '/bin/bash', args: [] },
            { name: 'Zsh', path: '/bin/zsh', args: [] },
            { name: 'Dash', path: '/bin/dash', args: [] },
            { name: 'PowerShell', path: '/usr/bin/pwsh', args: [] },
          ];
        },
        
        async listSerialPorts(): Promise<string[]> {
          // Will be implemented by SerialService
          return [];
        },
      };
      
    case 'darwin':
      return {
        type: 'darwin',
        arch: process.arch || 'x64',
        version: '',
        ...commonPlatform,
        
        getDefaultShell(): string {
          return process.env.SHELL || '/bin/zsh';
        },
        
        getShells(): ShellInfo[] {
          return [
            { name: 'Zsh', path: '/bin/zsh', args: [] },
            { name: 'Bash', path: '/bin/bash', args: [] },
            { name: 'PowerShell', path: '/usr/local/bin/pwsh', args: [] },
          ];
        },
        
        async listSerialPorts(): Promise<string[]> {
          // Will be implemented by SerialService
          return [];
        },
      };
      
    default:
      return {
        type: 'unknown',
        arch: 'unknown',
        version: '',
        ...commonPlatform,
        
        getDefaultShell(): string {
          return '/bin/sh';
        },
        
        getShells(): ShellInfo[] {
          return [
            { name: 'Shell', path: '/bin/sh', args: [] },
          ];
        },
        
        async listSerialPorts(): Promise<string[]> {
          return [];
        },
      };
  }
}

export function getPlatform(): Platform {
  if (!platformInstance) {
    platformInstance = createPlatform();
  }
  return platformInstance;
}

// Export singleton
export const platform = getPlatform();
