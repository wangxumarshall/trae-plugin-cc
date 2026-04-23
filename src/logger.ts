import { LogLevel, LogEntry } from './types';

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private level: LogLevel;
  private jsonMode: boolean;

  constructor(options?: { level?: LogLevel; json?: boolean }) {
    this.level = options?.level ?? 'info';
    this.jsonMode = options?.json ?? false;
  }

  private shouldLog(level: LogLevel): boolean {
    return LEVEL_ORDER[level] >= LEVEL_ORDER[this.level];
  }

  private format(level: LogLevel, message: string, data?: Record<string, unknown>): string {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...(data ? { data } : {}),
    };

    if (this.jsonMode) {
      return JSON.stringify(entry);
    }

    const prefix = {
      debug: '[DEBUG]',
      info: '[INFO]',
      warn: '[WARN]',
      error: '[ERROR]',
    }[level];

    return `${prefix} ${message}`;
  }

  debug(message: string, data?: Record<string, unknown>): void {
    if (!this.shouldLog('debug')) return;
    process.stdout.write(this.format('debug', message, data) + '\n');
  }

  info(message: string, data?: Record<string, unknown>): void {
    if (!this.shouldLog('info')) return;
    process.stdout.write(this.format('info', message, data) + '\n');
  }

  warn(message: string, data?: Record<string, unknown>): void {
    if (!this.shouldLog('warn')) return;
    process.stderr.write(this.format('warn', message, data) + '\n');
  }

  error(message: string, data?: Record<string, unknown>): void {
    if (!this.shouldLog('error')) return;
    process.stderr.write(this.format('error', message, data) + '\n');
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  setJsonMode(json: boolean): void {
    this.jsonMode = json;
  }
}

export const logger = new Logger();

export function createLogger(options?: { level?: LogLevel; json?: boolean }): Logger {
  return new Logger(options);
}

export default logger;
