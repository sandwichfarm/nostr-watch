import { db, initDB } from "npm:@nostrwatch/db";
import { getLogger } from "../utils/logger.ts";
import type { RelayInfo } from "../types/relay.ts";
import { createInfoHash } from "../utils/hostnames.ts";
import {
  rerunDedupForAllRowsMigration,
  rerunNostringsSweepMigration,
} from "../utils/remediation.ts";

const logger = getLogger("DB");
let isInitialized = false;

/**
 * Initialize the database with a specific path
 * @param dbPath Optional path to the SQLite database file
 * @param enableWAL Optional boolean to enable WAL mode (default: true)
 */
export async function initializeDB(dbPath?: string, enableWAL: boolean = true): Promise<void> {
  if (isInitialized) {
    logger.warn("Database already initialized, ignoring repeated initialization");
    return;
  }

  const path = dbPath || "relaymon.db";
  logger.info(`Initializing database with path: ${path}, WAL mode: ${enableWAL ? "enabled" : "disabled"}`);
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

  // Phase 18 Fix 2: re-hash existing relay_info rows using the new
  // normalizeNip11-aware createInfoHash. Idempotent via relaymon_migrations
  // sentinel.
  try {
    rehashRelayInfoMigration();
  } catch (e) {
    logger.error(`rehashRelayInfoMigration threw: ${e}`);
  }

  // Phase 19 REMED-01/REMED-02: re-run dedup over every row in
  // relay_status using the now-fixed relayHostnameDedup. Idempotent via
  // relaymon_migrations sentinel. MUST run AFTER rehashRelayInfoMigration
  // so the re-dedup sees stable hashes, and MUST complete BEFORE the
  // daemon constructs IgnoreListSync (which snapshots relay_status
  // ignore=1 rows into its in-memory map). initializeDB is therefore
  // async so main.ts can await the migration before wiring the daemon.
  // Migration writes deletion events to remediation_deletion_queue
  // rather than publishing directly — the daemon drains that queue
  // after setup via drainRemediationDeletionQueue.
  try {
    await rerunDedupForAllRowsMigration();
  } catch (e) {
    logger.error(`rerunDedupForAllRowsMigration threw: ${e}`);
  }

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

  isInitialized = true;
}

/**
 * Store relay NIP-11 info
 * @param url The relay URL
 * @param info The NIP-11 info object
 * @param infoHash Hash of the NIP-11 info for comparison
 */
export function storeRelayInfo(url: string, info: RelayInfo, infoHash: string): void {
  try {
    const infoJson = JSON.stringify(info);
    const timestamp = Math.floor(Date.now() / 1000);
    
    // Use REPLACE to update or insert
    db.query(`
      REPLACE INTO relay_info (url, info_json, info_hash, last_updated)
      VALUES (?, ?, ?, ?)
    `, [url, infoJson, infoHash, timestamp]);
    
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
export function getRelayInfo(url: string): { info: RelayInfo; infoHash: string } | null {
  try {
    const result = db.query(`
      SELECT info_json, info_hash FROM relay_info
      WHERE url = ?
    `, [url]);
    
    if (!result || result.length === 0) {
      return null;
    }
    
    const [infoJson, infoHash] = result[0];
    
    let info = null;
    try {
      if (infoJson && typeof infoJson === 'string') {
        info = JSON.parse(infoJson);
      }
    } catch (e) {
      logger.warn(`Failed to parse info JSON for relay ${url}: ${e}`);
      return null;
    }
    
    return {
      info,
      infoHash: infoHash as string
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
    const results = db.query(`
      SELECT url FROM relay_info
      WHERE info_hash = ?
    `, [infoHash]);
    
    if (!results || results.length === 0) {
      return [];
    }
    
    return results.map(row => row[0] as string);
  } catch (e) {
    logger.error(`Error getting relays with info hash ${infoHash}: ${e}`);
    return [];
  }
}

/**
 * Get online relays from the database
 * @returns Array of online relay URLs
 */
export function getOnlineRelays(): string[] {
  try {
    const rows = db.query(`SELECT url FROM relay_status WHERE online = 1`);
    return rows.map(row => row[0] as string);
  } catch (e) {
    logger.error(`Error getting online relays: ${e}`);
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
    const result = db.query(`SELECT ignore FROM relay_status WHERE url = ?`, [url]);
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
    const result = db.query(`
      SELECT state_json, rtt_open, rtt_read, rtt_write, dns_json, geo_json
      FROM relay_delta_state
      WHERE url = ?
    `, [url]);

    if (!result || result.length === 0) {
      return null;
    }

    const [stateJson, rttOpen, rttRead, rttWrite, dnsJson, geoJson] = result[0];

    let state = null;
    try {
      if (stateJson && typeof stateJson === 'string') {
        state = JSON.parse(stateJson);
      }
    } catch (e) {
      logger.warn(`Failed to parse delta state JSON for relay ${url}: ${e}`);
      return null;
    }

    let dns = undefined;
    try {
      if (dnsJson && typeof dnsJson === 'string') {
        dns = JSON.parse(dnsJson);
      }
    } catch (e) {
      logger.warn(`Failed to parse DNS JSON for relay ${url}: ${e}`);
    }

    let geo = undefined;
    try {
      if (geoJson && typeof geoJson === 'string') {
        geo = JSON.parse(geoJson);
      }
    } catch (e) {
      logger.warn(`Failed to parse geo JSON for relay ${url}: ${e}`);
    }

    return {
      state,
      rttOpen: rttOpen !== null && rttOpen !== -1 ? rttOpen as number : undefined,
      rttRead: rttRead !== null && rttRead !== -1 ? rttRead as number : undefined,
      rttWrite: rttWrite !== null && rttWrite !== -1 ? rttWrite as number : undefined,
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

    db.query(`
      REPLACE INTO relay_delta_state (url, state_json, rtt_open, rtt_read, rtt_write, dns_json, geo_json, last_updated)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [url, stateJson, rttOpen, rttRead, rttWrite, dnsJson, geoJson, timestamp]);

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
export function getPeriodSnapshot(url: string, period: string): PeriodSnapshot | null {
  try {
    const result = db.query(`
      SELECT state_json, snapshot_at
      FROM relay_period_snapshots
      WHERE url = ? AND period = ?
    `, [url, period]);

    if (!result || result.length === 0) {
      return null;
    }

    const [stateJson, snapshotAt] = result[0];

    let state = null;
    try {
      if (stateJson && typeof stateJson === 'string') {
        state = JSON.parse(stateJson);
      }
    } catch (e) {
      logger.warn(`Failed to parse period snapshot JSON for relay ${url}, period ${period}: ${e}`);
      return null;
    }

    return {
      state,
      snapshotAt: snapshotAt as number
    };
  } catch (e) {
    logger.error(`Error getting period snapshot for ${url}, period ${period}: ${e}`);
    return null;
  }
}

/**
 * Store a period snapshot for a relay
 * @param url The relay URL
 * @param period The period (e.g., "6h", "1d", "7d")
 * @param state The relay state to snapshot
 */
export function storePeriodSnapshot(url: string, period: string, state: RelayInfo): void {
  try {
    const stateJson = JSON.stringify(state);
    const timestamp = Math.floor(Date.now() / 1000);

    db.query(`
      REPLACE INTO relay_period_snapshots (url, period, state_json, snapshot_at)
      VALUES (?, ?, ?, ?)
    `, [url, period, stateJson, timestamp]);

    logger.debug(`Stored period snapshot for ${url}, period ${period}`);
  } catch (e) {
    logger.error(`Failed to store period snapshot for ${url}, period ${period}: ${e}`);
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
export function getAllPeriodSnapshots(url: string): Map<string, PeriodSnapshot> {
  const snapshots = new Map<string, PeriodSnapshot>();

  try {
    const results = db.query(`
      SELECT period, state_json, snapshot_at
      FROM relay_period_snapshots
      WHERE url = ?
    `, [url]);

    for (const [period, stateJson, snapshotAt] of results) {
      try {
        const state = JSON.parse(stateJson as string);
        snapshots.set(period as string, {
          state,
          snapshotAt: snapshotAt as number
        });
      } catch (e) {
        logger.warn(`Failed to parse snapshot for ${url}, period ${period}: ${e}`);
      }
    }
  } catch (e) {
    logger.error(`Error getting all period snapshots for ${url}: ${e}`);
  }

  return snapshots;
}

/**
 * Mark a relay as ignored in the database
 * @param url The relay URL to mark as ignored
 * @param reason Optional reason for ignoring (logged only)
 */
export function markRelayIgnored(url: string, reason?: string): void {
  try {
    db.query(`UPDATE relay_status SET ignore = 1, ignore_reason = ? WHERE url = ?`, [reason || "", url]);
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
    db.query(`UPDATE relay_status SET ignore = 0, ignore_reason = '' WHERE url = ?`, [url]);
    logger.info(`Unmarked relay ${url} as ignored`);
  } catch (e) {
    logger.error(`Failed to unignore relay ${url}: ${e}`);
  }
}

/**
 * Get all ignored relays whose ignore_reason matches a pattern
 * @param reasonPattern Substring to match against ignore_reason
 * @returns Array of {url, reason} objects
 */
export function getIgnoredRelaysByReason(reasonPattern: string): Array<{url: string, reason: string}> {
  try {
    const results = db.query(
      `SELECT url, ignore_reason FROM relay_status WHERE ignore = 1 AND ignore_reason LIKE ?`,
      [`%${reasonPattern}%`]
    );
    return results.map(([url, reason]) => ({ url: url as string, reason: reason as string }));
  } catch (e) {
    logger.error(`Error getting ignored relays by reason pattern "${reasonPattern}": ${e}`);
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
    const result = db.query(`SELECT ignore_reason FROM relay_status WHERE url = ?`, [url]);
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