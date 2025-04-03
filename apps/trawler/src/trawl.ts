/// <reference lib="deno.ns" />

import { nostrawl } from 'npm:nostrawl';
import { relaysFromRelayList } from './helpers.ts';
import { getLogger, setGlobalLogLevel, LogLevel   } from './logger';
import { trawlerStats, setupStatusReporting, formatCompactStats } from './status';
import { db, initDB, seedNewRelay } from 'npm:@nostrwatch/db';
import nostrings from '@nostrwatch/nostrings';

const kinds = [2, 3, 10002, 30002];
const filters = { kinds };
const logger = getLogger("Trawler");

// No longer initialize the DB here, we'll do it in the trawl function based on config

setGlobalLogLevel(LogLevel.DEBUG);

const RELAYS = [
  'wss://user.kindpag.es',
  'wss://relay.damus.io',
  'wss://relay.nostr.band',
  'wss://purplepag.es',
  'wss://nos.lol',
  'wss://nostrue.com',
  'wss://relay.primal.net',
];

// Drop the unnecessary trawler_processed_events table if it exists
function dropProcessedEventsTable(): void {
  try {
    db.query(`DROP TABLE IF EXISTS trawler_processed_events`);
    logger.info("Dropped trawler_processed_events table");
  } catch (error) {
    logger.error(`Error dropping table: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Check if a relay URL already exists in the database
function isRelayInDatabase(url: string): boolean {
  try {
    // First check if the relay_status table exists
    const tableExists = db.query(`SELECT name FROM sqlite_master WHERE type='table' AND name='relay_status'`).length > 0;
    
    if (!tableExists) {
      // If table doesn't exist, no relays are in the database
      logger.debug('relay_status table does not exist yet');
      return false;
    }
    
    // Now check if the relay exists
    const query = `SELECT 1 FROM relay_status WHERE url = ?`;
    const result = db.query(query, [url]);
    return result.length > 0;
  } catch (error) {
    logger.error(`Error checking relay in database: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

// Process relay list from an event
async function processRelayList(event: any): Promise<void> {
  try {
    const relayListResult = await relaysFromRelayList(event);
    
    // Check if relayListResult is false first to handle the type safety
    if (!relayListResult) {
      logger.debug(`No relay list found in event ${event.id}`);
      return;
    }
    
    logger.debug(`Found ${relayListResult.length} relays in event ${event.id}`);
    
    if (relayListResult.length === 0) {
      logger.debug(`Relay list is empty in event ${event.id}`);
      return;
    }

    // Process only new relays
    const newRelays = relayListResult.filter(relay => {
      // Try to add the relay - seedNewRelay returns true only if it was new
      const isNew = seedNewRelay(relay.url, relay.network);
      
      // Track all unique relays we've seen
      trawlerStats.uniqueRelaysFound.add(relay.url);
      
      // Return only new relays
      return isNew;
    });

    // Update stats and log if we found new relays
    if (newRelays.length > 0) {
      trawlerStats.newRelaysFound += newRelays.length;
      logger.info(`Found ${newRelays.length} new relays: ${newRelays.map(relay => relay.url).join(', ')} | ${formatCompactStats()}`);
    }
  } catch (err) {
    logger.error(`Error processing event: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// Define options interface for trawl function
interface TrawlOptions {
  dbPath?: string;
  enableWAL?: boolean;
  nostrawlOptions?: any; // Options for nostrawl
}

// The default options for nostrawl
const defaultNostrawlOptions = {
  filters,
  adapter: 'pqueue',
  queueName: 'trawler',
  repeatWhenComplete: true,
  restDuration: 1000 * 60 * 5,
  strictTimestamps: false,
  logLevel: 'DEBUG',
  adapterOptions: {
    concurrency: 2,
    cache: {
      path: './cache'
    }
  }
};

export const trawl = async (options: TrawlOptions = {}) => {
  logger.info('╭────────────────────────────────────────────────────────────────╮');
  logger.info('│               Starting Nostr Trawler for Relays                │');
  logger.info('╰────────────────────────────────────────────────────────────────╯');
  
  // Initialize the database with custom path if provided
  if (options.dbPath) {
    const enableWAL = options.enableWAL !== undefined ? options.enableWAL : true;
    logger.info(`Using custom database path: ${options.dbPath} (WAL mode: ${enableWAL ? 'enabled' : 'disabled'})`);
    initDB(options.dbPath, enableWAL);
  } else {
    // Default path with WAL setting
    const enableWAL = options.enableWAL !== undefined ? options.enableWAL : true;
    logger.info(`Using default database path: trawler.db (WAL mode: ${enableWAL ? 'enabled' : 'disabled'})`);
    initDB("trawler.db", enableWAL);
  }
  
  // Drop the unnecessary table
  dropProcessedEventsTable();
  
  // Reset stats for a new session
  trawlerStats.reset();
  
  // Start status reporting (every 30 seconds)
  const statusInterval = setupStatusReporting(30);
  
  // Merge default and custom nostrawl options
  const nostrawlOptions = {
    ...defaultNostrawlOptions,
    ...options.nostrawlOptions
  };
  
  // Update concurrency from options if provided
  if (options.nostrawlOptions?.adapterOptions?.concurrency) {
    nostrawlOptions.adapterOptions.concurrency = options.nostrawlOptions.adapterOptions.concurrency;
    logger.info(`Using concurrency level: ${nostrawlOptions.adapterOptions.concurrency}`);
  }
  
  // Create the trawler instance
  const trawler = nostrawl(RELAYS, nostrawlOptions);

  // Set up event handlers for receiving nostr events
  trawler.on('event', async (event: any) => {
    // Track in our stats
    trawlerStats.eventsProcessed++;
    trawlerStats.lastUpdateTime = Date.now();
    
    // Process the event
    await processRelayList(event);
  });
  
  // Set up worker progress handler
  trawler
    .on_worker('progress', (job: any, progress: any) => {
      if (progress.found > 0) {
        logger.debug(`Progress from ${progress.relay}: ${progress.found} events found`);
      }
    })
    // Set up queue drained handler
    .on_queue('drained', () => {
      logger.info(`Queue drained | ${formatCompactStats()}`);
    })
    // Set up worker completed handler
    .on_worker('completed', (job: any) => {
      logger.debug(`Job completed: ${job.id}`);
    });
  
  // Start the trawler
  trawler.run();
  logger.info('Trawler started and running');
};