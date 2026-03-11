import { Nocap } from "npm:@nostrwatch/nocap";
import EveryAdapterDefault from "npm:@nostrwatch/nocap-every-adapter-default";
import { Publisher, Kind30166 } from "npm:@nostrwatch/publisher";
import { relayHostnameDedup, setConfig } from "../utils/hostnames.ts";
import { persistResult, incrementRetryCount, getRetryCount, db, storeRelayInfo, isRelayIgnored, getLastDeltaState, storeDeltaState, getPeriodSnapshot, storePeriodSnapshot, markRelayIgnored } from "../db/db.ts";
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
import type { IgnoreListSync } from "../utils/IgnoreListSync.ts";
import { getErrorMessage } from "../types/errors.ts";
import { detectDeltas } from "../delta/detector.ts";
import { Kind1066 } from "../delta/kind1066.ts";
import { Kind20166 } from "../delta/kind20166.ts";
import { getPeriodsToEmit, validatePeriods } from "../delta/periods.ts";
import { getPrivateKey } from "./daemon.ts";

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
  private warmupMode: boolean = false;
  private ignoreListSync: IgnoreListSync | null = null;

  constructor(
    private pubkey: string,
    private queueManager: QueueManager,
    config: Config,
    ignoreListSync?: IgnoreListSync
  ) {
    this.config = config;
    this.ignoreListSync = ignoreListSync || null;
    this.publisher = new Publisher(this.pubkey, config.publisher.relays);

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

    // Validate period configuration if periods are enabled
    if (config.relaymon.delta?.periods?.enabled) {
      const checkIntervalMs = config.relaymon.checks.options.interval;
      const periods = config.relaymon.delta.periods.definitions;
      const warnings = validatePeriods(periods, checkIntervalMs);

      if (warnings.length > 0) {
        this.logger.warn("Period configuration warnings:");
        warnings.forEach(w => this.logger.warn(`  - ${w}`));
      } else {
        this.logger.info(`Period aggregates enabled: ${periods.join(', ')}`);
      }
    }
  }

  // Enable/disable warmup mode. When enabled, monitor event publishing is suppressed
  // and first-checks bypass DB ignore gating to ensure all relays are checked at least once.
  public setWarmupMode(enabled: boolean): void {
    this.warmupMode = enabled;
    this.logger.info(`Warmup mode ${enabled ? 'enabled' : 'disabled'}`);
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

    // Determine if this is the first-ever check for this relay
    try {
      const checkedAt = db.query("SELECT checked_at FROM relay_status WHERE url = ?", [relayUrl]);
      if (checkedAt.length > 0 && (checkedAt[0][0] === -1)) {
        isFirstCheck = true;
        this.logger.debug(`This is the first check for relay: ${relayUrl}`);
      }
    } catch (error) {
      this.logger.error(`Error checking if first check for ${relayUrl}: ${error}`);
    }

    if (isRelayIgnored(relayUrl)) {
      this.logger.debug(`Skipping check for relay ${relayUrl} - already marked as ignored in database`);
      // During warmup, if this is the first check, bypass the ignore and continue
      if (this.warmupMode && isFirstCheck) {
        this.logger.debug(`Warmup: bypassing DB ignore for first check of ${relayUrl}`);
      } else {
        try {
          await deleteRelayCheckEvent(relayUrl, "Relay was previously marked as ignored", this.config, this.queueManager);
          this.logger.debug(`Published deletion event for previously ignored relay ${relayUrl}`);
        } catch (error) {
          this.logger.error(`Error publishing deletion event for ${relayUrl}: ${error}`);
        }
        return;
      }
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

      // Fake relay detection: connects but doesn't speak nostr protocol
      const checksEnabled = this.config.relaymon.checks.enabled || ["open", "read"];
      const readCheckEnabled = checksEnabled.includes("read");
      const readFailedProtocol = result.read?.data !== true
        && typeof result.read?.message === 'string'
        && result.read.message.includes('NIP-01 compatible');
      const isFakeRelay = wasOnline && readCheckEnabled && readFailedProtocol;

      if (isFakeRelay) {
        const fakeRelayReason = "Not a relay: WebSocket connects but does not speak nostr protocol";
        this.logger.warn(`Fake relay detected: ${relayUrl} (open=true, read=false)`);
        wasOnline = false;
        dedupedResult.ignore = true;
        dedupedResult.ignore_reason = fakeRelayReason;
        dedupedResult.online = false;

        markRelayIgnored(relayUrl, fakeRelayReason);

        if (this.ignoreListSync) {
          this.ignoreListSync.addToIgnoreList(relayUrl, fakeRelayReason);
        }

        await deleteRelayCheckEvent(
          relayUrl,
          "Fake relay: WebSocket connects but does not speak nostr protocol",
          this.config,
          this.queueManager
        );
      }

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

      // Determine operational status transition for delta events
      let operationalStatus: "init" | "down" | "up" | undefined;
      if (previousStatus === undefined) {
        operationalStatus = "init"; // First check ever
      } else if (previousStatus === true && !wasOnline) {
        operationalStatus = "down"; // Went offline
      } else if (previousStatus === false && wasOnline) {
        operationalStatus = "up"; // Recovered
      }
      // If no state change, operationalStatus remains undefined

      this.knownRelayStatus.set(relayUrl, wasOnline);

      if (!dedupedResult.ignore && wasOnline) {
        this.publishResult(dedupedResult);
      }

      // Publish delta event (Kind 1066) if enabled
      this.publishDeltaEvent(relayUrl, dedupedResult, operationalStatus, wasOnline);

      this.logger.debug(`Persisting result for relay: ${relayUrl}, online: ${wasOnline}`);
      persistResult(dedupedResult);
      
      if (wentOffline || isRetry) {
        this.logger.debug(`Incrementing retry count for ${relayUrl} as it ${wentOffline ? 'went offline' : 'is still offline'}`);
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

    } catch (error: unknown) {
      wasSuccessful = false;
      this.logger.error(`Error processing relay ${relayUrl}: ${getErrorMessage(error)}`);
      
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
      if (this.warmupMode) {
        this.logger.debug(`Warmup mode active; suppressing check event publish for ${result.url}`);
        return;
      }
      const publishJob = async (retryCount = 0, maxRetries = this.publishMaxRetries, backoffMs = this.publishInitialBackoffMs) => {
        try {
          const event = new Kind30166(this.pubkey);
          const privkey = getPrivateKey();
          const generated = event.generateEvent(result);
          generated.tags.push(['client', '@nostrwatch/relaymon']);
          const signedEvent = await event.signEvent(privkey);
          await this.publisher.publishEvent(signedEvent);
          this.logger.debug(`Published event for relay ${result.url}`);
        } catch (error: unknown) {
          const errorMsg = getErrorMessage(error);
          this.logger.error(`Publish failed for ${result.url} (attempt ${retryCount + 1}/${maxRetries + 1}): ${errorMsg}`);

          if (retryCount < maxRetries) {
            const nextRetryCount = retryCount + 1;
            const nextBackoffMs = backoffMs * 2;
            this.logger.info(`Scheduling retry ${nextRetryCount}/${maxRetries} for ${result.url} in ${(nextBackoffMs / 1000).toFixed(1)}s`);

            setTimeout(() => {
              this.queueManager.addPublishJob(
                () => publishJob(nextRetryCount, maxRetries, nextBackoffMs),
                { isRetry: true, category: 'delta' }
              );
            }, nextBackoffMs);
          } else {
            this.logger.error(`Exceeded maximum retries (${maxRetries}) for publishing ${result.url}`);
          }

          // Always throw to properly count failures in queue metrics
          throw error;
        }
      };

      this.queueManager.addPublishJob(() => publishJob(), { isRetry: false, category: 'check' });
    } catch (error: unknown) {
      this.logger.error(`Failed to add publish job for ${result.url}: ${getErrorMessage(error)}`);
    }
  }

  async publishDeltaEvent(
    relayUrl: string,
    result: RelayCheckResult,
    operationalStatus?: "init" | "down" | "up",
    isOnline?: boolean
  ): Promise<void> {
    // Check if delta events are enabled
    if (!this.config.relaymon.delta?.enabled) {
      return;
    }

    // Don't publish delta events for ignored relays
    if (result.ignore) {
      return;
    }

    try {
      const wasOnline = isOnline ?? (result.open?.data === true);
      const retryCount = getRetryCount(relayUrl);

      // Check if we should stop publishing delta events (exceeded max retries for offline relay)
      const maxRetries = this.config.relaymon.delta.max_retries ?? 10;
      if (!wasOnline && retryCount > maxRetries) {
        this.logger.debug(`Skipping delta event for ${relayUrl} - exceeded max_retries (${maxRetries})`);
        return;
      }

      // Get the last delta state
      const lastState = getLastDeltaState(relayUrl);

      // Get current NIP-11 info (use empty object if not available)
      const currentInfo = result.info?.data || {};

      // Get current DNS and geo data
      const currentDns = result.dns?.data;
      const currentGeo = result.geo?.data;

      // Create composite state objects for delta detection
      const lastCompositeState = lastState ? {
        ...lastState.state,
        ...(lastState.dns ? Object.fromEntries(
          Object.entries(lastState.dns).map(([k, v]) => [`dns.${k}`, v])
        ) : {}),
        ...(lastState.geo ? Object.fromEntries(
          Object.entries(lastState.geo).map(([k, v]) => [`geo.${k}`, v])
        ) : {}),
      } : null;

      const currentCompositeState = {
        ...currentInfo,
        ...(currentDns ? Object.fromEntries(
          Object.entries(currentDns).map(([k, v]) => [`dns.${k}`, v])
        ) : {}),
        ...(currentGeo ? Object.fromEntries(
          Object.entries(currentGeo).map(([k, v]) => [`geo.${k}`, v])
        ) : {}),
      };

      // Detect deltas from last check
      const deltas = detectDeltas(lastCompositeState, currentCompositeState);

      // Store current state for next comparison (only when online to preserve last-known-good state)
      if (wasOnline) {
        storeDeltaState(relayUrl, {
          state: currentInfo,
          rttOpen: result.open?.duration,
          rttRead: result.read?.duration,
          rttWrite: result.write?.duration,
          dns: currentDns,
          geo: currentGeo,
        });
      }

      // Handle period aggregates if enabled
      let periodsToEmit: string[] = [];
      const periodsEnabled = this.config.relaymon.delta.periods?.enabled;

      if (periodsEnabled && this.config.relaymon.delta.periods) {
        const checkIntervalMs = this.config.relaymon.checks.options.interval;
        const configuredPeriods = this.config.relaymon.delta.periods.definitions;
        const nowTs = Math.floor(Date.now() / 1000);

        // Get period snapshots for this relay
        const periodSnapshotTimes = new Map<string, number>();
        for (const period of configuredPeriods) {
          const snapshot = getPeriodSnapshot(relayUrl, period);
          if (snapshot) {
            periodSnapshotTimes.set(period, snapshot.snapshotAt);
          } else {
            periodSnapshotTimes.set(period, 0); // Never emitted
          }
        }

        // Determine which periods should be emitted on this check
        periodsToEmit = getPeriodsToEmit(
          configuredPeriods,
          checkIntervalMs,
          periodSnapshotTimes,
          nowTs
        );

        // Store snapshots for all periods that are being emitted
        if (periodsToEmit.length > 0) {
          this.logger.debug(`Emitting period aggregates for ${relayUrl}: ${periodsToEmit.join(', ')}`);
          for (const period of periodsToEmit) {
            storePeriodSnapshot(relayUrl, period, currentInfo);
          }
        }
      }

      // Generate and publish delta event
      const publishJob = async (retryCount = 0, maxRetries = this.publishMaxRetries, backoffMs = this.publishInitialBackoffMs) => {
        try {
          const event = new Kind1066(this.pubkey);
          const privkey = getPrivateKey();

          const signedEvent = await event.generateAndSignEvent({
            url: relayUrl,
            online: wasOnline,
            retryCount: wasOnline ? 0 : retryCount,
            rttOpen: result.open?.duration,
            deltas: wasOnline ? deltas : [], // Only include deltas when online
            periods: periodsToEmit.length > 0 ? periodsToEmit : undefined, // Cascading period tags
            operationalStatus, // Add operational status for O tag
          }, privkey);

          await this.publisher.publishEvent(signedEvent);
          this.logger.debug(`Published delta event (Kind 1066) for relay ${relayUrl}` +
            (periodsToEmit.length > 0 ? ` with periods: ${periodsToEmit.join(', ')}` : ''));

          // Publish ephemeral state change event (Kind 20166) if status changed
          if (operationalStatus) {
            try {
              const ephemeralEvent = new Kind20166(this.pubkey);
              const ephemeralSigned = await ephemeralEvent.generateAndSignEvent({
                url: relayUrl,
                operationalStatus,
                online: wasOnline,
                rttOpen: result.open?.duration,
                retryCount: wasOnline ? undefined : retryCount,
              }, privkey);

              await this.publisher.publishEvent(ephemeralSigned);
              this.logger.debug(`Published ephemeral state change event (Kind 20166) for relay ${relayUrl}: ${operationalStatus}`);
            } catch (ephemeralError: unknown) {
              // Don't fail the whole job if ephemeral publish fails
              this.logger.warn(`Failed to publish ephemeral event for ${relayUrl}: ${getErrorMessage(ephemeralError)}`);
            }
          }
        } catch (error: unknown) {
          const errorMsg = getErrorMessage(error);
          this.logger.error(`Delta event publish failed for ${relayUrl} (attempt ${retryCount + 1}/${maxRetries + 1}): ${errorMsg}`);

          if (retryCount < maxRetries) {
            const nextRetryCount = retryCount + 1;
            const nextBackoffMs = backoffMs * 2;
            this.logger.info(`Scheduling delta event retry ${nextRetryCount}/${maxRetries} for ${relayUrl} in ${(nextBackoffMs / 1000).toFixed(1)}s`);

            setTimeout(() => {
              this.queueManager.addPublishJob(
                () => publishJob(nextRetryCount, maxRetries, nextBackoffMs),
                { isRetry: true, category: 'check' }
              );
            }, nextBackoffMs);
          } else {
            this.logger.error(`Exceeded maximum retries (${maxRetries}) for publishing delta event for ${relayUrl}`);
          }

          // Always throw to properly count failures in queue metrics
          throw error;
        }
      };

      if (this.warmupMode) {
        this.logger.debug(`Warmup mode active; suppressing delta event publish for ${relayUrl}`);
        return;
      }
      this.queueManager.addPublishJob(() => publishJob(), { isRetry: false, category: 'delta' });
    } catch (error: unknown) {
      this.logger.error(`Failed to publish delta event for ${relayUrl}: ${getErrorMessage(error)}`);
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
