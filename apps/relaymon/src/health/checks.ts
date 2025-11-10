/**
 * Health check functions for RelayMon
 *
 * Individual health checks for various system components:
 * - Database connectivity and performance
 * - Signing capability (nsec validation)
 * - Queue health (check and publish queues)
 * - Check loop heartbeat
 */

import { getLogger } from "../utils/logger.ts";
import { db } from "npm:@nostrwatch/db";
import { getPublicKey, finalizeEvent } from "npm:nostr-tools";
import type { HealthCheck, HealthThresholds, HeartbeatTracker } from "./types.ts";
import type { QueueManager } from "../utils/queueManager.ts";

const logger = getLogger("HealthChecks");

/**
 * Test database connectivity and performance
 *
 * @returns Health check result
 */
export async function checkDatabase(): Promise<HealthCheck> {
  const start = Date.now();

  try {
    // Simple test query
    const result = db.query("SELECT 1 as test");
    const elapsed = Date.now() - start;

    if (!result || result.length === 0) {
      return {
        name: "database",
        status: "fail",
        message: "Database query returned no results",
        timestamp: new Date().toISOString(),
      };
    }

    // Check if query was slow (>100ms is concerning)
    if (elapsed > 100) {
      return {
        name: "database",
        status: "warn",
        message: `Database query slow (${elapsed}ms)`,
        data: { queryTimeMs: elapsed },
        timestamp: new Date().toISOString(),
      };
    }

    return {
      name: "database",
      status: "pass",
      message: "Database healthy",
      data: { queryTimeMs: elapsed },
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      name: "database",
      status: "fail",
      message: "Database connection failed",
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Test signing capability with a self-test
 *
 * Creates and signs a dummy event to verify the private key works
 *
 * @param privkey - Private key (hex format)
 * @returns Health check result
 */
export async function checkSigning(privkey: string | undefined): Promise<HealthCheck> {
  if (!privkey || privkey.trim() === "") {
    return {
      name: "signing",
      status: "fail",
      message: "Private key not configured",
      error: "RELAYMON_NSEC or RELAYMON_NSEC_FILE not set",
      timestamp: new Date().toISOString(),
    };
  }

  // Validate hex format
  if (!/^[0-9a-f]{64}$/i.test(privkey)) {
    return {
      name: "signing",
      status: "fail",
      message: "Private key invalid format",
      error: "Expected 64-character hex string",
      timestamp: new Date().toISOString(),
    };
  }

  try {
    // Derive public key
    const pubkey = getPublicKey(privkey);

    // Create a dummy event (kind 0 = metadata)
    const dummyEvent = {
      kind: 1,
      created_at: Math.floor(Date.now() / 1000),
      tags: [["health-check", "self-test"]],
      content: "RelayMon health check self-test",
      pubkey,
    };

    // Sign the event using nostr-tools finalizeEvent
    const signedEvent = finalizeEvent(dummyEvent, privkey);

    // Verify the signature is present and valid format
    if (!signedEvent.sig || signedEvent.sig.length !== 128) {
      return {
        name: "signing",
        status: "fail",
        message: "Event signing produced invalid signature",
        error: "Signature missing or wrong length",
        timestamp: new Date().toISOString(),
      };
    }

    return {
      name: "signing",
      status: "pass",
      message: "Signing capability verified",
      data: {
        pubkey: pubkey.slice(0, 8) + "..." + pubkey.slice(-8),
      },
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      name: "signing",
      status: "fail",
      message: "Signing self-test failed",
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Check check queue health
 *
 * @param queueManager - Queue manager instance
 * @param thresholds - Health thresholds
 * @returns Health check result
 */
export function checkCheckQueue(
  queueManager: QueueManager,
  thresholds: HealthThresholds,
): HealthCheck {
  try {
    const checkQueue = queueManager.checkQueue;

    if (!checkQueue) {
      return {
        name: "checkQueue",
        status: "fail",
        message: "Check queue not initialized",
        timestamp: new Date().toISOString(),
      };
    }

    const pending = checkQueue.pending;
    const size = checkQueue.size;

    // Queue is healthy - we don't care about backlog for check queue,
    // only that it's functioning
    return {
      name: "checkQueue",
      status: "pass",
      message: "Check queue operational",
      data: {
        pending,
        size,
        concurrency: checkQueue.concurrency,
      },
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      name: "checkQueue",
      status: "fail",
      message: "Check queue error",
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Check publish queue health
 *
 * Monitors backlog and success rate
 *
 * @param queueManager - Queue manager instance
 * @param thresholds - Health thresholds
 * @returns Health check result
 */
export function checkPublishQueue(
  queueManager: QueueManager,
  thresholds: HealthThresholds,
): HealthCheck {
  try {
    const publishQueue = queueManager.publishQueue;

    if (!publishQueue) {
      return {
        name: "publishQueue",
        status: "fail",
        message: "Publish queue not initialized",
        timestamp: new Date().toISOString(),
      };
    }

    const stats = queueManager.getPublishingStats();
    const pending = publishQueue.pending;

    // Check for excessive backlog (degraded state)
    if (pending > thresholds.publishBacklogMax) {
      return {
        name: "publishQueue",
        status: "warn",
        message: `Publish backlog high (${pending} > ${thresholds.publishBacklogMax})`,
        data: {
          pending,
          published: stats.published,
          failed: stats.failed,
          successRate: stats.successRate,
        },
        timestamp: new Date().toISOString(),
      };
    }

    // Check success rate (if we have enough data)
    const totalAttempts = stats.published + stats.failed;
    if (totalAttempts >= 10 && stats.successRate < 0.5) {
      return {
        name: "publishQueue",
        status: "warn",
        message: `Low publish success rate (${(stats.successRate * 100).toFixed(1)}%)`,
        data: {
          pending,
          published: stats.published,
          failed: stats.failed,
          successRate: stats.successRate,
        },
        timestamp: new Date().toISOString(),
      };
    }

    return {
      name: "publishQueue",
      status: "pass",
      message: "Publish queue healthy",
      data: {
        pending,
        published: stats.published,
        failed: stats.failed,
        retrying: stats.retrying,
        successRate: stats.successRate,
      },
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      name: "publishQueue",
      status: "fail",
      message: "Publish queue error",
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Check check loop heartbeat
 *
 * Verifies that the check loop is still advancing (enqueuing work)
 * and not stalled while expired relays are waiting
 *
 * @param heartbeat - Heartbeat tracker
 * @param thresholds - Health thresholds
 * @param expiredRelaysCount - Number of expired relays waiting (optional)
 * @returns Health check result
 */
export function checkCheckLoop(
  heartbeat: HeartbeatTracker,
  thresholds: HealthThresholds,
  expiredRelaysCount?: number,
): HealthCheck {
  const now = Date.now();

  // Check if we're still in startup grace period
  const uptime = now - heartbeat.startupTime;
  if (uptime < thresholds.startupGraceMs) {
    return {
      name: "checkLoop",
      status: "pass",
      message: "Check loop starting (grace period)",
      data: {
        uptimeMs: uptime,
        gracePeriodMs: thresholds.startupGraceMs,
      },
      timestamp: new Date().toISOString(),
    };
  }

  // If we've never seen a heartbeat after grace period
  if (!heartbeat.checkLoop) {
    // Only fail if there is work waiting; otherwise it's fine to be idle
    if (expiredRelaysCount && expiredRelaysCount > 0) {
      return {
        name: "checkLoop",
        status: "fail",
        message: `Check loop never started with ${expiredRelaysCount} expired relays waiting`,
        data: {
          uptimeMs: uptime,
          expiredRelaysWaiting: expiredRelaysCount,
        },
        timestamp: new Date().toISOString(),
      };
    }

    return {
      name: "checkLoop",
      status: "pass",
      message: "Check loop idle; no expired relays waiting",
      data: {
        uptimeMs: uptime,
        expiredRelaysWaiting: 0,
      },
      timestamp: new Date().toISOString(),
    };
  }

  const timeSinceHeartbeat = now - heartbeat.checkLoop;

  // Check if loop is stalled
  if (timeSinceHeartbeat > thresholds.checkIdleMs) {
    // If there are expired relays waiting and loop is stalled, that's critical
    if (expiredRelaysCount && expiredRelaysCount > 0) {
      return {
        name: "checkLoop",
        status: "fail",
        message: `Check loop stalled with ${expiredRelaysCount} expired relays waiting`,
        data: {
          timeSinceHeartbeatMs: timeSinceHeartbeat,
          thresholdMs: thresholds.checkIdleMs,
          expiredRelaysWaiting: expiredRelaysCount,
        },
        timestamp: new Date().toISOString(),
      };
    }

    // Stalled but no work waiting - degraded
    return {
      name: "checkLoop",
      status: "warn",
      message: `Check loop idle for ${(timeSinceHeartbeat / 1000).toFixed(0)}s`,
      data: {
        timeSinceHeartbeatMs: timeSinceHeartbeat,
        thresholdMs: thresholds.checkIdleMs,
      },
      timestamp: new Date().toISOString(),
    };
  }

  // Healthy
  return {
    name: "checkLoop",
    status: "pass",
    message: "Check loop active",
    data: {
      lastHeartbeat: new Date(heartbeat.checkLoop).toISOString(),
      timeSinceHeartbeatMs: timeSinceHeartbeat,
      expiredRelaysWaiting: expiredRelaysCount || 0,
    },
    timestamp: new Date().toISOString(),
  };
}
