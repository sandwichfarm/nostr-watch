import Logger, { LogLevel } from './Logger';
import type { LoggerOptions } from './Logger';

// Create a default instance of the logger
const logger = new Logger({
  prefix: 'nostrawl',
  level: LogLevel.INFO,
  timestamp: true
});

/**
 * Configure the global logger
 * @param options Logger options
 */
export const configureLogger = (options: LoggerOptions): void => {
  if (options.level !== undefined) {
    logger.setLevel(options.level);
  }
};

export { logger, Logger, LogLevel };
export type { LoggerOptions }; 