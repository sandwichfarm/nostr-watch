/**
 * Health monitoring types for RelayMon
 *
 * Defines the health states, snapshots, and configuration for monitoring
 * the health of the RelayMon process itself (not the relays it monitors).
 */

/**
 * Health state of the RelayMon process
 * - up: Process alive, checks advancing, DB OK, signing works
 * - degraded: Functional but backlog/queue stalls/high error rate
 * - down: Fatal config/DB/signing issues or check loop stalled
 */
export type HealthState = "up" | "degraded" | "down";

/**
 * Individual health check result
 */
export interface HealthCheck {
  /** Check name (e.g., "database", "signing", "check_queue") */
  name: string;
  /** Check status */
  status: "pass" | "warn" | "fail";
  /** Human-readable message */
  message: string;
  /** Optional error details */
  error?: string;
  /** Optional timing or metric data */
  data?: Record<string, unknown>;
  /** Timestamp of check (ISO 8601) */
  timestamp: string;
}

/**
 * Complete health snapshot
 */
export interface HealthSnapshot {
  /** Overall health state */
  state: HealthState;
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Process uptime in milliseconds */
  uptime: number;
  /** Individual check results */
  checks: {
    database: HealthCheck;
    signing: HealthCheck;
    checkQueue: HealthCheck;
    publishQueue: HealthCheck;
    checkLoop: HealthCheck;
  };
  /** Summary metrics */
  metrics: {
    checkQueue: {
      pending: number;
      completed: number;
      failed: number;
      enqueued: number;
    };
    publishQueue: {
      pending: number;
      published: number;
      failed: number;
      retrying: number;
      successRate: number;
    };
    errors: {
      lastMinute: number;
      lastFiveMinutes: number;
    };
    checkLoop: {
      lastHeartbeat?: string; // ISO 8601
      timeSinceHeartbeat?: number; // milliseconds
      expiredRelaysWaiting?: number;
    };
  };
  /** Reasons for current state */
  reasons: string[];
}

/**
 * Health thresholds configuration
 */
export interface HealthThresholds {
  /** Check loop idle threshold (ms) - time without heartbeat before considering stalled */
  checkIdleMs: number;
  /** Publish queue backlog threshold - max pending events before degraded */
  publishBacklogMax: number;
  /** Error rate threshold - errors per minute before degraded */
  errorRatePerMin: number;
  /** Startup grace period (ms) - don't report Down during initial startup */
  startupGraceMs: number;
}

/**
 * Health server configuration
 */
export interface HealthServerConfig {
  /** Enable HTTP health server */
  enabled: boolean;
  /** Host to bind to (default: 127.0.0.1) */
  host: string;
  /** Port to bind to (default: 8080) */
  port: number;
  /** Enable token authentication */
  authEnabled: boolean;
}

/**
 * Uptime Kuma push configuration
 */
export interface KumaConfig {
  /** Enable Kuma push */
  enabled: boolean;
  /** Push interval in milliseconds */
  intervalMs: number;
  /** Report degraded state as "up" to Kuma (with message) */
  degradedAsUp: boolean;
  /** Startup grace period (ms) - don't push during initial startup */
  startupGraceMs: number;
  /** Message verbosity: "summary" or "detailed" */
  msgVerbosity: "summary" | "detailed";
}

/**
 * Complete health configuration
 */
export interface HealthConfig {
  /** Enable health monitoring */
  enabled: boolean;
  /** HTTP server config */
  server: HealthServerConfig;
  /** Uptime Kuma push config */
  kuma: KumaConfig;
  /** Health check thresholds */
  thresholds: HealthThresholds;
}

/**
 * Error tracking entry
 */
export interface ErrorEntry {
  timestamp: number; // milliseconds since epoch
  message: string;
  source: string; // e.g., "queue", "worker", "daemon"
}

/**
 * Heartbeat tracking
 */
export interface HeartbeatTracker {
  checkLoop?: number; // Last check loop heartbeat (ms since epoch)
  startupTime: number; // Process startup time (ms since epoch)
}
