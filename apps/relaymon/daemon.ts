import { QueueManager } from "./queueManager.ts";
import { Worker } from "./worker.ts";
import { RelaySeeder } from "./seeder.ts";
import { getLogger, setGlobalLogLevel } from "./logger.ts";
import { delay } from "npm:@nostrwatch/utils";
import { getExpiredRelays } from "./db.ts";
import { maybeAnnounce } from "./announce.ts";
import { getPublicKey } from "npm:nostr-tools";

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
    console.log(event)
    processError(event.error, "global error event");
  });

  self.addEventListener("unhandledrejection", (event) => {
    console.log(event)
    processError(event.reason, "unhandled promise rejection");
  });

  try {
    await maybeAnnounce(config);

    const queueManager = new QueueManager(
      config.queue.workerConcurrency,
      2
    );
    const pubkey = Deno.env.get("DAEMON_PRIVKEY")? getPublicKey(Deno.env.get("DAEMON_PRIVKEY") || "") : "";
    const worker = new Worker(pubkey, queueManager, config);

    const seeder = new RelaySeeder({
      interval: config.relaymon.seed.interval,
      sources: config.relaymon.seed.sources,
      options: {
        ...config.relaymon.seed.options,
        allowedNetworks: config.relaymon.networks,
        config: config?.seed || [],
      },
    });
    
    async function checkExpiredRelays() {
      while (true) {
        try {
          logger.info(`Checking for expired relays with expiry time: ${config.relaymon.checks.options.expires}`);
          
          const expiredRelays = getExpiredRelays(
            Math.round(config.relaymon.checks.options.expires/1000),
            config.relaymon.networks
          );
          logger.info(`Found ${expiredRelays.length} expired relays in the DB.`);
          
          if (expiredRelays.length === 0) {
            logger.info(`No expired relays found. Waiting for ${config.relaymon.checks.options.interval} before checking again.`);
            await delay(config.relaymon.checks.options.interval);
            continue;
          }
          
          let toEnqueue: string[] = [];
          const maxValue = config.relaymon.checks.options.max;
          if (typeof maxValue === "number") {
            toEnqueue = expiredRelays.slice(0, maxValue);
            logger.info(`Enqueuing ${toEnqueue.length} relays (numeric max: ${maxValue})`);
          } else if (typeof maxValue === "string" && maxValue.trim().endsWith("%")) {
            const percentage = parseFloat(maxValue) / 100;
            const count = Math.ceil(expiredRelays.length * percentage);
            toEnqueue = expiredRelays.slice(0, count);
            logger.info(`Enqueuing ${toEnqueue.length} relays (percentage: ${maxValue}, count: ${count})`);
          } else {
            toEnqueue = expiredRelays;
            logger.info(`Enqueuing all ${toEnqueue.length} expired relays`);
          }

          for (const relay of toEnqueue) {
            queueManager.addCheckJob(async () => {
              await worker.processRelay(relay);
            });
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

    // First run the seeder to populate the database
    logger.info("Starting seeder to populate database...");
    try {
      await seeder.seed(); // Run initial seed
      logger.info("Initial seeding complete, starting monitoring...");
    } catch (seedError) {
      logger.error(`Error during initial seeding: ${seedError.message}`);
      logger.error(seedError.stack || "No stack trace available");
      // Continue anyway - we might have partial results
    }
    
    // Then start both processes in parallel, with individual error handling
    await Promise.all([
      seeder.start().catch(error => {
        logger.error(`Seeder process error: ${error.message}`);
        logger.error(error.stack || "No stack trace available");
        // Keep running - we'll just have a failed seeder
      }),
      checkExpiredRelays().catch(error => {
        logger.error(`Check process error: ${error.message}`);
        logger.error(error.stack || "No stack trace available");
        // This shouldn't happen due to the try/catch inside checkExpiredRelays
      })
    ]);
  } catch (error) {
    logger.error(`Fatal error in daemon: ${error.message}`);
    logger.error(error.stack || "No stack trace available");
    throw error; // Re-throw to let Deno handle it
  }
}
