import { QueueManager } from "../utils/queueManager.ts";
import { Worker } from "./worker.ts";
import { RelaySeeder } from "./seeder.ts";
import { getLogger, setGlobalLogLevel } from "../utils/logger.ts";
import { delay } from "npm:@nostrwatch/utils";
import { db, getExpiredRelays } from "npm:@nostrwatch/db";
import { maybeAnnounce } from "../utils/announce.ts";
import { getPublicKey } from "npm:nostr-tools";
import { RetryManager } from "../utils/retryManager.ts";
import { formatCompactStats, showStatus } from "./status.ts";
import { deleteRelayCheckEvent } from "../utils/deletion.ts";
import { IgnoreListSync } from "../utils/IgnoreListSync.ts";
import { setIgnoreListSync, reevaluateAllDeduplication } from "../utils/hostnames.ts";

/**
 * Parse interval string like "1h", "30m", "24h" to milliseconds
 */
function parseInterval(interval: string): number {
  const match = interval.match(/^(\d+)([smhd])$/);
  if (!match) {
    throw new Error(`Invalid interval format: ${interval}`);
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: throw new Error(`Unknown time unit: ${unit}`);
  }
}

export async function runDaemon(config: any): Promise<void> {
  // Set global log level from config if specified
  if (config.logLevel) {
    setGlobalLogLevel(config.logLevel);
  }
  
  const logger = getLogger("Daemon");

  // Set up global error handlers
  const processError = (error: Error, source: string): void => {
    logger.error(`Unhandled error in ${source}: ${error?.message || JSON.stringify(error)}`);
    logger.error(error?.stack || "No stack trace available");
  };

  // In Deno, we need to use self which is the global scope
  self.addEventListener("error", (event) => {
    processError(event.error, "global error event");
  });

  self.addEventListener("unhandledrejection", (event) => {
    processError(event.reason, "unhandled promise rejection");
  });

  try {
    // Set concurrency based on CPU cores if not defined in config
    let concurrency = config?.queue?.workerConcurrency;
    if (!concurrency || concurrency === 'auto') {
      if(!concurrency){
        logger.info(`Concurrency not specified in config: Using CPU cores-2: ${concurrency} threads`);
      }
      else {
        logger.info(`Concurrency set to "auto": Using CPU cores-2: ${concurrency} threads`);
      }
      // Get CPU cores and use cores-2 (min 1)
      const availableCores = navigator.hardwareConcurrency || 4; // Default to 4 if not available
      concurrency = Math.max(1, availableCores - 2); // At least 1 thread
    }

    const queueManager = new QueueManager(
      concurrency,
      1,
      config
    );

    // Initialize ignore list sync
    const staticMetaRelays = [
      ...(config?.publisher?.relays || []),
      "wss://purplepag.es",
      "wss://user.kindpag.es",
      "wss://profiles.nostr1.com"
    ];
    const ignoreListSync = new IgnoreListSync(config, staticMetaRelays);

    // Set the global IgnoreListSync instance for use in hostname deduplication
    setIgnoreListSync(ignoreListSync);

    if (ignoreListSync && config?.relaymon?.ignorelist?.enabled) {
      logger.info("Performing initial ignore list sync...");
      await ignoreListSync.sync().catch((err) => logger.error(`Initial sync error: ${err.message}`));
      // Publish initial deletions on startup
      logger.info("Publishing initial NIP-09 deletions...");
      await ignoreListSync.publishDeletions(Deno.env.get("DAEMON_PRIVKEY") || "").catch((err) => logger.error(`Initial deletions error: ${err.message}`));
    }

    // Move maybeAnnounce call after creating queueManager so we can pass it
    await maybeAnnounce(config, queueManager);

    const pubkey = Deno.env.get("DAEMON_PRIVKEY")? getPublicKey(Deno.env.get("DAEMON_PRIVKEY") || "") : "";
    const worker = new Worker(pubkey, queueManager, config);

    let seeder: RelaySeeder | undefined
    
    if(config?.relaymon?.seed) {
      seeder = new RelaySeeder({
        interval: config.relaymon.seed.interval,
        sources: config.relaymon.seed.sources,
        options: {
          ...config.relaymon.seed.options,
          allowedNetworks: config.relaymon.networks,
          db: config.relaymon.seed.options.db || undefined
        },
      });
    }
    
    async function checkExpiredRelays() {
      // No longer need the local Set - we'll use QueueManager's tracking
      // const recentlyEnqueued = new Set<string>();
      
      // Create a RetryManager instance with the same config as the worker
      const retryManager = new RetryManager(config.relaymon.retry.expiry);
      
      while (true) {
        try {
          logger.debug(`Checking for expired relays with expiry time: ${config.relaymon.checks.options.expires}`);
          logger.debug(`Using networks: ${JSON.stringify(config.relaymon.networks)}`);
          
          // Pass the RetryManager to getExpiredRelays
          const expiredRelays = getExpiredRelays(
            Math.round(config.relaymon.checks.options.expires/1000),
            config.relaymon.networks,
            retryManager
          );
          logger.debug(`Found ${expiredRelays.length} expired relays in the DB (including retry backoff).`);
          
          if (expiredRelays.length === 0) {
            logger.debug(`No expired relays found. Waiting for ${config.relaymon.checks.options.interval} before checking again.`);
            await delay(config.relaymon.checks.options.interval);
            continue;
          }
          
          // Filter out relays that are already in the queue
          const notAlreadyEnqueued = expiredRelays.filter(relay => !queueManager.isRelayEnqueued(relay));
          logger.debug(`Filtered out ${expiredRelays.length - notAlreadyEnqueued.length} already enqueued relays.`);
          
          let toEnqueue: string[] = [];
          const maxValue = config.relaymon.checks.options.max;
          if (typeof maxValue === "number") {
            toEnqueue = notAlreadyEnqueued.slice(0, maxValue);
            logger.info(`Enqueuing ${toEnqueue.length} relays (numeric max: ${maxValue}) - ${formatCompactStats(queueManager)}`);
          } else if (typeof maxValue === "string" && maxValue.trim().endsWith("%")) {
            const percentage = parseFloat(maxValue) / 100;
            const count = Math.ceil(notAlreadyEnqueued.length * percentage);
            toEnqueue = notAlreadyEnqueued.slice(0, count);
            logger.info(`Enqueuing ${toEnqueue.length} relays (percentage: ${maxValue}, count: ${count}) - ${formatCompactStats(queueManager)}`);
          } else {
            toEnqueue = notAlreadyEnqueued;
            logger.info(`Enqueuing ${toEnqueue.length} expired relays - ${formatCompactStats(queueManager)}`);
          }

          // Add relays to queue
          for (const relay of toEnqueue) {
            //hotfixes
            if(relay.includes("|")) {
              logger.warn(`DEBUG: Skipping/Deleting relay ${relay} because it includes |`);
              await deleteRelayCheckEvent(relay, "Skipping/Deleting relay because it includes |", config, queueManager);
              db.query("DELETE FROM relay_status WHERE url = ?", [relay]);
              continue;
            }
            // We no longer need to manually track relays - QueueManager does it
            queueManager.addCheckJob(async () => {
              try {
                // Process the relay
                await worker.processRelay(relay);
              } catch (error) {
                logger.error(`Error processing relay ${relay}: ${error.message}`);
              }
            }, relay); // Pass the relay URL to QueueManager
          }
          
          logger.info(`Waiting for ${config.relaymon.checks.options.interval} before checking for more expired relays`);
          await delay(config.relaymon.checks.options.interval);
        } catch (error) {
          logger.error(`Error in checkExpiredRelays: ${error.message}`);
          logger.error(error.stack || "No stack trace available");
          // If there was an error, wait a bit before retrying
          await delay(30000); // Wait 30 seconds before retrying after an error
        }
      }
    }

    if(seeder) {
      // First run the seeder to populate the database
      logger.info("Starting seeder to populate database...");
      try {
        await seeder.seed(); // Run initial seed
        logger.info("Initial seeding complete, starting monitoring...");
      } catch (seedError) {
        logger.error(`Error during initial seeding: ${seedError.message}`);
        logger.error(seedError.stack || "No stack trace available");
        // Continue anyway- we might have partial results
      }
    }
    else {
      logger.info("No seeder found, skipping initial seeding.");
    }

    // Schedule ignore list sync if enabled
    async function runIgnoreListSync() {
      if (!ignoreListSync || !config?.relaymon?.ignorelist?.enabled) {
        logger.debug("IgnoreListSync is disabled, skipping");
        return;
      }

      const interval = config.relaymon.ignorelist.interval || "24h";
      const intervalMs = parseInterval(interval);
      logger.info(`Scheduling ignore list sync every ${interval}`);

      while (true) {
        try {
          await delay(intervalMs);
          logger.info("Running scheduled ignore list sync and publish...");
          await ignoreListSync.sync().catch((err) => logger.error(`Sync error: ${err.message}`));
          await ignoreListSync.publish(Deno.env.get("DAEMON_PRIVKEY") || "").catch((err) => logger.error(`Publish error: ${err.message}`));
        } catch (error) {
          logger.error(`Error in runIgnoreListSync: ${error.message}`);
          await delay(60000); // Wait 1 minute before retrying
        }
      }
    }

    // Schedule ignore list deletions if enabled
    async function runIgnoreListDeletions() {
      if (!ignoreListSync || !config?.relaymon?.ignorelist?.enabled) {
        logger.debug("IgnoreListSync is disabled, skipping deletions");
        return;
      }

      const interval = config.relaymon.ignorelist.deletion_interval || "24h";
      const intervalMs = parseInterval(interval);
      logger.info(`Scheduling ignore list deletions every ${interval}`);

      while (true) {
        try {
          await delay(intervalMs);
          logger.info("Running scheduled ignore list deletion publish...");
          await ignoreListSync.publishDeletions(Deno.env.get("DAEMON_PRIVKEY") || "").catch((err) => logger.error(`Deletions error: ${err.message}`));
        } catch (error) {
          logger.error(`Error in runIgnoreListDeletions: ${error.message}`);
          await delay(60000); // Wait 1 minute before retrying
        }
      }
    }

    // Schedule deduplication re-evaluation
    async function runDedupReevaluation() {
      const interval = config?.relaymon?.deduplication?.reevaluation_interval || "24h";
      const nip11CacheTtl = config?.relaymon?.deduplication?.nip11_cache_ttl || "24h";
      const intervalMs = parseInterval(interval);
      const ttlMs = parseInterval(nip11CacheTtl);
      logger.info(`Scheduling deduplication re-evaluation every ${interval}`);
      logger.info(`NIP-11 cache TTL: ${nip11CacheTtl}`);

      while (true) {
        try {
          await delay(intervalMs);
          logger.info("Running scheduled deduplication re-evaluation...");
          const changedRelays = await reevaluateAllDeduplication(ttlMs).catch((err) => {
            logger.error(`Re-evaluation error: ${err.message}`);
            return [];
          });
          if (changedRelays && changedRelays.length > 0) {
            logger.info(`Re-evaluation changed ${changedRelays.length} relay(s) ignore status`);
            // Publish deletions for newly ignored relays
            if (ignoreListSync) {
              await ignoreListSync.publishDeletions(Deno.env.get("DAEMON_PRIVKEY") || "").catch((err) => logger.error(`Deletions after re-eval error: ${err.message}`));
            }
          }
        } catch (error) {
          logger.error(`Error in runDedupReevaluation: ${error.message}`);
          await delay(60000); // Wait 1 minute before retrying
        }
      }
    }

    const tasks: Promise<void>[] = []

    if(seeder) {
      tasks.push(
        seeder.start().catch(error => {
          logger.error(`Seeder process error: ${error.message}`);
          logger.error(error.stack || "No stack trace available");
          // Keep running - we'll just have a failed seeder
        })
      )
    }

    tasks.push(
      checkExpiredRelays().catch(error => {
        logger.error(`Check process error: ${error.message}`);
        logger.error(error.stack || "No stack trace available");
        // This shouldn't happen due to the try/catch inside checkExpiredRelays
      })
    )

    // Add scheduled tasks
    if (config?.relaymon?.ignorelist?.enabled) {
      tasks.push(
        runIgnoreListSync().catch(error => {
          logger.error(`Ignore list sync process error: ${error.message}`);
        })
      );
      tasks.push(
        runIgnoreListDeletions().catch(error => {
          logger.error(`Ignore list deletions process error: ${error.message}`);
        })
      );
    }

    tasks.push(
      runDedupReevaluation().catch(error => {
        logger.error(`Dedup re-evaluation process error: ${error.message}`);
      })
    )

    showStatus(queueManager);
    
    // Then start both processes in parallel, with individual error handling
    await Promise.all(tasks);
  } catch (error) {
    logger.error(`Fatal error in daemon: ${error.message}`);
    logger.error(error.stack || "No stack trace available");
    throw error; // Re-throw to let Deno handle it
  }
}
