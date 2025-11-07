import PQueueAdapter from './adapters/PQueueAdapter';
import BullMqAdapter from './adapters/BullMqAdapter';
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
  switch (mergedOptions.adapter) {
    case 'bullmq':
      logger.info('Using BullMQ adapter');
      $adapter = new BullMqAdapter(relays, mergedOptions);
      $adapter.init();
      return $adapter;
    case 'pqueue':
    default:
      logger.info('Using PQueue adapter');
      $adapter = new PQueueAdapter(relays, mergedOptions as PQueueAdapterOptions);
      $adapter.init();
      return $adapter;
  }
};

export * from './types';
export * from './utils';