import { nostrawl } from '../../src';
import { TrawlerOptions } from '../../src/types';
import { LogLevel, logger } from '../../src/utils';

/**
 * Basic example demonstrating the usage of the PQueue adapter
 * 
 * This example shows how to:
 * 1. Configure the PQueue adapter with custom options
 * 2. Set up event handlers for queue events and nostr events
 * 3. Configure logging with different log levels
 * 4. Run the trawler with the PQueue adapter
 */
async function main() {
  // Create a child logger for this example
  const exampleLogger = logger.child('example');
  exampleLogger.info('Starting PQueue example...');
  
  // Define the relays to trawl
  const relays = [
    'wss://relay.damus.io',
    'wss://nostr.fmt.wiz.biz',
    'wss://relay.nostr.band',
    'wss://nostr.bitcoiner.social',
    'wss://relay.nostr.info'
  ];

  exampleLogger.info(`Using ${relays.length} relays:`, relays);

  // Get log level from command line arguments, default to INFO
  const logLevelArg = process.argv.find(arg => arg.startsWith('--log-level='));
  let logLevel = LogLevel.SILENT;
  
  if (logLevelArg) {
    const level = logLevelArg.split('=')[1]?.toUpperCase();
    switch (level) {
      case 'SILENT': logLevel = LogLevel.SILENT; break;
      case 'ERROR': logLevel = LogLevel.ERROR; break;
      case 'WARN': logLevel = LogLevel.WARN; break; 
      case 'INFO': logLevel = LogLevel.INFO; break;
      case 'DEBUG': logLevel = LogLevel.DEBUG; break;
      case 'TRACE': logLevel = LogLevel.TRACE; break;
    }
  }
  
  exampleLogger.info(`Using log level: ${LogLevel[logLevel]}`);

  // Configure the PQueue adapter options
  const options: TrawlerOptions = {
    // Specify the adapter to use
    adapter: 'pqueue',
    
    // Set the log level
    logLevel,
    
    // PQueue specific options
    adapterOptions: {
      // Number of concurrent jobs
      concurrency: 2,
      
      // timeout is intentionally not set (undefined)
      // this disables timeouts for long-running jobs
      
      // Cache configuration
      cache: {
        path: './cache'
      }
    },
    
    // General trawler options
    relaysPerBatch: 2,
    
    // Filter for events (only text notes)
    filters: {
      kinds: [1]
    }
  };

  exampleLogger.info('Creating trawler with options:', options);

  // Create a trawler instance with the PQueue adapter
  const trawler = nostrawl(relays, options);

  // Set up event handlers for receiving nostr events
  // This is the recommended way to handle events (easier than using parser)
  trawler.on('event', (event) => {
    exampleLogger.debug(`Received event: ${event.id}`);
    exampleLogger.debug(`From: ${event.pubkey.slice(0, 8)}... | Kind: ${event.kind}`);
    exampleLogger.debug(`Content: ${event.content.slice(0, 80)}${event.content.length > 80 ? '...' : ''}`);
  });

  // Track progress
  trawler.on('progress', (progress) => {
    // Log progress as INFO to ensure it's visible at default log level
    exampleLogger.info(`Progress: ${progress.found} events found, ${progress.rejected} rejected from ${progress.relay}`);
    
    // Log more detailed progress information at DEBUG level
    exampleLogger.debug('Progress details:', {
      found: progress.found,
      rejected: progress.rejected,
      relay: progress.relay,
      last_timestamp: progress.last_timestamp,
      total: progress.total,
      percentage: progress.total > 0 ? `${((progress.found / progress.total) * 100).toFixed(1)}%` : 'N/A'
    });
  });

  // Handle errors
  trawler.on('error', (error) => {
    exampleLogger.error('Error occurred:', error);
  });

  // Queue-specific events
  trawler.on('queue_active', () => {
    exampleLogger.info('Queue is active - processing jobs');
  });

  trawler.on('queue_completed', (result) => {
    exampleLogger.info('Job completed successfully');
    exampleLogger.debug('Job result:', result);
  });

  trawler.on('queue_idle', () => {
    exampleLogger.info('Queue is idle - waiting for more jobs');
  });

  // Initialize and run the trawler
  try {
    exampleLogger.info('Initializing trawler...');
    await trawler.init();
    exampleLogger.info('Trawler initialized');
    
    exampleLogger.info('Starting trawler...');
    await trawler.run();
    exampleLogger.info('Trawler started');

    // Create a promise that resolves when the trawler is done or when stopped
    const trawlerPromise = new Promise<void>((resolve, reject) => {
      let isDone = false;
      let forceExitTimeout: NodeJS.Timeout | null = null;

      const cleanup = (fromSignal = false) => {
        if (!isDone) {
          isDone = true;
          exampleLogger.info('Cleaning up trawler...');
          
          try {
            // Stop the trawler
            trawler.stop();
            
            // If triggered by a signal like SIGINT, set a force exit timeout
            // This ensures the process exits even if trawler.stop() gets stuck
            if (fromSignal) {
              if (forceExitTimeout) {
                clearTimeout(forceExitTimeout);
              }
              forceExitTimeout = setTimeout(() => {
                exampleLogger.warn('Forcing exit after timeout...');
                process.exit(0);
              }, 2000); // Force exit after 2 seconds if stop doesn't complete
            }
            
            resolve();
          } catch (error) {
            exampleLogger.error('Error during cleanup:', error);
            if (fromSignal) {
              process.exit(1);
            } else {
              reject(error);
            }
          }
        }
      };

      // Remove any existing signal handlers to prevent duplicates
      process.removeAllListeners('SIGINT');
      process.removeAllListeners('SIGTERM');

      // Set up cleanup handlers
      process.on('SIGINT', () => {
        exampleLogger.info('Received SIGINT signal (Ctrl+C), cleaning up...');
        cleanup(true);
      });
      
      process.on('SIGTERM', () => {
        exampleLogger.info('Received SIGTERM signal, cleaning up...');
        cleanup(true);
      });

      // Handle completion
      trawler.on('queue_idle', () => {
        exampleLogger.info('All jobs completed');
        cleanup();
      });

      // Handle errors
      trawler.on('error', (error) => {
        exampleLogger.error('Fatal error:', error);
        cleanup();
        reject(error);
      });

      // Set a maximum runtime of 2 minutes
      setTimeout(() => {
        exampleLogger.info('Maximum runtime reached (2 minutes)');
        cleanup();
      }, 2 * 60 * 1000);
    });

    // Wait for the trawler to complete
    await trawlerPromise;
    exampleLogger.info('Trawler finished');

  } catch (error) {
    exampleLogger.error('Error running trawler:', error);
    throw error;
  } finally {
    // Ensure cleanup
    exampleLogger.info('Stopping trawler...');
    trawler.stop();
    exampleLogger.info('Trawler stopped and cleaned up');
  }
}

// Run the example
logger.info('Starting PQueue example script...');
logger.info('Log level can be set with --log-level=<LEVEL> where level is one of: SILENT, ERROR, WARN, INFO, DEBUG, TRACE');
main().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
}); 