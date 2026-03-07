import chalk from "npm:chalk";
import { getLogger } from "./logger";

const logger = getLogger("Status");

export const trawlerStats = {
  totalEvents: 0,
  eventsProcessed: 0,
  eventsRejected: 0,
  newRelaysFound: 0,
  uniqueRelaysFound: new Set<string>(),
  sessionStart: Date.now(),
  lastUpdateTime: Date.now(),
  relayPoolSize: 0,
  scanningRelays: new Set<string>(),
  relaysScannedTotal: new Set<string>(),
  persistQueue: {
    active: 0,
    size: 0,
    completed: 0
  },
  reset: () => {
    trawlerStats.totalEvents = 0;
    trawlerStats.eventsProcessed = 0;
    trawlerStats.eventsRejected = 0;
    trawlerStats.newRelaysFound = 0;
    trawlerStats.uniqueRelaysFound.clear();
    trawlerStats.sessionStart = Date.now();
    trawlerStats.lastUpdateTime = Date.now();
    trawlerStats.relayPoolSize = 0;
    trawlerStats.scanningRelays.clear();
    trawlerStats.relaysScannedTotal.clear();
    trawlerStats.persistQueue.active = 0;
    trawlerStats.persistQueue.size = 0;
    trawlerStats.persistQueue.completed = 0;
  }
};

function formatRuntime(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function formatTimeSince(ms: number): string {
  if (ms < 1000) return "just now";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${h > 0 ? h + "h " : ""}${m > 0 ? m + "m " : ""}${s}s ago`;
}

function formatNum(n: number): string {
  return n.toLocaleString();
}

export function createStatusDisplay(): string {
  const now = Date.now();
  const runtimeMs = now - trawlerStats.sessionStart;
  const runtimeMin = runtimeMs / 60000;
  const timeSinceLastMs = now - trawlerStats.lastUpdateTime;

  const epm = runtimeMin > 0
    ? Math.round((trawlerStats.eventsProcessed / runtimeMin) * 10) / 10
    : 0;
  const rejRate = trawlerStats.totalEvents > 0
    ? Math.round((trawlerStats.eventsRejected / trawlerStats.totalEvents) * 1000) / 10
    : 0;

  const c = chalk;
  const dim = c.dim;
  const label = c.cyan;
  const val = c.white.bold;
  const good = c.green.bold;
  const sep = dim('|');
  const line = dim('-'.repeat(70));

  const scanning = trawlerStats.scanningRelays.size > 0
    ? Array.from(trawlerStats.scanningRelays).map(r => c.yellow(r)).join(dim(', '))
    : dim('idle');

  const rows = [
    '',
    `${dim('---')} ${c.bold.white('NOSTR TRAWLER')} ${line}`,
    '',
    `  ${label('Runtime')} ${val(formatRuntime(runtimeMs))}  ${sep}  ${label('Events')} ${val(formatNum(trawlerStats.eventsProcessed))} ${dim('(' + epm + '/min)')}  ${sep}  ${label('Last')} ${val(formatTimeSince(timeSinceLastMs))}`,
    `  ${label('Relays')}  ${val(formatNum(trawlerStats.relayPoolSize))} ${dim('in pool')}  ${sep}  ${good(formatNum(trawlerStats.newRelaysFound))} ${dim('new found')}  ${sep}  ${val(formatNum(trawlerStats.relaysScannedTotal.size))} ${dim('scanned')}`,
    `  ${label('Queue')}   ${val(String(trawlerStats.persistQueue.active))} ${dim('active')}  ${sep}  ${val(String(trawlerStats.persistQueue.size))} ${dim('pending')}  ${sep}  ${val(formatNum(trawlerStats.persistQueue.completed))} ${dim('completed')}`,
    rejRate > 0
      ? `  ${label('Rejected')} ${c.red.bold(formatNum(trawlerStats.eventsRejected))} ${dim('(' + rejRate + '%)')}`
      : '',
    '',
    `  ${label('Scanning')} ${scanning}`,
    '',
    line,
    '',
  ].filter(r => r !== '');

  return rows.join('\n');
}

export function formatCompactStats(): string {
  return `Events: ${formatNum(trawlerStats.eventsProcessed)} | New Relays: ${trawlerStats.newRelaysFound} | Pool: ${trawlerStats.relayPoolSize}`;
}

export function setupStatusReporting(intervalSeconds: number = 30): ReturnType<typeof setInterval> {
  return setInterval(() => {
    try {
      console.log(createStatusDisplay());
    } catch (error) {
      logger.error(`Error creating status: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, intervalSeconds * 1000);
}
