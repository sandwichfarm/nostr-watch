import { derived, readable, writable, type Writable, type Readable, get } from "svelte/store";
import { compress, decompress } from 'compress-json'

import { eventsArray } from './events.js';

import { Nip66CheckEvent } from '@nostrwatch/route66/models';
import { StateManager } from "@nostrwatch/route66";
import { doAggregateCache, isBootstrapping } from "./app.js";
import { throttledDerived } from "$utils/stores.js";
import { nip11ValidationErrorCount } from "./nip11-validations.js";
import { eventKey } from "$lib/utils/event-keys";
import { relayCheckAggregator as aggregateRelayChecks, type RelayChecksByRelay } from "$lib/derivations/relay-checks-aggregate";

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
          if (Object.keys(seeded).length) set(seeded);
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
      set((data.relayChecks ?? {}) as RelayChecksByRelay);
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

export const relayChecks: Readable<RelayChecksByRelay> = canUseDerivationWorker
  ? createRelayChecksWorkerStore()
  : derived(
      [eventsChecks, relayChecksActiveKeys, nip11ValidationErrorCount],
      ([$eventsChecks, $relayChecksActiveKeys, $nip11Errors]) => {
        if (!$eventsChecks.length) return {};
        return relayCheckAggregator($eventsChecks as any, $relayChecksActiveKeys, $nip11Errors);
      }
    );

export const relayCheckMap: Readable<Map<string, any>> = derived(relayChecks, ($relayChecks) => {
  const map = new Map();
  for(const [relay, item] of Object.entries($relayChecks)){
    map.set(relay, item.aggregate)
  }
  return map;
})

export const relayCheckAggregates: Readable<any[]> = derived([relayChecks, overrideRelayChecksActiveKeys], ([$relayChecks, $overrideRelayChecksActiveKeys]) => {
  let aggregates = Object.entries($relayChecks).map(([relay, item], index) => {
    try {
      relay = new URL(relay).toString();
    }
    catch(e){
      console.warn('could not normalize relay:', relay)
    }
    return {
      relay,
      ...item.aggregate,
      id: index
    }
  });
  
  const $isBootstrapping = get(isBootstrapping)
  const agg = StateManager.get('aggregate:complete');
  if(!aggregates.length || ($isBootstrapping && agg) ) {
    const aggDecompressed = agg? decompress(agg): [];
    if($isBootstrapping) {
      aggregates = aggDecompressed.map((aggregate: any, index: number) => {
        const freshy = aggregates.find( (item) => item.relay === aggregate.relay )
        return freshy? freshy: aggregate;
      });
    }
    return agg? aggDecompressed: aggregates? aggregates: [];
  }
  else {
    if(get(doAggregateCache) === true && $overrideRelayChecksActiveKeys.length === 0) {
      StateManager.set('aggregate:complete', compress(aggregates))
    }
  }
  return aggregates 
});

export const relaysForMiniSearch: Readable<any[]> = throttledDerived(relayCheckAggregates, ($relayCheckAggregates) => {
  let ag = $relayCheckAggregates.map((item, index) => {
    const { relay, isp, operatorPubkey, supportedNips, lastSeen }  = item
    return { 
      ...{ relay, operatorPubkey },
      id: index,
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
