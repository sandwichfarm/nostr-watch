import { QueueManager } from "../utils/queueManager.ts";
import { Worker } from "./worker.ts";
import { RelaySeeder } from "./seeder.ts";
import { getLogger, setGlobalLogLevel } from "../utils/logger.ts";
import { delay } from "npm:@nostrwatch/utils";
import { db, getExpiredRelays } from "npm:@nostrwatch/db";
import { getIgnoredRelaysByReason } from "../db/db.ts";
import { maybeAnnounce } from "../utils/announce.ts";
import { getPublicKey } from "npm:nostr-tools";
import { hexToBytes } from "@noble/hashes/utils";
import { tryNsecToHex } from "npm:@nostrwatch/utils";
import { RetryManager } from "../utils/retryManager.ts";
import { formatCompactStats, showStatus } from "./status.ts";
import {
  deleteRelayCheckEvent,
  setDeletionPublishSuppressed,
} from "../utils/deletion.ts";
import { IgnoreListSync } from "../utils/IgnoreListSync.ts";
import {
  reevaluateAllDeduplication,
  setIgnoreListSync,
} from "../utils/hostnames.ts";
import { checkSigning } from "../health/index.ts";
import { ErrorTracker } from "../health/index.ts";
import {
  loadHealthAuthToken,
  loadKumaPushUrl,
  redactUrl,
} from "../health/index.ts";
import { startHealthServer } from "../health/server.ts";
import { startKumaPusher } from "../health/kuma.ts";
import type { Config } from "../config/config.ts";
import type { HeartbeatTracker } from "../health/types.ts";
import type { HealthServer } from "../health/server.ts";
import type { KumaPusher } from "../health/kuma.ts";

/**
 * Get hex private key from RELAYMON_NSEC environment variable
 * Supports both NIP-19 encoded nsec format and raw hex format
 * @returns hex-encoded private key string, or empty string on error
 */
export function getPrivateKey(): string {
  return tryNsecToHex(Deno.env.get("RELAYMON_NSEC"));
}

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
    case "s":
      return value * 1000;
    case "m":
      return value * 60 * 1000;
    case "h":
      return value * 60 * 60 * 1000;
    case "d":
      return value * 24 * 60 * 60 * 1000;
    default:
      throw new Error(`Unknown time unit: ${unit}`);
  }
}

// Global heartbeat tracker for health monitoring
export const heartbeatTracker: HeartbeatTracker = {
  startupTime: Date.now(),
};

// Global error tracker for health monitoring
export const errorTracker = new ErrorTracker();

export async function runDaemon(config: Config): Promise<void> {
  // Set global log level from config if specified
  if (config.logLevel) {
    setGlobalLogLevel(config.logLevel);
  }

  const logger = getLogger("Daemon");

  // Set up global error handlers
  const processError = (error: Error, source: string): void => {
    const message = error?.message || JSON.stringify(error);
    logger.error(`Unhandled error in ${source}: ${message}`);
    logger.error(error?.stack || "No stack trace available");

    // Track error for health monitoring
    errorTracker.track(message, source);
  };

  // In Deno, we need to use self which is the global scope
  self.addEventListener("error", (event) => {
    processError(event.error, "global error event");
  });

  self.addEventListener("unhandledrejection", (event) => {
    // Prevent Deno from terminating the process on unhandled rejections
    // (e.g. nostr-tools SimplePool can leak rejections from closed WebSocket connections)
    event.preventDefault();
    processError(event.reason, "unhandled promise rejection");
  });

  try {
    // Set concurrency based on CPU cores if not defined in config
    let concurrency = config?.queue?.workerConcurrency;
    if (!concurrency || concurrency === "auto") {
      if (!concurrency) {
        logger.info(
          `Concurrency not specified in config: Using CPU cores-2: ${concurrency} threads`,
        );
      } else {
        logger.info(
          `Concurrency set to "auto": Using CPU cores-2: ${concurrency} threads`,
        );
      }
      // Get CPU cores and use cores-2 (min 1)
      const availableCores = navigator.hardwareConcurrency || 4; // Default to 4 if not available
      concurrency = Math.max(1, availableCores - 2); // At least 1 thread
    }

    const queueManager = new QueueManager(
      concurrency,
      1,
      config,
    );

    // Initialize ignore list sync
    const staticMetaRelays = [
      ...(config?.publisher?.relays || []),
      "wss://purplepag.es",
      "wss://user.kindpag.es",
      "wss://profiles.nostr1.com",
    ];
    const ignoreListSync = new IgnoreListSync(config, staticMetaRelays);

    // Set the global IgnoreListSync instance for use in hostname deduplication
    setIgnoreListSync(ignoreListSync);

    // Suppress deletion publishing during warmup (set true early to catch initial deletion publish call)
    setDeletionPublishSuppressed(true);

    if (ignoreListSync && config?.relaymon?.ignorelist?.enabled) {
      logger.info("Performing initial ignore list sync...");
      await ignoreListSync.sync().catch((err) =>
        logger.error(`Initial sync error: ${err.message}`)
      );
      // Publish initial deletions on startup
      logger.info("Publishing initial NIP-09 deletions...");
      await ignoreListSync.publishDeletions(getPrivateKey()).catch((err) =>
        logger.error(`Initial deletions error: ${err.message}`)
      );
    }

    // Move maybeAnnounce call after creating queueManager so we can pass it
    await maybeAnnounce(config, queueManager);

    // Safely derive pubkey from RELAYMON_NSEC with error handling
    // Supports both nsec (NIP-19) and hex formats
    let pubkey = "";
    const privkey = getPrivateKey();
    if (privkey) {
      try {
        pubkey = getPublicKey(hexToBytes(privkey));
        logger.info("Successfully derived public key from RELAYMON_NSEC");

        // Run signing self-test if health monitoring is enabled
        if (config.health?.enabled) {
          logger.info("Running signing self-test...");
          const signingCheck = await checkSigning(privkey);
          if (signingCheck.status === "fail") {
            logger.error(`Signing self-test failed: ${signingCheck.message}`);
            logger.error(`Error: ${signingCheck.error}`);
            logger.error("Daemon will start but publish jobs will fail");
            errorTracker.track(
              `Signing self-test failed: ${signingCheck.message}`,
              "daemon",
            );
          } else {
            logger.info("Signing self-test passed");
          }
        }
      } catch (error) {
        logger.warn(
          `Invalid RELAYMON_NSEC, cannot derive public key: ${error.message}`,
        );
        logger.warn(
          "Daemon will start but publish jobs will fail and be counted as failures",
        );
        errorTracker.track(`Invalid RELAYMON_NSEC: ${error.message}`, "daemon");
      }
    } else {
      logger.warn("Missing or invalid RELAYMON_NSEC environment variable");
      logger.warn(
        "Daemon will start but publish jobs will fail and be counted as failures",
      );
      errorTracker.track("Missing or invalid RELAYMON_NSEC", "daemon");
    }

    const worker = new Worker(pubkey, queueManager, config, ignoreListSync);

    let seeder: RelaySeeder | undefined;

    if (config?.relaymon?.seed) {
      seeder = new RelaySeeder({
        interval: config.relaymon.seed.interval,
        sources: config.relaymon.seed.sources,
        options: {
          ...config.relaymon.seed.options,
          allowedNetworks: config.relaymon.networks,
          db: config.relaymon.seed.options.db || undefined,
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
          logger.debug(
            `Checking for expired relays with expiry time: ${config.relaymon.checks.options.expires}`,
          );
          logger.debug(
            `Using networks: ${JSON.stringify(config.relaymon.networks)}`,
          );

          // Pass the RetryManager to getExpiredRelays
          const expiredRelays = getExpiredRelays(
            Math.round(config.relaymon.checks.options.expires / 1000),
            config.relaymon.networks,
            retryManager,
          );
          logger.debug(
            `Found ${expiredRelays.length} expired relays in the DB (including retry backoff).`,
          );

          if (expiredRelays.length === 0) {
            logger.debug(
              `No expired relays found. Waiting for ${config.relaymon.checks.options.interval} before checking again.`,
            );
            await delay(config.relaymon.checks.options.interval);
            continue;
          }

          // Filter out relays that are already in the queue
          const notAlreadyEnqueued = expiredRelays.filter((relay) =>
            !queueManager.isRelayEnqueued(relay)
          );
          logger.debug(
            `Filtered out ${
              expiredRelays.length - notAlreadyEnqueued.length
            } already enqueued relays.`,
          );

          let toEnqueue: string[] = [];
          const rawMax = config.relaymon.checks.options.max;
          // Coerce string numbers to actual numbers (e.g. YAML '50' vs 50)
          const maxValue =
            typeof rawMax === "string" && /^\d+$/.test(rawMax.trim())
              ? parseInt(rawMax.trim(), 10)
              : rawMax;
          if (typeof maxValue === "number") {
            toEnqueue = notAlreadyEnqueued.slice(0, maxValue);
            logger.info(
              `Enqueuing ${toEnqueue.length} relays (numeric max: ${maxValue}) - ${
                formatCompactStats(queueManager)
              }`,
            );
          } else if (
            typeof maxValue === "string" && maxValue.trim().endsWith("%")
          ) {
            const percentage = parseFloat(maxValue) / 100;
            const count = Math.ceil(notAlreadyEnqueued.length * percentage);
            toEnqueue = notAlreadyEnqueued.slice(0, count);
            logger.info(
              `Enqueuing ${toEnqueue.length} relays (percentage: ${maxValue}, count: ${count}) - ${
                formatCompactStats(queueManager)
              }`,
            );
          } else {
            toEnqueue = notAlreadyEnqueued;
            logger.info(
              `Enqueuing ${toEnqueue.length} expired relays - ${
                formatCompactStats(queueManager)
              }`,
            );
          }

          // Add relays to queue
          for (const relay of toEnqueue) {
            //hotfixes
            if (relay.includes("|")) {
              logger.warn(
                `DEBUG: Skipping/Deleting relay ${relay} because it includes |`,
              );
              await deleteRelayCheckEvent(
                relay,
                "Skipping/Deleting relay because it includes |",
                config,
                queueManager,
              );
              db.query("DELETE FROM relay_status WHERE url = ?", [relay]);
              continue;
            }
            // We no longer need to manually track relays - QueueManager does it
            queueManager.addCheckJob(async () => {
              try {
                // Process the relay
                await worker.processRelay(relay);
              } catch (error) {
                logger.error(
                  `Error processing relay ${relay}: ${error.message}`,
                );
                errorTracker.track(
                  `Error processing relay ${relay}: ${error.message}`,
                  "worker",
                );
              }
            }, relay); // Pass the relay URL to QueueManager
          }

          // Update heartbeat after enqueuing work
          heartbeatTracker.checkLoop = Date.now();

          logger.info(
            `Waiting for ${config.relaymon.checks.options.interval} before checking for more expired relays`,
          );
          await delay(config.relaymon.checks.options.interval);
        } catch (error) {
          logger.error(`Error in checkExpiredRelays: ${error.message}`);
          logger.error(error.stack || "No stack trace available");
          errorTracker.track(
            `Error in checkExpiredRelays: ${error.message}`,
            "daemon",
          );
          // If there was an error, wait a bit before retrying
          await delay(30000); // Wait 30 seconds before retrying after an error
        }
      }
    }

    // Enable deletion publish suppression immediately to prevent any deletions during warmup
    setDeletionPublishSuppressed(true);

    if (seeder) {
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
    } else {
      logger.info("No seeder found, skipping initial seeding.");
    }

    // Start health reporting before warmup. Warmup can run for a long time, and
    // external push monitors should still see that RelayMon is alive.
    let healthServer: HealthServer | null = null;
    if (config.health?.enabled && config.health.server.enabled) {
      try {
        logger.info("Starting health server...");

        // Load auth token if auth is enabled
        let authToken: string | undefined;
        if (config.health.server.authEnabled) {
          authToken = await loadHealthAuthToken();
          if (!authToken) {
            logger.warn(
              "Health server auth enabled but no token configured (RELAYMON_HEALTH_AUTH_TOKEN)",
            );
          }
        }

        healthServer = await startHealthServer(
          config.health.server,
          {
            queueManager,
            privkey,
            heartbeat: heartbeatTracker,
            errorTracker,
            authToken,
            thresholds: config.health.thresholds,
          },
        );
      } catch (error) {
        logger.error(`Failed to start health server: ${error.message}`);
        errorTracker.track(
          `Failed to start health server: ${error.message}`,
          "daemon",
        );
      }
    }

    let kumaPusher: KumaPusher | null = null;
    if (config.health?.enabled && config.health.kuma.enabled) {
      try {
        logger.info("Starting Kuma pusher...");

        // Load Kuma push URL
        const kumaPushUrl = await loadKumaPushUrl();
        if (!kumaPushUrl) {
          logger.error("Kuma pusher enabled but no push URL configured");
          logger.error(
            "Set RELAYMON_KUMA_PUSH_URL or RELAYMON_KUMA_BASE_URL + RELAYMON_KUMA_TOKEN",
          );
        } else {
          logger.info(`Kuma push URL configured: ${redactUrl(kumaPushUrl)}`);

          kumaPusher = await startKumaPusher(
            config.health.kuma,
            {
              queueManager,
              privkey,
              heartbeat: heartbeatTracker,
              errorTracker,
              thresholds: config.health.thresholds,
            },
            kumaPushUrl,
          );
        }
      } catch (error) {
        logger.error(`Failed to start Kuma pusher: ${error.message}`);
        errorTracker.track(
          `Failed to start Kuma pusher: ${error.message}`,
          "daemon",
        );
      }
    }

    // Warmup runner - checks all unchecked relays (checked_at = -1) for configured networks
    async function runWarmup(): Promise<void> {
      try {
        // Turn on warmup mode in the worker to suppress publishing and bypass DB-ignore for first checks
        worker.setWarmupMode(true);
        queueManager.setWarmupActive(true);
        heartbeatTracker.checkLoop = Date.now();
        while (true) {
          // Build network filter from config
          const networks: string[] = Array.isArray(config.relaymon.networks)
            ? config.relaymon.networks
            : ["clearnet"];
          const placeholders = networks.map(() => "?").join(",");
          const query =
            `SELECT url FROM relay_status WHERE checked_at = -1 AND network IN (${placeholders})`;
          const rows = db.query(query, networks);
          const urls: string[] = rows.map(([url]) => url as string);

          if (urls.length === 0) {
            logger.info("Warmup complete: no unchecked relays remain");
            break;
          }

          logger.info(`Warmup: processing ${urls.length} unchecked relays`);
          heartbeatTracker.checkLoop = Date.now();
          // Enqueue all unchecked relays
          for (const url of urls) {
            // Skip any malformed items defensively
            if (typeof url !== "string" || url.includes("|")) continue;
            queueManager.addCheckJob(async () => {
              try {
                await worker.processRelay(url);
              } catch (error) {
                logger.error(
                  `Warmup error processing ${url}: ${error?.message || error}`,
                );
              } finally {
                // Keep the check-loop heartbeat fresh as warmup makes progress.
                // The batch drain can run far longer than checkIdleMs, so without
                // a per-check bump the heartbeat goes stale and health reports
                // the live monitor as DOWN.
                heartbeatTracker.checkLoop = Date.now();
              }
            }, url);
          }

          // Wait for warmup batch to drain
          await queueManager.waitEmpty([queueManager.checkQueue]);
          // Loop to re-check in case seeder or other inputs added more unchecked
        }
      } catch (e) {
        logger.error(`Warmup runner failed: ${e?.message || e}`);
      } finally {
        // Disable warmup mode and re-enable deletion publishing
        worker.setWarmupMode(false);
        setDeletionPublishSuppressed(false);
        queueManager.setWarmupActive(false);
      }
    }

    // Run warmup before starting normal loops
    await runWarmup();

    // Drain remediation deletion queue after warmup re-enables deletion
    // publishing. Draining earlier makes deletion.ts return false before
    // sending any kind:5 event, which leaves valid removals in the queue.
    try {
      const { drainRemediationDeletionQueue } = await import(
        "../utils/remediation.ts"
      );
      await drainRemediationDeletionQueue(config);
    } catch (e) {
      logger.error(`drainRemediationDeletionQueue failed: ${e}`);
    }

    // Auto-recover from retry poisoning (e.g. after prolonged proxy outage)
    // Only checks relays whose last known state was online=1 — dead relays
    // naturally accumulate high retries and should not trigger recovery.
    {
      const networks: string[] = Array.isArray(config.relaymon.networks)
        ? config.relaymon.networks
        : ["clearnet"];
      const placeholders = networks.map(() => "?").join(",");
      const onlineResult = db.query(
        `SELECT COUNT(*) FROM relay_status WHERE ignore = 0 AND online = 1 AND network IN (${placeholders})`,
        networks,
      );
      const poisonedResult = db.query(
        `SELECT COUNT(*) FROM relay_status WHERE ignore = 0 AND online = 1 AND retries > 7 AND network IN (${placeholders})`,
        networks,
      );
      const onlineTotal = (onlineResult[0]?.[0] as number) || 0;
      const poisoned = (poisonedResult[0]?.[0] as number) || 0;

      if (onlineTotal > 0 && (poisoned / onlineTotal) > 0.5) {
        logger.warn(
          `Retry poisoning detected: ${poisoned}/${onlineTotal} previously-online relays have retries > 7. Resetting all retries.`,
        );
        db.query("UPDATE relay_status SET retries = 0");
      }
    }

    // Kickstart publishing immediately after warmup so we don't wait for expiry
    async function kickstartPublishing(): Promise<void> {
      try {
        const networks: string[] = Array.isArray(config.relaymon.networks)
          ? config.relaymon.networks
          : ["clearnet"];
        const placeholders = networks.map(() => "?").join(",");
        const query =
          `SELECT url FROM relay_status WHERE network IN (${placeholders})`;
        const rows = db.query(query, networks);
        const allUrls: string[] = rows.map(([url]) => url as string).filter(
          (u) => typeof u === "string" && !u.includes("|"),
        );

        if (allUrls.length === 0) {
          logger.info("Kickoff: no relays found to enqueue after warmup");
          return;
        }

        let toEnqueue: string[] = [];
        const rawMax = config.relaymon.checks.options.max;
        // Coerce string numbers to actual numbers (e.g. YAML '50' vs 50)
        const maxValue =
          typeof rawMax === "string" && /^\d+$/.test(rawMax.trim())
            ? parseInt(rawMax.trim(), 10)
            : rawMax;
        if (typeof maxValue === "number") {
          toEnqueue = allUrls.slice(0, maxValue);
          logger.info(
            `Kickoff: enqueuing ${toEnqueue.length} relays (numeric max: ${maxValue}) for immediate publishing`,
          );
        } else if (
          typeof maxValue === "string" && maxValue.trim().endsWith("%")
        ) {
          const percentage = parseFloat(maxValue) / 100;
          const count = Math.ceil(allUrls.length * percentage);
          toEnqueue = allUrls.slice(0, count);
          logger.info(
            `Kickoff: enqueuing ${toEnqueue.length} relays (percentage: ${maxValue}, count: ${count}) for immediate publishing`,
          );
        } else {
          toEnqueue = allUrls;
          logger.info(
            `Kickoff: enqueuing ${toEnqueue.length} relays for immediate publishing`,
          );
        }

        for (const url of toEnqueue) {
          queueManager.addCheckJob(async () => {
            try {
              await worker.processRelay(url);
            } catch (error) {
              logger.error(
                `Kickoff error processing ${url}: ${error?.message || error}`,
              );
            }
          }, url);
        }
      } catch (e) {
        logger.error(`Kickoff publishing failed: ${e?.message || e}`);
      }
    }

    await kickstartPublishing();

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
          await ignoreListSync.sync().catch((err) =>
            logger.error(`Sync error: ${err.message}`)
          );
          await ignoreListSync.publish(getPrivateKey()).catch((err) =>
            logger.error(`Publish error: ${err.message}`)
          );
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
          await ignoreListSync.publishDeletions(getPrivateKey()).catch((err) =>
            logger.error(`Deletions error: ${err.message}`)
          );
        } catch (error) {
          logger.error(`Error in runIgnoreListDeletions: ${error.message}`);
          await delay(60000); // Wait 1 minute before retrying
        }
      }
    }

    // Schedule deduplication re-evaluation
    async function runDedupReevaluation() {
      const interval = config?.relaymon?.deduplication?.reevaluation_interval ||
        "24h";
      const nip11CacheTtl = config?.relaymon?.deduplication?.nip11_cache_ttl ||
        "24h";
      const intervalMs = parseInterval(interval);
      const ttlMs = parseInterval(nip11CacheTtl);
      logger.info(`Scheduling deduplication re-evaluation every ${interval}`);
      logger.info(`NIP-11 cache TTL: ${nip11CacheTtl}`);

      while (true) {
        try {
          await delay(intervalMs);
          logger.info("Running scheduled deduplication re-evaluation...");
          const changedRelays = await reevaluateAllDeduplication(ttlMs).catch(
            (err) => {
              logger.error(`Re-evaluation error: ${err.message}`);
              return [];
            },
          );
          if (changedRelays && changedRelays.length > 0) {
            logger.info(
              `Re-evaluation changed ${changedRelays.length} relay(s) ignore status`,
            );
            // Publish deletions for newly ignored relays
            if (ignoreListSync) {
              await ignoreListSync.publishDeletions(getPrivateKey()).catch((
                err,
              ) =>
                logger.error(`Deletions after re-eval error: ${err.message}`)
              );
            }
          }
        } catch (error) {
          logger.error(`Error in runDedupReevaluation: ${error.message}`);
          await delay(60000); // Wait 1 minute before retrying
        }
      }
    }

    // Schedule re-evaluation of fake-relay ignored relays
    async function runIgnoredRelayReevaluation() {
      if (!config?.relaymon?.ignorelist?.enabled) {
        logger.debug(
          "IgnoreListSync is disabled, skipping ignored relay re-evaluation",
        );
        return;
      }

      const interval = config.relaymon.ignorelist.reevaluation_interval ||
        "24h";
      const intervalMs = parseInterval(interval);
      logger.info(`Scheduling ignored relay re-evaluation every ${interval}`);

      while (true) {
        try {
          await delay(intervalMs);
          logger.info("Running scheduled ignored relay re-evaluation...");

          const fakeRelays = getIgnoredRelaysByReason(
            "does not speak nostr protocol",
          );
          if (fakeRelays.length === 0) {
            logger.info("No fake-relay-ignored relays to re-evaluate");
            continue;
          }

          logger.info(
            `Re-evaluating ${fakeRelays.length} fake-relay-ignored relays`,
          );
          let unignoredCount = 0;

          for (const { url } of fakeRelays) {
            const wasUnignored = await worker.recheckIgnoredRelay(url);
            if (wasUnignored) {
              unignoredCount++;
            }
          }

          if (unignoredCount > 0) {
            logger.info(
              `Unignored ${unignoredCount} relay(s) that are no longer fake — republishing block list`,
            );
            await ignoreListSync.publish(getPrivateKey()).catch((err) =>
              logger.error(`Publish after re-evaluation error: ${err.message}`)
            );
          } else {
            logger.info(
              "All fake-relay-ignored relays still fail protocol check",
            );
          }
        } catch (error) {
          logger.error(
            `Error in runIgnoredRelayReevaluation: ${error.message}`,
          );
          await delay(60000);
        }
      }
    }

    const tasks: Promise<void>[] = [];

    if (seeder) {
      tasks.push(
        seeder.start().catch((error) => {
          logger.error(`Seeder process error: ${error.message}`);
          logger.error(error.stack || "No stack trace available");
          // Keep running - we'll just have a failed seeder
        }),
      );
    }

    tasks.push(
      checkExpiredRelays().catch((error) => {
        logger.error(`Check process error: ${error.message}`);
        logger.error(error.stack || "No stack trace available");
        // This shouldn't happen due to the try/catch inside checkExpiredRelays
      }),
    );

    // Add scheduled tasks
    if (config?.relaymon?.ignorelist?.enabled) {
      tasks.push(
        runIgnoreListSync().catch((error) => {
          logger.error(`Ignore list sync process error: ${error.message}`);
        }),
      );
      tasks.push(
        runIgnoreListDeletions().catch((error) => {
          logger.error(`Ignore list deletions process error: ${error.message}`);
        }),
      );
    }

    // DISABLED Phase 22: dedup re-evaluation loop disabled to prevent
    // interference with NATO phonetic spam purge. Code preserved for
    // future re-enablement.
    // tasks.push(
    //   runDedupReevaluation().catch(error => {
    //     logger.error(`Dedup re-evaluation process error: ${error.message}`);
    //   })
    // )

    if (config?.relaymon?.ignorelist?.enabled) {
      tasks.push(
        runIgnoredRelayReevaluation().catch((error) => {
          logger.error(
            `Ignored relay re-evaluation process error: ${error.message}`,
          );
        }),
      );
    }

    showStatus(queueManager);

    // Then start both processes in parallel, with individual error handling
    await Promise.all(tasks);
  } catch (error) {
    logger.error(`Fatal error in daemon: ${error.message}`);
    logger.error(error.stack || "No stack trace available");
    throw error; // Re-throw to let Deno handle it
  }
}
