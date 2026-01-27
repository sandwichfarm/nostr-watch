export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

let globalLogLevel: LogLevel = 'info';

export function setGlobalLogLevel(level: LogLevel): void {
  globalLogLevel = level;
}

export function getLogger(context: string) {
  const levels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
  };

  const currentLevel = levels[globalLogLevel];

  return {
    debug: (message: string, ...args: any[]) => {
      if (currentLevel <= levels.debug) {
        console.debug(`[${context}] ${message}`, ...args);
      }
    },
    info: (message: string, ...args: any[]) => {
      if (currentLevel <= levels.info) {
        console.info(`[${context}] ${message}`, ...args);
      }
    },
    warn: (message: string, ...args: any[]) => {
      if (currentLevel <= levels.warn) {
        console.warn(`[${context}] ${message}`, ...args);
      }
    },
    error: (message: string, ...args: any[]) => {
      if (currentLevel <= levels.error) {
        console.error(`[${context}] ${message}`, ...args);
      }
    }
  };
} 