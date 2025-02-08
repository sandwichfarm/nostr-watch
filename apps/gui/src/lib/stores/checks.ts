import { derived, writable, type Writable, type Readable, get } from "svelte/store";
import { compress, decompress } from 'compress-json'

interface Check {
  relay: string;
  monitorPubkey: string;
  [id: string]: any;
}

import { eventsArray } from './events.js';

import { Nip66CheckEvent } from '@nostrwatch/route66/models';
import { StateManager } from "@nostrwatch/route66";
import { doAggregateCache, isBootstrapping } from "./app.js";
import { throttledDerived } from "$utils/stores.js";
import { nip11ValidationErrorCount } from "./nip11-validations.js";
import { monitorsMap } from "./monitors.js";

let nip11Errors: Map<string, number> = new Map();

nip11ValidationErrorCount.subscribe((value) => {
  nip11Errors = value;
})

export const overrideRelayChecksActiveKeys: Writable<string[]> = writable([]);

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
    "dd"
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

export const relayCheckAggregator = ($checks: Nip66CheckEvent[]) => {
  const countMap: Record<
    string,
    { a: Record<string, any>; checks: Check[]; aggregate?: any }
  > = {};

  const relayAverages: Record<string, number> = {};
  const relayCounts: Record<string, number> = {};

  

  $checks.forEach((check: Nip66CheckEvent) => {
    let relay: string;
    if(!check?.relay) return;
    // if(check.tags.find( (tag: string[]) => tag[0] === 'a' && tag[1]?.startsWith('30166:'))) {
    //   return;
    // } 
    try {
      relay = new URL(check?.relay).toString();
    }
    catch(e){
      console.warn('could not normalize relay:', check.relay)
    }

    const monitor = get(monitorsMap).get(check.pubkey);

    if(monitor?.checks.includes('open')) {
      if (!relayAverages[relay]) {
        relayAverages[relay] = 0;
        relayCounts[relay] = 0;
      }

      const rtt = check.rtt;
      if (typeof rtt === 'number') {
        relayAverages[relay] += rtt;
        relayCounts[relay] += 1;
      }

      if (!countMap[relay]) {
        countMap[relay] = { a: {}, checks: [] };
      }
      countMap[relay].checks.push(check);
    }
  });

  Object.keys(relayAverages).forEach((relay) => {
    const sum = relayAverages[relay];
    const count = relayCounts[relay];
    const avg = count > 0 ? sum / count : 0;
    relayAverages[relay] = avg;
  });

  const averageValues = Object.values(relayAverages);
  const globalMin = Math.min(...averageValues);
  const globalMax = Math.max(...averageValues);
  const range = globalMax - globalMin || 1;

  Object.keys(countMap).forEach((relay) => {
    countMap[relay].aggregate = countMap[relay].checks.reduceRight((acc: any, nip66Event: Nip66CheckEvent) => {
      Nip66CheckEvent.keys.forEach((key: string) => {
      // get(relayChecksActiveKeys).forEach((key: string) => {
        const value = nip66Event[key];
        
        const isNonNull = value !== null && value !== undefined;
  
        const isArray = Array.isArray(value);
        const isAccArray = Array.isArray(acc[key]);

        if(key === 'nip11ValidationErrors'){
          const nip11ValidationErrors = nip11Errors.get(relay)
          acc.nip11ValidationErrors = nip11ValidationErrors? nip11ValidationErrors: 0;
          return acc
        }
        else if(key === 'nip11IsValid'){
          const nip11ValidationErrors = nip11Errors.get(relay)
          if(typeof nip11ValidationErrors === 'number') {
            acc.nip11IsValid = nip11ValidationErrors === 0? true: false;  
          }
          else {
            acc.nip11IsValid = null;
          }
          
          return acc
        }
        else if(key === 'seenTimes') {
          if(!acc?.seenTimes) {
            acc.seenTimes = 1;
          }
          else {
            acc.seenTimes += 1;
          }
          return acc;
        }
        else if(key === 'monitorPubkey'){
          if(!acc?.seenBy) {
            acc.seenBy = [];
          }
          acc.seenBy.push(value);
        }
        else if(key === 'created_at'){
          if(!acc?.lastSeen) {
            acc.lastSeen = value;
          }
          else if(value > acc.lastSeen) {
            acc.lastSeen = value;
          }
        }
        else if (isArray) {
          acc[key] = isAccArray
            ? [...new Set([...acc[key], ...value])]
            : value;
        } else if (!isArray && isNonNull) {
          acc[key] = value;
        }
      });
      return acc;
    }, {});
  });

  Object.keys(relayAverages).forEach((relay) => {
    const avg = relayAverages[relay];
    const normalized = (avg - globalMin) / range;
    countMap[relay].aggregate.rtt = avg
    countMap[relay].aggregate.rttNormalized = Math.round(normalized * 10000) / 10000
  });

  return countMap;
}

export const eventsChecks: Readable<Nip66CheckEvent[]> = derived(eventsArray, ($events) => {
  return $events.filter(event => event.kind === 30166) as Nip66CheckEvent[];
})



export const relayChecks: Readable<
  Record<string, { a: Record<string, any>; checks: Check[]; aggregate?: any }>
> = derived(eventsChecks, ($eventsChecks) => {
  if(!$eventsChecks.length) return {};
  return relayCheckAggregator($eventsChecks);
});

export const relayCheckAggregates: Readable<any[]> = derived(relayChecks, ($relayChecks) => {
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
    if(get(doAggregateCache) === true) StateManager.set('aggregate:complete', compress(aggregates))
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