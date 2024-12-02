import { derived, writable, type Writable, type Readable } from "svelte/store";

interface Check {
  relay: string;
  monitorPubkey: string;
  [id: string]: any;
}

import { eventsArray } from './events.js';

import type { Nip66Event } from '@nostrwatch/nip66/models';
import { StateManager } from "@nostrwatch/nip66";

export const transformCheck = (event: any) => {
  const nid = event.id;
  
  const dTag = event.tags.find((tag) => tag[0] === 'd');
  const relay = dTag ? new URL(dTag[1]).toString() : null;

  const monitorPubkey = event.pubkey;
  const created_at = event.created_at;

  const network = event.tags.find((tag) => tag[0] === 'n')?.[1] || null;
  const rttOpen = parseInt(event.tags.find((tag) => tag[0] === 'rtt-open')?.[1]) || null;
  const rttWrite = parseInt(event.tags.find((tag) => tag[0] === 'rtt-write')?.[1]) || null;
  const rtt = rttOpen || rttWrite || null;

  const operatorPubkey = event.tags.find((tag) => tag[0] === 'p')?.[1] || null;

  const supportedNips = event.tags
    .filter((tag) => tag[0] === 'N')
    .map((tag) => parseInt(tag[1])) || null;

  const software = event.tags.find((tag) => tag[0] === 's')?.[1] || null;
  const version = event.tags.find((tag) => tag[0] === 'l' && tag[2] === 'nip11.version')?.[1] || null;

  const paymentRequired = event.tags.some((tag) => tag[0] === 'R' && tag[1] === 'payment') ? true : false;
  const authRequired = event.tags.some((tag) => tag[0] === 'R' && tag[1] === 'auth') ? true : false;
  const powRequired = event.tags.some((tag) => tag[0] === 'R' && tag[1] === 'auth') ? true : false;

  const geohash = event.tags.filter((tag) => tag[0] === 'g').map((tag) => tag[1]) || null;
  const geocode = event.tags.find((tag) => tag[0] === 'l' && tag[2] === 'countryCode' && tag[1].length === 2)?.[1] || null;

  const isp = event.tags.find((tag) => tag[0] === 'l' && tag[2].includes('isp'))?.[1] || null;
  const as = event.tags.find((tag) => tag[0] === 'l' && tag[2] === 'host.as')?.[1] || null;
  const asname = event.tags.find((tag) => tag[0] === 'l' && tag[2] === 'host.asn')?.[1] || null;

  const ipv4 = event.tags.filter((tag) => tag[0] === 'l' && tag[2].includes('ipv4')).map((tag) => tag[1]) || null;

  return {
    nid,
    relay,
    monitorPubkey,
    created_at,
    network,
    rtt,
    operatorPubkey,
    supportedNips,
    software,
    version,
    paymentRequired,
    authRequired,
    geohash,
    geocode,
    isp,
    as,
    asname,
    ipv4,
    ipv6: null,
    sslValidTo: null,
    sslIssuer: null,
  };
}

export const relayChecks: Readable<
  Record<string, { a: Record<string, any>; checks: Check[]; aggregate?: any }>
> = derived(eventsArray, ($checks) => {
  const countMap: Record<
    string,
    { a: Record<string, any>; checks: Check[]; aggregate?: any }
  > = {};

  const relayAverages: Record<string, number> = {};
  const relayCounts: Record<string, number> = {};

  $checks.forEach((check) => {
    const relay = check.relay;
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
    countMap[relay].aggregate = countMap[relay].checks.reduceRight((acc: any, nip66Event: Nip66Event) => {
      nip66Event.keys.forEach((key: string) => {
        const value = nip66Event[key];
        
        const isNonNull = value !== null && value !== undefined;
  
        const isArray = Array.isArray(value);
        const isAccArray = Array.isArray(acc[key]);
        if (isArray) {
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
});

export const relayAggregates: Readable<any[]> = derived(relayChecks, ($relayChecks) => {
  return Object.entries($relayChecks).map(([relay, item], index) => ({
    relay,
    ...item.aggregate,
    id: index,
  }));
});


export const relaysForMiniSearch: Readable<any[]> = derived(relayAggregates, ($relayAggregates) => {
  let ag = $relayAggregates.map((item, index) => {
    const { relay, isp, operatorPubkey, supportedNips, lastSeen }  = item
    return { 
      ...{ relay, isp, operatorPubkey, supportedNips, lastSeen },
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
});

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