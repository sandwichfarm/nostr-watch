/**
 * Shared types for the relaymon config UI.
 * These are standalone copies of types from apps/relaymon/src/ —
 * do NOT import from relaymon source (this is a browser bundle).
 */

// ---- Health types (from apps/relaymon/src/health/types.ts) ----

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
  name: string;
  status: "pass" | "warn" | "fail";
  message: string;
  error?: string;
  data?: Record<string, unknown>;
  timestamp: string;
}

/**
 * Complete health snapshot
 */
export interface HealthSnapshot {
  state: HealthState;
  timestamp: string;
  uptime: number;
  checks: {
    database: HealthCheck;
    signing: HealthCheck;
    checkQueue: HealthCheck;
    publishQueue: HealthCheck;
    checkLoop: HealthCheck;
  };
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
      lastHeartbeat?: string;
      timeSinceHeartbeat?: number;
      expiredRelaysWaiting?: number;
    };
  };
  reasons: string[];
}

// ---- Config types (from apps/relaymon/src/types/config.ts) ----

export type NetworkType = "clearnet" | "tor" | "i2p" | "lokinet";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface GeoConfig {
  city: string;
  country: string;
  countryCode: string;
  lat: number;
  lon: number;
  region: string;
  continent: string;
}

export interface MonitorInfoConfig {
  name?: string;
  about?: string;
  nip05?: string;
  lud16?: string;
  picture?: string;
  banner?: string;
}

export interface MonitorConfig {
  slug: string;
  info: MonitorInfoConfig;
  owner?: string;
  geo?: GeoConfig;
}

export interface PublisherConfig {
  relays: string[];
  retry?: {
    maxRetries?: number;
    initialBackoffMs?: number;
  };
}

export interface RetryExpiryConfig {
  max: number;
  delay: number;
}

export interface RetryConfig {
  expiry: RetryExpiryConfig[];
}

export interface SeedDbOptions {
  path: string;
  enableWAL?: boolean;
}

export interface SeedOptions {
  db?: SeedDbOptions;
  static?: {
    path?: string;
  };
  config?: string[];
  [key: string]: unknown;
}

export interface SeedConfig {
  interval: number;
  sources: string[];
  options: SeedOptions;
}

export interface CheckTimeoutConfig {
  open?: number;
  read?: number;
  write?: number;
  info?: number;
  dns?: number;
  geo?: number;
  ssl?: number;
}

export interface CheckOptionsConfig {
  expires: number;
  interval: number;
  timeout: CheckTimeoutConfig;
  max: number | string;
  statusInterval: number;
  checks: string[];
}

export interface ChecksConfig {
  enabled: string[];
  options: CheckOptionsConfig;
}

export interface IgnoreListConfig {
  enabled: boolean;
  interval: string;
  deletion_interval: string;
  relays: string[];
  pubkeys: string[];
}

export interface DeduplicationConfig {
  reevaluation_interval: string;
  nip11_cache_ttl: string;
}

export interface PeriodConfig {
  enabled: boolean;
  definitions: string[];
}

export interface DeltaConfig {
  enabled: boolean;
  max_retries?: number;
  periods?: PeriodConfig;
}

export interface RelaymonConfig {
  networks: NetworkType[];
  retry: RetryConfig;
  seed: SeedConfig;
  checks: ChecksConfig;
  ignorelist?: IgnoreListConfig;
  deduplication?: DeduplicationConfig;
  delta?: DeltaConfig;
}

export interface QueueConfig {
  workerConcurrency: number | "auto";
}

export interface DbConfig {
  path: string;
  enableWAL?: boolean;
}

export interface AnnounceConfig {
  frequency?: number | string;
  userMetaRelays?: string[];
  nip66Relays?: string[];
}

export interface HealthServerConfig {
  enabled: boolean;
  host: string;
  port: number;
  authEnabled: boolean;
}

export interface KumaConfig {
  enabled: boolean;
  intervalMs: number | string;
  degradedAsUp: boolean;
  startupGraceMs: number | string;
  msgVerbosity: "summary" | "detailed";
}

export interface HealthThresholdsConfig {
  checkIdleMs: number | string;
  publishBacklogMax: number;
  errorRatePerMin: number;
  startupGraceMs: number | string;
}

export interface HealthConfig {
  enabled: boolean;
  server: HealthServerConfig;
  kuma: KumaConfig;
  thresholds: HealthThresholdsConfig;
}

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

// ---- UI-specific types ----

export type ConfigMode = 'simple' | 'advanced' | 'raw';
export type SeedingMode = 'my-relays' | 'relay-lists' | 'network-scale';

/** Healthz response (minimal health check) */
export interface HealthzResponse {
  status: HealthState;
  timestamp: string;
  uptime: number;
  reasons: string[];
}
