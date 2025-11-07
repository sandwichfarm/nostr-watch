import PQueueAdapter from './adapters/PQueueAdapter';
import { TrawlerOptions, PQueueAdapterOptions } from './types';
import { logger, LogLevel, configureLogger } from './utils';

const defaultOptions: TrawlerOptions = {
  queueName: 'nostr',
  repeatWhenComplete: true,
  restDuration: 1000,
  cache: {
    enabled: true,
    path: './cache'
  },
  logLevel: LogLevel.INFO
};

export const nostrawl = (relays: string[], options: Partial<TrawlerOptions> = {}) => {
  const mergedOptions = { ...defaultOptions, ...options };
  
  // Configure the global logger with the provided log level
  if (mergedOptions.logLevel !== undefined) {
    configureLogger({ level: mergedOptions.logLevel });
  }
  
  logger.info('Initializing nostrawl with adapter:', mergedOptions.adapter || 'pqueue');
  logger.debug('Options:', mergedOptions);
  
  let $adapter;
  // Only support pqueue in this monorepo build; default if unspecified
  if (mergedOptions.adapter && mergedOptions.adapter !== 'pqueue') {
    logger.warn(`Adapter '${mergedOptions.adapter}' is not available in this build. Falling back to 'pqueue'.`);
  }
  logger.info('Using PQueue adapter');
  $adapter = new PQueueAdapter(relays, mergedOptions as PQueueAdapterOptions);
  $adapter.init();
  return $adapter;
};

export * from './types';
export * from './utils';
