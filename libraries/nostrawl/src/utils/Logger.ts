import chalk from 'chalk';

/**
 * Log levels in order of verbosity
 */
export enum LogLevel {
  SILENT = 0,
  ERROR = 1,
  WARN = 2,
  INFO = 3,
  DEBUG = 4,
  TRACE = 5
}

/**
 * Logger configuration options
 */
export interface LoggerOptions {
  level?: LogLevel;
  prefix?: string;
  timestamp?: boolean;
}

/**
 * A simple, colorful logger with support for log levels
 */
export default class Logger {
  private level: LogLevel;
  private prefix: string;
  private timestamp: boolean;

  /**
   * Create a new logger
   * @param options Logger options
   */
  constructor(options: LoggerOptions = {}) {
    this.level = options.level ?? LogLevel.SILENT;
    this.prefix = options.prefix ?? 'nostrawl';
    this.timestamp = options.timestamp ?? true;
  }

  /**
   * Set the log level
   * @param level The log level to set
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * Get the current log level
   */
  getLevel(): LogLevel {
    return this.level;
  }

  /**
   * Format a log message with timestamp and prefix
   * @param message The message to format
   */
  private format(message: string): string {
    const parts = [];
    
    if (this.timestamp) {
      parts.push(chalk.gray(`[${new Date().toISOString()}]`));
    }
    
    if (this.prefix) {
      parts.push(chalk.blue(`[${this.prefix}]`));
    }
    
    parts.push(message);
    return parts.join(' ');
  }

  /**
   * Log a trace level message
   * @param message The message to log
   * @param args Additional arguments to log
   */
  trace(message: string, ...args: any[]): void {
    if (this.level >= LogLevel.TRACE) {
      console.trace(this.format(chalk.gray(message)), ...args);
    }
  }

  /**
   * Log a debug level message
   * @param message The message to log
   * @param args Additional arguments to log
   */
  debug(message: string, ...args: any[]): void {
    if (this.level >= LogLevel.DEBUG) {
      console.debug(this.format(chalk.cyan(message)), ...args);
    }
  }

  /**
   * Log an info level message
   * @param message The message to log
   * @param args Additional arguments to log
   */
  info(message: string, ...args: any[]): void {
    if (this.level >= LogLevel.INFO) {
      console.info(this.format(message), ...args);
    }
  }

  /**
   * Log a warning level message
   * @param message The message to log
   * @param args Additional arguments to log
   */
  warn(message: string, ...args: any[]): void {
    if (this.level >= LogLevel.WARN) {
      console.warn(this.format(chalk.yellow(message)), ...args);
    }
  }

  /**
   * Log an error level message
   * @param message The message to log
   * @param args Additional arguments to log
   */
  error(message: string, ...args: any[]): void {
    if (this.level >= LogLevel.ERROR) {
      console.error(this.format(chalk.red(message)), ...args);
    }
  }

  /**
   * Create a child logger with a specific prefix
   * @param prefix The prefix for the child logger
   */
  child(prefix: string): Logger {
    return new Logger({
      level: this.level,
      prefix: `${this.prefix}:${prefix}`,
      timestamp: this.timestamp
    });
  }
} 