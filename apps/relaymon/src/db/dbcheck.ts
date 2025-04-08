import { db, initDB } from "./db.ts";
import { getLogger } from "../utils/logger.ts";
import { loadConfig } from "../config/config.ts";
import { parse } from "https://deno.land/std/flags/mod.ts";

const logger = getLogger("DBCheck");

interface RelayRecord {
  rowid: number;
  url: string;
  checked_at: number;
  retries: number;
  online: number;
  ignore: number;
  network: string;
}

interface DuplicateGroup {
  url: string;
  records: RelayRecord[];
}

/**
 * Find duplicate relay entries in the database
 */
function findDuplicateRelays(): DuplicateGroup[] {
  logger.info("Checking for duplicate relay entries in database...");
  
  // First, get all URLs and count occurrences
  const urlCounts = db.query(`
    SELECT url, COUNT(*) as count 
    FROM relay_status 
    GROUP BY url 
    HAVING count > 1
  `);
  
  if (urlCounts.length === 0) {
    logger.info("No duplicate relay entries found!");
    return [];
  }
  
  logger.warn(`Found ${urlCounts.length} URLs with duplicate entries!`);
  
  // For each URL with duplicates, get the full records
  const duplicateGroups: DuplicateGroup[] = [];
  
  for (const [url, count] of urlCounts) {
    const records = db.query(`
      SELECT rowid, url, checked_at, retries, online, ignore, network
      FROM relay_status
      WHERE url = ?
      ORDER BY rowid
    `, [url as string]);
    
    const relayRecords: RelayRecord[] = records.map(row => ({
      rowid: row[0] as number,
      url: row[1] as string,
      checked_at: row[2] as number,
      retries: row[3] as number,
      online: row[4] as number,
      ignore: row[5] as number,
      network: row[6] as string
    }));
    
    duplicateGroups.push({
      url: url as string,
      records: relayRecords
    });
  }
  
  return duplicateGroups;
}

/**
 * Display duplicate relay groups with details
 */
function displayDuplicateGroups(groups: DuplicateGroup[]): void {
  if (groups.length === 0) return;
  
  console.log("\n=== DUPLICATE RELAY ENTRIES ===");
  
  for (const [index, group] of groups.entries()) {
    console.log(`\n[${index + 1}] URL: ${group.url}`);
    console.log("    Records:");
    
    for (const [recordIndex, record] of group.records.entries()) {
      const checkedAtStr = record.checked_at === -1 
        ? "never" 
        : new Date(record.checked_at * 1000).toISOString();
      
      console.log(`    ${String.fromCharCode(97 + recordIndex)}) rowid: ${record.rowid}, ` +
        `checked_at: ${checkedAtStr}, retries: ${record.retries}, ` +
        `online: ${record.online === 1 ? "yes" : "no"}, ` +
        `ignore: ${record.ignore === 1 ? "yes" : "no"}, ` +
        `network: ${record.network}`);
    }
  }
  
  console.log("\n==================================");
}

/**
 * Check if the database is corrupted - basic checks
 */
function checkDatabaseIntegrity(): boolean {
  try {
    const integrityCheck = db.query("PRAGMA integrity_check");
    if (integrityCheck.length === 1 && integrityCheck[0][0] === "ok") {
      logger.info("Database integrity check passed.");
      return true;
    } else {
      logger.error("Database integrity check failed!");
      console.log("\n=== INTEGRITY CHECK RESULTS ===");
      for (const row of integrityCheck) {
        console.log(row[0]);
      }
      console.log("===============================\n");
      return false;
    }
  } catch (error) {
    logger.error(`Error running integrity check: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

/**
 * Fix duplicate relay entries using a simple strategy:
 * - For each duplicate group, keep the entry with the most information
 */
async function fixDuplicateRelays(groups: DuplicateGroup[], fixMethod: string): Promise<void> {
  if (groups.length === 0) return;
  
  let fixedCount = 0;
  
  for (const group of groups) {
    try {
      if (fixMethod === "auto") {
        // Auto-fix strategy:
        // 1. If one record has checked_at=-1 (never checked) and another has been checked, delete the unchecked one
        // 2. If multiple records have been checked, keep the one with the highest rowid (newest)
        
        let keepRecord: RelayRecord | null = null;
        const deleteRowIds: number[] = [];
        
        // First check if we have both checked and unchecked records
        const checkedRecords = group.records.filter(r => r.checked_at !== -1);
        const uncheckedRecords = group.records.filter(r => r.checked_at === -1);
        
        if (checkedRecords.length > 0 && uncheckedRecords.length > 0) {
          // Keep the record with the highest rowid from the checked records
          keepRecord = checkedRecords.reduce((max, record) => 
            record.rowid > max.rowid ? record : max, checkedRecords[0]);
          
          // All unchecked records should be deleted
          deleteRowIds.push(...uncheckedRecords.map(r => r.rowid));
          
          // Add all checked records except the one we're keeping
          deleteRowIds.push(...checkedRecords
            .filter(r => r.rowid !== (keepRecord?.rowid || 0))
            .map(r => r.rowid));
        } else {
          // Either all records are checked or all are unchecked
          // Keep the record with the highest rowid
          keepRecord = group.records.reduce((max, record) => 
            record.rowid > max.rowid ? record : max, group.records[0]);
          
          // Delete all other records
          deleteRowIds.push(...group.records
            .filter(r => r.rowid !== (keepRecord?.rowid || 0))
            .map(r => r.rowid));
        }
        
        if (deleteRowIds.length > 0 && keepRecord) {
          const placeholders = deleteRowIds.map(() => "?").join(",");
          db.query(`DELETE FROM relay_status WHERE rowid IN (${placeholders})`, deleteRowIds);
          logger.info(`Fixed duplicates for ${group.url}: Kept rowid ${keepRecord.rowid}, deleted ${deleteRowIds.join(", ")}`);
          fixedCount++;
        }
      } else if (fixMethod === "backup") {
        // Backup strategy: 
        // Create a backup table, move all duplicates there, then keep just the newest in the main table
        
        // Create backup table if it doesn't exist
        db.query(`
          CREATE TABLE IF NOT EXISTS relay_status_duplicates (
            rowid INTEGER PRIMARY KEY,
            url TEXT,
            online INTEGER,
            ignore INTEGER DEFAULT 0,
            parent TEXT,
            checked_at INTEGER,
            rtt INTEGER,
            network TEXT,
            retries INTEGER DEFAULT 0,
            original_rowid INTEGER
          )
        `);
        
        // Find the newest record (highest rowid)
        const keepRecord = group.records.reduce((max, record) => 
          record.rowid > max.rowid ? record : max, group.records[0]);
        
        // Move all other records to the backup table
        for (const record of group.records) {
          if (record.rowid !== keepRecord.rowid) {
            // Insert into backup table
            db.query(`
              INSERT INTO relay_status_duplicates 
              SELECT *, ? FROM relay_status WHERE rowid = ?
            `, [record.rowid, record.rowid]);
            
            // Delete from main table
            db.query(`DELETE FROM relay_status WHERE rowid = ?`, [record.rowid]);
          }
        }
        
        logger.info(`Fixed duplicates for ${group.url}: Kept rowid ${keepRecord.rowid}, moved ${group.records.length - 1} records to backup`);
        fixedCount++;
      }
    } catch (error) {
      logger.error(`Error fixing duplicates for ${group.url}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  logger.info(`Fixed ${fixedCount} duplicate URL entries.`);
}

/**
 * Check for specific problematic relay URLs and fix them
 */
export async function checkSpecificProblems(): Promise<void> {
  logger.info("Checking for specific problematic relay URLs...");
  
  // Check for the problematic 100.100.* IP addresses
  const problematicUrls = db.query(`
    SELECT url, COUNT(*) as count 
    FROM relay_status 
    WHERE url LIKE 'ws://100.100.%'
    GROUP BY url
    HAVING count > 1
  `);
  
  if (problematicUrls.length === 0) {
    logger.info("No specific problematic relay URLs found.");
    return;
  }
  
  logger.warn(`Found ${problematicUrls.length} problematic relay URLs with duplicate entries!`);
  
  // For each problematic URL, get all rows and fix
  for (const [url, count] of problematicUrls) {
    const records = db.query(`
      SELECT rowid, url, checked_at, retries, online, ignore, network
      FROM relay_status
      WHERE url = ?
      ORDER BY rowid
    `, [url]);
    
    const relayRecords: RelayRecord[] = records.map(row => ({
      rowid: row[0] as number,
      url: row[1] as string,
      checked_at: row[2] as number,
      retries: row[3] as number,
      online: row[4] as number,
      ignore: row[5] as number,
      network: row[6] as string
    }));
    
    // Display the problematic records
    logger.info(`Problematic URL: ${url} has ${relayRecords.length} entries:`);
    for (const record of relayRecords) {
      const checkedAtStr = record.checked_at === -1 
        ? "never" 
        : new Date(record.checked_at * 1000).toISOString();
      logger.info(`  rowid: ${record.rowid}, checked_at: ${checkedAtStr}, retries: ${record.retries}, online: ${record.online === 1 ? "yes" : "no"}`);
    }
    
    // Auto-fix strategy for these specific problematic URLs
    // 1. If one record has checked_at=-1 (never checked) and another has been checked, delete the unchecked one
    // 2. If multiple records have been checked, keep the one with the highest rowid (newest)
    
    // First check if we have both checked and unchecked records
    const checkedRecords = relayRecords.filter(r => r.checked_at !== -1);
    const uncheckedRecords = relayRecords.filter(r => r.checked_at === -1);
    
    const deleteRowIds: number[] = [];
    let keepRecord: RelayRecord | null = null;
    
    if (checkedRecords.length > 0 && uncheckedRecords.length > 0) {
      // Keep the record with the highest rowid from the checked records
      keepRecord = checkedRecords.reduce((max, record) => 
        record.rowid > max.rowid ? record : max, checkedRecords[0]);
      
      // All unchecked records should be deleted
      deleteRowIds.push(...uncheckedRecords.map(r => r.rowid));
      
      // Add all checked records except the one we're keeping
      deleteRowIds.push(...checkedRecords
        .filter(r => r.rowid !== (keepRecord?.rowid || 0))
        .map(r => r.rowid));
    } else {
      // Either all records are checked or all are unchecked
      // Keep the record with the highest rowid
      keepRecord = relayRecords.reduce((max, record) => 
        record.rowid > max.rowid ? record : max, relayRecords[0]);
      
      // Delete all other records
      deleteRowIds.push(...relayRecords
        .filter(r => r.rowid !== (keepRecord?.rowid || 0))
        .map(r => r.rowid));
    }
    
    if (deleteRowIds.length > 0 && keepRecord) {
      logger.info(`Fixing ${url}: Keeping rowid ${keepRecord.rowid}, deleting rowids: ${deleteRowIds.join(", ")}`);
      
      // Backup the records we're going to delete
      db.query(`
        CREATE TABLE IF NOT EXISTS relay_status_duplicates (
          rowid INTEGER PRIMARY KEY,
          url TEXT,
          online INTEGER,
          ignore INTEGER DEFAULT 0,
          parent TEXT,
          checked_at INTEGER,
          rtt INTEGER,
          network TEXT,
          retries INTEGER DEFAULT 0,
          original_rowid INTEGER
        )
      `);
      
      // Move records to backup before deleting
      for (const rowid of deleteRowIds) {
        try {
          // Insert into backup table - using string concatenation to avoid parameter typing issues
          db.query(
            `INSERT INTO relay_status_duplicates SELECT *, ${rowid} FROM relay_status WHERE rowid = ${rowid}`
          );
        } catch (error) {
          logger.error(`Error backing up record ${rowid}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      
      // Delete the duplicate records
      const placeholders = deleteRowIds.map(() => "?").join(",");
      db.query(`DELETE FROM relay_status WHERE rowid IN (${placeholders})`, deleteRowIds);
      
      logger.info(`Successfully fixed ${url}`);
    } else {
      logger.warn(`No action taken for ${url}`);
    }
  }
  
  logger.info("Finished checking specific problematic relay URLs.");
}

/**
 * Main database check function
 */
export async function checkDatabase(options: { fix?: string } = {}): Promise<void> {
  logger.info("Starting database check...");
  
  // First check integrity
  const integrityOk = checkDatabaseIntegrity();
  if (!integrityOk) {
    if (!options.fix) {
      logger.warn("Database integrity issues detected. Run with --fix to attempt repairs.");
    } else {
      logger.warn("Database integrity issues detected. Will try to fix specific issues...");
    }
  }
  
  // Check for duplicate relays
  const duplicateGroups = findDuplicateRelays();
  if (duplicateGroups.length > 0) {
    displayDuplicateGroups(duplicateGroups);
    
    if (options.fix) {
      logger.info(`Fixing duplicate entries using '${options.fix}' method...`);
      await fixDuplicateRelays(duplicateGroups, options.fix);
      
      // Re-check after fixing
      const remainingDuplicates = findDuplicateRelays();
      if (remainingDuplicates.length > 0) {
        logger.warn(`${remainingDuplicates.length} duplicate groups remain after fix attempt.`);
        displayDuplicateGroups(remainingDuplicates);
      } else {
        logger.info("All duplicate entries have been fixed!");
      }
    } else {
      logger.info("Run with --fix=auto to automatically fix duplicates");
      logger.info("Run with --fix=backup to move duplicates to a backup table");
    }
  }
  
  // Check for specific problematic relay URLs
  if (options.fix) {
    await checkSpecificProblems();
  }
  
  logger.info("Database check complete!");
}

/**
 * CLI entry point
 */
async function main() {
  try {
    const args = parse(Deno.args, {
      string: ["fix"],
      boolean: ["help"],
      alias: { h: "help", f: "fix" },
    });
    
    if (args.help) {
      console.log("RelayMon Database Check Utility");
      console.log("------------------------------");
      console.log("Usage: ./relaymon dbcheck [options]");
      console.log("");
      console.log("Options:");
      console.log("  --help, -h       Show this help message");
      console.log("  --fix=auto       Automatically fix issues by keeping most complete records");
      console.log("  --fix=backup     Fix issues by moving duplicates to a backup table");
      Deno.exit(0);
    }
    
    // Load config to get the DB path
    const config = await loadConfig("./config.yaml");
    if (config.db?.path) {
      initDB(config.db.path, config.db.enableWAL || true);
    } else {
      logger.warn("No database path configured, using default");
      initDB();
    }
    
    // Run the check
    await checkDatabase({ fix: args.fix });
    
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : String(error));
    Deno.exit(1);
  }
}

// Only run as main module
if (import.meta.main) {
  await main();
} 