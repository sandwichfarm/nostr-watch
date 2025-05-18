#!/usr/bin/env deno run --allow-all

/**
 * Database initialization test script
 * 
 * This script tests database initialization and access with direct calls to the @nostrwatch/db module.
 * Run with: deno run --allow-all apps/relaymon/src/cli/interactive/db-init-test.ts <dbPath>
 */

// Import directly from our db module to test that it's properly exposed
import { db, initDB } from "./db.ts";

// Get database path from command line or use default
const dbPath = Deno.args[0] || "./relaymon.db";

console.log(`Testing database initialization for: ${dbPath}`);

try {
  // Initialize database directly
  console.log("Calling initDB with path:", dbPath);
  initDB(dbPath, true);
  console.log("✅ Database initialization successful");
  
  // Test database access
  console.log("\nRunning test queries:");
  
  // Test count
  const count = db.query(`SELECT COUNT(*) FROM relay_status`)[0][0];
  console.log(`✅ Total relays: ${count}`);
  
  // Test sample data
  const sample = db.query(`SELECT url, online, ignore, checked_at FROM relay_status LIMIT 3`);
  console.log("\nSample relays:");
  sample.forEach((row, i) => {
    console.log(`Relay ${i+1}: url=${row[0]}, online=${row[1]}, ignore=${row[2]}, checked_at=${row[3]}`);
  });
  
  // Test ignored relays
  const ignored = db.query(`SELECT COUNT(*) FROM relay_status WHERE ignore = 1`)[0][0];
  console.log(`\n✅ Ignored relays: ${ignored}`);
  
  console.log("\nAll tests passed successfully!");
} catch (error: unknown) {
  console.error("\n❌ Error testing database:", error instanceof Error ? error.message : String(error));
  if (error instanceof Error && error.stack) {
    console.error(error.stack);
  }
  Deno.exit(1);
} 