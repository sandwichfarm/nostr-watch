import { derived, writable, type Writable, get } from "svelte/store";
import type { ICheck } from "@nostrwatch/nip66/models";
import { eventsArray } from "./events.js";
import type { IMonitor, IEvent } from "@nostrwatch/nip66/models";
import { throttledDerived } from "$lib/utils/stores.js";
import { MonitorManager, StateManager } from "@nostrwatch/nip66";
import { Monitor } from '@nostrwatch/nip66/models'
import { nip05s, validNip05s } from "./nip05s.js";


export const monitorsMap: Writable<Map<string, Monitor>> = writable(new Map());

export const monitors = derived(
  monitorsMap, 
  ($monitorsMap) => {
    const arr = Array.from($monitorsMap.values());
    if(arr.length){
      const cacheValues = arr.map(( monitor: Monitor) => {
        console.log('before cache monitor', typeof monitor.toCache, monitor)
        return monitor.toCache()
      })
      StateManager.set('cache:monitors', cacheValues);  
    }
    return arr;
  }
)

export const monitorsSorted = derived(
  monitors,
  ($monitors) => {
    return MonitorManager.sortMonitorsByPriority($monitors);
  }
);

export const monitorNip05s = derived(
  monitors,
  monitors => 
    monitors
      .filter( m => m?.profile?.nip05 )
      .map( m => ({ pubkey: m.pubkey, nip05: m.profile.nip05 }) )
)

export const monitorChecksCount = derived(
  eventsArray, 
  ($eventsArray) => {
    const countMap: Record<string, number> = {};
    $eventsArray.forEach((event: any) => {
      countMap[event.pubkey] = (countMap?.[event.pubkey] || 0) + 1;
    });
    console.log('monitor counts', countMap)
    return countMap;
  }
);


export const monitorRows = derived(
  [monitorsSorted, monitorChecksCount, nip05s],
  ([$monitorsSorted, $monitorChecksCount, $nip05s]) => {
    return $monitorsSorted.map((monitor: Monitor) => {
      const row: Record<string, any> = new Object();
      row.id = monitor.registration.pubkey;
      row.active = monitor.active;
      row.pubkey = monitor.registration.pubkey;
      row.name = monitor.profile?.name ?? null
      row.photo = monitor?.profile?.photo ?? monitor?.profile?.picture ?? null
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
      row.reportingOnline = $monitorChecksCount?.[monitor.registration.pubkey] ?? 0
      return row;
    })
  }
);


