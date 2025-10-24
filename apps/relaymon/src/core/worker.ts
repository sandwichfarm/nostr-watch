import { Nocap } from "npm:@nostrwatch/nocap";
import EveryAdapterDefault from "npm:@nostrwatch/nocap-every-adapter-default";
import { Publisher, Kind30166 } from "npm:@nostrwatch/publisher";
import { relayHostnameDedup, setConfig } from "../utils/hostnames.ts";
import { persistResult, incrementRetryCount, getRetryCount, db, storeRelayInfo, isRelayIgnored } from "../db/db.ts";
import { delay } from "npm:@nostrwatch/utils";
import { getLogger, LogLevel } from "../utils/logger.ts";
import { RetryManager } from "../utils/retryManager.ts";
import { statuses, updateSessionStats, incrementChecksCounter, incrementRelaysRecovered, incrementNewRelaysFound } from "./status.ts";
import chalk from "npm:chalk";
import { QueueManager } from "../utils/queueManager.ts";
import { getExpiredRelays } from "../db/db.ts";
import { maybeAnnounce } from "../utils/announce.ts";
import { getPublicKey } from "npm:nostr-tools";
import { isHostnameBlocked } from "../utils/blocklists.ts";
import { createInfoHash } from "../utils/hostnames.ts";
import { deleteRelayCheckEvent } from "../utils/deletion.ts";
import type { Config } from "../config/config.ts";
import type { NocapCheckResult, RelayCheckResult } from "../types/relay.ts";

chalk.level = 1;

export class Worker {
  private relayRetries: Map<string, number> = new Map();
  private logger = getLogger("Worker");
  private config: Config;
  private publisher: Publisher;
  private retryManager: RetryManager;
  private statusIntval: ReturnType<typeof setInterval>;
  private knownRelayStatus: Map<string, boolean> = new Map();
  private publishMaxRetries: number = 5;
  private publishInitialBackoffMs: number = 1000*60;

  constructor(
    private pubkey: string,
    private queueManager: any,
    config: Config
  ) {
    this.config = config;
    this.publisher = new Publisher(this.pubkey, config.monitor.relays);
    this.retryManager = new RetryManager(config.relaymon.retry.expiry);
    this.statusIntval = statuses(this.queueManager, config.relaymon.checks.options.statusInterval);
    
    if (config.logLevel) {
      this.logger.setLevel(config.logLevel);
    }

    if (config.publisher?.retry?.maxRetries !== undefined) {
      this.publishMaxRetries = config.publisher.retry.maxRetries;
    }
    if (config.publisher?.retry?.initialBackoffMs !== undefined) {
      this.publishInitialBackoffMs = config.publisher.retry.initialBackoffMs;
    }

    this.initializeRelayStatusFromDB();
    
    setConfig(config);
  }

  private initializeRelayStatusFromDB(): void {
    try {
      const results = db.query(`SELECT url, online, retries FROM relay_status`);
      
      for (const [url, online, retries] of results) {
        this.knownRelayStatus.set(url as string, (online as number) === 1);
        
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
    let recovered = false;
    let isFirstCheck = false;

    if (isHostnameBlocked(relayUrl)) {
      this.logger.debug(`Skipping check for relay ${relayUrl} - hostname is in blocklist`);
      await deleteRelayCheckEvent(relayUrl, "hostname is in blocklist", this.config, this.queueManager);
      db.query("DELETE FROM relay_status WHERE url = ?", [relayUrl]); 
      return;
    }

    if (isRelayIgnored(relayUrl)) {
      this.logger.debug(`Skipping check for relay ${relayUrl} - already marked as ignored in database`);
      
      try {
        await deleteRelayCheckEvent(relayUrl, "Relay was previously marked as ignored", this.config, this.queueManager);
        this.logger.debug(`Published deletion event for previously ignored relay ${relayUrl}`);
      } catch (error) {
        this.logger.error(`Error publishing deletion event for ${relayUrl}: ${error}`);
      }
      
      return;
    }

    try {
      const checkedAt = db.query("SELECT checked_at FROM relay_status WHERE url = ?", [relayUrl]);
      if (checkedAt.length > 0 && (checkedAt[0][0] === -1)) {
        isFirstCheck = true;
        this.logger.debug(`This is the first check for relay: ${relayUrl}`);
      }
    } catch (error) {
      this.logger.error(`Error checking if first check for ${relayUrl}: ${error}`);
    }

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

      if (result.info?.data && Object.keys(result.info.data).length > 0) {
        try {
          const infoHash = createInfoHash(result.info.data);
          if (infoHash) {
            storeRelayInfo(relayUrl, result.info.data, infoHash);
            this.logger.debug(`Stored NIP-11 info for ${relayUrl} with hash ${infoHash}`);
          }
        } catch (infoError) {
          this.logger.error(`Error storing NIP-11 info for ${relayUrl}: ${infoError}`);
        }
      }

      const dedupedResult = await relayHostnameDedup(result);
      
      wasOnline = result.open?.data === true;
      
      if (isFirstCheck && wasOnline) {
        incrementNewRelaysFound(1, true);
        this.logger.debug(`New relay ${relayUrl} is online - incrementing new relays found counter`);
      }
      
      const previouslyOnline = this.knownRelayStatus.get(relayUrl);
      if (previouslyOnline === true && !wasOnline) {
        wentOffline = true;
        this.logger.debug(`Relay ${relayUrl} went offline (was previously online)`);
      }
      
      const previousStatus = this.knownRelayStatus.get(relayUrl);
      const previouslyOffline = previousStatus === false;
      if (previouslyOffline && wasOnline) {
        recovered = true;
        this.logger.debug(`Relay ${relayUrl} recovered (was previously offline)`);
        incrementRelaysRecovered();
      }
      
      const isRetry = previouslyOffline && !wasOnline;
      
      this.knownRelayStatus.set(relayUrl, wasOnline);
      
      if (!dedupedResult.ignore && wasOnline) {
        this.publishResult(dedupedResult);
      } 
      
      this.logger.debug(`Persisting result for relay: ${relayUrl}, online: ${wasOnline}`);
      persistResult(dedupedResult);
      
      if (isRetry) {
        this.logger.debug(`Incrementing retry count for ${relayUrl} as it's still offline`);
        this.handleRetryForRelay(relayUrl);
      }
      
      try {
        this.progressMessage(relayUrl, result, recovered, false);
      } catch (displayError) {
        console.error("Error displaying progress:", displayError);
      }
      
      if (wasOnline) {
        this.relayRetries.set(relayUrl, 0);
      }
      this.logger.debug(`Successfully completed check for relay: ${relayUrl}`);

    } catch (error: any) {
      wasSuccessful = false;
      this.logger.error(`Error processing relay ${relayUrl}: ${error.message}`);
      
      const currentRetryCount = this.relayRetries.get(relayUrl) || 0;
      if (currentRetryCount > 0) {
        this.logger.debug(`Incrementing retry count for ${relayUrl} after repeated error (current: ${currentRetryCount})`);
        this.handleRetryForRelay(relayUrl);
      } else {
        this.logger.debug(`First error for ${relayUrl}, not incrementing retry count yet`);
        this.relayRetries.set(relayUrl, 0);
      }
      
      try {
        this.progressMessage(relayUrl, {}, false, true);
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

  async publishResult(result: RelayCheckResult): Promise<void> {
    try {
      const publishJob = async (retryCount = 0, maxRetries = this.publishMaxRetries, backoffMs = this.publishInitialBackoffMs) => {
        try {
          const event = new Kind30166(getPublicKey(Deno.env.get("DAEMON_PRIVKEY") || ""));
          event.generateEvent(result);
          const privkey = Deno.env.get("DAEMON_PRIVKEY") || "";
          const signedEvent = await event.signEvent(privkey);
          await this.publisher.publishEvent(signedEvent);
          this.logger.debug(`Published event for relay ${result.url}`);
          return true;
        } catch (error: any) {
          this.logger.error(`Publish failed for ${result.url}: ${error.message}`);
          
          if (retryCount < maxRetries) {
            const nextRetryCount = retryCount + 1;
            const nextBackoffMs = backoffMs * 2;
            this.logger.info(`Scheduling retry ${nextRetryCount}/${maxRetries} for ${result.url} in ${nextBackoffMs}ms`);
            
            setTimeout(() => {
              this.queueManager.addPublishJob(
                () => publishJob(nextRetryCount, maxRetries, nextBackoffMs),
                { isRetry: true }
              );
            }, nextBackoffMs);
            
            return false;
          } else {
            this.logger.error(`Exceeded maximum retries (${maxRetries}) for publishing ${result.url}`);
            return false;
          }
        }
      };

      this.queueManager.addPublishJob(() => publishJob(), { isRetry: false });
    } catch (error: any) {
      this.logger.error(`Failed to add publish job for ${result.url}: ${error.message}`);
    }
  }

  handleRetryForRelay(relayUrl: string): void {
    let currentRetries = this.relayRetries.get(relayUrl) || 0;
    currentRetries++;
    this.relayRetries.set(relayUrl, currentRetries);
    
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
    result: NocapCheckResult | Record<string, never> = {},
    recovered: boolean = false,
    error: boolean = false
  ): void {
    const maxRelayWidth = 50;
    const failure = chalk.red;
    const success = chalk.bold.green;
    const mute = chalk.gray;
    const recoverHighlight = chalk.bold.cyan;

    let duration = 0;
    const incD = (_d: number) => {
      if (_d > 0) duration += _d;
    };

    let formattedUrl = url;
    if (url.length > maxRelayWidth) {
      formattedUrl = url.substring(0, maxRelayWidth - 3) + '...';
    } else {
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

    const retries = getRetryCount(url);
    const isOnline = result?.open?.data === true;

    if (error) {
      progress += `${chalk.gray.italic("error")} `;
      
      if (retries > 0) {
        const nextRetryDelay = this.retryManager.getDelay(retries);
        const formattedDelay = this.formatDuration(nextRetryDelay);
        progress += chalk.yellow(`[retries: ${retries}, next: ${formattedDelay}]`);
      }
    } else if (!isOnline) {
      if (retries > 0) {
        const nextRetryDelay = this.retryManager.getDelay(retries);
        const formattedDelay = this.formatDuration(nextRetryDelay);
        progress += chalk.yellow(`[retries: ${retries}, next: ${formattedDelay}]`);
      }
    } else {
      progress += chalk.gray.italic(`${(duration / 1000).toFixed(2)} seconds `);
      
      if (recovered) {
        progress += recoverHighlight(`[RECOVERED]`);
      }
    }
    
    console.log(progress);
  }
}
