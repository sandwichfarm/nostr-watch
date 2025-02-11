import { DB } from "https://deno.land/x/sqlite/mod.ts";

const db = new DB("relay.db");

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
}

export function getExpiredRelays(expires: number, allowedNetworks: string[]): string[] {
  const now = Math.round(Date.now()/1000);
  const expired: string[] = [];
  if (allowedNetworks.length === 0) {
    return expired;
  }
  const placeholders = allowedNetworks.map(() => '?').join(',');
  const query = `SELECT url, checked_at FROM relay_status WHERE network IN (${placeholders})`;
  for (const [url, checked_at] of db.query(query, allowedNetworks)) {
    if (!checked_at || now - (checked_at as number) > expires) {
      expired.push(url as string);
    }
  }
  return expired;
}

/**
 * Retrieves the URLs of online relays from the SQLite database.
 * A relay is considered online if its "online" column equals 1.
 */
export function getOnlineRelays(): string[] {
    const onlineRelays: string[] = [];
    for (const [url] of db.query("SELECT url FROM relay_status WHERE online = 1")) {
      onlineRelays.push(url as string);
    }
    return onlineRelays;
}
