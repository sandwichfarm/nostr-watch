import { derived, writable, type Writable, get, type Readable } from "svelte/store";
import { eventsArray } from "./events.js";
import type { IEvent } from "@nostrwatch/route66/models";
import { StateManager } from "@nostrwatch/route66";
import { Monitor } from '@nostrwatch/route66/models'
import { nip05s } from "./nip05s.js";
import { route66 } from "./route66.js";
import type Route66 from "@nostrwatch/route66";
import { publishEventsToMemoryRelay } from "./events-helpers.js";
import { doAggregateCache, statsAsOf, tabState } from "./app.js";
import timestring from "timestring";
import { getLeaderTabRpcClient } from "$lib/runtime/leader-tab-client";

let $route66: Route66 | null;

route66.subscribe(instance => $route66 = instance)

export const MONITOR_LIVENESS_LENIENCY_KEY = "preferences:monitors:liveness:leniency";
export const MONITOR_LIVENESS_DEAD_THRESHOLD_KEY = "preferences:monitors:liveness:deadThreshold";

export const DEFAULT_MONITOR_LIVENESS_LENIENCY = 1.2;
export const DEFAULT_MONITOR_LIVENESS_DEAD_THRESHOLD = "30d";

const MONITORS_CACHE_KEY = "cache:monitors";
let suppressMonitorsCachePersist = false;

function clampLeniency(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_MONITOR_LIVENESS_LENIENCY;
  return Math.min(2, Math.max(1, parsed));
}

function normalizeDeadThreshold(value: unknown): string {
  if (typeof value !== "string") return DEFAULT_MONITOR_LIVENESS_DEAD_THRESHOLD;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : DEFAULT_MONITOR_LIVENESS_DEAD_THRESHOLD;
}

export function parseDeadThresholdSeconds(value: string): number {
  try {
    const seconds = timestring(value);
    if (!Number.isFinite(seconds) || seconds <= 0) return timestring(DEFAULT_MONITOR_LIVENESS_DEAD_THRESHOLD);
    return seconds;
  } catch {
    return timestring(DEFAULT_MONITOR_LIVENESS_DEAD_THRESHOLD);
  }
}

function storageKey(key: string): string {
  const prefix = (StateManager as any)?.localStorage?.prefix ?? "state";
  return `${prefix}:${key}`;
}

const initialLeniency =
  typeof window === "undefined" ? DEFAULT_MONITOR_LIVENESS_LENIENCY : clampLeniency(StateManager.get(MONITOR_LIVENESS_LENIENCY_KEY));

const initialDeadThreshold =
  typeof window === "undefined"
    ? DEFAULT_MONITOR_LIVENESS_DEAD_THRESHOLD
    : normalizeDeadThreshold(StateManager.get(MONITOR_LIVENESS_DEAD_THRESHOLD_KEY));

export const monitorsLivenessLeniency = writable<number>(initialLeniency);
export const monitorsLivenessDeadThreshold = writable<string>(initialDeadThreshold);

function buildMonitorsMap(monitorsArr: any[] | undefined): Map<string, Monitor> {
  if (!monitorsArr?.length) return new Map();
  const map: Map<string, Monitor> = new Map();
  for (const monitor of monitorsArr) {
    const mon: Monitor | undefined = Monitor.fromCache(monitor);
    if (!mon) continue;
    publishEventsToMemoryRelay(mon.events, 'monitorsMapFromCache');
    map.set(monitor.pubkey, mon);
  }
  return map;
}

function applyMonitorsCache(monitorsArr: any[] | undefined) {
  suppressMonitorsCachePersist = true;
  try {
    if (Array.isArray(monitorsArr)) {
      try {
        $route66?.services?.monitors?.loadMonitors(monitorsArr);
      } catch {}
      monitorsMap.set(buildMonitorsMap(monitorsArr));
    } else {
      monitorsMap.set(new Map());
    }
  } finally {
    suppressMonitorsCachePersist = false;
  }
}

if (typeof window !== "undefined") {
  monitorsLivenessLeniency.subscribe((value) => {
    const next = clampLeniency(value);
    if (next !== value) {
      monitorsLivenessLeniency.set(next);
      return;
    }
    try {
      if (StateManager.get(MONITOR_LIVENESS_LENIENCY_KEY) !== next) StateManager.set(MONITOR_LIVENESS_LENIENCY_KEY, next);
    } catch {}
  });

  monitorsLivenessDeadThreshold.subscribe((value) => {
    const next = normalizeDeadThreshold(value);
    if (next !== value) {
      monitorsLivenessDeadThreshold.set(next);
      return;
    }
    try {
      if (StateManager.get(MONITOR_LIVENESS_DEAD_THRESHOLD_KEY) !== next) StateManager.set(MONITOR_LIVENESS_DEAD_THRESHOLD_KEY, next);
    } catch {}
  });

  window.addEventListener("storage", (event) => {
    if (!event.key) return;
    if (event.key === storageKey(MONITOR_LIVENESS_LENIENCY_KEY)) {
      const next = clampLeniency(StateManager.get(MONITOR_LIVENESS_LENIENCY_KEY));
      if (get(monitorsLivenessLeniency) !== next) monitorsLivenessLeniency.set(next);
    }
    if (event.key === storageKey(MONITOR_LIVENESS_DEAD_THRESHOLD_KEY)) {
      const next = normalizeDeadThreshold(StateManager.get(MONITOR_LIVENESS_DEAD_THRESHOLD_KEY));
      if (get(monitorsLivenessDeadThreshold) !== next) monitorsLivenessDeadThreshold.set(next);
    }
    if (event.key === storageKey(MONITORS_CACHE_KEY)) {
      try {
        const cached = StateManager.get(MONITORS_CACHE_KEY);
        applyMonitorsCache(Array.isArray(cached) ? cached : undefined);
      } catch {}
    }
  });
}

export const monitorsMapFromCache = (): Map<string, Monitor>  => {
  const monitorsArr = StateManager.get(MONITORS_CACHE_KEY);
  return buildMonitorsMap(Array.isArray(monitorsArr) ? monitorsArr : undefined);
}

// monitorsMapFromCache()

export const monitorsEvents: Readable<Record<string, IEvent[]>> = derived(
  [eventsArray],
  ([$eventsArray]) => {
    const eventsMap: Record<string, IEvent[]> = {};
    $eventsArray
      .filter((event: IEvent) => event.kind === 10166 || event.kind === 0 || event.kind === 10002)
      .forEach((event: IEvent) => {
        if(!eventsMap[event.pubkey]) eventsMap[event.pubkey] = []
        eventsMap[event.pubkey].push(event)
      });
    Object.entries(eventsMap).forEach(([pubkey, events]) => {
      const hasRegistration = events.some((event) => event.kind === 10166)  
      if(!hasRegistration) delete eventsMap[pubkey]
    })
    return eventsMap;
  }
);

// export const monitorsMap: Readable<Map<string, Monitor>> = derived(
//   monitorsEvents,
//   ($monitorsEvents) => {
//     return monitorsMapFromCache()
//   }
// );

export const monitorsMap: Writable<Map<string, Monitor>> = writable(monitorsMapFromCache());

export const monitors = derived(
  ([monitorsMap]), 
  ([$monitorsMap]) => {
    const liveData = $route66?.services?.monitors?.sortedMonitors
    let arr: Monitor[] = []
    if(liveData?.length) {
      if(liveData && liveData.length) {
        arr = liveData
      }
      if(!arr.length) {
        arr = Array.from(monitorsMapFromCache().values());
      }
    }
    else if($monitorsMap.size) {
      arr = Array.from($monitorsMap.values());
    }
    if(arr.length){
      const toCache = arr.map(( monitor: Monitor) => monitor.toCache())
      if (!suppressMonitorsCachePersist && get(tabState) === 'leader') {
        try {
          StateManager.set(MONITORS_CACHE_KEY, toCache);
        } catch {}
      }
    }
    return arr;
  }
)

export const monitorsSorted = derived(
  monitors,
  ($monitors) => {
    return $route66?.services?.monitors?.sortedMonitors || $monitors;
  }
);

export const monitorNip05s = derived(
  monitors,
  monitors => 
    monitors
      .filter( m => m?.profile?.nip05 )
      .map( m => ({ pubkey: m.pubkey, nip05: m.profile.nip05 }) )
)

export const inactiveDisabledMonitorChecksCount = writable<Record<string, number>>({});
const inactiveDisabledMonitorChecksCountReadable = derived(
  inactiveDisabledMonitorChecksCount,
  (value) => value
);

export const activeMonitorChecksCount = writable<Record<string, number>>({});
const activeMonitorChecksCountReadable = derived(
  activeMonitorChecksCount,
  (value) => value
);

export type MonitorRelayLivenessCounts = {
  online: number;
  offline: number;
  dead: number;
};

export type MonitorRelayLivenessMap = Record<string, MonitorRelayLivenessCounts>;

const MONITOR_RELAY_LIVENESS_CACHE_KEY = "aggregate:monitors:relayLiveness:v1";

function readCachedRelayLiveness(): MonitorRelayLivenessMap {
  if (typeof window === "undefined") return {};
  try {
    const cached = StateManager.get(MONITOR_RELAY_LIVENESS_CACHE_KEY) as MonitorRelayLivenessMap | undefined;
    if (cached && typeof cached === "object") return cached;
  } catch {}
  return {};
}

export const monitorRelayLivenessCounts: Writable<MonitorRelayLivenessMap> = writable(readCachedRelayLiveness());

if (typeof window !== "undefined") {
  // Ensure monitor selection changes propagate across tabs, including into the leader tab.
  try {
    getLeaderTabRpcClient().onBroadcast((msg) => {
      if (msg.kind !== 'state.stateManager') return;
      const data = msg.data as any;
      if (data?.key !== MONITORS_CACHE_KEY) return;
      applyMonitorsCache(Array.isArray(data?.value) ? data.value : undefined);
    });
  } catch {}

  window.addEventListener("storage", (event) => {
    if (!event.key) return;
    if (event.key !== storageKey(MONITOR_RELAY_LIVENESS_CACHE_KEY)) return;
    try {
      const cached = StateManager.get(MONITOR_RELAY_LIVENESS_CACHE_KEY) as MonitorRelayLivenessMap | undefined;
      if (cached && typeof cached === "object") monitorRelayLivenessCounts.set(cached);
    } catch {}
  });
}

function monitorFrequencySeconds(monitor: Monitor): number {
  const raw = (monitor as any)?.registration?.frequency;
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return raw;
  // If a monitor is missing a frequency, fall back to the Monitor model default (12h).
  return 60 * 60 * 12;
}

/**
 * Compute per-monitor relay liveness counts by getting the latest event per relay
 * and classifying by timestamp. Fetches all monitors' events in a single query for efficiency.
 * Uses the user-configurable leniency and dead threshold from stores.
 */
async function computeRelayLivenessFromCache(
  monitorsList: Monitor[]
): Promise<MonitorRelayLivenessMap> {
  const result: MonitorRelayLivenessMap = {};
  if (!$route66?.adapters?.cacheAdapter) return result;

  const cacheAdapter = $route66.adapters.cacheAdapter;

  // Get current threshold settings from stores
  const leniency = get(monitorsLivenessLeniency);
  const deadThresholdStr = get(monitorsLivenessDeadThreshold);
  const deadThresholdSeconds = parseDeadThresholdSeconds(deadThresholdStr);
  const wallNow = Math.round(Date.now() / 1000);
  const refNow = get(statsAsOf);
  const now = refNow > 0 ? Math.min(wallNow, refNow) : wallNow;

  // Build a map of monitor pubkeys to their Monitor objects for quick lookup
  const monitorMap = new Map<string, Monitor>();
  const pubkeys: string[] = [];
  for (const monitor of monitorsList) {
    const pubkey = monitor?.pubkey;
    if (typeof pubkey !== "string" || !pubkey.length) continue;
    monitorMap.set(pubkey, monitor);
    pubkeys.push(pubkey);
    // Initialize result
    result[pubkey] = { online: 0, offline: 0, dead: 0 };
  }

  if (pubkeys.length === 0) return result;

  // Fetch ALL check events for all monitors in a single query
  const filter = { kinds: [30166], authors: pubkeys };
  let events: IEvent[];
  try {
    events = await cacheAdapter.REQ([filter]) as IEvent[];
  } catch {
    return result;
  }

  if (!Array.isArray(events) || events.length === 0) return result;

  // Group events by (monitor pubkey, relay d-tag) and keep only the latest
  // Key format: "pubkey:relay"
  const latestByMonitorRelay = new Map<string, IEvent>();
  for (const event of events) {
    const relay = event.tags?.find(t => t[0] === 'd')?.[1];
    if (!relay) continue;
    const key = `${event.pubkey}:${relay}`;
    const existing = latestByMonitorRelay.get(key);
    if (!existing || (event.created_at as number) > (existing.created_at as number)) {
      latestByMonitorRelay.set(key, event);
    }
  }

  // Classify each relay by its latest event timestamp for each monitor
  // Use store-based thresholds instead of Monitor's internal values
  for (const event of latestByMonitorRelay.values()) {
    const monitor = monitorMap.get(event.pubkey);
    if (!monitor) continue;

    const timestamp = event.created_at as number;
    // Calculate thresholds using store values
    const frequency = monitorFrequencySeconds(monitor);
    const onlineAfter = now - Math.round(frequency * leniency);
    const deadBefore = now - deadThresholdSeconds;

    if (timestamp >= onlineAfter) {
      result[event.pubkey].online++;
    } else if (timestamp < deadBefore) {
      result[event.pubkey].dead++;
    } else {
      result[event.pubkey].offline++;
    }
  }

  return result;
}

let relayLivenessScheduled: ReturnType<typeof setTimeout> | null = null;

function scheduleRelayLivenessCompute(delayMs = 250) {
  if (typeof window === "undefined") return;
  if (relayLivenessScheduled) return;
  relayLivenessScheduled = setTimeout(() => {
    relayLivenessScheduled = null;
    computeAndUpdateRelayLiveness();
  }, delayMs);
}

async function computeAndUpdateRelayLiveness(): Promise<void> {
  const monitorsList = get(monitorsSorted) as Monitor[];
  if (!Array.isArray(monitorsList) || monitorsList.length === 0) return;

  const result = await computeRelayLivenessFromCache(monitorsList);

  // Don't overwrite cached values with empty results
  // This can happen if the cache adapter isn't ready yet
  const hasAnyData = Object.values(result).some(counts =>
    counts.online > 0 || counts.offline > 0 || counts.dead > 0
  );
  if (Object.keys(result).length === 0 || !hasAnyData) {
    return;
  }

  // Merge with existing cached values - only update monitors that have non-zero counts
  // This prevents overwriting good cached data with zeros when cache is still loading
  const existingCounts = get(monitorRelayLivenessCounts);
  const merged: MonitorRelayLivenessMap = { ...existingCounts };

  for (const [pubkey, counts] of Object.entries(result)) {
    const hasData = counts.online > 0 || counts.offline > 0 || counts.dead > 0;
    if (hasData) {
      merged[pubkey] = counts;
    }
    // If no data for this monitor but we have existing cached data, keep the cached data
  }

  monitorRelayLivenessCounts.set(merged);

  // Cache the merged result (leader tab only)
  if (get(tabState) === "leader" && get(doAggregateCache)) {
    try {
      const cachedJson = StateManager.get(MONITOR_RELAY_LIVENESS_CACHE_KEY);
      const existingJson = cachedJson ? JSON.stringify(cachedJson) : "";
      const mergedJson = JSON.stringify(merged);
      if (existingJson !== mergedJson) {
        StateManager.set(MONITOR_RELAY_LIVENESS_CACHE_KEY, merged);
      }
    } catch {}
  }
}

if (typeof window !== "undefined") {
  // Re-compute when monitors change or on a timer
  // Use a longer initial delay to give the cache time to seed
  let isFirstMonitorUpdate = true;
  monitorsSorted.subscribe((monitors) => {
    // Skip if no monitors yet
    if (!monitors?.length) return;
    // Use longer delay on first update to allow cache to fully seed
    const delay = isFirstMonitorUpdate ? 2000 : 500;
    isFirstMonitorUpdate = false;
    scheduleRelayLivenessCompute(delay);
  });
  monitorsLivenessLeniency.subscribe(() => {
    scheduleRelayLivenessCompute(250);
  });
  monitorsLivenessDeadThreshold.subscribe(() => {
    scheduleRelayLivenessCompute(250);
  });
  statsAsOf.subscribe(() => {
    scheduleRelayLivenessCompute(250);
  });

  // Also trigger periodic refresh since cache data changes independently
  setInterval(() => {
    scheduleRelayLivenessCompute(100);
  }, 30000); // Refresh every 30 seconds
}

export const monitorRows = derived(
  [monitorsSorted, monitorRelayLivenessCounts, nip05s, statsAsOf],
  ([$monitorsSorted, $monitorRelayLivenessCounts, _nip05s, $statsAsOf]) => {
    const wallNow = Math.round(Date.now() / 1000);
    const now = $statsAsOf > 0 ? Math.min(wallNow, $statsAsOf) : wallNow;
    return $monitorsSorted.map((monitor: Monitor) => {
      const row: Record<string, any> = new Object();
      const liveness = $monitorRelayLivenessCounts?.[monitor.pubkey] ?? { online: 0, offline: 0, dead: 0 };
      row.id = monitor.pubkey;
      const lastActive = monitor?.lastActive ?? -1;
      const frequency = monitor?.frequency ?? 0;
      row.active = typeof lastActive === "number" && lastActive > 0 && typeof frequency === "number" && frequency > 0
        ? now - frequency < lastActive
        : false;
      row.pubkey = monitor.pubkey;
      row.name = monitor.profile?.name ?? null
      row.photo = monitor.photo ?? null
      row.about = monitor?.profile?.about ?? null
      row.nip05 = monitor?.profile?.nip05 ?? null
      row.lud16 = monitor?.profile?.lud16 ?? null
      row.geohash = monitor?.registration?.geohash ?? null
      row.checks = monitor?.registration?.checks ?? null
      row.networks = monitor?.registration?.networks ?? null
      row.frequency = monitor?.registration?.frequency ?? null
      row.lastActive = monitor?.lastActive ?? null
      row.relays = monitor.relays ?? null
      row.enabled = monitor.enabled ?? false
      row.priority = monitor.priority ?? 0
      row.reportingOnline = liveness?.online ?? 0
      row.reportingOffline = liveness?.offline ?? 0
      row.likelyDead = liveness?.dead ?? 0
      return row;
    })
  }
);
