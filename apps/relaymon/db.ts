import { DB } from "https://deno.land/x/sqlite/mod.ts";
import { getLogger, LogLevel } from "./logger.ts";

const logger = getLogger("DB");
export let db = new DB("relay.db");

db.query(`
  CREATE TABLE IF NOT EXISTS relay_status (
    url TEXT PRIMARY KEY,
    online INTEGER,
    ignore INTEGER,
    parent TEXT,
    checked_at INTEGER,
    rtt INTEGER,
    network TEXT
  )
`);

// Create timestamp table to track seeder methods' last run times
db.query(`
  CREATE TABLE IF NOT EXISTS seeder_timestamps (
    method TEXT PRIMARY KEY,
    timestamp INTEGER
  )
`);

export function persistResult(result: any): void {
  const online = result.open?.data ? 1 : 0;
  const ignore = result.ignore ? 1 : 0;
  const parent = result.parent || "";
  const checked_at = Math.round(Date.now()/1000);
  const rtt = result.open?.duration || -1;
  const network = result.network || "clearnet";
  
  db.query(
    `
    INSERT INTO relay_status (url, online, ignore, parent, checked_at, rtt, network)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(url) DO UPDATE SET
      online = excluded.online,
      ignore = excluded.ignore,
      parent = excluded.parent,
      checked_at = excluded.checked_at,
      rtt = excluded.rtt,
      network = excluded.network
    `,
    [result.url, online, ignore, parent, checked_at, rtt, network]
  );

  // logger.debug(`Persisted result for ${result.url}`);
}

export function seedNewRelay(url: string, network: string): boolean {
  // First check if the relay exists
  const exists = db.query("SELECT 1 FROM relay_status WHERE url = ?", [url]).length > 0;
  
  if (!exists) {
    db.query(
      `
      INSERT INTO relay_status (url, online, ignore, parent, checked_at, rtt, network)
      VALUES (?, 0, 0, '', -1, -1, ?)
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

export function getExpiredRelays(expires: number, allowedNetworks: string[]): string[] {
  const now = Math.round(Date.now()/1000);
  const expired: string[] = [];
  
  if (allowedNetworks.length === 0) {
    return expired;
  }
  
  // Create placeholders for networks
  const networkPlaceholders = allowedNetworks.map(() => '?').join(',');
  
  // Use SQL to filter expired relays directly
  const query = `
    SELECT url FROM relay_status 
    WHERE network IN (${networkPlaceholders})
    AND (checked_at IS NULL OR checked_at = -1 OR (? - checked_at) > ?)
  `;
  
  // All parameters: networks + now timestamp + expires duration
  const params = [...allowedNetworks, now, expires];
  
  logger.info(`Checking for expired relays with expires=${expires}, now=${now}`);
  
  for (const [url] of db.query(query, params)) {
    expired.push(url as string);
  }
  
  return expired;
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
