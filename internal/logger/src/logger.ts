import createLogger from 'logging';

// Wrapper for logging: https://www.npmjs.com/package/logging
export default class Logger {
  private logger: any;
  private log_level: string;

  constructor(name: string, log_level: string = 'INFO', split_logs: boolean = false) {
    this.logger = createLogger?.default ? createLogger.default(name) : createLogger(name);
    this.log_level = (log_level || 'info').toUpperCase();
  }

  fatal(message: any): void {
    if (!['FATAL', 'ERROR', 'WARN', 'INFO', 'DEBUG'].includes(this.log_level)) return;
    this.logger.error(`FATAL: ${message}`);
  }

  error(message: any): void {
    this.err(message);
  }

  err(message: any): void {
    if (!['ERROR', 'WARN', 'INFO', 'DEBUG'].includes(this.log_level)) return;
    this.logger.error(message);
  }

  warn(message: any): void {
    if (!['WARN', 'INFO', 'DEBUG'].includes(this.log_level)) return;
    this.logger.warn(message);
  }

  info(message: any): void {
    if (!['INFO', 'DEBUG'].includes(this.log_level)) return;
    this.logger.info(message);
  }

  debug(message: any): void {
    if (!['DEBUG'].includes(this.log_level) && !process.env?.DEBUG) return;
    this.logger.debug(message);
  }
}
