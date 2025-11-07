
import { nostrawl, TrawlerOptions, Progress } from 'npm:nostrawl';
import { relaysFromRelayList } from './helpers.ts';
import { getLogger, setGlobalLogLevel, LogLevel   } from './logger';
import { trawlerStats, setupStatusReporting, formatCompactStats } from './status';
import { db, getAllRelays, initDB, seedNewRelay } from 'npm:@nostrwatch/db';
import pQueue from 'npm:p-queue';
import { RelaySeeder } from 'internal/seed';
import { loadConfig } from "./config.ts";

const kinds = [2, 3, 10002, 30002];
const filters = { kinds };
const logger = getLogger("Trawler");
const persistQueue = new pQueue({ concurrency: 20 });

let allRelays: Set<string>;

let RELAYS = [
  'wss://purplepag.es',
  'wss://user.kindpag.es',
  'wss://relaydiscovery.com'
  // 'wss://relay.damus.io',
  // 'wss://relay.nostr.band',
  // 'wss://nos.lol',
  // 'wss://nostrue.com',
  // 'wss://relay.primal.net',
  // 'wss://relay.snort.social',
  // 'cache2.primal.net/v1'
];

function dropProcessedEventsTable(): void {
  try {
    db.query(`DROP TABLE IF EXISTS trawler_processed_events`);
    logger.info("Dropped trawler_processed_events table");
  } catch (error) {
    logger.error(`Error dropping table: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function updateQueueStats(): void {
  const { pending: active, size } = persistQueue;
  trawlerStats.persistQueue = { ...trawlerStats.persistQueue, active, size }
}

function processRelayList(event: any ): Promise<void> {
  return persistQueue.add(async () => {
    try {
      const relayListResult = await relaysFromRelayList(event);
      if (!relayListResult) {
        logger.debug(`No relay list found in event ${event.id}`);
        return;
      }
      
      logger.debug(`Found ${relayListResult.length} relays in event ${event.id}`);
      
      if (relayListResult.length === 0) {
        logger.debug(`Relay list is empty in event ${event.id}`);
        return;
      }

      const newRelays = relayListResult.filter(relay => {
        if(allRelays.has(relay.url)) {
          return false;
        }
        seedNewRelay(relay.url, relay.network);
        allRelays.add(relay.url);
        return true;
      });

      if (newRelays.length > 0) {
        trawlerStats.newRelaysFound += newRelays.length;
        // Track each newly discovered relay in the unique set for this session
        newRelays.forEach(r => trawlerStats.uniqueRelaysFound.add(r.url));
        logger.info(`Found ${newRelays.length} new relays: ${newRelays.map(r => r.url).join(', ')} | ${formatCompactStats()}`);
      }
      trawlerStats.persistQueue.completed += 1;
    } catch (err) {
      logger.error(`Error processing event: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      updateQueueStats();
    }
  })
}

interface TrawlOptions {
  dbPath?: string;
  enableWAL?: boolean;
  nostrawlOptions?: TrawlerOptions;
}

const defaultNostrawlOptions: TrawlerOptions = {
  filters,
  adapter: 'pqueue',
  queueName: 'trawler',
  repeatWhenComplete: true,
  restDuration: 1000,
  sinceStrict: false,
  logLevel: 5,
  relaysPerBatch: 10,
  adapterOptions: {
    concurrency: 5,
    cache: {
      path: './cache'
    }
  }
};

export const trawl = async (options: TrawlOptions = {}) => {
  logger.info('╭────────────────────────────────────────────────────────────────╮');
  logger.info('│               Starting Nostr Trawler for Relays                │');
  logger.info('╰────────────────────────────────────────────────────────────────╯');
  
  // Load configuration first, to set log level and seeding
  const config = await loadConfig();

  // Respect configured log level (default to INFO)
  try {
    const level = (config?.logLevel || config?.trawler?.logLevel || 'info') as string;
    setGlobalLogLevel(level);
  } catch (_) {
    setGlobalLogLevel(LogLevel.INFO);
  }

  if (options.dbPath) {
    const enableWAL = options.enableWAL !== undefined ? options.enableWAL : true;
    logger.info(`Using custom database path: ${options.dbPath} (WAL mode: ${enableWAL ? 'enabled' : 'disabled'})`);
    initDB(options.dbPath, enableWAL);
  } else {
    const enableWAL = options.enableWAL !== undefined ? options.enableWAL : true;
    logger.info(`Using default database path: trawler.db (WAL mode: ${enableWAL ? 'enabled' : 'disabled'})`);
    initDB("trawler.db", enableWAL);
  }

  allRelays = getAllRelays()
  
  dropProcessedEventsTable();
  
  trawlerStats.reset();

  // Seed initial relay list from configured sources if available
  try {
    const seedCfg = config?.trawler?.seed || config?.seed;
    if (seedCfg) {
      const seeder = new RelaySeeder(seedCfg);
      const seeded = await seeder.seed();
      if (Array.isArray(seeded) && seeded.length > 0) {
        RELAYS = Array.from(new Set([...RELAYS, ...seeded]));
        logger.info(`Seeding complete. Trawling ${RELAYS.length} relays`);
      } else {
        logger.warn(`No relays returned by seeder; proceeding with ${RELAYS.length} defaults`);
      }
    } else {
      logger.warn(`No seed configuration found; proceeding with ${RELAYS.length} default relays`);
    }
  } catch (e) {
    logger.error(`Error during seeding: ${e instanceof Error ? e.message : String(e)}`);
  }
  
  setupStatusReporting(30);
  
  const nostrawlOptions = {
    ...defaultNostrawlOptions,
    ...options.nostrawlOptions
  };
  
  if (options.nostrawlOptions?.adapterOptions?.concurrency) {
    nostrawlOptions.adapterOptions.concurrency = options.nostrawlOptions.adapterOptions.concurrency;
    logger.info(`Using concurrency level: ${nostrawlOptions.adapterOptions.concurrency}`);
  }

  const trawler = nostrawl(RELAYS, nostrawlOptions);

  trawler.on('event', (event: any) => {
    // Track totals and progress timestamps
    trawlerStats.totalEvents++;
    trawlerStats.eventsProcessed++;
    trawlerStats.lastUpdateTime = Date.now();
    
    processRelayList(event);
  });
  
  trawler
    .on('progress', (progress: Progress ) => {
      if (progress?.found > 0) {
        logger.debug(`Progress from ${progress.relay}: ${progress.found} events found`);
      }
    })
    .on('drained', () => {
      logger.info(`Queue drained | ${formatCompactStats()}`);
    })
    .on('completed', (job: any) => {
      logger.debug(`Job completed: ${job.id}`);
    });
  
  trawler.run();
  logger.info('Trawler started and running');

  setInterval(updateQueueStats, 5000);
};
