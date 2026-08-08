import { db, initDB } from "npm:@nostrwatch/db";
import { getLogger } from "../utils/logger.ts";
import type { RelayInfo } from "../types/relay.ts";
import { createInfoHash } from "../utils/hostnames.ts";
import {
  enqueueRemediationDeletion,
  rerunDedupAllUnignoredMigration,
  rerunDedupForAllRowsMigration,
  rerunNostringsSweepMigration,
} from "../utils/remediation.ts";
import { purgeNatoPhoneticSpam } from "../../../../libraries/db/src/nato-purge.ts";

const logger = getLogger("DB");
let isInitialized = false;

function ensureTrustedRelayAssertionTable(): void {
  db.query(`
    CREATE TABLE IF NOT EXISTS relay_trust_assertion_state (
      url TEXT PRIMARY KEY,
      first_seen INTEGER NOT NULL,
      last_observed INTEGER NOT NULL,
      observations INTEGER NOT NULL DEFAULT 0,
      reachable_observations INTEGER NOT NULL DEFAULT 0,
      total_rtt_open INTEGER NOT NULL DEFAULT 0,
      rtt_open_samples INTEGER NOT NULL DEFAULT 0,
      total_rtt_read INTEGER NOT NULL DEFAULT 0,
      rtt_read_samples INTEGER NOT NULL DEFAULT 0,
      last_online_at INTEGER,
      last_status TEXT,
      last_score INTEGER,
      last_reliability INTEGER,
      last_quality INTEGER,
      last_accessibility INTEGER,
      last_confidence TEXT,
      last_event_id TEXT,
      last_published_at INTEGER
    )
  `);
}

function ensureTrustedRelayObservationHistoryTable(): void {
  db.query(`
    CREATE TABLE IF NOT EXISTS relay_trust_observations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL,
      observed_at INTEGER NOT NULL,
      online INTEGER NOT NULL,
      rtt_open INTEGER,
      rtt_read INTEGER,
      rtt_write INTEGER,
      network TEXT,
      nip11_present INTEGER NOT NULL DEFAULT 0,
      operator_pubkey TEXT,
      ssl_valid INTEGER,
      dns_address TEXT,
      dns_as TEXT,
      dns_asn TEXT,
      country_code TEXT,
      region TEXT,
      is_hosting INTEGER
    )
  `);
  db.query(`
    CREATE INDEX IF NOT EXISTS relay_trust_observations_url_observed_idx
    ON relay_trust_observations (url, observed_at)
  `);
  db.query(`
    CREATE INDEX IF NOT EXISTS relay_trust_observations_observed_idx
    ON relay_trust_observations (observed_at)
  `);
}

/**
 * Initialize the database with a specific path
 * @param dbPath Optional path to the SQLite database file
 * @param enableWAL Optional boolean to enable WAL mode (default: true)
 */
export async function initializeDB(
  dbPath?: string,
  enableWAL: boolean = true,
): Promise<void> {
  if (isInitialized) {
    logger.warn(
      "Database already initialized, ignoring repeated initialization",
    );
    return;
  }

  const path = dbPath || "relaymon.db";
  logger.info(
    `Initializing database with path: ${path}, WAL mode: ${
      enableWAL ? "enabled" : "disabled"
    }`,
  );
  initDB(path, enableWAL);

  // Create the relay_info table if it doesn't exist
  try {
    db.query(`
      CREATE TABLE IF NOT EXISTS relay_info (
        url TEXT PRIMARY KEY,
        info_json TEXT,
        info_hash TEXT,
        last_updated INTEGER
      )
    `);
    logger.info("Created relay_info table if it didn't exist");
  } catch (e) {
    logger.error(`Failed to create relay_info table: ${e}`);
  }

  // Phase 18 Fix 2: schema migration tracking for one-shot migrations
  try {
    db.query(`
      CREATE TABLE IF NOT EXISTS relaymon_migrations (
        name TEXT PRIMARY KEY,
        applied_at INTEGER
      )
    `);
  } catch (e) {
    logger.error(`Failed to create relaymon_migrations table: ${e}`);
  }

  // Remediation deletion queue: rows written by remediation migrations
  // that need kind:5 deletion events published once the daemon has
  // config, keys, and a live nostr-tools SimplePool. Drained by the
  // daemon after startup wiring — see drainRemediationDeletionQueue in
  // remediation.ts. Rows are removed on successful OK.
  try {
    db.query(`
      CREATE TABLE IF NOT EXISTS remediation_deletion_queue (
        url TEXT PRIMARY KEY,
        reason TEXT NOT NULL,
        queued_at INTEGER NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        last_error TEXT
      )
    `);
  } catch (e) {
    logger.error(`Failed to create remediation_deletion_queue table: ${e}`);
  }

  // Create the relay_delta_state table for tracking state changes
  try {
    db.query(`
      CREATE TABLE IF NOT EXISTS relay_delta_state (
        url TEXT PRIMARY KEY,
        state_json TEXT,
        rtt_open INTEGER,
        rtt_read INTEGER,
        rtt_write INTEGER,
        dns_json TEXT,
        geo_json TEXT,
        last_updated INTEGER
      )
    `);
    logger.info("Created relay_delta_state table if it didn't exist");

    // Migrate existing tables to add dns_json and geo_json columns if they don't exist
    try {
      db.query(`ALTER TABLE relay_delta_state ADD COLUMN dns_json TEXT`);
      logger.info("Added dns_json column to relay_delta_state");
    } catch (e) {
      // Column already exists, ignore
    }
    try {
      db.query(`ALTER TABLE relay_delta_state ADD COLUMN geo_json TEXT`);
      logger.info("Added geo_json column to relay_delta_state");
    } catch (e) {
      // Column already exists, ignore
    }
  } catch (e) {
    logger.error(`Failed to create relay_delta_state table: ${e}`);
  }

  // Create the relay_period_snapshots table for period aggregates
  try {
    db.query(`
      CREATE TABLE IF NOT EXISTS relay_period_snapshots (
        url TEXT NOT NULL,
        period TEXT NOT NULL,
        state_json TEXT,
        snapshot_at INTEGER,
        PRIMARY KEY (url, period)
      )
    `);
    logger.info("Created relay_period_snapshots table if it didn't exist");
  } catch (e) {
    logger.error(`Failed to create relay_period_snapshots table: ${e}`);
  }

  // Trusted Relay Assertions (kind 30385) need local publication state so
  // RelayMon can publish material changes instead of re-announcing every check.
  // Detailed per-check TRA history is created only by opt-in TRA publishing.
  try {
    ensureTrustedRelayAssertionTable();
    logger.info("Created relay_trust_assertion_state table if it didn't exist");
  } catch (e) {
    logger.error(`Failed to create relay_trust_assertion_state table: ${e}`);
  }

  // Phase 18 Fix 2: re-hash existing relay_info rows using the new
  // normalizeNip11-aware createInfoHash. Idempotent via relaymon_migrations
  // sentinel.
  try {
    rehashRelayInfoMigration();
  } catch (e) {
    logger.error(`rehashRelayInfoMigration threw: ${e}`);
  }

  // Re-dedup every unignored row (online + offline) so the existing mislabelled
  // backlog self-heals at boot. MUST run after rehashRelayInfoMigration (stable
  // hashes) and before IgnoreListSync is constructed. Newly-ignored rows are
  // queued for kind:5 deletion and drained by the daemon after wiring.
  try {
    await rerunDedupAllUnignoredMigration();
  } catch (e) {
    logger.error(`rerunDedupAllUnignoredMigration threw: ${e}`);
  }

  // rerunDedupForAllRowsMigration (online-only scope) is a subset of the above
  // and no longer run at boot; kept importable for its targeted tests.
  void rerunDedupForAllRowsMigration;

  // Nostrings sweep: re-run @nostrwatch/nostrings qualification over
  // every row in relay_status, hard-deleting unparseable garbage and
  // soft-ignoring parseable-but-disqualified URLs. Sentinel-gated per
  // nostrings VERSION so each library bump re-triggers the sweep
  // exactly once per DB. MUST run AFTER rerunDedupForAllRowsMigration
  // because dedup walks every row and should not have rows added
  // underneath it — the sweep only removes/ignores, so appending here
  // is safe. Spec: docs/superpowers/specs/2026-04-11-nostrings-sweep-migration-design.md
  try {
    await rerunNostringsSweepMigration();
  } catch (e) {
    logger.error(`rerunNostringsSweepMigration threw: ${e}`);
  }

  // Phase 22: Purge NATO phonetic spam URLs from relay_status.
  // Idempotent via relaymon_migrations sentinel. Writes deleted URLs
  // to disk for downstream NIP-09 processing (Phase 23).
  try {
    await purgeNatoPhoneticSpam("nato-purged-urls.txt");
  } catch (e) {
    logger.error(`purgeNatoPhoneticSpam threw: ${e}`);
  }

  // Phase 23: Enqueue NATO-purged URLs into remediation_deletion_queue
  // so the daemon's drainRemediationDeletionQueue() publishes kind:5
  // delete events for them during startup. Non-fatal: if the file does
  // not exist or is empty, we log and continue.
  try {
    await enqueueNatoPurgedUrls("nato-purged-urls.txt");
  } catch (e) {
    logger.error(`enqueueNatoPurgedUrls threw: ${e}`);
  }

  isInitialized = true;
}

/**
 * Phase 23: Read NATO-purged URLs from the file written by
 * purgeNatoPhoneticSpam and enqueue each one into the
 * remediation_deletion_queue for NIP-09 kind:5 broadcast. The daemon's
 * existing drainRemediationDeletionQueue() publishes them after startup
 * wiring completes.
 *
 * Non-fatal: if the file does not exist or is empty, logs a debug
 * message and returns. Idempotent: enqueueRemediationDeletion uses
 * ON CONFLICT(url) DO UPDATE, so repeat calls just refresh the reason.
 *
 * @param purgedUrlsPath Path to the file containing purged URLs (one per line)
 */
export async function enqueueNatoPurgedUrls(
  purgedUrlsPath: string,
): Promise<void> {
  try {
    let fileContent: string;
    try {
      fileContent = await Deno.readTextFile(purgedUrlsPath);
    } catch (e) {
      // File does not exist — no URLs were purged (or purge hasn't run yet)
      logger.debug(
        `NATO purged URLs file not found at ${purgedUrlsPath}, nothing to enqueue: ${e}`,
      );
      return;
    }

    const urls = fileContent.split("\n").filter((line: string) =>
      line.trim().length > 0
    );

    if (urls.length === 0) {
      logger.debug("NATO purged URLs file is empty, nothing to enqueue");
      return;
    }

    for (const url of urls) {
      enqueueRemediationDeletion(url, "NATO phonetic spam purge (Phase 23)");
    }

    logger.info(`Enqueued ${urls.length} NATO-purged URLs for kind:5 deletion`);
  } catch (e) {
    logger.error(`enqueueNatoPurgedUrls failed: ${e}`);
  }
}

/**
 * Store relay NIP-11 info
 * @param url The relay URL
 * @param info The NIP-11 info object
 * @param infoHash Hash of the NIP-11 info for comparison
 */
export function storeRelayInfo(
  url: string,
  info: RelayInfo,
  infoHash: string,
): void {
  try {
    const infoJson = JSON.stringify(info);
    const timestamp = Math.floor(Date.now() / 1000);

    // Use REPLACE to update or insert
    db.query(
      `
      REPLACE INTO relay_info (url, info_json, info_hash, last_updated)
      VALUES (?, ?, ?, ?)
    `,
      [url, infoJson, infoHash, timestamp],
    );

    logger.debug(`Stored NIP-11 info for ${url} with hash ${infoHash}`);
  } catch (e) {
    logger.error(`Failed to store relay info for ${url}: ${e}`);
  }
}

/**
 * Phase 18 Fix 2: re-hash every row in relay_info using the new
 * normalizeNip11 → createInfoHash pipeline.
 *
 * Idempotent: the sentinel row in relaymon_migrations ensures this runs
 * exactly once per database lifetime. Also, re-running on an already-
 * migrated DB produces identical hashes (the pipeline is deterministic).
 *
 * Resilient: malformed info_json rows are logged and skipped.
 */
export function rehashRelayInfoMigration(): void {
  const migrationName = "phase18_rehash_relay_info_normalizeNip11_v1";
  try {
    const existing = db.query(
      `SELECT applied_at FROM relaymon_migrations WHERE name = ?`,
      [migrationName],
    );
    if (existing.length > 0) {
      logger.debug(`Migration ${migrationName} already applied, skipping`);
      return;
    }

    logger.info(`Running migration: ${migrationName}`);
    const rows = db.query(`SELECT url, info_json FROM relay_info`);
    let updated = 0;
    let skipped = 0;
    for (const [url, infoJson] of rows) {
      try {
        if (!infoJson || typeof infoJson !== "string") {
          skipped++;
          continue;
        }
        const info = JSON.parse(infoJson);
        const newHash = createInfoHash(info);
        if (!newHash) {
          skipped++;
          continue;
        }
        db.query(
          `UPDATE relay_info SET info_hash = ? WHERE url = ?`,
          [newHash, url as string],
        );
        updated++;
      } catch (e) {
        logger.warn(`Failed to rehash relay_info row for ${url}: ${e}`);
        skipped++;
      }
    }

    db.query(
      `INSERT INTO relaymon_migrations (name, applied_at) VALUES (?, ?)`,
      [migrationName, Math.floor(Date.now() / 1000)],
    );
    logger.info(
      `Migration ${migrationName} complete: ${updated} rows re-hashed, ${skipped} skipped`,
    );
  } catch (e) {
    logger.error(`Migration ${migrationName} failed: ${e}`);
  }
}

/**
 * Get the stored NIP-11 info for a relay
 * @param url The relay URL
 * @returns Object with info and infoHash, or null if not found
 */
export function getRelayInfo(
  url: string,
): { info: RelayInfo; infoHash: string } | null {
  try {
    const result = db.query(
      `
      SELECT info_json, info_hash FROM relay_info
      WHERE url = ?
    `,
      [url],
    );

    if (!result || result.length === 0) {
      return null;
    }

    const [infoJson, infoHash] = result[0];

    let info = null;
    try {
      if (infoJson && typeof infoJson === "string") {
        info = JSON.parse(infoJson);
      }
    } catch (e) {
      logger.warn(`Failed to parse info JSON for relay ${url}: ${e}`);
      return null;
    }

    return {
      info,
      infoHash: infoHash as string,
    };
  } catch (e) {
    logger.error(`Error getting relay info from DB for ${url}: ${e}`);
    return null;
  }
}

/**
 * Get all relays with the same NIP-11 info hash
 * @param infoHash The NIP-11 info hash to search for
 * @returns Array of relay URLs that have the same NIP-11 info
 */
export function getRelaysWithSameInfo(infoHash: string): string[] {
  try {
    const results = db.query(
      `
      SELECT url FROM relay_info
      WHERE info_hash = ?
    `,
      [infoHash],
    );

    if (!results || results.length === 0) {
      return [];
    }

    return results.map((row) => row[0] as string);
  } catch (e) {
    logger.error(`Error getting relays with info hash ${infoHash}: ${e}`);
    return [];
  }
}

/**
 * Check if a relay is marked as ignored in the database
 * @param url The relay URL to check
 * @returns true if the relay is ignored, false otherwise
 */
export function isRelayIgnored(url: string): boolean {
  try {
    const result = db.query(`SELECT ignore FROM relay_status WHERE url = ?`, [
      url,
    ]);
    if (!result || result.length === 0) {
      return false; // Relay not found in database
    }
    return (result[0][0] as number) === 1;
  } catch (e) {
    logger.error(`Error checking if relay ${url} is ignored: ${e}`);
    return false;
  }
}

/**
 * Delta State Management Functions
 */

export interface DeltaState {
  state: RelayInfo;
  rttOpen?: number;
  rttRead?: number;
  rttWrite?: number;
  dns?: import("../types/relay.ts").DnsResult;
  geo?: import("../types/relay.ts").GeoResult;
}

/**
 * Get the last delta state for a relay
 * @param url The relay URL
 * @returns The last delta state or null if not found
 */
export function getLastDeltaState(url: string): DeltaState | null {
  try {
    const result = db.query(
      `
      SELECT state_json, rtt_open, rtt_read, rtt_write, dns_json, geo_json
      FROM relay_delta_state
      WHERE url = ?
    `,
      [url],
    );

    if (!result || result.length === 0) {
      return null;
    }

    const [stateJson, rttOpen, rttRead, rttWrite, dnsJson, geoJson] = result[0];

    let state = null;
    try {
      if (stateJson && typeof stateJson === "string") {
        state = JSON.parse(stateJson);
      }
    } catch (e) {
      logger.warn(`Failed to parse delta state JSON for relay ${url}: ${e}`);
      return null;
    }

    let dns = undefined;
    try {
      if (dnsJson && typeof dnsJson === "string") {
        dns = JSON.parse(dnsJson);
      }
    } catch (e) {
      logger.warn(`Failed to parse DNS JSON for relay ${url}: ${e}`);
    }

    let geo = undefined;
    try {
      if (geoJson && typeof geoJson === "string") {
        geo = JSON.parse(geoJson);
      }
    } catch (e) {
      logger.warn(`Failed to parse geo JSON for relay ${url}: ${e}`);
    }

    return {
      state,
      rttOpen: rttOpen !== null && rttOpen !== -1
        ? rttOpen as number
        : undefined,
      rttRead: rttRead !== null && rttRead !== -1
        ? rttRead as number
        : undefined,
      rttWrite: rttWrite !== null && rttWrite !== -1
        ? rttWrite as number
        : undefined,
      dns,
      geo,
    };
  } catch (e) {
    logger.error(`Error getting delta state for ${url}: ${e}`);
    return null;
  }
}

/**
 * Store the current delta state for a relay
 * @param url The relay URL
 * @param deltaState The state to store
 */
export function storeDeltaState(url: string, deltaState: DeltaState): void {
  try {
    const stateJson = JSON.stringify(deltaState.state);
    const timestamp = Math.floor(Date.now() / 1000);
    const rttOpen = deltaState.rttOpen ?? -1;
    const rttRead = deltaState.rttRead ?? -1;
    const rttWrite = deltaState.rttWrite ?? -1;
    const dnsJson = deltaState.dns ? JSON.stringify(deltaState.dns) : null;
    const geoJson = deltaState.geo ? JSON.stringify(deltaState.geo) : null;

    db.query(
      `
      REPLACE INTO relay_delta_state (url, state_json, rtt_open, rtt_read, rtt_write, dns_json, geo_json, last_updated)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [url, stateJson, rttOpen, rttRead, rttWrite, dnsJson, geoJson, timestamp],
    );

    logger.debug(`Stored delta state for ${url}`);
  } catch (e) {
    logger.error(`Failed to store delta state for ${url}: ${e}`);
  }
}

/**
 * Clear the delta state for a relay (used when relay is deleted)
 * @param url The relay URL
 */
export function clearDeltaState(url: string): void {
  try {
    db.query(`DELETE FROM relay_delta_state WHERE url = ?`, [url]);
    logger.debug(`Cleared delta state for ${url}`);
  } catch (e) {
    logger.error(`Failed to clear delta state for ${url}: ${e}`);
  }
}

/**
 * Period Snapshot Management Functions
 */

export interface PeriodSnapshot {
  state: RelayInfo;
  snapshotAt: number;
}

/**
 * Get the period snapshot for a relay
 * @param url The relay URL
 * @param period The period (e.g., "6h", "1d", "7d")
 * @returns The period snapshot or null if not found
 */
export function getPeriodSnapshot(
  url: string,
  period: string,
): PeriodSnapshot | null {
  try {
    const result = db.query(
      `
      SELECT state_json, snapshot_at
      FROM relay_period_snapshots
      WHERE url = ? AND period = ?
    `,
      [url, period],
    );

    if (!result || result.length === 0) {
      return null;
    }

    const [stateJson, snapshotAt] = result[0];

    let state = null;
    try {
      if (stateJson && typeof stateJson === "string") {
        state = JSON.parse(stateJson);
      }
    } catch (e) {
      logger.warn(
        `Failed to parse period snapshot JSON for relay ${url}, period ${period}: ${e}`,
      );
      return null;
    }

    return {
      state,
      snapshotAt: snapshotAt as number,
    };
  } catch (e) {
    logger.error(
      `Error getting period snapshot for ${url}, period ${period}: ${e}`,
    );
    return null;
  }
}

/**
 * Store a period snapshot for a relay
 * @param url The relay URL
 * @param period The period (e.g., "6h", "1d", "7d")
 * @param state The relay state to snapshot
 */
export function storePeriodSnapshot(
  url: string,
  period: string,
  state: RelayInfo,
): void {
  try {
    const stateJson = JSON.stringify(state);
    const timestamp = Math.floor(Date.now() / 1000);

    db.query(
      `
      REPLACE INTO relay_period_snapshots (url, period, state_json, snapshot_at)
      VALUES (?, ?, ?, ?)
    `,
      [url, period, stateJson, timestamp],
    );

    logger.debug(`Stored period snapshot for ${url}, period ${period}`);
  } catch (e) {
    logger.error(
      `Failed to store period snapshot for ${url}, period ${period}: ${e}`,
    );
  }
}

/**
 * Clear all period snapshots for a relay (used when relay is deleted)
 * @param url The relay URL
 */
export function clearPeriodSnapshots(url: string): void {
  try {
    db.query(`DELETE FROM relay_period_snapshots WHERE url = ?`, [url]);
    logger.debug(`Cleared period snapshots for ${url}`);
  } catch (e) {
    logger.error(`Failed to clear period snapshots for ${url}: ${e}`);
  }
}

/**
 * Get all period snapshots for a relay
 * @param url The relay URL
 * @returns Map of period to snapshot
 */
export function getAllPeriodSnapshots(
  url: string,
): Map<string, PeriodSnapshot> {
  const snapshots = new Map<string, PeriodSnapshot>();

  try {
    const results = db.query(
      `
      SELECT period, state_json, snapshot_at
      FROM relay_period_snapshots
      WHERE url = ?
    `,
      [url],
    );

    for (const [period, stateJson, snapshotAt] of results) {
      try {
        const state = JSON.parse(stateJson as string);
        snapshots.set(period as string, {
          state,
          snapshotAt: snapshotAt as number,
        });
      } catch (e) {
        logger.warn(
          `Failed to parse snapshot for ${url}, period ${period}: ${e}`,
        );
      }
    }
  } catch (e) {
    logger.error(`Error getting all period snapshots for ${url}: ${e}`);
  }

  return snapshots;
}

export interface TrustedRelayObservationState {
  url: string;
  firstSeen: number;
  lastObserved: number;
  observations: number;
  reachableObservations: number;
  totalRttOpen: number;
  rttOpenSamples: number;
  totalRttRead: number;
  rttReadSamples: number;
  lastOnlineAt?: number;
  history?: TrustedRelayObservationSample[];
}

export interface TrustedRelayObservationSample {
  url: string;
  observedAt: number;
  online: boolean;
  rttOpen?: number;
  rttRead?: number;
  rttWrite?: number;
  network?: string;
  nip11Present: boolean;
  operatorPubkey?: string;
  sslValid?: boolean;
  dnsAddress?: string;
  dnsAs?: string;
  dnsAsn?: string;
  countryCode?: string;
  region?: string;
  isHosting?: boolean;
}

export interface TrustedRelayObservationOptions {
  recordHistory?: boolean;
  historyRetentionMs?: number | string;
  maxObservationsPerRelay?: number;
  observedAt?: number;
}

export interface PublishedTrustedRelayAssertionState {
  status?: string;
  score?: number;
  reliability?: number;
  quality?: number;
  accessibility?: number;
  confidence?: string;
  eventId?: string;
  publishedAt?: number;
}

function observationRowToState(
  row: unknown[],
  url: string,
): TrustedRelayObservationState {
  const [
    firstSeen,
    lastObserved,
    observations,
    reachableObservations,
    totalRttOpen,
    rttOpenSamples,
    totalRttRead,
    rttReadSamples,
    lastOnlineAt,
  ] = row;

  return {
    url,
    firstSeen: firstSeen as number,
    lastObserved: lastObserved as number,
    observations: observations as number,
    reachableObservations: reachableObservations as number,
    totalRttOpen: totalRttOpen as number,
    rttOpenSamples: rttOpenSamples as number,
    totalRttRead: totalRttRead as number,
    rttReadSamples: rttReadSamples as number,
    lastOnlineAt: lastOnlineAt === null ? undefined : lastOnlineAt as number,
  };
}

function firstGeoData(result: {
  geo?: { data?: unknown };
}): Record<string, unknown> | undefined {
  const geo = result.geo?.data;
  if (Array.isArray(geo)) {
    return geo[0] && typeof geo[0] === "object"
      ? geo[0] as Record<string, unknown>
      : undefined;
  }
  return geo && typeof geo === "object"
    ? geo as Record<string, unknown>
    : undefined;
}

function inferRelayHosting(result: {
  geo?: { data?: unknown };
}): boolean | undefined {
  const geo = firstGeoData(result);
  const haystack = `${geo?.isp ?? ""} ${geo?.as ?? ""}`.toLowerCase();
  if (!haystack.trim()) return undefined;

  return [
    "hosting",
    "cloud",
    "datacenter",
    "data center",
    "hetzner",
    "ovh",
    "digitalocean",
    "amazon",
    "google",
    "microsoft",
    "linode",
    "vultr",
  ].some((needle) => haystack.includes(needle));
}

function normalizePositiveDuration(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.round(value)
    : null;
}

function normalizeRetentionSeconds(
  retentionMs: number | string | undefined,
): number | undefined {
  if (retentionMs === undefined) return undefined;
  let ms: number | undefined;
  if (typeof retentionMs === "number") {
    ms = retentionMs;
  } else {
    const match = retentionMs.trim().match(/^(\d+(?:\.\d+)?)(ms|s|m|h|d)$/);
    if (match) {
      const value = parseFloat(match[1]);
      const unit = match[2];
      const multipliers: Record<string, number> = {
        ms: 1,
        s: 1000,
        m: 60 * 1000,
        h: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000,
      };
      ms = value * multipliers[unit];
    }
  }
  if (ms === undefined || !Number.isFinite(ms) || ms <= 0) return undefined;
  return Math.floor(ms / 1000);
}

function observationSampleFromRow(
  row: unknown[],
): TrustedRelayObservationSample {
  const [
    url,
    observedAt,
    online,
    rttOpen,
    rttRead,
    rttWrite,
    network,
    nip11Present,
    operatorPubkey,
    sslValid,
    dnsAddress,
    dnsAs,
    dnsAsn,
    countryCode,
    region,
    isHosting,
  ] = row;

  return {
    url: url as string,
    observedAt: observedAt as number,
    online: (online as number) === 1,
    rttOpen: rttOpen === null ? undefined : rttOpen as number,
    rttRead: rttRead === null ? undefined : rttRead as number,
    rttWrite: rttWrite === null ? undefined : rttWrite as number,
    network: network === null ? undefined : network as string,
    nip11Present: (nip11Present as number) === 1,
    operatorPubkey: operatorPubkey === null
      ? undefined
      : operatorPubkey as string,
    sslValid: sslValid === null ? undefined : (sslValid as number) === 1,
    dnsAddress: dnsAddress === null ? undefined : dnsAddress as string,
    dnsAs: dnsAs === null ? undefined : dnsAs as string,
    dnsAsn: dnsAsn === null ? undefined : dnsAsn as string,
    countryCode: countryCode === null ? undefined : countryCode as string,
    region: region === null ? undefined : region as string,
    isHosting: isHosting === null ? undefined : (isHosting as number) === 1,
  };
}

export function getTrustedRelayObservationHistory(
  url: string,
): TrustedRelayObservationSample[] {
  const table = db.query(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='relay_trust_observations'",
  );
  if (!table.length) {
    return [];
  }

  const rows = db.query(
    `
    SELECT
      url,
      observed_at,
      online,
      rtt_open,
      rtt_read,
      rtt_write,
      network,
      nip11_present,
      operator_pubkey,
      ssl_valid,
      dns_address,
      dns_as,
      dns_asn,
      country_code,
      region,
      is_hosting
    FROM relay_trust_observations
    WHERE url = ?
    ORDER BY observed_at ASC, id ASC
  `,
    [url],
  );

  return rows.map(observationSampleFromRow);
}

function pruneTrustedRelayObservationHistory(
  url: string,
  observedAt: number,
  options: TrustedRelayObservationOptions,
): void {
  const retentionSeconds = normalizeRetentionSeconds(
    options.historyRetentionMs,
  );
  if (retentionSeconds !== undefined) {
    db.query(
      `
      DELETE FROM relay_trust_observations
      WHERE url = ? AND observed_at < ?
    `,
      [url, observedAt - retentionSeconds],
    );
  }

  const maxRows = options.maxObservationsPerRelay;
  if (typeof maxRows === "number" && Number.isFinite(maxRows) && maxRows > 0) {
    db.query(
      `
      DELETE FROM relay_trust_observations
      WHERE url = ?
        AND id NOT IN (
          SELECT id FROM relay_trust_observations
          WHERE url = ?
          ORDER BY observed_at DESC, id DESC
          LIMIT ?
        )
    `,
      [url, url, Math.floor(maxRows)],
    );
  }
}

export function recordTrustedRelayObservation(url: string, result: {
  online?: boolean;
  open?: { duration?: number };
  read?: { duration?: number };
  write?: { duration?: number };
  checked_at?: number;
  network?: string;
  info?: { data?: { pubkey?: string; name?: string; software?: string } };
  ssl?: { data?: { valid?: boolean } };
  dns?: {
    data?: {
      address?: string;
      addresses?: string[];
      as?: string;
      asn?: string | number;
    };
  };
  geo?: { data?: unknown };
}, options: TrustedRelayObservationOptions = {}): TrustedRelayObservationState {
  ensureTrustedRelayAssertionTable();

  const now = typeof options.observedAt === "number"
    ? Math.floor(options.observedAt)
    : typeof result.checked_at === "number" && result.checked_at > 0
    ? Math.floor(result.checked_at)
    : Math.floor(Date.now() / 1000);
  const online = result.online === true;
  const rttOpen = normalizePositiveDuration(result.open?.duration);
  const rttRead = normalizePositiveDuration(result.read?.duration);
  const rttWrite = normalizePositiveDuration(result.write?.duration);

  db.query(
    `
    INSERT INTO relay_trust_assertion_state (
      url,
      first_seen,
      last_observed,
      observations,
      reachable_observations,
      total_rtt_open,
      rtt_open_samples,
      total_rtt_read,
      rtt_read_samples,
      last_online_at
    )
    VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(url) DO UPDATE SET
      last_observed = excluded.last_observed,
      observations = relay_trust_assertion_state.observations + 1,
      reachable_observations = relay_trust_assertion_state.reachable_observations + excluded.reachable_observations,
      total_rtt_open = relay_trust_assertion_state.total_rtt_open + excluded.total_rtt_open,
      rtt_open_samples = relay_trust_assertion_state.rtt_open_samples + excluded.rtt_open_samples,
      total_rtt_read = relay_trust_assertion_state.total_rtt_read + excluded.total_rtt_read,
      rtt_read_samples = relay_trust_assertion_state.rtt_read_samples + excluded.rtt_read_samples,
      last_online_at = CASE
        WHEN excluded.last_online_at IS NOT NULL THEN excluded.last_online_at
        ELSE relay_trust_assertion_state.last_online_at
      END
  `,
    [
      url,
      now,
      now,
      online ? 1 : 0,
      rttOpen ?? 0,
      rttOpen !== null ? 1 : 0,
      rttRead ?? 0,
      rttRead !== null ? 1 : 0,
      online ? now : null,
    ],
  );

  if (options.recordHistory === true) {
    ensureTrustedRelayObservationHistoryTable();
    const geo = firstGeoData(result);
    const countryCode = typeof geo?.countryCode === "string"
      ? geo.countryCode.toUpperCase()
      : undefined;
    const region = typeof geo?.region === "string" ? geo.region : undefined;
    const dnsData = result.dns?.data;
    const dnsAddress = Array.isArray(dnsData?.addresses)
      ? dnsData?.addresses[0]
      : dnsData?.address;
    const dnsAsn = dnsData?.asn === undefined ? undefined : String(dnsData.asn);
    const isHosting = inferRelayHosting(result);

    db.query(
      `
      INSERT INTO relay_trust_observations (
        url,
        observed_at,
        online,
        rtt_open,
        rtt_read,
        rtt_write,
        network,
        nip11_present,
        operator_pubkey,
        ssl_valid,
        dns_address,
        dns_as,
        dns_asn,
        country_code,
        region,
        is_hosting
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        url,
        now,
        online ? 1 : 0,
        rttOpen,
        rttRead,
        rttWrite,
        result.network ?? null,
        result.info?.data ? 1 : 0,
        result.info?.data?.pubkey ?? null,
        typeof result.ssl?.data?.valid === "boolean"
          ? result.ssl.data.valid ? 1 : 0
          : null,
        dnsAddress ?? null,
        dnsData?.as ?? null,
        dnsAsn ?? null,
        countryCode ?? null,
        region ?? null,
        isHosting === undefined ? null : isHosting ? 1 : 0,
      ],
    );

    pruneTrustedRelayObservationHistory(url, now, options);
  }

  const rows = db.query(
    `
    SELECT
      first_seen,
      last_observed,
      observations,
      reachable_observations,
      total_rtt_open,
      rtt_open_samples,
      total_rtt_read,
      rtt_read_samples,
      last_online_at
    FROM relay_trust_assertion_state
    WHERE url = ?
  `,
    [url],
  );

  if (!rows.length) {
    throw new Error(
      `Failed to read trusted relay observation state for ${url}`,
    );
  }

  const state = observationRowToState(rows[0], url);
  if (options.recordHistory === true) {
    state.history = getTrustedRelayObservationHistory(url);
  }
  return state;
}

export function getPublishedTrustedRelayAssertion(
  url: string,
): PublishedTrustedRelayAssertionState | null {
  ensureTrustedRelayAssertionTable();

  const rows = db.query(
    `
    SELECT
      last_status,
      last_score,
      last_reliability,
      last_quality,
      last_accessibility,
      last_confidence,
      last_event_id,
      last_published_at
    FROM relay_trust_assertion_state
    WHERE url = ?
  `,
    [url],
  );

  if (!rows.length) {
    return null;
  }

  const [
    status,
    score,
    reliability,
    quality,
    accessibility,
    confidence,
    eventId,
    publishedAt,
  ] = rows[0];

  if (publishedAt === null || publishedAt === undefined) {
    return null;
  }

  return {
    status: status as string | undefined,
    score: score === null ? undefined : score as number,
    reliability: reliability === null ? undefined : reliability as number,
    quality: quality === null ? undefined : quality as number,
    accessibility: accessibility === null ? undefined : accessibility as number,
    confidence: confidence as string | undefined,
    eventId: eventId as string | undefined,
    publishedAt: publishedAt as number,
  };
}

export function storePublishedTrustedRelayAssertion(url: string, assertion: {
  status: string;
  score?: number;
  reliability?: number;
  quality?: number;
  accessibility?: number;
  confidence: string;
}, eventId: string): void {
  ensureTrustedRelayAssertionTable();

  const now = Math.floor(Date.now() / 1000);

  db.query(
    `
    UPDATE relay_trust_assertion_state
    SET
      last_status = ?,
      last_score = ?,
      last_reliability = ?,
      last_quality = ?,
      last_accessibility = ?,
      last_confidence = ?,
      last_event_id = ?,
      last_published_at = ?
    WHERE url = ?
  `,
    [
      assertion.status,
      assertion.score ?? null,
      assertion.reliability ?? null,
      assertion.quality ?? null,
      assertion.accessibility ?? null,
      assertion.confidence,
      eventId,
      now,
      url,
    ],
  );
}

/**
 * Mark a relay as ignored in the database
 * @param url The relay URL to mark as ignored
 * @param reason Optional reason for ignoring (logged only)
 */
export function markRelayIgnored(url: string, reason?: string): void {
  try {
    db.query(
      `UPDATE relay_status SET ignore = 1, ignore_reason = ? WHERE url = ?`,
      [reason || "", url],
    );
    if (reason) {
      logger.info(`Marked relay ${url} as ignored: ${reason}`);
    } else {
      logger.info(`Marked relay ${url} as ignored`);
    }
  } catch (e) {
    logger.error(`Failed to mark relay ${url} as ignored: ${e}`);
  }
}

/**
 * Unmark a relay as ignored in the database
 * @param url The relay URL to unignore
 */
export function markRelayUnignored(url: string): void {
  try {
    // Clear the deletion marker too: if this relay is ignored again later, its
    // deletion must be re-published once (the prior deletion only covered the
    // earlier 30166).
    db.query(
      `UPDATE relay_status SET ignore = 0, ignore_reason = '', deletion_published_at = 0 WHERE url = ?`,
      [url],
    );
    logger.info(`Unmarked relay ${url} as ignored`);
  } catch (e) {
    logger.error(`Failed to unignore relay ${url}: ${e}`);
  }
}

/**
 * Whether a NIP-09 deletion has already been published for this relay's current
 * ignore episode. The marker is cleared whenever the relay becomes unignored
 * (markRelayUnignored / persistResult), so this only stays true while the relay
 * remains ignored — letting deletion publishing send each deletion once.
 */
export function isDeletionPublished(url: string): boolean {
  try {
    const rows = db.query(
      `SELECT deletion_published_at FROM relay_status WHERE url = ?`,
      [url],
    );
    if (!rows || rows.length === 0) return false;
    return ((rows[0][0] as number) || 0) > 0;
  } catch (e) {
    logger.error(`Failed to read deletion_published_at for ${url}: ${e}`);
    return false;
  }
}

/** Record that a NIP-09 deletion has been published for this relay. */
export function markDeletionPublished(url: string, at: number = Date.now()): void {
  try {
    db.query(
      `UPDATE relay_status SET deletion_published_at = ? WHERE url = ?`,
      [at, url],
    );
  } catch (e) {
    logger.error(`Failed to mark deletion published for ${url}: ${e}`);
  }
}

/** URLs of ignored relays that have not yet had a deletion published. */
export function getIgnoredRelaysPendingDeletion(): Array<{ url: string; reason: string }> {
  try {
    const rows = db.query(
      `SELECT url, ignore_reason FROM relay_status
       WHERE ignore = 1 AND COALESCE(deletion_published_at, 0) = 0`,
    );
    return rows.map((r) => ({ url: r[0] as string, reason: (r[1] as string) || "" }));
  } catch (e) {
    logger.error(`Failed to query ignored relays pending deletion: ${e}`);
    return [];
  }
}

/**
 * Get all ignored relays whose ignore_reason matches a pattern
 * @param reasonPattern Substring to match against ignore_reason
 * @returns Array of {url, reason} objects
 */
export function getIgnoredRelaysByReason(
  reasonPattern: string,
): Array<{ url: string; reason: string }> {
  try {
    const results = db.query(
      `SELECT url, ignore_reason FROM relay_status WHERE ignore = 1 AND ignore_reason LIKE ?`,
      [`%${reasonPattern}%`],
    );
    return results.map(([url, reason]) => ({
      url: url as string,
      reason: reason as string,
    }));
  } catch (e) {
    logger.error(
      `Error getting ignored relays by reason pattern "${reasonPattern}": ${e}`,
    );
    return [];
  }
}

/**
 * Get the ignore reason for a relay
 * @param url The relay URL
 * @returns The ignore reason string, or empty string if not found
 */
export function getIgnoreReason(url: string): string {
  try {
    const result = db.query(
      `SELECT ignore_reason FROM relay_status WHERE url = ?`,
      [url],
    );
    if (!result || result.length === 0) {
      return "";
    }
    return (result[0][0] as string) || "";
  } catch (e) {
    logger.error(`Error getting ignore reason for relay ${url}: ${e}`);
    return "";
  }
}

// Re-export everything from the DB package
export * from "npm:@nostrwatch/db";
