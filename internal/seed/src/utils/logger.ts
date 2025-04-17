export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4
}

let globalLogLevel = LogLevel.INFO;

export function setGlobalLogLevel(level: LogLevel | string): void {
  if (typeof level === 'string') {
    switch (level.toLowerCase()) {
      case 'debug': globalLogLevel = LogLevel.DEBUG; break;
      case 'info': globalLogLevel = LogLevel.INFO; break;
      case 'warn': globalLogLevel = LogLevel.WARN; break;
      case 'error': globalLogLevel = LogLevel.ERROR; break;
      case 'none': globalLogLevel = LogLevel.NONE; break;
      default: globalLogLevel = LogLevel.INFO;
    }
  } else {
    globalLogLevel = level;
  }
}

class Logger {
  private moduleName: string;
  private logLevel: LogLevel;

  constructor(moduleName: string, logLevel: LogLevel = globalLogLevel) {
    this.moduleName = moduleName;
    this.logLevel = logLevel;
  }

  setLevel(level: LogLevel | string): void {
    if (typeof level === 'string') {
      switch (level.toLowerCase()) {
        case 'debug': this.logLevel = LogLevel.DEBUG; break;
        case 'info': this.logLevel = LogLevel.INFO; break;
        case 'warn': this.logLevel = LogLevel.WARN; break;
        case 'error': this.logLevel = LogLevel.ERROR; break;
        case 'none': this.logLevel = LogLevel.NONE; break;
        default: this.logLevel = globalLogLevel;
      }
    } else {
      this.logLevel = level;
    }
  }

  debug(message: string): void {
    if (this.logLevel <= LogLevel.DEBUG) {
      console.debug(`[${this.moduleName}] ${message}`);
    }
  }

  info(message: string): void {
    if (this.logLevel <= LogLevel.INFO) {
      console.info(`[${this.moduleName}] ${message}`);
    }
  }

  warn(message: string): void {
    if (this.logLevel <= LogLevel.WARN) {
      console.warn(`[${this.moduleName}] ${message}`);
    }
  }

  error(message: string): void {
    if (this.logLevel <= LogLevel.ERROR) {
      console.error(`[${this.moduleName}] ${message}`);
    }
  }
}

export function getLogger(moduleName: string, logLevel?: LogLevel | string): Logger {
  const logger = new Logger(moduleName);
  if (logLevel !== undefined) {
    logger.setLevel(logLevel);
  }
  return logger;
} 