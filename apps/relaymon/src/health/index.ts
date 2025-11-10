/**
 * Health monitoring system for RelayMon
 *
 * Public API exports for the health monitoring system
 */

// Type exports
export type {
  HealthState,
  HealthSnapshot,
  HealthCheck,
  HealthThresholds,
  HealthServerConfig,
  KumaConfig,
  HealthConfig,
  HeartbeatTracker,
  ErrorEntry,
} from "./types.ts";

// Check function exports
export {
  checkDatabase,
  checkSigning,
  checkCheckQueue,
  checkPublishQueue,
  checkCheckLoop,
} from "./checks.ts";

// Snapshot builder exports
export {
  buildHealthSnapshot,
  ErrorTracker,
} from "./snapshot.ts";

// Secret loading exports
export {
  loadSecret,
  loadKumaPushUrl,
  loadHealthAuthToken,
  loadNsec,
  redactSecret,
  redactUrl,
  requireSecret,
  loadAllSecrets,
} from "./secrets.ts";

// Server exports
export {
  HealthServer,
  startHealthServer,
} from "./server.ts";
export type { HealthServerContext } from "./server.ts";

// Kuma exports
export {
  KumaPusher,
  startKumaPusher,
} from "./kuma.ts";
export type { KumaPushContext } from "./kuma.ts";
