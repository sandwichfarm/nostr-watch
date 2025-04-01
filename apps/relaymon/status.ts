import { db } from "./db.ts";
import { getLogger, LogLevel } from "./logger.ts";
import chalk from "npm:chalk";
import { getExpiredRelays } from "./db.ts";
import { RetryManager } from "./retryManager.ts";
import { loadConfig } from "./config.ts";

const logger = getLogger("Status");

// Simple counter for checks
let checksCounter = 0;

// Session statistics (reset when the program restarts)
const sessionStats = {
  checksTotal: 0,
  checksErrors: 0,
  wentOffline: new Set<string>(), // Track unique relays that went offline
  newRelaysFound: 0
};

// Update session stats when a relay is checked
export function updateSessionStats(relay: string, wasSuccessful: boolean, wasOnline: boolean, wentOffline: boolean): void {
  sessionStats.checksTotal++;
  
  if (!wasSuccessful) {
    sessionStats.checksErrors++;
  }
  
  if (wentOffline) {
    sessionStats.wentOffline.add(relay);
  }
}

// Update the count of new relays found
export function incrementNewRelaysFound(count: number = 1): void {
  sessionStats.newRelaysFound += count;
}

// Statistics to track
interface StatusStats {
  // Queue stats
  active: number;
  waiting: number;
  failed: number;
  paused: number;
  totalQueue: number;
  
  // Cache stats
  online: number;
  onlineExpired: number;
  offline: number;
  expired: number;
  unchecked: number;
  total: number;
  ignored: number;
  parents: number;
  children: number;
  
  // Session stats (since program start)
  checksTotal: number;
  checksErrors: number;
  wentOfflineCount: number;
  newRelaysFound: number;
  queueSize: number;
}

/**
 * Get current statistics from the database and queue
 */
export function getStats(queueManager: any): StatusStats {
  // Get queue stats from queueManager
  const queueStats = {
    active: queueManager.checkQueue.pending || 0,
    waiting: queueManager.checkQueue.size || 0,
    failed: queueManager.checkQueue.sizeFailed || 0,
    paused: queueManager.checkQueue.isPaused ? 1 : 0,
    totalQueue: (queueManager.checkQueue.pending || 0) + (queueManager.checkQueue.size || 0)
  };

  // Get database stats
  const now = Math.round(Date.now()/1000);
  
  // Use the SAME config that the daemon uses
  const config = queueManager.config;
  
  // Get expiry time from config
  let expiryTime = 60; // Default fallback
  if (config?.relaymon?.checks?.options?.expires) {
    // Get seconds value
    expiryTime = Math.round(config.relaymon.checks.options.expires/1000);
    logger.debug(`Using config expiry time: ${expiryTime}s`);
  } else {
    logger.debug(`Using fallback expiry time: ${expiryTime}s`);
  }
  
  // Get networks from config
  const networks = ["clearnet"]; // Default fallback
  if (config?.relaymon?.networks && Array.isArray(config.relaymon.networks)) {
    networks.length = 0; // Clear default
    networks.push(...config.relaymon.networks);
    logger.debug(`Using config networks: ${JSON.stringify(networks)}`);
  } else {
    logger.debug(`Using fallback networks: ${JSON.stringify(networks)}`);
  }

  // Initialize the RetryManager to match the worker's behavior
  // Provide a default configuration if none exists to prevent "Cannot read property 'delay' of undefined" errors
  const defaultRetryConfig = [{ max: 999, delay: 60000 }]; // Default: retry after 1 minute
  let retryConfig = defaultRetryConfig;
  
  if (config?.relaymon?.retry?.expiry && Array.isArray(config.relaymon.retry.expiry) && config.relaymon.retry.expiry.length > 0) {
    retryConfig = config.relaymon.retry.expiry;
    logger.debug(`Using retry config from configuration: ${JSON.stringify(retryConfig)}`);
  } else {
    logger.debug(`Using fallback retry config: ${JSON.stringify(retryConfig)}`);
  }
  
  const retryManager = new RetryManager(retryConfig);

  // Query all necessary counts in one go to avoid multiple DB reads
  const dbStats = {
    online: 0,
    onlineExpired: 0,
    offline: 0,
    expired: 0,
    unchecked: 0,
    total: 0,
    ignored: 0,
    parents: 0,
    children: 0
  };

  // Get total count
  dbStats.total = db.query("SELECT COUNT(*) FROM relay_status")[0][0] as number;
  
  // Get online count
  dbStats.online = db.query("SELECT COUNT(*) FROM relay_status WHERE online = 1")[0][0] as number;
  
  // Get offline count
  dbStats.offline = db.query("SELECT COUNT(*) FROM relay_status WHERE online = 0")[0][0] as number;
  
  // Get expired relays using the same function as the daemon - with retry logic
  // This will correctly account for the retry backoff
  const expiredRelays = getExpiredRelays(expiryTime, networks, retryManager);
  
  // Show ALL expired relays in the status display, regardless of queue state
  dbStats.expired = expiredRelays.length;
  
  // Get online-only expired relays
  if (expiredRelays.length > 0) {
    const placeholders = expiredRelays.map(() => '?').join(',');
    const onlineExpiredUrls = db.query(
      `SELECT url FROM relay_status 
       WHERE url IN (${placeholders})
       AND online = 1`,
      [...expiredRelays]
    ).map(([url]) => url);
    
    dbStats.onlineExpired = onlineExpiredUrls.length;
  } else {
    dbStats.onlineExpired = 0;
  }
  
  // We can show the queue size separately to indicate how many relays are being processed
  logger.debug(`Status calculation: Found ${dbStats.expired} expired relays, ${dbStats.onlineExpired} online expired, Queue size: ${queueStats.totalQueue}`);
  
  // Get unchecked count (never checked)
  dbStats.unchecked = db.query("SELECT COUNT(*) FROM relay_status WHERE checked_at = -1")[0][0] as number;
  
  // Get ignored count
  dbStats.ignored = db.query("SELECT COUNT(*) FROM relay_status WHERE ignore = 1")[0][0] as number;
  
  // Get parents count (relays that have child relays)
  dbStats.parents = db.query("SELECT COUNT(*) FROM relay_status WHERE parent = ''")[0][0] as number;
  
  // Get children count (relays that have a parent)
  dbStats.children = db.query("SELECT COUNT(*) FROM relay_status WHERE parent != ''")[0][0] as number;

  // Add session stats
  const sessionDataStats = {
    checksTotal: sessionStats.checksTotal,
    checksErrors: sessionStats.checksErrors,
    wentOfflineCount: sessionStats.wentOffline.size,
    newRelaysFound: sessionStats.newRelaysFound
  };

  // Return combined stats
  return {
    ...queueStats,
    ...dbStats,
    checksTotal: sessionStats.checksTotal,
    checksErrors: sessionStats.checksErrors,
    wentOfflineCount: sessionStats.wentOffline.size,
    newRelaysFound: sessionStats.newRelaysFound,
    queueSize: queueStats.totalQueue
  };
}

/**
 * Create an ASCII box with stats
 */
function createAsciiBox(stats: StatusStats): string {
  const c = chalk;
  const title = c.bold.bgBlue.white;
  const header = c.bold.cyan;
  const subheader = c.bold.blue;
  const value = c.yellow;
  const highlight = c.bold.green;
  const warning = c.bold.red;
  
  // Calculate visible string length (without ANSI codes)
  const strLength = (str: string): number => {
    // Remove ANSI escape codes when calculating length
    return str.replace(/\u001b\[.*?m/g, '').length;
  };
  
  // Helper function to pad numbers and ensure consistent spacing
  const pad = (num: number): string => {
    return num.toString().padStart(5, ' ');
  };
  
  // Box dimensions
  const boxWidth = 90;
  const columnWidth = Math.floor((boxWidth - 2) / 3);
  const titleText = ' RELAYMON STATUS ';
  const titlePadding = Math.floor((boxWidth - 2 - titleText.length) / 2);
  
  // Create the box
  let box = '\n';
  
  // Top border
  box += '╔' + '═'.repeat(boxWidth - 2) + '╗\n';
  
  // Title
  const titleLine = `${' '.repeat(titlePadding)}${title(titleText)}${' '.repeat(boxWidth - 2 - titlePadding - titleText.length)}`;
  box += `║${titleLine}║\n`;
  
  // Separator
  box += '╠' + '═'.repeat(boxWidth - 2) + '╣\n';
  
  // Headers for the three columns
  const queueHeader = `${header('QUEUE STATS')}`;
  const cacheHeader = `${header('CACHE STATS')}`;
  const sessionHeader = `${header('SESSION STATS')}`;
  
  // Pad headers to fit column width
  const paddedQueueHeader = ` ${queueHeader}${' '.repeat(columnWidth - strLength(queueHeader) - 1)}`;
  const paddedCacheHeader = `${cacheHeader}${' '.repeat(columnWidth - strLength(cacheHeader))}`;
  const paddedSessionHeader = `${sessionHeader}${' '.repeat(columnWidth - strLength(sessionHeader))}`;
  
  // Add headers row
  box += `║${paddedQueueHeader}${paddedCacheHeader}${paddedSessionHeader}║\n`;
  
  // Separator line
  box += `║${' '.repeat(boxWidth - 2)}║\n`;
  
  // Define type for the data items
  interface StatsItem {
    key: string;
    value: number;
    highlight?: boolean;
    warning?: boolean;
  }
  
  // Define the data for each table
  const queueData: StatsItem[] = [
    { key: 'Active:', value: stats.active },
    { key: 'Waiting:', value: stats.waiting },
    { key: 'Failed:', value: stats.failed, warning: stats.failed > 0 },
    { key: 'Paused:', value: stats.paused },
    { key: 'Total Queue:', value: stats.totalQueue }
  ];
  
  const cacheData: StatsItem[] = [
    { key: 'Online:', value: stats.online, highlight: true },
    { key: 'Online & Expired:', value: stats.onlineExpired, warning: true },
    { key: 'Offline:', value: stats.offline },
    { key: 'Expired (Total):', value: stats.expired, warning: stats.expired > 0 },
    { key: 'Unchecked:', value: stats.unchecked },
    { key: 'Total Relays:', value: stats.total, highlight: true },
    { key: 'Ignored:', value: stats.ignored },
    { key: 'Parents:', value: stats.parents },
    { key: 'Children:', value: stats.children }
  ];
  
  const sessionData: StatsItem[] = [
    { key: 'Checks Total:', value: stats.checksTotal, highlight: true },
    { key: 'Check Errors:', value: stats.checksErrors, warning: true },
    { key: 'Went Offline:', value: stats.wentOfflineCount, warning: true },
    { key: 'New Relays Found:', value: stats.newRelaysFound, highlight: true }
  ];
  
  // Find the max number of rows needed
  const maxRows = Math.max(queueData.length, cacheData.length, sessionData.length);
  
  // Generate rows for the tables
  for (let i = 0; i < maxRows; i++) {
    let rowContent = '';
    
    // Queue column
    if (i < queueData.length) {
      const item = queueData[i];
      const formattedValue = item.warning ? 
        warning(pad(item.value)) : 
        (item.highlight ? highlight(pad(item.value)) : value(pad(item.value)));
      rowContent += ` ${subheader(item.key)} ${formattedValue}${' '.repeat(columnWidth - strLength(` ${item.key} ${pad(item.value)}`) - 1)}`;
    } else {
      rowContent += ' '.repeat(columnWidth);
    }
    
    // Cache column
    if (i < cacheData.length) {
      const item = cacheData[i];
      const formattedValue = item.warning ? 
        warning(pad(item.value)) : 
        (item.highlight ? highlight(pad(item.value)) : value(pad(item.value)));
      rowContent += `${subheader(item.key)} ${formattedValue}${' '.repeat(columnWidth - strLength(`${item.key} ${pad(item.value)}`))}`;
    } else {
      rowContent += ' '.repeat(columnWidth);
    }
    
    // Session column
    if (i < sessionData.length) {
      const item = sessionData[i];
      const formattedValue = item.warning ? 
        warning(pad(item.value)) : 
        (item.highlight ? highlight(pad(item.value)) : value(pad(item.value)));
      rowContent += `${subheader(item.key)} ${formattedValue}${' '.repeat(columnWidth - strLength(`${item.key} ${pad(item.value)}`))}`;
    } else {
      rowContent += ' '.repeat(columnWidth);
    }
    
    // Add the row to the box
    box += `║${rowContent}║\n`;
  }
  
  // Bottom border
  box += '╚' + '═'.repeat(boxWidth - 2) + '╝\n';
  
  return box;
}

export function incrementChecksCounter(): void {
  checksCounter++;
}

export function statuses(queueManager: any, interval: number = 20): ReturnType<typeof setInterval> {
  return setInterval(() => {
    logStatus(queueManager, interval);
  }, interval * 100);
}

/**
 * Log status information every N checks
 */
export function logStatus(queueManager: any, interval: number = 20): void {
  checksCounter++;
  if (checksCounter >= interval) {
    checksCounter = 0; // Reset counter
    try {
      const stats = getStats(queueManager);
      console.log(createAsciiBox(stats));
    } catch (error) {
      logger.error(`Error getting stats: ${error}`);
    }
  }
}

/**
 * Format a simple metric for inline display
 */
export function formatCompactStats(queueManager: any): string {
  try {
    const stats = getStats(queueManager);
    return `Online: ${stats.online} | Expired: ${stats.expired} | Queued: ${stats.totalQueue}`;
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

// Run when executed directly
if (import.meta.main) {
  async function runStatus() {
    // Load the configuration
    try {
      const config = await loadConfig("./config.yaml");
      
      // Create a minimal QueueManager for status display
      const queueManager = {
        checkQueue: { pending: 0, size: 0, sizeFailed: 0, isPaused: false },
        config,
        // Add placeholder for isRelayEnqueued
        isRelayEnqueued: (relay: string) => false, // Assume no relays are enqueued when run standalone
        enqueuedRelays: new Set<string>()
      };
      
      const stats = getStats(queueManager);
      console.log(createAsciiBox(stats));
    } catch (error) {
      logger.error(`Error getting stats: ${error}`);
    }
  }
  
  runStatus();
} 