import { db } from "./db.ts";
import { getLogger, LogLevel } from "./logger.ts";
import chalk from "npm:chalk";

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
  const expiryTime = 24 * 60 * 60; // 24 hours in seconds

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
  
  // Get online but expired count
  dbStats.onlineExpired = db.query(
    `SELECT COUNT(*) FROM relay_status 
     WHERE online = 1 AND (? - checked_at) > ?`, 
    [now, expiryTime]
  )[0][0] as number;
  
  // Get offline count
  dbStats.offline = db.query("SELECT COUNT(*) FROM relay_status WHERE online = 0")[0][0] as number;
  
  // Get expired count (all relays that need checking)
  dbStats.expired = db.query(
    `SELECT COUNT(*) FROM relay_status 
     WHERE (? - checked_at) > ?`, 
    [now, expiryTime]
  )[0][0] as number;
  
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

  return { ...queueStats, ...dbStats, ...sessionDataStats };
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
  
  // QUEUE STATS section
  const queueHeader = ` ${header('QUEUE STATS')}`;
  box += `║${queueHeader}${' '.repeat(boxWidth - 2 - strLength(queueHeader))}║\n`;
  box += `║${' '.repeat(boxWidth - 2)}║\n`;
  
  // Format each stat with consistent spacing
  const activeLabel = `  ${subheader('Active:')} ${value(pad(stats.active))}`;
  const waitingLabel = `${subheader('Waiting:')} ${value(pad(stats.waiting))}`;
  const failedLabel = `${subheader('Failed:')} ${stats.failed > 0 ? warning(pad(stats.failed)) : value(pad(stats.failed))}`;
  const pausedLabel = `${subheader('Paused:')} ${value(pad(stats.paused))}`;
  
  // Calculate consistent column widths
  const colWidth1 = 22; // Active + value
  const colWidth2 = 22; // Waiting + value
  const colWidth3 = 22; // Failed + value
  
  // Create line with proper spacing
  const queueLine = activeLabel + ' '.repeat(Math.max(0, colWidth1 - strLength(activeLabel))) + 
                   waitingLabel + ' '.repeat(Math.max(0, colWidth2 - strLength(waitingLabel))) + 
                   failedLabel + ' '.repeat(Math.max(0, colWidth3 - strLength(failedLabel))) + 
                   pausedLabel;
  
  // Add queue line with right padding
  box += `║${queueLine}${' '.repeat(Math.max(0, boxWidth - 2 - strLength(queueLine)))}║\n`;
  
  // Total queue line
  const queueLine2 = `  ${subheader('Total Queue:')} ${value(pad(stats.totalQueue))}`;
  box += `║${queueLine2}${' '.repeat(boxWidth - 2 - strLength(queueLine2))}║\n`;
  
  // Add separator line
  box += `║${' '.repeat(boxWidth - 2)}║\n`;
  
  // CACHE STATS section
  const cacheHeader = ` ${header('CACHE STATS')}`;
  box += `║${cacheHeader}${' '.repeat(boxWidth - 2 - strLength(cacheHeader))}║\n`;
  box += `║${' '.repeat(boxWidth - 2)}║\n`;
  
  // Format cache stats
  const onlineLabel = `  ${subheader('Online:')} ${highlight(pad(stats.online))}`;
  const onlineExpiredLabel = `${subheader('Online & Expired:')} ${warning(pad(stats.onlineExpired))}`;
  const offlineLabel = `${subheader('Offline:')} ${value(pad(stats.offline))}`;
  
  // Create cache line with proper spacing
  const cacheLine1 = onlineLabel + ' '.repeat(Math.max(0, colWidth1 - strLength(onlineLabel))) + 
                    onlineExpiredLabel + ' '.repeat(Math.max(0, 32 - strLength(onlineExpiredLabel))) + 
                    offlineLabel;
  
  box += `║${cacheLine1}${' '.repeat(Math.max(0, boxWidth - 2 - strLength(cacheLine1)))}║\n`;
  
  // Second cache line
  const expiredLabel = `  ${subheader('Expired:')} ${stats.expired > 0 ? warning(pad(stats.expired)) : value(pad(stats.expired))}`;
  const uncheckedLabel = `${subheader('Unchecked:')} ${value(pad(stats.unchecked))}`;
  const totalLabel = `${subheader('Total:')} ${highlight(pad(stats.total))}`;
  
  const cacheLine2 = expiredLabel + ' '.repeat(Math.max(0, colWidth1 - strLength(expiredLabel))) + 
                    uncheckedLabel + ' '.repeat(Math.max(0, colWidth2 - strLength(uncheckedLabel))) + 
                    totalLabel;
  
  box += `║${cacheLine2}${' '.repeat(Math.max(0, boxWidth - 2 - strLength(cacheLine2)))}║\n`;
  
  // Third cache line
  const ignoredLabel = `  ${subheader('Ignored:')} ${value(pad(stats.ignored))}`;
  const parentsLabel = `${subheader('Parents:')} ${value(pad(stats.parents))}`;
  const childrenLabel = `${subheader('Children:')} ${value(pad(stats.children))}`;
  
  const cacheLine3 = ignoredLabel + ' '.repeat(Math.max(0, colWidth1 - strLength(ignoredLabel))) + 
                    parentsLabel + ' '.repeat(Math.max(0, colWidth2 - strLength(parentsLabel))) + 
                    childrenLabel;
  
  box += `║${cacheLine3}${' '.repeat(Math.max(0, boxWidth - 2 - strLength(cacheLine3)))}║\n`;
  
  // Add separator line
  box += `║${' '.repeat(boxWidth - 2)}║\n`;
  
  // SESSION STATS section
  const sessionHeader = ` ${header('SESSION STATS')}`;
  box += `║${sessionHeader}${' '.repeat(boxWidth - 2 - strLength(sessionHeader))}║\n`;
  box += `║${' '.repeat(boxWidth - 2)}║\n`;
  
  // Format session stats  
  const checksLabel = `  ${subheader('Checks Total:')} ${highlight(pad(stats.checksTotal))}`;
  const errorsLabel = `${subheader('Check Errors:')} ${warning(pad(stats.checksErrors))}`;
  
  const sessionLine1 = checksLabel + ' '.repeat(Math.max(0, 30 - strLength(checksLabel))) + 
                      errorsLabel;
  
  box += `║${sessionLine1}${' '.repeat(Math.max(0, boxWidth - 2 - strLength(sessionLine1)))}║\n`;
  
  // Second session line
  const offlineCountLabel = `  ${subheader('Went Offline:')} ${warning(pad(stats.wentOfflineCount))}`;
  const newRelaysLabel = `${subheader('New Relays Found:')} ${highlight(pad(stats.newRelaysFound))}`;
  
  const sessionLine2 = offlineCountLabel + ' '.repeat(Math.max(0, 30 - strLength(offlineCountLabel))) + 
                      newRelaysLabel;
  
  box += `║${sessionLine2}${' '.repeat(Math.max(0, boxWidth - 2 - strLength(sessionLine2)))}║\n`;
  
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