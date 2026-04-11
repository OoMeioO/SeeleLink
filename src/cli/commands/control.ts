/**
 * CLI Control Commands - Command line interface for control services
 * 
 * Provides commands like:
 * - seelelink mouse move 100 200
 * - seelelink keyboard type "hello"
 * - seelelink screen capture
 * - seelelink debug logs
 */

import { getControlService, ControlService } from '../services/control/ControlService';

export interface CLICommand {
  name: string;
  description: string;
  subcommands?: CLICommand[];
  action: (args: string[]) => Promise<void>;
}

export function createControlCommands(): CLICommand[] {
  const service = getControlService();
  
  return [
    // ========== Mouse Commands ==========
    {
      name: 'mouse',
      description: 'Mouse control',
      subcommands: [
        {
          name: 'position',
          description: 'Get current mouse position',
          action: async () => {
            const pos = await service.mouse.getPosition();
            console.log(`Mouse position: X=${pos.x}, Y=${pos.y}`);
          },
        },
        {
          name: 'move',
          description: 'Move mouse to position',
          action: async (args) => {
            const [x, y] = args.map(Number);
            if (isNaN(x) || isNaN(y)) {
              console.error('Usage: seelelink mouse move <x> <y>');
              process.exit(1);
            }
            await service.mouse.setPosition(x, y);
            console.log(`Mouse moved to X=${x}, Y=${y}`);
          },
        },
        {
          name: 'click',
          description: 'Click at position',
          action: async (args) => {
            const [x, y, button] = args;
            if (!x || !y) {
              console.error('Usage: seelelink mouse click <x> <y> [left|right|middle]');
              process.exit(1);
            }
            await service.mouse.click(Number(x), Number(y), button as any || 'left');
            console.log(`Clicked at X=${x}, Y=${y}`);
          },
        },
        {
          name: 'drag',
          description: 'Drag from one position to another',
          action: async (args) => {
            const [fromX, fromY, toX, toY] = args.map(Number);
            if (args.length < 4) {
              console.error('Usage: seelelink mouse drag <fromX> <fromY> <toX> <toY>');
              process.exit(1);
            }
            await service.mouse.drag(
              { x: fromX, y: fromY },
              { x: toX, y: toY }
            );
            console.log(`Dragged from (${fromX}, ${fromY}) to (${toX}, ${toY})`);
          },
        },
      ],
    },
    
    // ========== Keyboard Commands ==========
    {
      name: 'keyboard',
      description: 'Keyboard control',
      subcommands: [
        {
          name: 'type',
          description: 'Type text',
          action: async (args) => {
            const text = args.join(' ');
            if (!text) {
              console.error('Usage: seelelink keyboard type <text>');
              process.exit(1);
            }
            await service.keyboard.typeText(text);
            console.log(`Typed: "${text}"`);
          },
        },
        {
          name: 'press',
          description: 'Press a key',
          action: async (args) => {
            const [key] = args;
            if (!key) {
              console.error('Usage: seelelink keyboard press <key>');
              process.exit(1);
            }
            await service.keyboard.pressKey(key);
            console.log(`Pressed: ${key}`);
          },
        },
        {
          name: 'hotkey',
          description: 'Press key combination',
          action: async (args) => {
            if (args.length < 2) {
              console.error('Usage: seelelink keyboard hotkey <key1> <key2> [...]');
              process.exit(1);
            }
            await service.keyboard.pressKeys(args);
            console.log(`Pressed: ${args.join('+')}`);
          },
        },
        {
          name: 'copy',
          description: 'Copy (Ctrl+C)',
          action: async () => {
            await service.keyboard.copy();
            console.log('Copy');
          },
        },
        {
          name: 'paste',
          description: 'Paste (Ctrl+V)',
          action: async () => {
            await service.keyboard.paste();
            console.log('Paste');
          },
        },
        {
          name: 'selectall',
          description: 'Select all (Ctrl+A)',
          action: async () => {
            await service.keyboard.selectAll();
            console.log('Select all');
          },
        },
      ],
    },
    
    // ========== Screen Commands ==========
    {
      name: 'screen',
      description: 'Screen capture',
      subcommands: [
        {
          name: 'list',
          description: 'List all screens',
          action: async () => {
            const screens = await service.screen.listScreens();
            console.log('Available screens:');
            for (const s of screens) {
              console.log(`  ${s.id}: ${s.name} (${s.width}x${s.height}) ${s.isPrimary ? '[PRIMARY]' : ''}`);
            }
          },
        },
        {
          name: 'capture',
          description: 'Capture screenshot',
          action: async (args) => {
            const [path, format] = args;
            const screenshot = await service.screen.capture();
            if (path) {
              await service.screen.captureAndSave(path, format as any || 'png');
              console.log(`Screenshot saved to: ${path}`);
            } else {
              // Output base64 to stdout
              console.log(screenshot.base64);
            }
          },
        },
        {
          name: 'capture-region',
          description: 'Capture region',
          action: async (args) => {
            const [x, y, width, height] = args.map(Number);
            if (args.length < 4) {
              console.error('Usage: seelelink screen capture-region <x> <y> <width> <height>');
              process.exit(1);
            }
            const screenshot = await service.screen.captureRegion(x, y, width, height);
            console.log(`Captured region (${x}, ${y}) ${width}x${height}`);
            console.log(screenshot.base64);
          },
        },
      ],
    },
    
    // ========== Debug Commands ==========
    {
      name: 'debug',
      description: 'Debug logging',
      subcommands: [
        {
          name: 'logs',
          description: 'Show debug logs',
          action: async (args) => {
            const level = args.find(a => a.startsWith('--level='))?.split('=')[1] as any;
            const limit = Number(args.find(a => a.startsWith('--limit='))?.split('=')[1]) || 50;
            
            const logs = service.debug.getLogs({ level, limit });
            
            if (logs.length === 0) {
              console.log('No logs');
              return;
            }
            
            for (const log of logs) {
              const time = new Date(log.timestamp).toLocaleTimeString();
              const levelStr = log.level.toUpperCase().padEnd(5);
              console.log(`[${time}] [${levelStr}] [${log.service}] ${log.action}`);
              if (log.params) {
                console.log(`  Params: ${JSON.stringify(log.params)}`);
              }
              if (log.error) {
                console.log(`  Error: ${log.error}`);
              }
            }
          },
        },
        {
          name: 'stats',
          description: 'Show debug statistics',
          action: async () => {
            const stats = service.debug.getStats();
            console.log('Debug Statistics:');
            for (const [svc, data] of Object.entries(stats)) {
              console.log(`  ${svc}:`);
              console.log(`    Total: ${data.total}`);
              console.log(`    Debug: ${data.byLevel.debug}`);
              console.log(`    Info: ${data.byLevel.info}`);
              console.log(`    Warn: ${data.byLevel.warn}`);
              console.log(`    Error: ${data.byLevel.error}`);
            }
          },
        },
        {
          name: 'clear',
          description: 'Clear debug logs',
          action: async () => {
            service.debug.clearLogs();
            console.log('Logs cleared');
          },
        },
        {
          name: 'level',
          description: 'Set debug level',
          action: async (args) => {
            const [level] = args;
            const validLevels = ['debug', 'info', 'warn', 'error'];
            if (!validLevels.includes(level)) {
              console.error(`Invalid level. Valid levels: ${validLevels.join(', ')}`);
              process.exit(1);
            }
            service.debug.setLevel(level as any);
            console.log(`Debug level set to: ${level}`);
          },
        },
        {
          name: 'export',
          description: 'Export logs',
          action: async (args) => {
            const [format] = args;
            const fmt = format === 'text' ? 'text' : 'json';
            const data = fmt === 'json' 
              ? service.debug.exportJSON() 
              : service.debug.exportText();
            console.log(data);
          },
        },
      ],
    },
  ];
}

// CLI parser
export async function parseCLI(args: string[]): Promise<void> {
  const commands = createControlCommands();
  
  if (args.length === 0) {
    console.log('Available commands:');
    for (const cmd of commands) {
      console.log(`  ${cmd.name}: ${cmd.description}`);
      if (cmd.subcommands) {
        for (const sub of cmd.subcommands) {
          console.log(`    ${cmd.name} ${sub.name}: ${sub.description}`);
        }
      }
    }
    return;
  }
  
  const [cmdName, subName, ...rest] = args;
  
  const cmd = commands.find(c => c.name === cmdName);
  if (!cmd) {
    console.error(`Unknown command: ${cmdName}`);
    process.exit(1);
  }
  
  if (cmd.subcommands && subName) {
    const sub = cmd.subcommands.find(s => s.name === subName);
    if (!sub) {
      console.error(`Unknown subcommand: ${cmdName} ${subName}`);
      process.exit(1);
    }
    await sub.action(rest);
  } else if (cmd.action) {
    await cmd.action([subName, ...rest]);
  } else {
    console.error(`Usage: seelelink <command> [subcommand] [args]`);
    process.exit(1);
  }
}
