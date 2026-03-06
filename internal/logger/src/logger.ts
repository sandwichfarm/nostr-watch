let debug: typeof import('debug') | null = null;
let isDebugAvailable = false;

let winston: typeof import('winston') | null = null;
let isWinstonAvailable = false;

if (typeof window === 'undefined' && typeof globalThis.require === 'function') {
  try {
    const { createRequire } = globalThis.require('module');
    const requireModule = createRequire(import.meta.url);
    winston = requireModule('winston');
    isWinstonAvailable = true;

    debug = requireModule('debug');
    isDebugAvailable = true;
  } catch (e) {
    winston = null;
    isWinstonAvailable = false;

    debug = null;
    isDebugAvailable = false;
  }
} else {
  winston = null;
  isWinstonAvailable = false;

  debug = null;
  isDebugAvailable = false;
}

const customLevels = {
  levels: {
    fatal: 0,
    error: 1,
    err: 1,
    warn: 2,
    info: 3,
    debug: 4,
  },
  colors: {
    fatal: 'red',
    error: 'red',
    err: 'red',
    warn: 'yellow',
    info: 'green',
    debug: 'blue',
  },
};

if (isWinstonAvailable && winston) {
  winston.addColors(customLevels.colors);
}

export default class Logger {
  private logger: any;
  private log_level: string;
  private debugInstance: any;
  private namespace: string;

  constructor(name: string, log_level: string = 'INFO', split_logs: boolean = false) {
    this.namespace = name;
    this.log_level = (log_level || 'INFO').toUpperCase();

    if (isDebugAvailable && debug) {
      this.debugInstance = debug(name);
    } else {
      const noop = () => {};
      noop.enabled = false;
      this.debugInstance = noop;
    }

    if (isWinstonAvailable && winston) {
      this.logger = winston.createLogger({
        levels: customLevels.levels,
        level: this.log_level.toLowerCase(),
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.label({ label: name }),
          winston.format.timestamp(),
          winston.format.printf(({ timestamp, level, message, label }) => {
            return `${timestamp} [${label}] ${level}: ${message}`;
          })
        ),
        transports: [new winston.transports.Console()],
      });
    } else {
      this.logger = console;
    }
  }

  private isLevelEnabled(level: string): boolean {
    const levelOrder = ['FATAL', 'ERROR', 'WARN', 'INFO', 'DEBUG'];
    const currentLevelIndex = levelOrder.indexOf(this.log_level);
    const messageLevelIndex = levelOrder.indexOf(level);

    if (messageLevelIndex <= currentLevelIndex) {
      return true;
    }

    if (level === 'DEBUG') {
      return this.debugInstance.enabled;
    }

    return false;
  }

  fatal(message: any): void {
    if (this.isLevelEnabled('FATAL')) {
      if (isWinstonAvailable && winston) {
        this.logger.log('fatal', message);
      } else {
        this.logger.error(`FATAL: ${message}`);
      }
    }
  }

  error(message: any): void {
    this.err(message);
  }

  err(message: any): void {
    if (this.isLevelEnabled('ERROR')) {
      if (isWinstonAvailable && winston) {
        this.logger.log('error', message);
      } else {
        this.logger.error(message);
      }
    }
  }

  warn(message: any): void {
    if (this.isLevelEnabled('WARN')) {
      if (isWinstonAvailable && winston) {
        this.logger.log('warn', message);
      } else {
        this.logger.warn(message);
      }
    }
  }

  info(message: any): void {
    if (this.isLevelEnabled('INFO')) {
      if (isWinstonAvailable && winston) {
        this.logger.log('info', message);
      } else {
        this.logger.info(message);
      }
    }
  }

  debug(message: any): void {
    if (this.isLevelEnabled('DEBUG')) {
      if (isWinstonAvailable && winston) {
        this.logger.log('debug', message);
      } else {
        this.logger.debug(message);
      }
    }
  }
}
