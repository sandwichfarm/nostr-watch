/**
 * Health snapshot builder
 *
 * Aggregates all health checks and determines overall health state
 */

import { getLogger } from "../utils/logger.ts";
import {
  checkDatabase,
  checkSigning,
  checkCheckQueue,
  checkPublishQueue,
  checkCheckLoop,
} from "./checks.ts";
import type {
  HealthSnapshot,
  HealthState,
  HealthThresholds,
  HeartbeatTracker,
  ErrorEntry,
} from "./types.ts";
import type { QueueManager } from "../utils/queueManager.ts";

const logger = getLogger("HealthSnapshot");

/**
 * Error tracker - keeps sliding window of recent errors
 */
export class ErrorTracker {
  private errors: ErrorEntry[] = [];

  /**
   * Track an error
   */
  track(message: string, source: string): void {
    this.errors.push({
      timestamp: Date.now(),
      message,
      source,
    });
  }

  /**
   * Get errors in the last N milliseconds
   */
  getRecent(windowMs: number): ErrorEntry[] {
    const cutoff = Date.now() - windowMs;
    // Clean up old errors
    this.errors = this.errors.filter((e) => e.timestamp > cutoff);
    return this.errors;
  }

  /**
   * Get error count in the last N milliseconds
   */
  getCount(windowMs: number): number {
    return this.getRecent(windowMs).length;
  }

  /**
   * Clear all errors
   */
  clear(): void {
    this.errors = [];
  }
}

/**
 * Build a complete health snapshot
 *
 * Runs all health checks and determines overall state
 *
 * @param options - Snapshot options
 * @returns Complete health snapshot
 */
export async function buildHealthSnapshot(options: {
  queueManager: QueueManager;
  privkey: string | undefined;
  heartbeat: HeartbeatTracker;
  thresholds: HealthThresholds;
  errorTracker: ErrorTracker;
  expiredRelaysCount?: number;
}): Promise<HealthSnapshot> {
  const {
    queueManager,
    privkey,
    heartbeat,
    thresholds,
    errorTracker,
    expiredRelaysCount,
  } = options;

  // Run all checks in parallel
  const [dbCheck, signingCheck, checkQueueCheck, publishQueueCheck, checkLoopCheck] =
    await Promise.all([
      checkDatabase(),
      checkSigning(privkey),
      Promise.resolve(checkCheckQueue(queueManager, thresholds)),
      Promise.resolve(checkPublishQueue(queueManager, thresholds)),
      Promise.resolve(checkCheckLoop(heartbeat, thresholds, expiredRelaysCount)),
    ]);

  // Get error counts
  const errorsLastMinute = errorTracker.getCount(60 * 1000);
  const errorsLastFiveMinutes = errorTracker.getCount(5 * 60 * 1000);

  // Get queue metrics
  const checkQueue = queueManager.checkQueue;
  const publishQueue = queueManager.publishQueue;
  const publishStats = queueManager.getPublishingStats();

  const metrics = {
    checkQueue: {
      pending: checkQueue.pending,
      completed: queueManager.checkQueue.size, // completed + failed
      failed: 0, // QueueManager doesn't expose this separately
      enqueued: queueManager.getEnqueuedRelaysCount(),
    },
    publishQueue: {
      pending: publishQueue.pending,
      published: publishStats.published,
      failed: publishStats.failed,
      retrying: publishStats.retrying,
      successRate: publishStats.successRate,
    },
    errors: {
      lastMinute: errorsLastMinute,
      lastFiveMinutes: errorsLastFiveMinutes,
    },
    checkLoop: {
      lastHeartbeat: heartbeat.checkLoop
        ? new Date(heartbeat.checkLoop).toISOString()
        : undefined,
      timeSinceHeartbeat: heartbeat.checkLoop
        ? Date.now() - heartbeat.checkLoop
        : undefined,
      expiredRelaysWaiting: expiredRelaysCount,
    },
  };

  // Determine overall state and collect reasons
  const reasons: string[] = [];
  let state: HealthState = "up";

  // Critical failures (DOWN state)
  if (dbCheck.status === "fail") {
    state = "down";
    reasons.push(`Database: ${dbCheck.message}`);
  }

  if (signingCheck.status === "fail") {
    state = "down";
    reasons.push(`Signing: ${signingCheck.message}`);
  }

  if (checkLoopCheck.status === "fail") {
    state = "down";
    reasons.push(`Check loop: ${checkLoopCheck.message}`);
  }

  // Degraded conditions (if not already down)
  if (state !== "down") {
    if (publishQueueCheck.status === "warn") {
      state = "degraded";
      reasons.push(`Publish queue: ${publishQueueCheck.message}`);
    }

    if (checkLoopCheck.status === "warn") {
      state = "degraded";
      reasons.push(`Check loop: ${checkLoopCheck.message}`);
    }

    if (checkQueueCheck.status === "warn") {
      state = "degraded";
      reasons.push(`Check queue: ${checkQueueCheck.message}`);
    }

    // High error rate
    if (errorsLastMinute > thresholds.errorRatePerMin) {
      state = "degraded";
      reasons.push(
        `High error rate: ${errorsLastMinute} errors in last minute (threshold: ${thresholds.errorRatePerMin})`,
      );
    }
  }

  // If no issues, state stays "up"
  if (reasons.length === 0) {
    reasons.push("All systems operational");
  }

  const uptime = Date.now() - heartbeat.startupTime;

  const snapshot: HealthSnapshot = {
    state,
    timestamp: new Date().toISOString(),
    uptime,
    checks: {
      database: dbCheck,
      signing: signingCheck,
      checkQueue: checkQueueCheck,
      publishQueue: publishQueueCheck,
      checkLoop: checkLoopCheck,
    },
    metrics,
    reasons,
  };

  logger.debug(`Health snapshot: state=${state}, reasons=${reasons.join("; ")}`);

  return snapshot;
}
