/**
 * Uptime Kuma push client
 *
 * Pushes health status to Uptime Kuma without using @nostrwatch/kuma
 * Implements jitter, backoff, and retry logic
 */

import { getLogger } from "../utils/logger.ts";
import { buildHealthSnapshot } from "./snapshot.ts";
import type { KumaConfig, HealthSnapshot, HeartbeatTracker, ErrorTracker as ErrorTrackerType } from "./types.ts";
import type { QueueManager } from "../utils/queueManager.ts";

const logger = getLogger("KumaPusher");

/**
 * Kuma push context
 */
export interface KumaPushContext {
  queueManager: QueueManager;
  privkey: string | undefined;
  heartbeat: HeartbeatTracker;
  errorTracker: ErrorTrackerType;
  thresholds: {
    checkIdleMs: number;
    publishBacklogMax: number;
    errorRatePerMin: number;
    startupGraceMs: number;
  };
}

/**
 * Kuma push client
 */
export class KumaPusher {
  private config: KumaConfig;
  private context: KumaPushContext;
  private pushUrl: string;
  private running = false;
  private failureCount = 0;
  private lastPushTime = 0;

  constructor(config: KumaConfig, context: KumaPushContext, pushUrl: string) {
    this.config = config;
    this.context = context;
    this.pushUrl = pushUrl;
  }

  /**
   * Start the push loop
   */
  async start(): Promise<void> {
    if (!this.config.enabled) {
      logger.info("Kuma pusher disabled");
      return;
    }

    logger.info(`Starting Kuma pusher (interval: ${this.config.intervalMs}ms)`);
    this.running = true;

    // Wait for startup grace period before first push
    if (this.config.startupGraceMs > 0) {
      logger.info(`Waiting ${this.config.startupGraceMs}ms startup grace period before first push`);
      await this.delay(this.config.startupGraceMs);
    }

    // Main push loop
    while (this.running) {
      try {
        await this.push();
        this.failureCount = 0; // Reset on success
      } catch (error) {
        logger.error(`Kuma push failed: ${error}`);
        this.failureCount++;
      }

      // Wait for next push with jitter and backoff
      const waitTime = this.calculateWaitTime();
      logger.debug(`Next Kuma push in ${(waitTime / 1000).toFixed(1)}s`);
      await this.delay(waitTime);
    }
  }

  /**
   * Stop the push loop
   */
  stop(): void {
    logger.info("Stopping Kuma pusher...");
    this.running = false;
  }

  /**
   * Calculate wait time with jitter and backoff
   */
  private calculateWaitTime(): number {
    const baseInterval = this.config.intervalMs;

    // Apply exponential backoff on failures
    const backoffMultiplier = Math.min(Math.pow(2, this.failureCount), 16); // Max 16x
    const intervalWithBackoff = baseInterval * backoffMultiplier;

    // Add jitter (±10%)
    const jitter = intervalWithBackoff * 0.1 * (Math.random() * 2 - 1);
    const finalInterval = intervalWithBackoff + jitter;

    return Math.max(finalInterval, 1000); // Min 1 second
  }

  /**
   * Push health status to Kuma
   */
  private async push(): Promise<void> {
    try {
      // Build health snapshot
      const snapshot = await buildHealthSnapshot({
        queueManager: this.context.queueManager,
        privkey: this.context.privkey,
        heartbeat: this.context.heartbeat,
        thresholds: this.context.thresholds,
        errorTracker: this.context.errorTracker as any,
      });

      // Map health state to Kuma status
      const kumaStatus = this.mapHealthToKumaStatus(snapshot);

      // Build message
      const message = this.buildMessage(snapshot);

      // Build push URL with params
      const url = new URL(this.pushUrl);
      url.searchParams.set("status", kumaStatus);
      url.searchParams.set("msg", message);
      url.searchParams.set("ping", "");

      // Make HTTP GET request
      const response = await fetch(url.toString(), {
        method: "GET",
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const responseText = await response.text();
      logger.debug(`Kuma push successful: ${responseText}`);
      this.lastPushTime = Date.now();

      // Log push details
      logger.info(
        `Pushed ${snapshot.state} (Kuma: ${kumaStatus}) to Uptime Kuma: ${message}`,
      );
    } catch (error) {
      // Track error but don't let it crash the daemon
      logger.error(`Error pushing to Kuma: ${error}`);
      this.context.errorTracker.track(`Kuma push error: ${error}`, "kuma");
      throw error; // Re-throw for backoff logic
    }
  }

  /**
   * Map health state to Kuma status
   *
   * - "up" → "up"
   * - "degraded" → "up" (if degradedAsUp) or "down"
   * - "down" → "down"
   */
  private mapHealthToKumaStatus(snapshot: HealthSnapshot): "up" | "down" {
    if (snapshot.state === "up") {
      return "up";
    }

    if (snapshot.state === "degraded") {
      return this.config.degradedAsUp ? "up" : "down";
    }

    // down
    return "down";
  }

  /**
   * Build message for Kuma
   */
  private buildMessage(snapshot: HealthSnapshot): string {
    if (this.config.msgVerbosity === "summary") {
      // Concise summary
      if (snapshot.state === "up") {
        return "All systems operational";
      } else if (snapshot.state === "degraded") {
        return `Degraded: ${snapshot.reasons[0] || "unknown"}`;
      } else {
        return `Down: ${snapshot.reasons[0] || "unknown"}`;
      }
    } else {
      // Detailed message
      const parts: string[] = [];

      parts.push(`State: ${snapshot.state}`);

      // Add key metrics
      if (snapshot.metrics.checkQueue.pending > 0) {
        parts.push(`Queue: ${snapshot.metrics.checkQueue.pending} pending`);
      }

      if (snapshot.metrics.publishQueue.pending > 10) {
        parts.push(`Publish: ${snapshot.metrics.publishQueue.pending} backlog`);
      }

      if (snapshot.metrics.errors.lastMinute > 0) {
        parts.push(`Errors: ${snapshot.metrics.errors.lastMinute}/min`);
      }

      // Add first reason
      if (snapshot.reasons.length > 0) {
        parts.push(snapshot.reasons[0]);
      }

      return parts.join("; ");
    }
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Start Kuma pusher
 *
 * @param config - Kuma configuration
 * @param context - Push context
 * @param pushUrl - Kuma push URL with token
 * @returns Kuma pusher instance
 */
export async function startKumaPusher(
  config: KumaConfig,
  context: KumaPushContext,
  pushUrl: string,
): Promise<KumaPusher> {
  const pusher = new KumaPusher(config, context, pushUrl);

  // Start in background
  pusher.start().catch((error) => {
    logger.error(`Kuma pusher failed: ${error}`);
  });

  return pusher;
}
