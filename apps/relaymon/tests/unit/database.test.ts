import { assertEquals, assertExists, assert } from "https://deno.land/std@0.218.2/assert/mod.ts";
import {
  initializeDB,
  storeRelayInfo,
  getRelayInfo,
  getRelaysWithSameInfo,
  getOnlineRelays,
  isRelayIgnored,
  db
} from "../../src/db/db.ts";
import type { RelayInfo } from "../../src/types/relay.ts";

/**
 * Test helper to disable resource/ops sanitization
 */
function dbTest(name: string, fn: () => void | Promise<void>) {
  Deno.test({
    name,
    sanitizeResources: false,
    sanitizeOps: false,
    fn
  });
}

// Global test database path
const GLOBAL_TEST_DB_PATH = `/tmp/test-db-global-${Date.now()}.db`;
let dbInitialized = false;

function ensureGlobalTestDB() {
  if (!dbInitialized) {
    initializeDB(GLOBAL_TEST_DB_PATH, false);
    dbInitialized = true;
  }
}

/**
 * Create mock NIP-11 relay info
 */
function createMockRelayInfo(overrides: Partial<RelayInfo> = {}): RelayInfo {
  return {
    name: "Test Relay",
    description: "A test relay",
    pubkey: "test-pubkey-abc123",
    contact: "test@example.com",
    supported_nips: [1, 2, 11],
    software: "test-software",
    version: "1.0.0",
    ...overrides
  };
}

// Test suite

dbTest("Database - initializeDB creates database file", () => {
  ensureGlobalTestDB();

  // Check that file was created
  const fileInfo = Deno.statSync(GLOBAL_TEST_DB_PATH);
  assertExists(fileInfo, "Database file should be created");
});

dbTest("Database - initializeDB creates relay_info table", () => {
  ensureGlobalTestDB();

  const result = db.query("SELECT name FROM sqlite_master WHERE type='table' AND name='relay_info'");
  assertEquals(result.length, 1, "relay_info table should exist");
});

dbTest("Database - relay_status table exists from @nostrwatch/db", () => {
  ensureGlobalTestDB();

  const result = db.query("SELECT name FROM sqlite_master WHERE type='table' AND name='relay_status'");
  assertEquals(result.length, 1, "relay_status table should exist");
});

dbTest("Database - storeRelayInfo inserts new relay info", () => {
  ensureGlobalTestDB();

  const url = `wss://test-insert-${Date.now()}.example.com`;
  const info = createMockRelayInfo();
  const infoHash = "hash123";

  storeRelayInfo(url, info, infoHash);

  const result = db.query("SELECT url, info_hash FROM relay_info WHERE url = ?", [url]);

  assertEquals(result.length, 1, "Should have one row");
  assertEquals(result[0][0], url, "URL should match");
  assertEquals(result[0][1], infoHash, "Info hash should match");
});

dbTest("Database - storeRelayInfo updates existing relay info", () => {
  ensureGlobalTestDB();

  const url = `wss://test-update-${Date.now()}.example.com`;
  const info1 = createMockRelayInfo({ name: "First Name" });
  const info2 = createMockRelayInfo({ name: "Updated Name" });

  // Store first version
  storeRelayInfo(url, info1, "hash1");

  // Update with new version
  storeRelayInfo(url, info2, "hash2");

  // Verify only one row exists with updated data
  const result = db.query("SELECT info_hash FROM relay_info WHERE url = ?", [url]);

  assertEquals(result.length, 1, "Should have exactly one row");
  assertEquals(result[0][0], "hash2", "Info hash should be updated");
});

dbTest("Database - storeRelayInfo stores valid JSON", () => {
  ensureGlobalTestDB();

  const url = `wss://test-json-${Date.now()}.example.com`;
  const info = createMockRelayInfo({
    supported_nips: [1, 2, 11, 50],
    name: "Test Relay with Special Chars: ñ, é, 中文"
  });

  storeRelayInfo(url, info, "hash123");

  // Verify JSON can be parsed back
  const result = db.query("SELECT info_json FROM relay_info WHERE url = ?", [url]);

  const storedJson = result[0][0] as string;
  const parsed = JSON.parse(storedJson);

  assertEquals(parsed.name, info.name, "Name should match including special chars");
  assertEquals(parsed.supported_nips, info.supported_nips, "NIPs array should match");
});

dbTest("Database - getRelayInfo returns stored info", () => {
  ensureGlobalTestDB();

  const url = `wss://test-get-${Date.now()}.example.com`;
  const info = createMockRelayInfo();
  const infoHash = "hash-get-123";

  storeRelayInfo(url, info, infoHash);

  const retrieved = getRelayInfo(url);

  assertExists(retrieved, "Should return relay info");
  assertEquals(retrieved!.infoHash, infoHash, "Hash should match");
  assertEquals(retrieved!.info.name, info.name, "Name should match");
  assertEquals(retrieved!.info.software, info.software, "Software should match");
});

dbTest("Database - getRelayInfo returns null for non-existent relay", () => {
  ensureGlobalTestDB();

  const retrieved = getRelayInfo("wss://nonexistent-totally-fake.example.com");

  assertEquals(retrieved, null, "Should return null for non-existent relay");
});

dbTest("Database - getRelayInfo handles malformed JSON gracefully", () => {
  ensureGlobalTestDB();

  const url = `wss://bad-json-${Date.now()}.example.com`;

  // Manually insert malformed JSON
  db.query(
    "INSERT INTO relay_info (url, info_json, info_hash, last_updated) VALUES (?, ?, ?, ?)",
    [url, "{invalid json", "hash123", Math.floor(Date.now() / 1000)]
  );

  const retrieved = getRelayInfo(url);

  assertEquals(retrieved, null, "Should return null for malformed JSON");
});

dbTest("Database - getRelaysWithSameInfo returns matching relays", () => {
  ensureGlobalTestDB();

  const timestamp = Date.now();
  const info = createMockRelayInfo();
  const sharedHash = `shared-hash-${timestamp}`;

  // Store multiple relays with same hash
  storeRelayInfo(`wss://relay1-${timestamp}.example.com`, info, sharedHash);
  storeRelayInfo(`wss://relay2-${timestamp}.example.com`, info, sharedHash);
  storeRelayInfo(`wss://relay3-${timestamp}.example.com`, info, sharedHash);

  // Store one with different hash
  storeRelayInfo(`wss://different-${timestamp}.example.com`, info, `different-hash-${timestamp}`);

  const relays = getRelaysWithSameInfo(sharedHash);

  assertEquals(relays.length, 3, "Should return 3 relays with same hash");
  assert(relays.includes(`wss://relay1-${timestamp}.example.com`), "Should include relay1");
  assert(relays.includes(`wss://relay2-${timestamp}.example.com`), "Should include relay2");
  assert(relays.includes(`wss://relay3-${timestamp}.example.com`), "Should include relay3");
  assert(!relays.includes(`wss://different-${timestamp}.example.com`), "Should not include different relay");
});

dbTest("Database - getRelaysWithSameInfo returns empty array for non-existent hash", () => {
  ensureGlobalTestDB();

  const relays = getRelaysWithSameInfo("totally-nonexistent-hash-unique-12345");

  assertEquals(relays, [], "Should return empty array");
});

dbTest("Database - getOnlineRelays returns only online relays", () => {
  ensureGlobalTestDB();

  const timestamp = Date.now();

  // Insert test relays
  db.query("INSERT OR REPLACE INTO relay_status (url, network, online) VALUES (?, ?, ?)",
    [`wss://online1-${timestamp}.example.com`, "clearnet", 1]);
  db.query("INSERT OR REPLACE INTO relay_status (url, network, online) VALUES (?, ?, ?)",
    [`wss://online2-${timestamp}.example.com`, "clearnet", 1]);
  db.query("INSERT OR REPLACE INTO relay_status (url, network, online) VALUES (?, ?, ?)",
    [`wss://offline1-${timestamp}.example.com`, "clearnet", 0]);
  db.query("INSERT OR REPLACE INTO relay_status (url, network, online) VALUES (?, ?, ?)",
    [`wss://offline2-${timestamp}.example.com`, "clearnet", -1]);

  const onlineRelays = getOnlineRelays();

  assert(onlineRelays.includes(`wss://online1-${timestamp}.example.com`), "Should include online1");
  assert(onlineRelays.includes(`wss://online2-${timestamp}.example.com`), "Should include online2");
  assert(!onlineRelays.includes(`wss://offline1-${timestamp}.example.com`), "Should not include offline1");
  assert(!onlineRelays.includes(`wss://offline2-${timestamp}.example.com`), "Should not include offline2");
});

dbTest("Database - isRelayIgnored returns true for ignored relay", () => {
  ensureGlobalTestDB();

  const timestamp = Date.now();
  const url = `wss://ignored-${timestamp}.example.com`;

  db.query("INSERT OR REPLACE INTO relay_status (url, network, ignore) VALUES (?, ?, ?)", [url, "clearnet", 1]);

  const ignored = isRelayIgnored(url);

  assertEquals(ignored, true, "Should return true for ignored relay");
});

dbTest("Database - isRelayIgnored returns false for non-ignored relay", () => {
  ensureGlobalTestDB();

  const timestamp = Date.now();
  const url = `wss://not-ignored-${timestamp}.example.com`;

  db.query("INSERT OR REPLACE INTO relay_status (url, network, ignore) VALUES (?, ?, ?)", [url, "clearnet", 0]);

  const ignored = isRelayIgnored(url);

  assertEquals(ignored, false, "Should return false for non-ignored relay");
});

dbTest("Database - isRelayIgnored returns false for non-existent relay", () => {
  ensureGlobalTestDB();

  const ignored = isRelayIgnored("wss://totally-nonexistent-fake-relay-12345.example.com");

  assertEquals(ignored, false, "Should return false for non-existent relay");
});

dbTest("Database - relay_info timestamp is updated on store", async () => {
  ensureGlobalTestDB();

  const url = `wss://timestamp-test-${Date.now()}.example.com`;
  const info = createMockRelayInfo();

  storeRelayInfo(url, info, "hash1");

  // Get first timestamp
  const result1 = db.query("SELECT last_updated FROM relay_info WHERE url = ?", [url]);
  const timestamp1 = result1[0][0] as number;

  // Wait a bit to ensure different timestamp
  await new Promise(resolve => setTimeout(resolve, 100));

  // Update
  storeRelayInfo(url, info, "hash2");

  const result2 = db.query("SELECT last_updated FROM relay_info WHERE url = ?", [url]);
  const timestamp2 = result2[0][0] as number;

  assert(timestamp2 >= timestamp1, "Timestamp should be updated or same");
});

dbTest("Database - multiple relays can be stored independently", () => {
  ensureGlobalTestDB();

  const timestamp = Date.now();
  const info1 = createMockRelayInfo({ name: "Relay 1" });
  const info2 = createMockRelayInfo({ name: "Relay 2" });
  const info3 = createMockRelayInfo({ name: "Relay 3" });

  storeRelayInfo(`wss://relay1-${timestamp}.example.com`, info1, "hash1");
  storeRelayInfo(`wss://relay2-${timestamp}.example.com`, info2, "hash2");
  storeRelayInfo(`wss://relay3-${timestamp}.example.com`, info3, "hash3");

  const retrieved1 = getRelayInfo(`wss://relay1-${timestamp}.example.com`);
  const retrieved2 = getRelayInfo(`wss://relay2-${timestamp}.example.com`);
  const retrieved3 = getRelayInfo(`wss://relay3-${timestamp}.example.com`);

  assertEquals(retrieved1!.info.name, "Relay 1", "Relay 1 name should match");
  assertEquals(retrieved2!.info.name, "Relay 2", "Relay 2 name should match");
  assertEquals(retrieved3!.info.name, "Relay 3", "Relay 3 name should match");
});

dbTest("Database - relay_status supports network types", () => {
  ensureGlobalTestDB();

  const timestamp = Date.now();

  db.query("INSERT OR REPLACE INTO relay_status (url, network) VALUES (?, ?)",
    [`wss://clearnet-${timestamp}.example.com`, "clearnet"]);
  db.query("INSERT OR REPLACE INTO relay_status (url, network) VALUES (?, ?)",
    [`ws://onion-${timestamp}.onion`, "tor"]);
  db.query("INSERT OR REPLACE INTO relay_status (url, network) VALUES (?, ?)",
    [`ws://i2p-${timestamp}.i2p`, "i2p"]);

  const result = db.query(`
    SELECT url, network FROM relay_status
    WHERE url IN (?, ?, ?)
    ORDER BY network
  `, [
    `wss://clearnet-${timestamp}.example.com`,
    `ws://i2p-${timestamp}.i2p`,
    `ws://onion-${timestamp}.onion`
  ]);

  assertEquals(result.length, 3, "Should have 3 relays");
  assertEquals(result[0][1], "clearnet", "First should be clearnet");
  assertEquals(result[1][1], "i2p", "Second should be i2p");
  assertEquals(result[2][1], "tor", "Third should be tor");
});
