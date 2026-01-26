export const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

const LOG_LEVEL_RANK: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

let globalLogLevel: LogLevel = 'warn';

export function isLogLevel(value: unknown): value is LogLevel {
  return typeof value === 'string' && (LOG_LEVELS as readonly string[]).includes(value);
}

export function normalizeLogLevel(value: unknown, fallback: LogLevel = globalLogLevel): LogLevel {
  return isLogLevel(value) ? value : fallback;
}

export function getGlobalLogLevel(): LogLevel {
  return globalLogLevel;
}

export function setGlobalLogLevel(level: LogLevel): void {
  globalLogLevel = level;
}

export type Logger = {
  debug: (message: string, ...args: any[]) => void;
  info: (message: string, ...args: any[]) => void;
  warn: (message: string, ...args: any[]) => void;
  error: (message: string, ...args: any[]) => void;
};

export function getLogger(context: string): Logger {
  const prefix = `[${context}]`;

  const debug = (message: string, ...args: any[]) => {
    if (LOG_LEVEL_RANK[globalLogLevel] <= LOG_LEVEL_RANK.debug) {
      console.debug(prefix, message, ...args);
    }
  };

  const info = (message: string, ...args: any[]) => {
    if (LOG_LEVEL_RANK[globalLogLevel] <= LOG_LEVEL_RANK.info) {
      console.info(prefix, message, ...args);
    }
  };

  const warn = (message: string, ...args: any[]) => {
    if (LOG_LEVEL_RANK[globalLogLevel] <= LOG_LEVEL_RANK.warn) {
      console.warn(prefix, message, ...args);
    }
  };

  const error = (message: string, ...args: any[]) => {
    if (LOG_LEVEL_RANK[globalLogLevel] <= LOG_LEVEL_RANK.error) {
      console.error(prefix, message, ...args);
    }
  };

  return { debug, info, warn, error };
}

type ConsoleMethod = 'debug' | 'info' | 'log' | 'warn' | 'error';

const CONSOLE_METHOD_LEVEL: Record<ConsoleMethod, LogLevel> = {
  debug: 'debug',
  info: 'info',
  log: 'info',
  warn: 'warn',
  error: 'error',
};

const CONSOLE_ORIGINALS_KEY = '__nostrwatch_console_originals__';

function getConsoleOriginals(): Partial<Record<ConsoleMethod, (...args: any[]) => void>> {
  const g = globalThis as any;
  if (g[CONSOLE_ORIGINALS_KEY]) return g[CONSOLE_ORIGINALS_KEY];
  const originals: Partial<Record<ConsoleMethod, (...args: any[]) => void>> = {};
  const c = g.console as Console | undefined;
  if (!c) return originals;
  originals.debug = c.debug?.bind(c);
  originals.info = c.info?.bind(c);
  originals.log = c.log?.bind(c);
  originals.warn = c.warn?.bind(c);
  originals.error = c.error?.bind(c);
  g[CONSOLE_ORIGINALS_KEY] = originals;
  return originals;
}

let consoleFilterInstalled = false;

export function installConsoleLogLevelFilter(): void {
  if (consoleFilterInstalled) return;
  if (typeof console === 'undefined') return;

  const originals = getConsoleOriginals();
  const shouldAllow = (method: ConsoleMethod) =>
    LOG_LEVEL_RANK[CONSOLE_METHOD_LEVEL[method]] >= LOG_LEVEL_RANK[globalLogLevel];

  const wrap = (method: ConsoleMethod) => {
    const original = originals[method];
    if (!original) return;
    (console as any)[method] = (...args: any[]) => {
      if (!shouldAllow(method)) return;
      original(...args);
    };
  };

  wrap('debug');
  wrap('info');
  wrap('log');
  wrap('warn');
  wrap('error');

  consoleFilterInstalled = true;
}

