import { db as dbImport, initDB as initNostrwatchDB } from "npm:@nostrwatch/db";
import { getLogger } from "../../utils/logger.ts";

const logger = getLogger("InteractiveDB");

// Track our database connection
let db = dbImport;
export { db };

// Initialize the database
export function initDB(dbPath: string, enableWAL: boolean = true): void {
  logger.info(`Initializing database at path: ${dbPath} (WAL mode: ${enableWAL ? 'enabled' : 'disabled'})`);
  
  try {
    // Close any existing connection first
    try {
      if (db) {
        // @ts-ignore - TypeScript doesn't know about close() method
        db.close();
      }
    } catch (e) {
      // Ignore errors when closing
    }
    
    // Reinitialize with the correct path
    db = initNostrwatchDB(dbPath, enableWAL);
    
    // Verify access by running a simple query
    try {
      const version = db.query("SELECT sqlite_version()")[0][0];
      logger.info(`Connected to SQLite database version ${version}`);
      
      // Check relay counts
      const relayCount = db.query(`SELECT COUNT(*) FROM relay_status`)[0][0];
      const onlineCount = db.query(`SELECT COUNT(*) FROM relay_status WHERE online = 1`)[0][0];
      const ignoredCount = db.query(`SELECT COUNT(*) FROM relay_status WHERE ignore = 1`)[0][0];
      
      logger.info(`Database contains ${relayCount} relays (${onlineCount} online, ${ignoredCount} ignored)`);
    } catch (error) {
      logger.error(`Database access check failed: ${error}`);
      throw new Error(`Failed to access database: ${error}`);
    }
  } catch (error) {
    logger.error(`Database initialization failed: ${error}`);
    throw error;
  }
}

// Cache for relay data to avoid repeated database queries
let relaysCache: any[] = [];
let ignoredRelaysCache: any[] = [];
let relayCacheTTL = 0; // Timestamp when cache expires

// Helper function to check if the cache is still valid
function isCacheValid(): boolean {
  return Date.now() < relayCacheTTL;
}

// Reset cache when needed (e.g., after toggling a relay's ignore status)
export function resetCache(): void {
  relaysCache = [];
  ignoredRelaysCache = [];
  relayCacheTTL = 0;
}

// Get relays from cache or database
export function getRelays(): any[] {
  // Use cache if available and still valid
  if (relaysCache.length > 0 && isCacheValid()) {
    return relaysCache;
  }
  
  try {
    // Get relay count first 
    const count = db.query(`SELECT COUNT(*) FROM relay_status`)[0][0] as number;
    
    // Query one field at a time to avoid entire query failure
    const urls: string[] = [];
    try {
      const urlRows = db.query(`SELECT url FROM relay_status ORDER BY url`);
      for (const row of urlRows) {
        urls.push(row[0] as string);
      }
    } catch (e) {
      logger.error(`Error retrieving relay URLs: ${e}`);
    }
    
    // If we couldn't get any URLs, return empty array
    if (urls.length === 0) {
      return [];
    }
    
    // Now build complete objects by querying individual relays
    const results: any[] = [];
    let errorsCount = 0;
    
    for (const url of urls) {
      try {
        // Get relay details with proper escaping to handle URLs with quotes
        const details = db.query(`SELECT online, ignore, parent, checked_at, rtt, network, retries 
                                FROM relay_status WHERE url = ?`, [url]);
        
        if (details.length > 0) {
          const [online, ignore, parent, checked_at, rtt, network, retries] = details[0];
          results.push({
            url,
            online: online as number,
            ignore: ignore as number,
            parent: parent as string,
            checked_at: checked_at as number, 
            rtt: rtt as number,
            network: network as string,
            retries: retries as number
          });
        }
      } catch (e) {
        // Only log the error count, not each individual error
        errorsCount++;
      }
    }
    
    // Log a summary instead of individual messages
    if (errorsCount > 0) {
      logger.error(`Encountered ${errorsCount} errors while retrieving relay details`);
    }
    
    // Update cache and set TTL (cache valid for 10 seconds)
    relaysCache = results;
    relayCacheTTL = Date.now() + 10000;
    
    return results;
  } catch (error) {
    logger.error(`Error getting relays: ${error}`);
    return [];
  }
}

// Get ignored relays from cache or database
export function getIgnoredRelays(): any[] {
  // Use cache if available and still valid
  if (ignoredRelaysCache.length > 0 && isCacheValid()) {
    return ignoredRelaysCache;
  }
  
  try {
    // First just get ignored relay URLs - this matches how getRelays() works
    const ignoredUrls: string[] = [];
    try {
      // Get count for debugging
      const ignoredCount = db.query(`SELECT COUNT(*) FROM relay_status WHERE ignore = 1`)[0][0] as number;
      logger.debug(`Database reports ${ignoredCount} ignored relays exist`);
      
      // Get URLs only first - this is the key change to match getRelays()
      const urlRows = db.query(`SELECT url FROM relay_status WHERE ignore = 1 ORDER BY url`);
      
      // If that query returned no results but there should be ignored relays, try different approach
      if (urlRows.length === 0 && ignoredCount > 0) {
        logger.debug("First query failed, trying alternate query");
        const altRows = db.query(`SELECT url FROM relay_status WHERE ignore != 0 ORDER BY url`);
        for (const row of altRows) {
          ignoredUrls.push(row[0] as string);
        }
      } else {
        // Process the original results
        for (const row of urlRows) {
          ignoredUrls.push(row[0] as string);
        }
      }
      
      logger.debug(`Found ${ignoredUrls.length} ignored relay URLs`);
    } catch (e) {
      logger.error(`Error retrieving ignored relay URLs: ${e}`);
    }
    
    // If we still couldn't get any URLs, try one more approach - direct integer comparison
    if (ignoredUrls.length === 0) {
      try {
        logger.debug("Trying integer cast query for URLs");
        const castRows = db.query(`SELECT url FROM relay_status WHERE CAST(ignore AS INTEGER) = 1 ORDER BY url`);
        for (const row of castRows) {
          ignoredUrls.push(row[0] as string);
        }
        logger.debug(`Found ${ignoredUrls.length} ignored relay URLs with CAST approach`);
      } catch (e) {
        logger.error(`Error with CAST query: ${e}`);
      }
      
      // If CAST approach failed, try a completely different approach using all possible truthy values
      if (ignoredUrls.length === 0) {
        try {
          logger.debug("Trying broad match approach for ignored relays");
          const truthyRows = db.query(`
            SELECT url FROM relay_status 
            WHERE ignore IN (1, 'true', 't', 'yes', 'y') 
               OR ignore = '1'
               OR ignore LIKE 'true'
               OR ignore LIKE 't'
            ORDER BY url
          `);
          for (const row of truthyRows) {
            ignoredUrls.push(row[0] as string);
          }
          logger.debug(`Found ${ignoredUrls.length} ignored relay URLs with broad match approach`);
        } catch (e) {
          logger.error(`Error with broad match query: ${e}`);
        }
        
        // As a last resort, try to get all rows and check in memory
        if (ignoredUrls.length === 0) {
          try {
            logger.warn("All SQL approaches failed, trying to scan all relay records in memory");
            const allRows = db.query(`SELECT url, ignore FROM relay_status`);
            logger.debug(`Retrieved ${allRows.length} total rows to scan`);
            
            // Log the first 10 ignore values to see what we're dealing with
            for (let i = 0; i < Math.min(10, allRows.length); i++) {
              const ignoreValue = allRows[i][1];
              logger.debug(`Row ${i+1}: ignore=${ignoreValue} (${typeof ignoreValue})`);
            }
            
            // Filter in memory with maximum flexibility
            for (const row of allRows) {
              const url = row[0] as string;
              const ignoreValue = row[1];
              
              // Check for ANY possible truthy representation
              const ignoreString = String(ignoreValue).toLowerCase();
              if (
                ignoreValue === 1 || 
                ignoreValue === true || 
                ignoreValue === "1" || 
                ignoreValue === "true" || 
                ignoreValue === "t" || 
                ignoreValue === "yes" || 
                ignoreValue === "y" ||
                ignoreString === "1" ||
                ignoreString === "true" ||
                ignoreString === "t" ||
                ignoreString === "yes" ||
                ignoreString === "y"
              ) {
                ignoredUrls.push(url);
              }
            }
            
            logger.debug(`Found ${ignoredUrls.length} potentially ignored relays by memory scan`);
          } catch (e) {
            logger.error(`Error scanning in memory: ${e}`);
          }
        }
      }
    }
    
    // If we still couldn't get any URLs, return empty array
    if (ignoredUrls.length === 0) {
      logger.warn("Could not find any ignored relay URLs with any query");
      return [];
    }
    
    // Now build complete objects by querying individual relays - EXACTLY like getRelays()
    const results: any[] = [];
    let errorsCount = 0;
    
    for (const url of ignoredUrls) {
      try {
        // Get relay details one by one with proper escaping
        const details = db.query(`SELECT online, ignore, parent, checked_at, rtt, network, retries 
                                FROM relay_status WHERE url = ?`, [url]);
        
        if (details.length > 0) {
          const [online, ignore, parent, checked_at, rtt, network, retries] = details[0];
          
          // Add this relay to our results
          results.push({
            url,
            online: online as number,
            ignore: ignore as number, // Keep original value
            parent: parent as string,
            checked_at: checked_at as number, 
            rtt: rtt as number,
            network: network as string,
            retries: retries as number
          });
        }
      } catch (e) {
        // Only count errors, don't log each one
        errorsCount++;
      }
    }
    
    // Log summary of errors
    if (errorsCount > 0) {
      logger.error(`Encountered ${errorsCount} errors while retrieving ignored relay details`);
    }
    
    // Update cache and set TTL (cache valid for 10 seconds)
    ignoredRelaysCache = results;
    relayCacheTTL = Date.now() + 10000;
    
    logger.info(`Successfully loaded ${results.length} ignored relays`);
    
    if (results.length > 0) {
      // Show a sample of what we found for debugging
      const sample = results.slice(0, Math.min(3, results.length));
      logger.debug(`Sample ignored relays: ${sample.map(r => r.url).join(', ')}`);
    }
    
    return results;
  } catch (error) {
    logger.error(`Error getting ignored relays: ${error}`);
    return [];
  }
}

// Get relay counts
export function getRelayCounts(): { total: number; online: number; offline: number; ignored: number } {
  try {
    // Get the counts with detailed debugging
    const total = db.query(`SELECT COUNT(*) FROM relay_status`)[0][0] as number;
    logger.debug(`Found ${total} total relays`);
    
    const online = db.query(`SELECT COUNT(*) FROM relay_status WHERE online = 1`)[0][0] as number;
    logger.debug(`Found ${online} online relays`);
    
    const offline = db.query(`SELECT COUNT(*) FROM relay_status WHERE online = 0`)[0][0] as number;
    logger.debug(`Found ${offline} offline relays`);
    
    const ignored = db.query(`SELECT COUNT(*) FROM relay_status WHERE CAST(ignore AS INTEGER) = 1`)[0][0] as number;
    logger.debug(`Found ${ignored} ignored relays with explicit casting`);
    
    // Do additional validation queries
    const ignoredNocast = db.query(`SELECT COUNT(*) FROM relay_status WHERE ignore = 1`)[0][0] as number;
    logger.debug(`Non-cast query found ${ignoredNocast} ignored relays`);
    
    // Get a sample of the ignored relay URLs to verify
    const ignoredUrls = db.query(`SELECT url FROM relay_status WHERE CAST(ignore AS INTEGER) = 1 LIMIT 10`);
    logger.debug(`Query for ignored relay URLs found ${ignoredUrls.length} results (sampled 10)`);
    
    if (ignoredUrls.length > 0) {
      const sampleUrls = ignoredUrls.map(row => row[0]).join(', ');
      logger.debug(`Sample ignored relay URLs: ${sampleUrls}`);
    }
    
    // Return the counts consistently using the cast version
    return { total, online, offline, ignored };
  } catch (error) {
    logger.error(`Error getting relay counts: ${error}`);
    return { total: 0, online: 0, offline: 0, ignored: 0 };
  }
}

// Toggle relay ignore status - ensure we use INTEGER values in SQLite
export function toggleRelayIgnore(url: string, ignore: boolean): void {
  try {
    // Get current value first for logging
    const currentValue = db.query(`SELECT ignore FROM relay_status WHERE url = ?`, [url]);
    logger.info(`Toggling relay ${url} from ${currentValue[0]?.[0] ?? 'unknown'} to ${ignore ? '1' : '0'}`);
    
    // Use INTEGER value for SQLite - this is critical for proper storage
    const ignoreValue = ignore ? 1 : 0;
    
    // Update using multiple approaches to ensure it works
    try {
      // First attempt with explicit CAST
      db.query(
        `UPDATE relay_status SET ignore = CAST(? AS INTEGER) WHERE url = ?`,
        [ignoreValue, url]
      );
      
      // Verify the update worked
      const newValue = db.query(`SELECT ignore FROM relay_status WHERE url = ?`, [url]);
      if (newValue.length > 0) {
        logger.info(`Updated relay ${url} ignore status to: ${newValue[0][0]}`);
      } else {
        throw new Error("Verification failed - could not retrieve updated value");
      }
    } catch (firstError) {
      // Log the error but try alternate approach
      logger.error(`First update approach failed: ${firstError}`);
      
      // Try a simpler approach without parameter binding
      try {
        db.query(`UPDATE relay_status SET ignore = ${ignoreValue} WHERE url = ?`, [url]);
        logger.info(`Updated relay ${url} ignore status with alternate approach`);
      } catch (secondError) {
        // Both approaches failed, log the error and rethrow
        logger.error(`Both update approaches failed: ${secondError}`);
        throw secondError;
      }
    }
    
    // Reset the cache since we modified relay data
    resetCache();
  } catch (error) {
    logger.error(`Error toggling relay ignore status: ${error}`);
    throw error;
  }
}

// Delete relay
export function deleteRelay(url: string): void {
  try {
    db.query(`DELETE FROM relay_status WHERE url = ?`, [url]);
    
    // Reset the cache since we modified relay data
    resetCache();
  } catch (error) {
    logger.error(`Error deleting relay: ${error}`);
    throw error;
  }
}

// Create a sample ignored relay for testing
export function createSampleIgnoredRelay(): boolean {
  try {
    // Find a relay to mark as ignored
    const relay = db.query(`SELECT url FROM relay_status WHERE CAST(ignore AS INTEGER) = 0 LIMIT 1`);
    if (relay.length === 0) {
      logger.error("No relays found to mark as ignored for testing");
      return false;
    }

    const url = relay[0][0] as string;
    logger.info(`Marking relay ${url} as ignored for testing`);
    
    // Try multiple approaches to update the ignore status
    try {
      // Direct update with INTEGER casting
      db.query(`UPDATE relay_status SET ignore = CAST(1 AS INTEGER) WHERE url = ?`, [url]);
      
      // Verify the update
      const check = db.query(`SELECT ignore FROM relay_status WHERE url = ?`, [url]);
      if (check.length > 0) {
        const ignoreValue = check[0][0];
        logger.info(`Updated relay ${url} ignore value to ${ignoreValue}`);
        
        // Check if the value is what we expect
        if (ignoreValue === 1 || ignoreValue === true || ignoreValue === "1") {
          resetCache();
          return true;
        } else {
          // The value didn't update properly, try another approach
          logger.warn(`Update didn't set the proper value (got ${ignoreValue}), trying alternate approach`);
          throw new Error("Unexpected ignore value");
        }
      } else {
        throw new Error("Verification query returned no results");
      }
    } catch (firstError) {
      // Try a more direct approach without binding
      logger.warn(`First approach failed: ${firstError}, trying direct SQL`);
      
      try {
        // Raw SQL approach
        db.query(`UPDATE relay_status SET ignore = 1 WHERE url = '${url.replace(/'/g, "''")}'`);
        
        // Verify the update
        const check = db.query(`SELECT ignore FROM relay_status WHERE url = ?`, [url]);
        if (check.length > 0) {
          const ignoreValue = check[0][0];
          logger.info(`Updated relay ${url} ignore value to ${ignoreValue} with direct SQL`);
          resetCache();
          return true;
        } else {
          return false;
        }
      } catch (secondError) {
        logger.error(`Both update approaches failed: ${secondError}`);
        return false;
      }
    }
  } catch (error) {
    logger.error(`Failed to create sample ignored relay: ${error}`);
    return false;
  }
}

// Debug and repair relay ignore values
export function debugAndRepairIgnoredRelays(): { fixed: number, total: number } {
  try {
    let fixedCount = 0;
    
    // First get a count of potentially ignored relays using different queries
    const count1 = db.query(`SELECT COUNT(*) FROM relay_status WHERE ignore = 1`)[0][0] as number;
    const count2 = db.query(`SELECT COUNT(*) FROM relay_status WHERE ignore != 0`)[0][0] as number;
    const count3 = db.query(`SELECT COUNT(*) FROM relay_status WHERE CAST(ignore AS INTEGER) = 1`)[0][0] as number;
    
    logger.info(`Ignore counts - standard: ${count1}, non-zero: ${count2}, cast: ${count3}`);
    
    // First check - Is there a mismatch between SQL and TypeScript?
    const mismatch = count1 !== count3;
    logger.info(`Type mismatch detected: ${mismatch ? 'YES' : 'NO'}`);
    
    // Check for blob encoding or string issues
    try {
      // Query and log actual column type
      const columnType = db.query(`PRAGMA table_info(relay_status)`).filter(row => row[1] === 'ignore')[0][2];
      logger.info(`Column 'ignore' defined as: ${columnType}`);
    } catch (e) {
      logger.error(`Error checking column type: ${e}`);
    }
    
    // Log database stats first before repair
    logger.info("DATABASE STATS BEFORE REPAIR:");
    try {
      // Count total rows
      const totalRows = db.query(`SELECT COUNT(*) FROM relay_status`)[0][0] as number;
      logger.info(`Total rows: ${totalRows}`);
      
      // Get a sample of all ignore values to see what's in there
      const sampleRows = db.query(`SELECT url, ignore FROM relay_status LIMIT 20`);
      logger.info("Sample of ignore values:");
      for (const [url, ignoreValue] of sampleRows) {
        logger.info(`  ${url}: ${ignoreValue} (${typeof ignoreValue})`);
      }
    } catch (e) {
      logger.error(`Error getting database stats: ${e}`);
    }
    
    // Get ALL potential ignored relays using a VERY broad query
    const potentialIgnored = db.query(`
      SELECT url, ignore FROM relay_status 
      WHERE ignore != 0 
         OR ignore IS NOT 0
         OR ignore = 'true' 
         OR ignore = 'yes' 
         OR ignore = 't' 
         OR ignore = 'y'
         OR ignore = '1'
         OR ignore LIKE 'true'
         OR ignore LIKE 't'
         OR ignore LIKE 'y'
         OR ignore LIKE '1'
    `);
    
    logger.info(`Found ${potentialIgnored.length} potentially ignored relays to check`);
    
    // FIRST REPAIR: Go through each one and fix the value
    for (const row of potentialIgnored) {
      const url = row[0] as string;
      const currentValue = row[1];
      
      // For debugging, log what we found
      logger.debug(`Relay ${url} has ignore value: ${currentValue} (${typeof currentValue})`);
      
      // Fix ANY value to exactly 1
      logger.info(`Setting ignore value for ${url} to exactly 1 (INTEGER)`);
      
      try {
        // Use multiple update methods to ensure it works
        try {
          // First try with explicit INTEGER type
          db.query(`UPDATE relay_status SET ignore = CAST(1 AS INTEGER) WHERE url = ?`, [url]);
        } catch (e1) {
          logger.warn(`First repair method failed for ${url}: ${e1}`);
          
          // Try direct integer
          try {
            db.query(`UPDATE relay_status SET ignore = 1 WHERE url = ?`, [url]);
          } catch (e2) {
            logger.warn(`Second repair method failed for ${url}: ${e2}`);
            
            // Last resort - direct SQL
            db.query(`UPDATE relay_status SET ignore = 1 WHERE url = '${url.replace(/'/g, "''")}'`);
          }
        }
        
        // Verify the fix
        const check = db.query(`SELECT ignore FROM relay_status WHERE url = ?`, [url])[0][0];
        logger.debug(`Updated value for ${url} is now ${check} (${typeof check})`);
        
        fixedCount++;
      } catch (e) {
        logger.error(`Failed to update ${url}: ${e}`);
      }
    }
    
    // SECOND REPAIR: Also ensure all non-ignored relays have exactly 0
    logger.info("Repairing non-ignored relays");
    try {
      // Update all non-1 values to be exactly 0
      const updateCount = db.query(`
        UPDATE relay_status 
        SET ignore = CAST(0 AS INTEGER)
        WHERE ignore IS NOT NULL 
          AND CAST(ignore AS INTEGER) != 1
      `);
      
      logger.info(`Set ${updateCount} non-ignored relays to exactly 0`);
    } catch (e) {
      logger.error(`Error repairing non-ignored relays: ${e}`);
    }
    
    // Verify final counts after repair
    try {
      const finalIgnored = db.query(`SELECT COUNT(*) FROM relay_status WHERE CAST(ignore AS INTEGER) = 1`)[0][0] as number;
      const finalNonIgnored = db.query(`SELECT COUNT(*) FROM relay_status WHERE CAST(ignore AS INTEGER) = 0`)[0][0] as number;
      const finalTotal = db.query(`SELECT COUNT(*) FROM relay_status`)[0][0] as number;
      
      logger.info(`AFTER REPAIR: ${finalIgnored} ignored, ${finalNonIgnored} non-ignored, ${finalTotal} total relays`);
      logger.info(`Database validation: ${finalIgnored + finalNonIgnored} accounted for vs ${finalTotal} total`);
    } catch (e) {
      logger.error(`Error verifying final counts: ${e}`);
    }
    
    // Reset cache after all these changes
    resetCache();
    
    return { fixed: fixedCount, total: potentialIgnored.length };
  } catch (error) {
    logger.error(`Error debugging/repairing relays: ${error}`);
    return { fixed: 0, total: 0 };
  }
} 