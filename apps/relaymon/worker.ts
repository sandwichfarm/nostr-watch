import { Nocap } from "npm:@nostrwatch/nocap";
import EveryAdapterDefault from "npm:@nostrwatch/nocap-every-adapter-default";
import { Publisher, Kind30166 } from "npm:@nostrwatch/publisher";
import { relayHostnameDedup } from "./hostnames.ts";
import { persistResult, incrementRetryCount, getRetryCount, db } from "./db.ts";
import { delay } from "npm:@nostrwatch/utils";
import { getLogger, LogLevel } from "./logger.ts";
import { RetryManager } from "./retryManager.ts";
import { statuses, updateSessionStats, incrementChecksCounter } from "./status.ts";
import chalk from "npm:chalk";
import { QueueManager } from "./queueManager.ts";
import { getExpiredRelays } from "./db.ts";
import { maybeAnnounce } from "./announce.ts";
import { getPublicKey } from "npm:nostr-tools";

chalk.level = 1;

export class Worker {
  private relayRetries: Map<string, number> = new Map();
  private logger = getLogger("Worker");
  private config: any;
  private publisher: Publisher;
  private retryManager: RetryManager;
  private statusIntval: ReturnType<typeof setInterval>; // Default to log status every 20 checks
  private knownRelayStatus: Map<string, boolean> = new Map(); // Track previous status (online/offline)

  constructor(
    private pubkey: string,
    private queueManager: any,
    config: any
  ) {
    this.config = config;
    this.publisher = new Publisher(this.pubkey, config.publisher.relays);
    this.retryManager = new RetryManager(config.relaymon.retry.expiry);
    this.statusIntval = statuses(this.queueManager, config.relaymon.checks.options.statusInterval);
    
    // Set logger level from config if available
    if (config.logLevel) {
      this.logger.setLevel(config.logLevel);
    }

    // Initialize known relay status from database to maintain state between runs
    this.initializeRelayStatusFromDB();
  }

  // Initialize relay status map from database to persist knowledge between runs
  private initializeRelayStatusFromDB(): void {
    try {
      // Use the existing db instance instead of creating a new connection
      const results = db.query(`SELECT url, online, retries FROM relay_status`);
      
      for (const [url, online, retries] of results) {
        // Get online status
        this.knownRelayStatus.set(url as string, (online as number) === 1);
        
        // Also initialize retry counts directly from the query
        if ((retries as number) > 0) {
          this.relayRetries.set(url as string, retries as number);
          this.logger.debug(`Loaded retry count for ${url}: ${retries}`);
        }
      }
      
      this.logger.info(`Initialized status for ${this.knownRelayStatus.size} relays from database`);
    } catch (error) {
      this.logger.error(`Failed to initialize relay status from database: ${error.message}`);
    }
  }

  async processRelay(relayUrl: string): Promise<void> {
    let wasSuccessful = true;
    let wasOnline = false;
    let wentOffline = false;

    this.logger.debug(`Starting check for relay: ${relayUrl}`);
    
    try {
      const nocap = new Nocap(relayUrl, {
        timeouts: this.config.relaymon.checks.options.timeout,
        logLevel: this.config.logLevel,
      });
      await nocap.useAdapters(Object.values(EveryAdapterDefault));
      const result = await nocap.check(
        this.config.relaymon.checks.enabled || ["open", "read"]
      );
      const dedupedResult = await relayHostnameDedup(result);
      
      // Update session stats - check if relay went offline
      wasOnline = result.open?.data === true;
      
      // Check if the relay was previously online but is now offline
      const previouslyOnline = this.knownRelayStatus.get(relayUrl);
      if (previouslyOnline === true && !wasOnline) {
        wentOffline = true;
        this.logger.debug(`Relay ${relayUrl} went offline (was previously online)`);
      }
      
      // Check if this is a retry (was already offline and still is)
      // Use strict comparison and handle undefined case
      const previousStatus = this.knownRelayStatus.get(relayUrl);
      const previouslyOffline = previousStatus === false; // only true if definitely was false before
      const isRetry = previouslyOffline && !wasOnline;
      
      // Update known relay status
      this.knownRelayStatus.set(relayUrl, wasOnline);
      
      if (!dedupedResult.ignore && wasOnline) {
        await this.publishResult(dedupedResult);
      } 
      
      this.logger.debug(`Persisting result for relay: ${relayUrl}, online: ${wasOnline}`);
      persistResult(dedupedResult);
      
      // Only increment retry count if this is a retry (relay was already offline before)
      if (isRetry) {
        this.logger.debug(`Incrementing retry count for ${relayUrl} as it's still offline`);
        this.handleRetryForRelay(relayUrl);
      }
      
      try {
        this.progressMessage(relayUrl, result, false);
      } catch (displayError) {
        console.error("Error displaying progress:", displayError);
      }
      
      // Success - reset retry count (already done in persistResult)
      if (wasOnline) {
        this.relayRetries.set(relayUrl, 0);
      }
      this.logger.debug(`Successfully completed check for relay: ${relayUrl}`);

    } catch (error: any) {
      wasSuccessful = false;
      this.logger.error(`Error processing relay ${relayUrl}: ${error.message}`);
      
      // Only increment retry count if this is a genuine retry (not first error)
      const currentRetryCount = this.relayRetries.get(relayUrl) || 0;
      if (currentRetryCount > 0) {
        this.logger.debug(`Incrementing retry count for ${relayUrl} after repeated error (current: ${currentRetryCount})`);
        this.handleRetryForRelay(relayUrl);
      } else {
        // First time error - set to 0 but don't increment yet
        this.logger.debug(`First error for ${relayUrl}, not incrementing retry count yet`);
        this.relayRetries.set(relayUrl, 0);
      }
      
      try {
        this.progressMessage(relayUrl, {}, true);
      } catch (displayError) {
        console.error("Error displaying error progress:", displayError);
      }
    } finally {
      try {
        updateSessionStats(relayUrl, wasSuccessful, wasOnline, wentOffline);
        incrementChecksCounter();
      } catch (statsError) {
        console.error("Error updating stats:", statsError);
      }
    }
  }

  async publishResult(result: any): Promise<void> {
    try {
      const event = new Kind30166(getPublicKey(Deno.env.get("DAEMON_PRIVKEY") || ""));
      event.generateEvent(result);
      const privkey = Deno.env.get("DAEMON_PRIVKEY") || "";
      const signedEvent = await event.signEvent(privkey);
      await this.publisher.publishEvent(signedEvent);
      this.logger.debug(`Published event for relay ${result.url}`);
    } catch (error: any) {
      this.logger.error(`Publish failed for ${result.url}: ${error.message}`);
      this.queueManager.addPublishJob(async () => {
        await delay(1000);
        // Optionally, retry publishing here.
      });
    }
  }

  handleRetryForRelay(relayUrl: string): void {
    let currentRetries = this.relayRetries.get(relayUrl) || 0;
    currentRetries++;
    this.relayRetries.set(relayUrl, currentRetries);
    
    // Increment retry count in database
    incrementRetryCount(relayUrl);
    
    const delayMs = this.retryManager.getDelay(currentRetries);
    this.logger.debug(
      `Relay ${relayUrl} failed check, incremented retry count to ${currentRetries} (next check after ~${delayMs/1000}s based on backoff)`
    );
  }

  /**
   * Format milliseconds into a human-readable string (e.g., 2m, 1h)
   */
  formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    
    if (seconds < 60) {
      return `${seconds}s`;
    } else if (seconds < 3600) {
      return `${Math.floor(seconds / 60)}m`;
    } else if (seconds < 86400) {
      return `${Math.floor(seconds / 3600)}h`;
    } else {
      return `${Math.floor(seconds / 86400)}d`;
    }
  }

  progressMessage(
    url: string,
    result: any = {},
    error: boolean = false
  ): void {
    const maxRelayWidth = 50; // Max width for relay URLs
    const failure = chalk.red;
    const success = chalk.bold.green;
    const mute = chalk.gray;

    let duration = 0;
    const incD = (_d: number) => {
      if (_d > 0) duration += _d;
    };

    // Format the URL to a consistent width
    let formattedUrl = url;
    if (url.length > maxRelayWidth) {
      // Truncate with ellipsis if too long
      formattedUrl = url.substring(0, maxRelayWidth - 3) + '...';
    } else {
      // Pad with spaces if shorter
      formattedUrl = url.padEnd(maxRelayWidth, ' ');
    }

    let progress = "";
    progress += chalk.hex('#9F2B68').bold(`${formattedUrl}: `);

    const checks: string[] = this.config.relaymon.checks.enabled || [];
    if (checks.includes("open")) {
      progress += `${
        result?.open?.data === true ? success("online   ") : failure("offline  ")
      } `;
      incD(result?.open?.duration || 0);
    }
    if (checks.includes("read")) {
      progress += `${
        result?.read?.data === true ? success("readable   ") : failure("unreadable ")
      } `;
      incD(result?.read?.duration || 0);
    }
    if (checks.includes("write")) {
      progress += `${
        result?.write?.data === true ? success("writable   ") : failure("unwritable ")
      } `;
      incD(result?.write?.duration || 0);
    }
    if (checks.includes("ssl")) {
      progress += `${
        Object.keys(result?.ssl?.data || {}).length
          ? success("ssl ")
          : failure("ssl ")
      } `;
      incD(result?.ssl?.duration || 0);
    }
    if (checks.includes("dns")) {
      progress += `${
        Object.keys(result?.dns?.data || {}).length
          ? success("dns ")
          : failure("dns ")
      } `;
      incD(result?.dns?.duration || 0);
    }
    if (checks.includes("geo")) {
      progress += `${
        Object.keys(result?.geo?.data || {}).length
          ? success("geo ")
          : failure("geo ")
      } `;
      incD(result?.geo?.duration || 0);
    }
    if (checks.includes("info")) {
      progress += `${
        Object.keys(result?.info?.data || {}).length
          ? success("info ")
          : failure("info ")
      } `;
      incD(result?.info?.duration || 0);
    }

    // Get retry count from database for accuracy instead of in-memory map
    const retries = getRetryCount(url);
    const isOnline = result?.open?.data === true;

    if (error) {
      // If there's an error, show error status
      progress += `${chalk.gray.italic("error")} `;
      
      // Only show retry count if greater than 0 (actual retries)
      if (retries > 0) {
        // Calculate time until next retry based on retry count
        const nextRetryDelay = this.retryManager.getDelay(retries);
        const formattedDelay = this.formatDuration(nextRetryDelay);
        progress += chalk.yellow(`[retries: ${retries}, next: ${formattedDelay}]`);
      }
    } else if (!isOnline) {
      // If relay is offline, show retries instead of duration, but only if > 0
      if (retries > 0) {
        // Calculate time until next retry based on retry count
        const nextRetryDelay = this.retryManager.getDelay(retries);
        const formattedDelay = this.formatDuration(nextRetryDelay);
        progress += chalk.yellow(`[retries: ${retries}, next: ${formattedDelay}]`);
      }
    } else {
      // If relay is online, show duration
      progress += chalk.gray.italic(`${(duration / 1000).toFixed(2)} seconds `);
    }
    
    console.log(progress);
  }
}
