import { db, initDB } from "npm:@nostrwatch/db";
import { getLogger } from "./logger.ts";

const logger = getLogger("DB");
let isInitialized = false;

/**
 * Initialize the database with a specific path
 * @param dbPath Optional path to the SQLite database file
 * @param enableWAL Optional boolean to enable WAL mode (default: true)
 */
export function initializeDB(dbPath?: string, enableWAL: boolean = true): void {
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
  
  isInitialized = true;
}

/**
 * Store relay NIP-11 info
 * @param url The relay URL
 * @param info The NIP-11 info object
 * @param infoHash Hash of the NIP-11 info for comparison
 */
export function storeRelayInfo(url: string, info: any, infoHash: string): void {
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
 * Get the stored NIP-11 info for a relay
 * @param url The relay URL
 * @returns Object with info and infoHash, or null if not found
 */
export function getRelayInfo(url: string): { info: any; infoHash: string } | null {
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

// Re-export everything from the DB package
export * from "npm:@nostrwatch/db";