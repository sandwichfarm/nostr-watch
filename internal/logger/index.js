import createLogger from 'logging';

// Wrapper for logging: https://www.npmjs.com/package/logging
export default class Logger {
  constructor(name, log_level = "INFO", split_logs = false) {
    this.logger = createLogger?.default ? createLogger.default(name) : createLogger(name);
    this.log_level = (log_level || 'info').toUpperCase();
    this.split_logs = split_logs || false;
  }

  fatal(message) {
    if (!['FATAL', 'ERROR', 'WARN', 'INFO', 'DEBUG'].includes(this?.log_level)) return;
    this.logger.error(`FATAL: ${message}`);
  }

  error(message){
    this.err(message)
  }

  err(message) {
    if (!['ERROR', 'WARN', 'INFO', 'DEBUG'].includes(this?.log_level)) return;
    this.logger.error(message);
  }

  warn(message) {
    if (!['WARN', 'INFO', 'DEBUG'].includes(this?.log_level)) return;
    this.logger.warn(message);
  }

  info(message) {
    if (!['INFO', 'DEBUG'].includes(this?.log_level)) return;
    this.logger.info(message);
  }

  debug(message) {
    if (!['DEBUG'].includes(this?.log_level) && !process.env?.DEBUG) return;
    this.logger.debug(message);
  }
}
