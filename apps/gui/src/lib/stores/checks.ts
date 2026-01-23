import { derived, readable, writable, type Writable, type Readable, get } from "svelte/store";
import { compress, decompress } from 'compress-json'

import { eventsArray } from './events.js';

import { Nip66CheckEvent } from '@nostrwatch/route66/models';
import { StateManager } from "@nostrwatch/route66";
import { doAggregateCache, isBootstrapping, statsAsOf, tabState } from "./app.js";
import { throttledDerived } from "$utils/stores.js";
import { nip11ValidationErrorCount } from "./nip11-validations.js";
import { eventKey } from "$lib/utils/event-keys";
import { relayCheckAggregator as aggregateRelayChecks, type RelayChecksByRelay } from "$lib/derivations/relay-checks-aggregate";
import { useWorkerRelayChecks } from "./dimension-stores.js";
import {
  monitorsLivenessDeadThreshold,
  monitorsLivenessLeniency,
  monitorsSorted,
  parseDeadThresholdSeconds,
} from "./monitors.js";

const AGGREGATE_COMPLETE_CACHE_KEY = 'aggregate:complete';
const aggregateCompleteVersion = writable(0);

function storageKey(key: string): string {
  const prefix = (StateManager as any)?.localStorage?.prefix ?? "state";
  return `${prefix}:${key}`;
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (!event.key) return;
    if (event.key === storageKey(AGGREGATE_COMPLETE_CACHE_KEY)) {
      aggregateCompleteVersion.update((value) => value + 1);
    }
  });
}

let aggregateCompleteLastWriteMs = 0;

export const overrideRelayChecksActiveKeys: Writable<string[]> = writable([]);

export type RelayChecksDerivationStats = {
  checks: number;
  relays: number;
  computeMs: number;
} | null;

export const relayChecksDerivationStats: Writable<RelayChecksDerivationStats> = writable(null);

export const relayChecksActiveKeys = derived(overrideRelayChecksActiveKeys, ($overrideRelayChecksActiveKeys) => {
  const alwaysKeys = [
    "relay",
    "created_at",
    "icon",
    "banner",
    "seenBy",
    "lastSeen",
    "seenTimes",
    "monitorPubkey",
    "operatorPubkey",
    "hasNip11",
    "dd",
    "network"
  ]
  const derivedKeys = [
    'nip11IsValid', 
    'nip11ValidationErrors'
  ]
  let keys = []
  if($overrideRelayChecksActiveKeys.length) { 
    keys = [ 
      ...alwaysKeys,
      ...$overrideRelayChecksActiveKeys
    ]
  }
  else {
    keys = [
      ...alwaysKeys,
      ...Nip66CheckEvent.keys,
      ...derivedKeys
    ]
  }
  return Array.from(new Set(keys))
})

export const relayCheckAggregator = aggregateRelayChecks;

export const eventsChecks: Readable<Nip66CheckEvent[]> = derived(eventsArray, ($events) => {
  return $events.filter(event => event.kind === 30166) as Nip66CheckEvent[];
})



const canUseDerivationWorker = typeof window !== 'undefined' && typeof Worker !== 'undefined';

function createRelayChecksWorkerStore(): Readable<RelayChecksByRelay> {
  return readable<RelayChecksByRelay>({}, (set) => {
    let seededBaseline: RelayChecksByRelay | null = null;
    let seededBaselineRelays = 0;

    // Seed from cached aggregates for fast first paint.
    try {
      const cached = StateManager.get('aggregate:complete');
      if (cached) {
        const aggDecompressed = decompress(cached) as any;
        if (Array.isArray(aggDecompressed)) {
          const seeded: RelayChecksByRelay = {};
          for (const item of aggDecompressed) {
            const relay = item?.relay;
            if (!relay) continue;
            const { relay: _relay, id: _id, ...rest } = item;
            seeded[relay] = { aggregate: rest };
          }
          if (Object.keys(seeded).length) {
            seededBaseline = seeded;
            seededBaselineRelays = Object.keys(seeded).length;
            set(seeded);
          }
        }
      }
    } catch {}

    let worker: Worker | null = null;
    try {
      worker = new Worker(new URL('../workers/relay-checks-aggregation.worker.ts', import.meta.url), {
        type: 'module',
      });
    } catch (e) {
      console.error('[relayChecks] failed to start derivation worker, falling back', e);
    }

    if (!worker) {
      relayChecksDerivationStats.set(null);
      const unsub = derived(
        [eventsChecks, relayChecksActiveKeys, nip11ValidationErrorCount],
        ([$eventsChecks, $relayChecksActiveKeys, $nip11Errors]) => {
          if (!$eventsChecks.length) return {};
          return relayCheckAggregator($eventsChecks as any, $relayChecksActiveKeys, $nip11Errors);
        }
      ).subscribe(set);
      return () => unsub();
    }

    const onMessage = (ev: MessageEvent) => {
      const data = ev.data as any;
      if (!data || typeof data !== 'object') return;
      if (data.type !== 'result') return;
      const next = (data.relayChecks ?? {}) as RelayChecksByRelay;

      // Followers often only receive a partial stream of check events (e.g. from a limited
      // leader snapshot). To avoid collapsing the UI dataset, merge worker results into the
      // cached per-relay aggregates baseline until we catch up.
      if (seededBaseline && seededBaselineRelays > 0) {
        const nextRelays = Object.keys(next).length;
        if (nextRelays < seededBaselineRelays) {
          for (const [relay, entry] of Object.entries(next)) {
            seededBaseline[relay] = entry;
          }
          set(seededBaseline);
        } else {
          seededBaseline = null;
          seededBaselineRelays = 0;
          set(next);
        }
      } else {
        set(next);
      }
      relayChecksDerivationStats.set((data.stats ?? null) as any);
    };
    worker.addEventListener('message', onMessage);

    const unsubActiveKeys = relayChecksActiveKeys.subscribe((keys) => {
      try {
        worker!.postMessage({ type: 'setActiveKeys', activeKeys: keys });
      } catch {}
    });

    const unsubNip11Errors = nip11ValidationErrorCount.subscribe((map) => {
      try {
        worker!.postMessage({ type: 'setNip11Errors', entries: Array.from(map.entries()) });
      } catch {}
    });

    let prevByKey = new Map<string, string>();

    const unsubChecks = eventsChecks.subscribe(($checks) => {
      const nextByKey = new Map<string, string>();
      const upserts: { key: string; event: any }[] = [];

      for (const check of $checks) {
        const raw: any = (check as any)?.json ?? check;
        if (!raw) continue;
        const key = eventKey(raw);
        if (!key) continue;
        const id = raw?.id;
        if (!id) continue;

        nextByKey.set(key, id);
        if (prevByKey.get(key) !== id) {
          upserts.push({ key, event: raw });
        }
      }

      const removals: string[] = [];
      for (const key of prevByKey.keys()) {
        if (!nextByKey.has(key)) removals.push(key);
      }

      prevByKey = nextByKey;

      if (upserts.length || removals.length) {
        try {
          worker!.postMessage({ type: 'patch', upserts, removals });
        } catch {}
      }
    });

    return () => {
      unsubChecks();
      unsubActiveKeys();
      unsubNip11Errors();
      worker?.removeEventListener('message', onMessage);
      relayChecksDerivationStats.set(null);
      try {
        worker?.terminate();
      } catch {}
    };
  });
}

// Worker store (created once, lazy)
let workerStore: Readable<RelayChecksByRelay> | null = null;
function getWorkerStore(): Readable<RelayChecksByRelay> {
  if (!workerStore) workerStore = createRelayChecksWorkerStore();
  return workerStore;
}

// Legacy derived store (created once, lazy)
let legacyStore: Readable<RelayChecksByRelay> | null = null;
function getLegacyStore(): Readable<RelayChecksByRelay> {
  if (!legacyStore) {
    legacyStore = derived(
      [eventsChecks, relayChecksActiveKeys, nip11ValidationErrorCount],
      ([$eventsChecks, $relayChecksActiveKeys, $nip11Errors]) => {
        if (!$eventsChecks.length) return {};
        return relayCheckAggregator($eventsChecks as any, $relayChecksActiveKeys, $nip11Errors);
      }
    );
  }
  return legacyStore;
}

// Hybrid store that switches between worker and legacy based on feature flag
export const relayChecks: Readable<RelayChecksByRelay> = readable<RelayChecksByRelay>({}, (set) => {
  let currentUnsub: (() => void) | null = null;

  const switchStore = (useWorker: boolean) => {
    if (currentUnsub) currentUnsub();

    const store = (useWorker && canUseDerivationWorker) ? getWorkerStore() : getLegacyStore();
    currentUnsub = store.subscribe(set);
  };

  // Initial subscription based on current flag value
  switchStore(get(useWorkerRelayChecks));

  // Re-subscribe when flag changes
  const flagUnsub = useWorkerRelayChecks.subscribe((useWorker) => {
    switchStore(useWorker);
  });

  return () => {
    if (currentUnsub) currentUnsub();
    flagUnsub();
  };
});

export const relayCheckMap: Readable<Map<string, any>> = derived(relayChecks, ($relayChecks) => {
  const map = new Map();
  for(const [relay, item] of Object.entries($relayChecks)){
    map.set(relay, item.aggregate)
  }
  return map;
})

// Cache for aggregate data - loaded once, updated separately
let cachedAggregateData: any[] | null = null;
let cachedAggregateLoaded = false;

function loadCachedAggregate(): any[] {
  if (cachedAggregateLoaded) return cachedAggregateData || [];
  cachedAggregateLoaded = true;
  try {
    const agg = StateManager.get(AGGREGATE_COMPLETE_CACHE_KEY);
    if (agg) {
      cachedAggregateData = decompress(agg) as any[];
      return cachedAggregateData || [];
    }
  } catch {}
  return [];
}

// Separate function to save cache - called asynchronously
let saveCacheTimeout: ReturnType<typeof setTimeout> | null = null;
function scheduleCacheSave(data: any[]) {
  if (saveCacheTimeout) clearTimeout(saveCacheTimeout);
  saveCacheTimeout = setTimeout(() => {
    const nowMs = Date.now();
    if (nowMs - aggregateCompleteLastWriteMs > 5_000) {
      aggregateCompleteLastWriteMs = nowMs;
      try {
        StateManager.set(AGGREGATE_COMPLETE_CACHE_KEY, compress(data));
        aggregateCompleteVersion.update((value) => value + 1);
      } catch {}
    }
  }, 1000);
}

export const relayCheckAggregates: Readable<any[]> = throttledDerived(
  [relayChecks, monitorsSorted, monitorsLivenessLeniency, monitorsLivenessDeadThreshold, tabState, isBootstrapping, statsAsOf],
  ([$relayChecks, $monitorsSorted, $livenessLeniency, $deadThreshold, $tabState, $isBootstrapping, $statsAsOf]) => {
  // Fast path: if no relay checks yet, return cached data
  const relayEntries = Object.entries($relayChecks);
  if (!relayEntries.length) {
    const cached = loadCachedAggregate();
    return cached.length ? cached : [];
  }

  let aggregates = relayEntries.map(([relay, item]) => {
    // Skip URL normalization for performance - relay URLs should already be normalized
    return {
      relay,
      ...item.aggregate,
      id: relay
    }
  });

  // Derive per-relay liveness from `lastSeen` and user-configured thresholds.
  let onlineAfter: number | null = null;
  let deadBefore: number | null = null;
  try {
    const enabledFrequencies: number[] = [];
    for (const monitor of $monitorsSorted || []) {
      if (monitor?.enabled === false) continue;
      const raw = monitor?.registration?.frequency;
      if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) enabledFrequencies.push(raw);
    }
    enabledFrequencies.sort((a, b) => a - b);
    const baselineFrequency =
      enabledFrequencies.length > 0 ? enabledFrequencies[Math.floor((enabledFrequencies.length - 1) / 2)] : 60 * 60 * 12;

    const leniencyRaw = $livenessLeniency;
    const leniency = Math.min(2, Math.max(1, typeof leniencyRaw === "number" ? leniencyRaw : Number(leniencyRaw)));
    const deadThresholdSeconds = parseDeadThresholdSeconds($deadThreshold);

    // Use the latest known-good dataset timestamp as "now" so seed/cached datasets
    // don't collapse to all-dead just because they're older than wall-clock time.
    const wallNow = Math.round(Date.now() / 1000);
    const refNowRaw = typeof $statsAsOf === "number" && Number.isFinite($statsAsOf) ? Math.round($statsAsOf) : 0;
    const now = refNowRaw > 0 ? Math.min(wallNow, refNowRaw) : wallNow;
    onlineAfter = now - Math.max(0, Math.round(baselineFrequency * leniency));
    deadBefore = now - Math.max(0, deadThresholdSeconds | 0);

    // Compute liveness in-place to avoid extra array allocation
    for (let i = 0; i < aggregates.length; i++) {
      const row = aggregates[i];
      const lastSeen = row?.lastSeen;
      let liveness: "online" | "offline" | "dead" = "dead";
      if (typeof lastSeen === "number" && Number.isFinite(lastSeen)) {
        if (onlineAfter !== null && lastSeen >= onlineAfter) liveness = "online";
        else if (deadBefore !== null && lastSeen < deadBefore) liveness = "dead";
        else liveness = "offline";
      }
      aggregates[i] = { ...row, liveness };
    }
  } catch {}

  // Merge with cached data if we have fewer relays (follower tab scenario)
  const cached = loadCachedAggregate();
  const cacheHasMoreRelays = cached.length > aggregates.length;
  const shouldMergeWithCache = cached.length > 0 && ($tabState !== 'leader' || $isBootstrapping || cacheHasMoreRelays);

  let result = aggregates;
  if (shouldMergeWithCache) {
    // Merge: use fresh data where available, fall back to cached
    const freshByRelay = new Map<string, any>();
    for (const row of aggregates) {
      if (typeof row?.relay === "string") freshByRelay.set(row.relay, row);
    }

    result = cached.map((row: any) => {
      const relay = row?.relay;
      if (typeof relay === "string" && freshByRelay.has(relay)) {
        const next = freshByRelay.get(relay);
        freshByRelay.delete(relay);
        return next;
      }
      // Add liveness to cached rows if missing
      if (typeof row?.liveness !== "string" && typeof row?.lastSeen === "number") {
        let liveness: "online" | "offline" | "dead" = "dead";
        if (onlineAfter !== null && row.lastSeen >= onlineAfter) liveness = "online";
        else if (deadBefore !== null && row.lastSeen < deadBefore) liveness = "dead";
        else liveness = "offline";
        return { ...row, liveness };
      }
      return row;
    });

    // Add any new relays not in cache
    for (const row of freshByRelay.values()) result.push(row);
  }

  // Schedule async cache save for leader tab
  if (get(doAggregateCache) === true && $tabState === 'leader' && result.length > cached.length) {
    scheduleCacheSave(result);
  }

  return result;
  },
  250 // Throttle to max 4 updates per second
);

export const relaysForMiniSearch: Readable<any[]> = throttledDerived(relayCheckAggregates, ($relayCheckAggregates) => {
  let ag = $relayCheckAggregates
  .filter((item) => item?.liveness === 'online')
  .map((item, index) => {
    const { relay, isp, operatorPubkey, supportedNips }  = item
    return { 
      relay,
      operatorPubkey,
      isp,
      supportedNips,
      id: relay,
    }
  });
  if(ag.length) {
    StateManager.set('relays:minisearch', ag);
  }
  else {
    ag = StateManager.get('relays:minisearch');
  }
  
  return ag || [];
}, 1000);

export enum SpeedGroups {
  LightningFast = 100,
  Swift = 80,
  Mid = 60,
  Leisurely = 40,
  Glacial = 20,
}

export const relaySpeedGroupResolver: Readable<(value: number) => SpeedGroups> = derived(
  relayChecks,
  ($relayChecks) => {
    const normalizedRTTs = Object.values($relayChecks)
      .map((item) => item.aggregate.rttNormalized)
      .filter((value): value is number => typeof value === 'number')
      .sort((a, b) => a - b);
    

    const total = normalizedRTTs.length;
    if (total === 0) {
      return () => SpeedGroups.Mid;
      
    }

    const thresholds = {
      LightningFast: normalizedRTTs[Math.floor((1 / 5) * total)],
      Swift: normalizedRTTs[Math.floor((2 / 5) * total)],
      Mid: normalizedRTTs[Math.floor((3 / 5) * total)],
      Leisurely: normalizedRTTs[Math.floor((4 / 5) * total)],
    };

    return (value: number): SpeedGroups => {
      if (value <= thresholds.LightningFast) {
        return SpeedGroups.LightningFast;
      } else if (value <= thresholds.Swift) {
        return SpeedGroups.Swift;
      } else if (value <= thresholds.Mid) {
        return SpeedGroups.Mid;
      } else if (value <= thresholds.Leisurely) {
        return SpeedGroups.Leisurely;
      } else {
        return SpeedGroups.Glacial;
      }
    };
  }
);

export const SpeedGroupBars: Record<SpeedGroups, string> = {
  [SpeedGroups.LightningFast]: '▁▂▃▅█',
  [SpeedGroups.Swift]: '▁▂▃▅',
  [SpeedGroups.Mid]: '▁▂▃',
  [SpeedGroups.Leisurely]: '▁▂',
  [SpeedGroups.Glacial]: '▁',
};

export const SpeedGroupColors: Record<SpeedGroups, string> = {
  [SpeedGroups.LightningFast]: '#00FF00',
  [SpeedGroups.Swift]: '#7FFF00',
  [SpeedGroups.Mid]: '#FFFF00',
  [SpeedGroups.Leisurely]: '#FF7F00',
  [SpeedGroups.Glacial]: '#FF0000',
};

// export const transformCheck = (event: any) => {
//   const nid = event.id;
  
//   const dTag = event.tags.find((tag: string[]) => tag[0] === 'd');
//   const relay = dTag ? new URL(dTag[1]).toString() : null;

//   const monitorPubkey = event.pubkey;
//   const created_at = event.created_at;

//   const network = event.tags.find((tag: string[]) => tag[0] === 'n')?.[1] || null;
//   const rttOpen = parseInt(event.tags.find((tag: string[]) => tag[0] === 'rtt-open')?.[1]) || null;
//   const rttWrite = parseInt(event.tags.find((tag: string[]) => tag[0] === 'rtt-write')?.[1]) || null;
//   const rtt = rttOpen || rttWrite || null;

//   const operatorPubkey = event.tags.find((tag: string[]) => tag[0] === 'p')?.[1] || null;

//   const supportedNips = event.tags
//     .filter((tag: string[]) => tag[0] === 'N')
//     .map((tag: string[]) => parseInt(tag[1])) || null;

//   const software = event.tags.find((tag: string[]) => tag[0] === 's')?.[1] || null;
//   const version = event.tags.find((tag: string[]) => tag[0] === 'l' && tag[2] === 'nip11.version')?.[1] || null;

//   const paymentRequired = event.tags.some((tag: string[]) => tag[0] === 'R' && tag[1] === 'payment') ? true : false;
//   const authRequired = event.tags.some((tag: string[]) => tag[0] === 'R' && tag[1] === 'auth') ? true : false;
//   const powRequired = event.tags.some((tag: string[]) => tag[0] === 'R' && tag[1] === 'auth') ? true : false;

//   const geohash = event.tags.filter((tag: string[]) => tag[0] === 'g').map((tag: string[]) => tag[1]) || null;
//   const geocode = event.tags.find((tag: string[]) => tag[0] === 'l' && tag[2] === 'countryCode' && tag[1].length === 2)?.[1] || null;

//   const isp = event.tags.find((tag: string[]) => tag[0] === 'l' && tag[2].includes('isp'))?.[1] || null;
//   const as = event.tags.find((tag: string[]) => tag[0] === 'l' && tag[2] === 'host.as')?.[1] || null;
//   const asname = event.tags.find((tag: string[]) => tag[0] === 'l' && tag[2] === 'host.asn')?.[1] || null;

//   const ipv4 = event.tags.filter((tag: string[]) => tag[0] === 'l' && tag[2].includes('ipv4')).map((tag: string[]) => tag[1]) || null;

//   return {
//     nid,
//     relay,
//     monitorPubkey,
//     created_at,
//     network,
//     rtt,
//     operatorPubkey,
//     supportedNips,
//     software,
//     version,
//     paymentRequired,
//     authRequired,
//     geohash,
//     geocode,
//     isp,
//     as,
//     asname,
//     ipv4,
//     ipv6: null,
//     sslValidTo: null,
//     sslIssuer: null,
//   };
// }
