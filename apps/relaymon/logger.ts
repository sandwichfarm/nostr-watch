import chalk from "npm:chalk";

// Define log levels
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4
}

// Global log level, can be set from config
let globalLogLevel: LogLevel = LogLevel.INFO;

// Set the global log level
export function setGlobalLogLevel(level: LogLevel | string): void {
  if (typeof level === 'string') {
    switch (level.toLowerCase()) {
      case 'debug':
        globalLogLevel = LogLevel.DEBUG;
        break;
      case 'info':
        globalLogLevel = LogLevel.INFO;
        break;
      case 'warn':
        globalLogLevel = LogLevel.WARN;
        break;
      case 'error':
        globalLogLevel = LogLevel.ERROR;
        break;
      case 'none':
        globalLogLevel = LogLevel.NONE;
        break;
      default:
        console.warn(`Unknown log level: ${level}, defaulting to INFO`);
        globalLogLevel = LogLevel.INFO;
    }
  } else {
    globalLogLevel = level;
  }
}

export interface Logger {
  debug: (msg: string) => void;
  info: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
  setLevel: (level: LogLevel | string) => void;
}

export function getLogger(moduleName: string, logLevel?: LogLevel | string): Logger {
  // Instance log level, defaults to global
  let instanceLogLevel = globalLogLevel;
  
  // Set instance log level if provided
  if (logLevel !== undefined) {
    if (typeof logLevel === 'string') {
      switch (logLevel.toLowerCase()) {
        case 'debug':
          instanceLogLevel = LogLevel.DEBUG;
          break;
        case 'info':
          instanceLogLevel = LogLevel.INFO;
          break;
        case 'warn':
          instanceLogLevel = LogLevel.WARN;
          break;
        case 'error':
          instanceLogLevel = LogLevel.ERROR;
          break;
        case 'none':
          instanceLogLevel = LogLevel.NONE;
          break;
        default:
          console.warn(`Unknown log level: ${logLevel}, defaulting to INFO`);
          instanceLogLevel = LogLevel.INFO;
      }
    } else {
      instanceLogLevel = logLevel;
    }
  }
  
  return {
    debug: (msg: string) => {
      if (instanceLogLevel <= LogLevel.DEBUG) {
        console.debug(chalk.blue(`[DEBUG] [${moduleName}] ${msg}`));
      }
    },
    info: (msg: string) => {
      if (instanceLogLevel <= LogLevel.INFO) {
        console.info(chalk.green(`[INFO] [${moduleName}] ${msg}`));
      }
    },
    warn: (msg: string) => {
      if (instanceLogLevel <= LogLevel.WARN) {
        console.warn(chalk.yellow(`[WARN] [${moduleName}] ${msg}`));
      }
    },
    error: (msg: string) => {
      if (instanceLogLevel <= LogLevel.ERROR) {
        console.error(chalk.red(`[ERROR] [${moduleName}] ${msg}`));
      }
    },
    setLevel: (level: LogLevel | string) => {
      if (typeof level === 'string') {
        switch (level.toLowerCase()) {
          case 'debug':
            instanceLogLevel = LogLevel.DEBUG;
            break;
          case 'info':
            instanceLogLevel = LogLevel.INFO;
            break;
          case 'warn':
            instanceLogLevel = LogLevel.WARN;
            break;
          case 'error':
            instanceLogLevel = LogLevel.ERROR;
            break;
          case 'none':
            instanceLogLevel = LogLevel.NONE;
            break;
          default:
            console.warn(`Unknown log level: ${level}, defaulting to INFO`);
            instanceLogLevel = LogLevel.INFO;
        }
      } else {
        instanceLogLevel = level;
      }
    }
  };
}
