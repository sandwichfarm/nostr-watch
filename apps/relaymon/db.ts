import { DB } from "https://deno.land/x/sqlite/mod.ts";
import { getLogger, LogLevel } from "./logger.ts";
import { RetryManager } from "./retryManager.ts";

const logger = getLogger("DB");
export let db = new DB("relaymon.db");

// Make sure our schema includes a retries column
db.query(`
  CREATE TABLE IF NOT EXISTS relay_status (
    url TEXT PRIMARY KEY,
    online INTEGER,
    ignore INTEGER,
    parent TEXT,
    checked_at INTEGER,
    rtt INTEGER,
    network TEXT,
    retries INTEGER DEFAULT 0
  )
`);

// Check if retries column exists, if not add it
const tableInfo = db.query(`PRAGMA table_info(relay_status)`);
let hasRetriesColumn = false;
for (const row of tableInfo) {
  if (row[1] === "retries") {
    hasRetriesColumn = true;
    break;
  }
}

if (!hasRetriesColumn) {
  logger.info("Adding retries column to relay_status table");
  db.query(`ALTER TABLE relay_status ADD COLUMN retries INTEGER DEFAULT 0`);
}

// Create timestamp table to track seeder methods' last run times
db.query(`
  CREATE TABLE IF NOT EXISTS seeder_timestamps (
    method TEXT PRIMARY KEY,
    timestamp INTEGER
  )
`);

/**
 * Check if a relay is ready to be checked based on its last check time, 
 * retry count, and the retry policy
 */
export function isReadyToCheck(
  checkedAt: number, 
  retries: number, 
  expirySeconds: number,
  retryManager: RetryManager
): boolean {
  const now = Math.round(Date.now()/1000);
  
  // Unchecked relays are always ready to check
  if (checkedAt === null || checkedAt === -1) {
    return true;
  }
  
  // For retry backoff, calculate when the next check should happen
  let nextCheckTime = checkedAt + expirySeconds;
  
  // Apply backoff for relays with retries - the higher the retry count, the longer we wait
  if (retries > 0) {
    // Get the appropriate delay based on retry count (in ms)
    const backoffDelay = retryManager.getDelay(retries);
    // Convert from ms to seconds and add to the time when the relay was last checked
    nextCheckTime += Math.floor(backoffDelay / 1000);
  }
  
  // Return true if now is later than the next check time
  return now >= nextCheckTime;
}

/**
 * Get a list of relays that have expired and are ready to be checked
 */
export function getExpiredRelays(expires: number, allowedNetworks: string[], retryManager: RetryManager): string[] {
  const now = Math.round(Date.now()/1000);
  const expired: string[] = [];
  
  logger.debug(`getExpiredRelays called with expires=${expires}s, now=${now}`);
  
  if (allowedNetworks.length === 0) {
    logger.debug("getExpiredRelays: No allowed networks provided, returning empty array");
    return expired;
  }
  
  // Create placeholders for networks
  const networkPlaceholders = allowedNetworks.map(() => '?').join(',');
  
  // Get all relays that might be candidates for checking
  // We'll apply retry backoff logic in memory
  const query = `
    SELECT url, checked_at, retries, online, network
    FROM relay_status 
    WHERE network IN (${networkPlaceholders})
  `;
  
  // All parameters: just networks
  const params = [...allowedNetworks];
  
  logger.debug(`Checking relays with networks=${JSON.stringify(allowedNetworks)}`);
  
  // Process each relay, applying backoff logic based on retry count
  for (const [url, checkedAt, retries, online, network] of db.query(query, params)) {
    // We've already filtered by network in the SQL query, 
    // so we don't need to check network again here
    
    // Use the shared isReadyToCheck function
    if (isReadyToCheck(checkedAt as number, retries as number, expires, retryManager)) {
      expired.push(url as string);
    }
  }
  
  logger.debug(`Found ${expired.length} expired relays after applying retry backoff`);
  
  return expired;
}

export function persistResult(result: any): void {
  const online = result.open?.data ? 1 : 0;
  const ignore = result.ignore ? 1 : 0;
  const parent = result.parent || "";
  const checked_at = Math.round(Date.now()/1000);
  const rtt = result.open?.duration || -1;
  const network = result.network || "clearnet";
  
  // Check current retry count before updating
  const currentRetries = getRetryCount(result.url);
  
  // If a relay was online, reset its retry count;
  // NOTE: We don't increment retry counts here, that's handled in Worker.handleRetryForRelay
  const retryUpdate = online ? "retries = 0" : "retries = retries";
  
  logger.debug(`Persisting result for ${result.url}: online=${online}, checked_at=${checked_at}, network=${network}, currentRetries=${currentRetries}, will ${online ? "reset" : "keep"} retries`);
  
  db.query(
    `
    INSERT INTO relay_status (url, online, ignore, parent, checked_at, rtt, network, retries)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0)
    ON CONFLICT(url) DO UPDATE SET
      online = excluded.online,
      ignore = excluded.ignore,
      parent = excluded.parent,
      checked_at = excluded.checked_at,
      rtt = excluded.rtt,
      network = excluded.network,
      ${retryUpdate}
    `,
    [result.url, online, ignore, parent, checked_at, rtt, network]
  );
  
  // Check if retries were updated correctly
  const newRetries = getRetryCount(result.url);
  if (online && newRetries > 0) {
    logger.warn(`⚠️ Retries for ${result.url} should be 0 but are ${newRetries} after online update!`);
  } else if (!online && newRetries !== currentRetries) {
    logger.warn(`⚠️ Retries for ${result.url} changed unexpectedly: ${currentRetries} -> ${newRetries}`);
  }
}

// Increment the retry count for a relay
export function incrementRetryCount(url: string): void {
  // Get the current retry count first
  const currentRetries = getRetryCount(url);
  
  db.query(
    `UPDATE relay_status SET retries = retries + 1 WHERE url = ?`,
    [url]
  );
  
  // Get the new retry count after increment
  const newRetries = getRetryCount(url);
  
  logger.debug(`Incremented retry count for ${url}: ${currentRetries} -> ${newRetries}`);
  
  // If the count didn't change, log a warning
  if (currentRetries === newRetries) {
    logger.warn(`⚠️ Retry count did not increment for ${url}!`);
  }
}

export function seedNewRelay(url: string, network: string): boolean {
  // First check if the relay exists
  const exists = db.query("SELECT 1 FROM relay_status WHERE url = ?", [url]).length > 0;
  
  if (!exists) {
    db.query(
      `
      INSERT INTO relay_status (url, online, ignore, parent, checked_at, rtt, network, retries)
      VALUES (?, 0, 0, '', -1, -1, ?, 0)
      `,
      [url, network]
    );
    logger.debug(`Seeded new relay: ${url}`);
    return true;
  } else {
    // logger.debug(`Skipping existing relay during seeding: ${url}`);
    return false;
  }
}

export function getOnlineRelays(): string[] {
    const onlineRelays: string[] = [];
    for (const [url] of db.query("SELECT url FROM relay_status WHERE online = 1")) {
      onlineRelays.push(url as string);
    }
    return onlineRelays;
}

export function saveSeederTimestamp(method: string, timestamp: number): void {
  db.query(
    `
    INSERT INTO seeder_timestamps (method, timestamp)
    VALUES (?, ?)
    ON CONFLICT(method) DO UPDATE SET
      timestamp = excluded.timestamp
    `,
    [method, timestamp]
  );
  logger.debug(`Saved timestamp ${timestamp} for seeder method: ${method}`);
}

export function getSeederTimestamps(): Record<string, number> {
  const timestamps: Record<string, number> = {};
  for (const [method, timestamp] of db.query("SELECT method, timestamp FROM seeder_timestamps")) {
    timestamps[method as string] = timestamp as number;
  }
  return timestamps;
}

/**
 * Get the current retry count for a relay
 */
export function getRetryCount(url: string): number {
  const result = db.query("SELECT retries FROM relay_status WHERE url = ?", [url]);
  if (result.length > 0) {
    return result[0][0] as number || 0;
  }
  return 0;
}
