import { db } from "./db.ts";
import { loadConfig } from "./config.ts";

async function main() {
  // Load the same config that the daemon uses
  const config = await loadConfig("./config.yaml");
  
  // Get the current timestamp
  const now = Math.round(Date.now()/1000);

  // Get expiry time from config, converted to seconds
  const expiryThreshold = Math.round(config.relaymon.checks.options.expires/1000);
  const expiryTimestamp = now - expiryThreshold;

  console.log(`Current time: ${now} (${new Date(now * 1000).toISOString()})`);
  console.log(`Expiry threshold: ${expiryTimestamp} (${new Date(expiryTimestamp * 1000).toISOString()})`);
  console.log(`Expiry time from config: ${expiryThreshold}s`);
  console.log(`Any relay with checked_at < ${expiryTimestamp} should be considered expired`);
  console.log('---');

  // Count total relays
  const totalRelays = db.query("SELECT COUNT(*) FROM relay_status")[0][0];
  console.log(`Total relays in database: ${totalRelays}`);

  // Count relays by network - using networks from config
  const networks = config.relaymon.networks;
  const networkPlaceholders = networks.map(() => '?').join(',');

  console.log(`Using networks from config: ${JSON.stringify(networks)}`);
  
  const totalByNetwork = db.query(
    `SELECT network, COUNT(*) FROM relay_status WHERE network IN (${networkPlaceholders}) GROUP BY network`,
    [...networks]
  );
  console.log('Relays by network:');
  for (const [network, count] of totalByNetwork) {
    console.log(`  ${network}: ${count}`);
  }
  console.log('---');

  // Check for expired relays (using the same logic as getExpiredRelays)
  const expiredRelays = db.query(
    `SELECT COUNT(*) FROM relay_status 
     WHERE network IN (${networkPlaceholders})
     AND (checked_at IS NULL OR checked_at = -1 OR (? - checked_at) > ?)`,
    [...networks, now, expiryThreshold]
  )[0][0];

  console.log(`Expired relays: ${expiredRelays}`);

  // Sample some expired relays
  const sampleExpired = db.query(
    `SELECT url, network, checked_at, online FROM relay_status 
     WHERE network IN (${networkPlaceholders})
     AND (checked_at IS NULL OR checked_at = -1 OR (? - checked_at) > ?)
     LIMIT 5`,
    [...networks, now, expiryThreshold]
  );

  if (sampleExpired.length > 0) {
    console.log('Sample expired relays:');
    for (const [url, network, checkedAt, online] of sampleExpired) {
      const age = checkedAt === -1 ? "never" : `${now - checkedAt}s ago`;
      const lastChecked = checkedAt === -1 ? "never" : new Date(checkedAt * 1000).toISOString();
      console.log(`  ${url} (${network}, online=${online})`);
      console.log(`    Last checked: ${lastChecked} (${age})`);
    }
  } else {
    console.log('No expired relays found to sample');
  }
  console.log('---');

  // Check the most recently updated relays
  const recentRelays = db.query(
    `SELECT url, network, checked_at, online FROM relay_status 
     ORDER BY checked_at DESC
     LIMIT 5`
  );

  console.log('Most recently checked relays:');
  for (const [url, network, checkedAt, online] of recentRelays) {
    const age = now - checkedAt;
    console.log(`  ${url} (${network}, online=${online})`);
    console.log(`    Last checked: ${new Date(checkedAt * 1000).toISOString()} (${age}s ago)`);
  }
}

// Run the main function
main().catch(err => {
  console.error("Error:", err);
  Deno.exit(1);
}); 