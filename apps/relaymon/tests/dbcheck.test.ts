import { DB } from "https://deno.land/x/sqlite/mod.ts";
import { describe, it, beforeEach, afterEach } from "https://deno.land/std/testing/bdd.ts";
import { assertEquals, assertMatch } from "https://deno.land/std/assert/mod.ts";
import { checkDatabase } from "../src/db/dbcheck.ts";
import { existsSync } from "https://deno.land/std/fs/mod.ts";

// Mock the logger to capture output
const mockLogs: {level: string, message: string}[] = [];
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

// Mock db and other imports that the dbcheck module uses
import * as dbModule from "../src/db/db.ts";
import * as loggerModule from "../src/utils/logger.ts";

// Create a temporary test database path
const TEST_DB_PATH = "./tests/test-dbcheck.db";

describe("Database Check Utility", () => {
  let db: DB;
  
  // Setup before each test
  beforeEach(() => {
    // Remove any existing test database
    try {
      if (existsSync(TEST_DB_PATH)) {
        Deno.removeSync(TEST_DB_PATH);
      }
    } catch (error) {
      console.error(`Error removing test database: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    // Mock the logging functions
    mockLogs.length = 0;
    console.log = (message: string) => {
      mockLogs.push({level: "info", message});
      // Still log to console for debugging
      originalConsoleLog(message);
    };
    console.error = (message: string) => {
      mockLogs.push({level: "error", message});
      // Still log to console for debugging
      originalConsoleError(message);
    };
    
    // Create a fresh test database
    db = new DB(TEST_DB_PATH);
    
    // Initialize the schema
    db.query(`
      CREATE TABLE IF NOT EXISTS relay_status (
        url TEXT PRIMARY KEY,
        online INTEGER,
        ignore INTEGER DEFAULT 0,
        parent TEXT,
        checked_at INTEGER,
        rtt INTEGER,
        network TEXT,
        retries INTEGER DEFAULT 0
      )
    `);
    
    // Mock the dbModule's db object
    try {
      delete (dbModule as any).db;
    } catch (e) {
      // Property might not exist yet or not deletable
    }
    Object.defineProperty(dbModule, "db", {
      value: db,
      writable: true,
      configurable: true,
    });
    
    // Mock the getLogger function to return a mock logger
    const mockLogger = {
      info: (message: string) => { mockLogs.push({level: "info", message}); },
      warn: (message: string) => { mockLogs.push({level: "warn", message}); },
      error: (message: string) => { mockLogs.push({level: "error", message}); },
      debug: (message: string) => { mockLogs.push({level: "debug", message}); },
      setLevel: () => {}
    };
    
    try {
      delete (loggerModule as any).getLogger;
    } catch (e) {
      // Property might not exist yet or not deletable
    }
    Object.defineProperty(loggerModule, "getLogger", {
      value: () => mockLogger,
      writable: true,
      configurable: true,
    });
  });
  
  // Cleanup after each test
  afterEach(() => {
    db.close();
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    
    // Remove the test database
    try {
      if (existsSync(TEST_DB_PATH)) {
        Deno.removeSync(TEST_DB_PATH);
      }
    } catch (error) {
      console.error(`Error removing test database: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
  
  it("should detect no duplicates in a clean database", async () => {
    // Insert some sample data without duplicates
    db.query(`INSERT INTO relay_status (url, online, checked_at, retries, network) VALUES (?, ?, ?, ?, ?)`, 
      ["wss://relay1.example.com", 1, 1678900000, 0, "clearnet"]);
    db.query(`INSERT INTO relay_status (url, online, checked_at, retries, network) VALUES (?, ?, ?, ?, ?)`, 
      ["wss://relay2.example.com", 0, 1678900000, 3, "clearnet"]);
      
    // Run the check
    await checkDatabase();
    
    // Check the logs for "No duplicate relay entries found!"
    const noDuplicatesMessage = mockLogs.find(log => 
      log.level === "info" && log.message.includes("No duplicate relay entries found"));
    
    assertEquals(noDuplicatesMessage !== undefined, true, "Should log that no duplicates were found");
  });
  
  it("should detect duplicated relay entries", async () => {
    // First we need to force SQLite to accept duplicates despite the PRIMARY KEY constraint
    
    // Insert some sample data without duplicates first
    db.query(`INSERT INTO relay_status (url, online, checked_at, retries, network) VALUES (?, ?, ?, ?, ?)`, 
      ["wss://relay1.example.com", 1, 1678900000, 0, "clearnet"]);
    
    // Now we need to simulate the corrupted state with duplicates
    // We'll do this by temporarily removing the PRIMARY KEY constraint
    db.query(`
      CREATE TABLE relay_status_temp (
        url TEXT,
        online INTEGER,
        ignore INTEGER DEFAULT 0,
        parent TEXT,
        checked_at INTEGER,
        rtt INTEGER,
        network TEXT,
        retries INTEGER DEFAULT 0
      )
    `);
    
    // Copy existing data
    db.query(`INSERT INTO relay_status_temp SELECT * FROM relay_status`);
    
    // Drop original table
    db.query(`DROP TABLE relay_status`);
    
    // Rename temp table
    db.query(`ALTER TABLE relay_status_temp RENAME TO relay_status`);
    
    // Now we can insert duplicates
    db.query(`INSERT INTO relay_status (url, online, checked_at, retries, network) VALUES (?, ?, ?, ?, ?)`, 
      ["wss://relay1.example.com", 0, 1678900100, 3, "clearnet"]);
    db.query(`INSERT INTO relay_status (url, online, checked_at, retries, network) VALUES (?, ?, ?, ?, ?)`, 
      ["wss://relay2.example.com", 1, 1678900000, 0, "clearnet"]);
    db.query(`INSERT INTO relay_status (url, online, checked_at, retries, network) VALUES (?, ?, ?, ?, ?)`, 
      ["wss://relay2.example.com", 0, -1, 0, "clearnet"]);
      
    // Run the check
    await checkDatabase();
    
    // Check the logs for duplicate relay detection
    const duplicatesFoundMessage = mockLogs.find(log => 
      log.level === "warn" && log.message.includes("URLs with duplicate entries"));
    
    assertEquals(duplicatesFoundMessage !== undefined, true, "Should log that duplicates were found");
  });
  
  it("should fix duplicated relay entries with auto method", async () => {
    // Set up the same corrupted database state as the previous test
    // First we need to force SQLite to accept duplicates despite the PRIMARY KEY constraint
    
    // Create a table without PRIMARY KEY constraint
    db.query(`
      CREATE TABLE IF NOT EXISTS relay_status_temp (
        url TEXT,
        online INTEGER,
        ignore INTEGER DEFAULT 0,
        parent TEXT,
        checked_at INTEGER,
        rtt INTEGER,
        network TEXT,
        retries INTEGER DEFAULT 0
      )
    `);
    
    // Drop original table if it exists
    db.query(`DROP TABLE IF EXISTS relay_status`);
    
    // Rename temp table
    db.query(`ALTER TABLE relay_status_temp RENAME TO relay_status`);
    
    // Insert duplicates for testing auto fix
    db.query(`INSERT INTO relay_status (url, online, checked_at, retries, network) VALUES (?, ?, ?, ?, ?)`, 
      ["wss://relay1.example.com", 1, 1678900000, 0, "clearnet"]);
    db.query(`INSERT INTO relay_status (url, online, checked_at, retries, network) VALUES (?, ?, ?, ?, ?)`, 
      ["wss://relay1.example.com", 0, 1678900100, 3, "clearnet"]);
    db.query(`INSERT INTO relay_status (url, online, checked_at, retries, network) VALUES (?, ?, ?, ?, ?)`, 
      ["wss://relay2.example.com", 1, 1678900000, 0, "clearnet"]);
    db.query(`INSERT INTO relay_status (url, online, checked_at, retries, network) VALUES (?, ?, ?, ?, ?)`, 
      ["wss://relay2.example.com", 0, -1, 0, "clearnet"]);
      
    // Run the check with auto fix
    await checkDatabase({ fix: "auto" });
    
    // Check if duplicates were fixed
    const fixedMessage = mockLogs.find(log => 
      log.level === "info" && log.message.includes("Fixed"));
    
    assertEquals(fixedMessage !== undefined, true, "Should log that duplicates were fixed");
    
    // Check how many entries remain (should be just 2 - one for each unique URL)
    const count = db.query(`SELECT COUNT(*) FROM relay_status`)[0][0];
    assertEquals(count, 2, "Should have only 2 relay entries after fixing");
    
    // Verify the correct entries were kept based on auto fix strategy
    // For relay1, it should keep the entry with checked_at=1678900100 because it's newer
    const relay1 = db.query(`SELECT * FROM relay_status WHERE url = ?`, ["wss://relay1.example.com"]);
    assertEquals(relay1[0][4], 1678900100, "Should keep the newer entry for relay1");
    
    // For relay2, it should keep the entry with checked_at=1678900000 because it's checked (not -1)
    const relay2 = db.query(`SELECT * FROM relay_status WHERE url = ?`, ["wss://relay2.example.com"]);
    assertEquals(relay2[0][4], 1678900000, "Should keep the checked entry for relay2");
  });
  
  it("should fix duplicated relay entries with backup method", async () => {
    // Set up the same corrupted database state as the previous test
    // Create a table without PRIMARY KEY constraint
    db.query(`
      CREATE TABLE IF NOT EXISTS relay_status_temp (
        url TEXT,
        online INTEGER,
        ignore INTEGER DEFAULT 0,
        parent TEXT,
        checked_at INTEGER,
        rtt INTEGER,
        network TEXT,
        retries INTEGER DEFAULT 0
      )
    `);
    
    // Drop original table if it exists
    db.query(`DROP TABLE IF EXISTS relay_status`);
    
    // Rename temp table
    db.query(`ALTER TABLE relay_status_temp RENAME TO relay_status`);
    
    // Insert duplicates for testing backup fix
    db.query(`INSERT INTO relay_status (url, online, checked_at, retries, network) VALUES (?, ?, ?, ?, ?)`, 
      ["wss://relay1.example.com", 1, 1678900000, 0, "clearnet"]);
    db.query(`INSERT INTO relay_status (url, online, checked_at, retries, network) VALUES (?, ?, ?, ?, ?)`, 
      ["wss://relay1.example.com", 0, 1678900100, 3, "clearnet"]);
      
    // Run the check with backup fix
    await checkDatabase({ fix: "backup" });
    
    // Check the backup table exists
    const tableExists = db.query(`SELECT name FROM sqlite_master WHERE type='table' AND name='relay_status_duplicates'`).length > 0;
    assertEquals(tableExists, true, "Should create a backup table");
    
    // Check that duplicates were moved to backup
    const countMain = db.query(`SELECT COUNT(*) FROM relay_status`)[0][0];
    assertEquals(countMain, 1, "Should have only 1 relay entry in main table after fixing");
    
    const countBackup = db.query(`SELECT COUNT(*) FROM relay_status_duplicates`)[0][0];
    assertEquals(countBackup, 1, "Should have 1 relay entry in backup table");
  });
}); 