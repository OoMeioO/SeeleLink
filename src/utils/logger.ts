export enum LogLevel { DEBUG = 0, INFO = 1, WARN = 2, ERROR = 3 }
const colors: Record<number, string> = { [LogLevel.DEBUG]: '\x1b[36m', [LogLevel.INFO]: '\x1b[32m', [LogLevel.WARN]: '\x1b[33m', [LogLevel.ERROR]: '\x1b[31m' };
export class Logger {
  constructor(private prefix = 'SeeleLink', private level = LogLevel.INFO) {}
  setLevel(level: LogLevel) { this.level = level; }
  private log(level: LogLevel, ...args: unknown[]) {
    if (level < this.level) return;
    const ts = new Date().toISOString().split('T')[1].split('.')[0];
    console.log(`${colors[level]}[${ts}] [${this.prefix}]${'\x1b[0m'}`, ...args);
  }
  debug(...a: unknown[]) { this.log(LogLevel.DEBUG, ...a); }
  info(...a: unknown[]) { this.log(LogLevel.INFO, ...a); }
  warn(...a: unknown[]) { this.log(LogLevel.WARN, ...a); }
  error(...a: unknown[]) { this.log(LogLevel.ERROR, ...a); }
}
export const logger = new Logger();
