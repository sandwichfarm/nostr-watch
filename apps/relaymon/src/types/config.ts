/**
 * Strong Type Definitions for RelayMon Configuration
 *
 * Provides compile-time type safety and runtime validation for configuration.
 */

/**
 * Network types supported by RelayMon
 */
export type NetworkType = "clearnet" | "tor" | "i2p" | "lokinet";

/**
 * Log levels
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Geographic location information
 */
export interface GeoConfig {
  city: string;
  country: string;
  countryCode: string;
  lat: number;
  lon: number;
  region: string;
  continent: string;
}

/**
 * Monitor profile information
 */
export interface MonitorInfoConfig {
  name?: string;
  about?: string;
  nip05?: string;
  lud16?: string; 
  picture?: string; 
  banner?: string;
}

/**
 * Monitor configuration
 */
export interface MonitorConfig {
  slug: string;
  info: MonitorInfoConfig;
  owner?: string;
  geo?: GeoConfig;
}

/**
 * Publisher configuration
 */
export interface PublisherConfig {
  relays: string[];
  retry?: {
    maxRetries?: number;
    initialBackoffMs?: number;
  };
}

/**
 * Retry expiry configuration
 */
export interface RetryExpiryConfig {
  max: number;
  delay: number;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  expiry: RetryExpiryConfig[];
}

/**
 * Seed database options
 */
export interface SeedDbOptions {
  path: string;
  enableWAL?: boolean;
}

/**
 * Seed options
 */
export interface SeedOptions {
  db?: SeedDbOptions;
  static?: {
    path?: string;
  };
  config?: string[];
  [key: string]: any;  // Allow other seed-specific options
}

/**
 * Seed configuration
 */
export interface SeedConfig {
  interval: number;
  sources: string[];
  options: SeedOptions;
}

/**
 * Check timeout configuration
 */
export interface CheckTimeoutConfig {
  open?: number;
  read?: number;
  write?: number;
  info?: number;
  dns?: number;
  geo?: number;
  ssl?: number;
}

/**
 * Check options configuration
 */
export interface CheckOptionsConfig {
  expires: number;
  interval: number;
  timeout: CheckTimeoutConfig;
  max: number | string;
  statusInterval: number;
  checks: string[];
}

/**
 * Checks configuration
 */
export interface ChecksConfig {
  enabled: string[];
  options: CheckOptionsConfig;
}

/**
 * Ignore list configuration
 */
export interface IgnoreListConfig {
  enabled: boolean;
  interval: string;
  deletion_interval: string;
  relays: string[];
  pubkeys: string[];
}

/**
 * Deduplication configuration
 */
export interface DeduplicationConfig {
  reevaluation_interval: string;
  nip11_cache_ttl: string;
  /**
   * Phase 20 PERF: skip live NIP-11 fetches in reevaluateAllDeduplication
   * when the relay_status row's checked_at is older than this threshold OR
   * the row is already marked ignore=1. Default "7d" (604_800_000ms). Read
   * once at daemon boot; changing it requires a restart. Consumed by
   * reevaluateAllDeduplication in hostnames.ts — see Plan 20-03.
   *
   * Conversion to ms is performed lazily at the consumer site via
   * parseInterval() (same pattern as nip11_cache_ttl); the type remains
   * `string` here even though the runtime value may be a number after
   * conversion. validateConfig applies the "7d" default when this field
   * is absent from user config.
   */
  nip11_stale_skip?: string;
}

/**
 * Period configuration for delta aggregates
 */
export interface PeriodConfig {
  enabled: boolean;
  definitions: string[];  // e.g., ["6h", "1d", "7d", "30d"]
}

/**
 * Delta events configuration (Kind 1066)
 */
export interface DeltaConfig {
  enabled: boolean;
  max_retries?: number;  // Stop publishing delta events after N offline retries
  periods?: PeriodConfig;  // Period aggregate configuration
}

/**
 * RelayMon configuration
 */
export interface RelaymonConfig {
  networks: NetworkType[];
  retry: RetryConfig;
  seed: SeedConfig;
  checks: ChecksConfig;
  ignorelist?: IgnoreListConfig;
  deduplication?: DeduplicationConfig;
  delta?: DeltaConfig;
}

/**
 * Queue configuration
 */
export interface QueueConfig {
  workerConcurrency: number | "auto";
}

/**
 * Database configuration
 */
export interface DbConfig {
  path: string;
  enableWAL?: boolean;
}

export interface AnnounceConfig {
  frequency?: number | string;
  userMetaRelays?: string[];
  nip66Relays?: string[];
}

/**
 * Health server configuration
 */
export interface HealthServerConfig {
  enabled: boolean;
  host: string;
  port: number;
  authEnabled: boolean;
}

/**
 * Uptime Kuma push configuration
 */
export interface KumaConfig {
  enabled: boolean;
  intervalMs: number | string;
  degradedAsUp: boolean;
  startupGraceMs: number | string;
  msgVerbosity: "summary" | "detailed";
}

/**
 * Health check thresholds
 */
export interface HealthThresholdsConfig {
  checkIdleMs: number | string;
  publishBacklogMax: number;
  errorRatePerMin: number;
  startupGraceMs: number | string;
}

/**
 * Health monitoring configuration
 */
export interface HealthConfig {
  enabled: boolean;
  server: HealthServerConfig;
  kuma: KumaConfig;
  thresholds: HealthThresholdsConfig;
}

/**
 * Complete RelayMon configuration
 */
export interface Config {
  monitor: MonitorConfig;
  publisher: PublisherConfig;
  relaymon: RelaymonConfig;
  announce: AnnounceConfig;
  queue?: QueueConfig;
  logLevel?: LogLevel;
  db?: DbConfig;
  health?: HealthConfig;
}

/**
 * Valid network types for validation
 */
const VALID_NETWORKS: NetworkType[] = ["clearnet", "tor", "i2p", "lokinet"];

/**
 * Validate that a value is a valid network type
 */
function isValidNetwork(network: string): network is NetworkType {
  return VALID_NETWORKS.includes(network as NetworkType);
}

/**
 * Runtime configuration validation
 *
 * Validates that a configuration object meets all requirements.
 * Throws descriptive errors for missing or invalid fields.
 *
 * @param config - Configuration object to validate
 * @returns Validated configuration
 * @throws Error if configuration is invalid
 */
export function validateConfig(config: unknown): Config {
  // Check if config exists and is an object
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    throw new Error("Config must be an object");
  }

  const c = config as any;

  // Validate monitor section
  if (!c.monitor || typeof c.monitor !== "object") {
    throw new Error("Missing required field: monitor");
  }

  if (!c.monitor.slug || typeof c.monitor.slug !== "string") {
    throw new Error("Missing required field: monitor.slug");
  }

  if (!c.monitor.info || typeof c.monitor.info !== "object") {
    throw new Error("Missing required field: monitor.info");
  }

  if (!c.monitor.info.name || typeof c.monitor.info.name !== "string") {
    throw new Error("Missing required field: monitor.info.name");
  }

  if (!c.monitor.info.about || typeof c.monitor.info.about !== "string") {
    throw new Error("Missing required field: monitor.info.about");
  }

  // if (!c.monitor.owner || typeof c.monitor.owner !== "string") {
  //   throw new Error("Missing required field: monitor.owner");
  // }

  // Validate publisher section
  if (!c.publisher || typeof c.publisher !== "object") {
    throw new Error("Missing required field: publisher");
  }

  if (!Array.isArray(c.publisher.relays)) {
    throw new Error("Missing required field: publisher.relays (must be array)");
  }

  // Validate relaymon section
  if (!c.relaymon || typeof c.relaymon !== "object") {
    throw new Error("Missing required field: relaymon");
  }

  if (!Array.isArray(c.relaymon.networks)) {
    throw new Error("Missing required field: relaymon.networks (must be array)");
  }

  if (c.relaymon.networks.length === 0) {
    throw new Error("relaymon.networks must contain at least one network");
  }

  // Validate network types
  for (const network of c.relaymon.networks) {
    if (!isValidNetwork(network)) {
      throw new Error(
        `Invalid network type: "${network}". Must be one of: ${VALID_NETWORKS.join(", ")}`
      );
    }
  }

  // Validate retry configuration exists
  if (!c.relaymon.retry || typeof c.relaymon.retry !== "object") {
    throw new Error("Missing required field: relaymon.retry");
  }

  if (!Array.isArray(c.relaymon.retry.expiry)) {
    throw new Error("Missing required field: relaymon.retry.expiry (must be array)");
  }

  // Validate seed configuration exists
  if (!c.relaymon.seed || typeof c.relaymon.seed !== "object") {
    throw new Error("Missing required field: relaymon.seed");
  }

  if (typeof c.relaymon.seed.interval !== "number") {
    throw new Error("Missing required field: relaymon.seed.interval (must be number)");
  }

  if (!Array.isArray(c.relaymon.seed.sources)) {
    throw new Error("Missing required field: relaymon.seed.sources (must be array)");
  }

  if (!c.relaymon.seed.options || typeof c.relaymon.seed.options !== "object") {
    throw new Error("Missing required field: relaymon.seed.options");
  }

  // Validate checks configuration exists
  if (!c.relaymon.checks || typeof c.relaymon.checks !== "object") {
    throw new Error("Missing required field: relaymon.checks");
  }

  if (!Array.isArray(c.relaymon.checks.enabled)) {
    throw new Error("Missing required field: relaymon.checks.enabled (must be array)");
  }

  if (!c.relaymon.checks.options || typeof c.relaymon.checks.options !== "object") {
    throw new Error("Missing required field: relaymon.checks.options");
  }

  // Phase 20: validate optional deduplication.nip11_stale_skip and apply
  // default "7d" when absent. The field is fully optional; we only fail when
  // a user-supplied value has an unsupported type. Both `string` (timestring,
  // pre-conversion) and `number` (ms, post-conversion at consumer site) are
  // acceptable so this validator survives a future move of the conversion
  // step into processConfigTimeValues without further edits.
  if (c.relaymon.deduplication !== undefined) {
    if (typeof c.relaymon.deduplication !== "object" || c.relaymon.deduplication === null) {
      throw new Error("relaymon.deduplication must be an object when present");
    }

    const dedup = c.relaymon.deduplication;
    if (dedup.nip11_stale_skip === undefined || dedup.nip11_stale_skip === null) {
      // Default applied when missing — Plan 20-03 reads this via
      // appConfig?.relaymon?.deduplication?.nip11_stale_skip
      dedup.nip11_stale_skip = "7d";
    } else if (
      typeof dedup.nip11_stale_skip !== "string" &&
      typeof dedup.nip11_stale_skip !== "number"
    ) {
      throw new Error(
        "relaymon.deduplication.nip11_stale_skip must be a timestring like '7d' or a number of ms",
      );
    }
  }

  // Validate health configuration if present (optional)
  if (c.health !== undefined) {
    if (typeof c.health !== "object") {
      throw new Error("health must be an object");
    }

    if (typeof c.health.enabled !== "boolean") {
      throw new Error("Missing required field: health.enabled (must be boolean)");
    }

    if (c.health.enabled) {
      // Validate server config
      if (!c.health.server || typeof c.health.server !== "object") {
        throw new Error("Missing required field: health.server");
      }

      if (typeof c.health.server.enabled !== "boolean") {
        throw new Error("Missing required field: health.server.enabled (must be boolean)");
      }

      if (typeof c.health.server.host !== "string") {
        throw new Error("Missing required field: health.server.host (must be string)");
      }

      if (typeof c.health.server.port !== "number") {
        throw new Error("Missing required field: health.server.port (must be number)");
      }

      if (typeof c.health.server.authEnabled !== "boolean") {
        throw new Error("Missing required field: health.server.authEnabled (must be boolean)");
      }

      // Validate kuma config
      if (!c.health.kuma || typeof c.health.kuma !== "object") {
        throw new Error("Missing required field: health.kuma");
      }

      if (typeof c.health.kuma.enabled !== "boolean") {
        throw new Error("Missing required field: health.kuma.enabled (must be boolean)");
      }

      if (typeof c.health.kuma.intervalMs !== "number" && typeof c.health.kuma.intervalMs !== "string") {
        throw new Error("Missing required field: health.kuma.intervalMs (must be number or timestring)");
      }

      if (typeof c.health.kuma.degradedAsUp !== "boolean") {
        throw new Error("Missing required field: health.kuma.degradedAsUp (must be boolean)");
      }

      if (typeof c.health.kuma.startupGraceMs !== "number" && typeof c.health.kuma.startupGraceMs !== "string") {
        throw new Error("Missing required field: health.kuma.startupGraceMs (must be number or timestring)");
      }

      if (!["summary", "detailed"].includes(c.health.kuma.msgVerbosity)) {
        throw new Error("health.kuma.msgVerbosity must be 'summary' or 'detailed'");
      }

      // Validate thresholds config
      if (!c.health.thresholds || typeof c.health.thresholds !== "object") {
        throw new Error("Missing required field: health.thresholds");
      }

      if (typeof c.health.thresholds.checkIdleMs !== "number" && typeof c.health.thresholds.checkIdleMs !== "string") {
        throw new Error("Missing required field: health.thresholds.checkIdleMs (must be number or timestring)");
      }

      if (typeof c.health.thresholds.publishBacklogMax !== "number") {
        throw new Error("Missing required field: health.thresholds.publishBacklogMax (must be number)");
      }

      if (typeof c.health.thresholds.errorRatePerMin !== "number") {
        throw new Error("Missing required field: health.thresholds.errorRatePerMin (must be number)");
      }

      if (typeof c.health.thresholds.startupGraceMs !== "number" && typeof c.health.thresholds.startupGraceMs !== "string") {
        throw new Error("Missing required field: health.thresholds.startupGraceMs (must be number or timestring)");
      }
    }
  }

  // All required validations passed, return typed config
  return c as Config;
}
