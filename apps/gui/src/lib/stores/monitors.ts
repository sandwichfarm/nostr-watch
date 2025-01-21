import { derived, writable, type Writable, get } from "svelte/store";
import type { ICheck } from "@nostrwatch/route66/models";
import { eventsArray } from "./events.js";
import type { IMonitor, IEvent } from "@nostrwatch/route66/models";
import { throttledDerived } from "$lib/utils/stores.js";
import { MonitorManager, StateManager } from "@nostrwatch/route66";
import { Monitor } from '@nostrwatch/route66/models'
import { nip05s, validNip05s } from "./nip05s.js";
import { route66 } from "./route66.js";
import type Route66 from "@nostrwatch/route66";

let $route66: Route66 | null;

route66.subscribe(instance => $route66 = instance)

export const monitorsMapFromCache = (): Map<string, Monitor>  => {
  const monitorsArr = StateManager.get('cache:monitors');  
  if(!monitorsArr?.length) return new Map()
  const map: Map<string, Monitor> = new Map()
  for(const monitor of monitorsArr) {
    const mon = Monitor.fromCache(monitor)
    if(!mon) continue
    map.set(monitor.pubkey, mon)
  }
  return map
}

export const monitorsMap: Writable<Map<string, Monitor>> = writable(monitorsMapFromCache());

export const monitors = derived(
  monitorsMap, 
  ($monitorsMap) => {
    let arr = Array.from($monitorsMap.values());
    if(arr.length){
      let sorted = $route66?.services?.monitors?.sortedMonitors
      if(sorted !== undefined && sorted.length) {
        StateManager.set('cache:monitors', sorted.map(( monitor: Monitor) => monitor.toCache()));
      }
      else {
        StateManager.set('cache:monitors', arr.map(( monitor: Monitor) => monitor.toCache()));   
      }
    }
    else {
      const fromCacheValues = StateManager.get('cache:monitors');  
      if(fromCacheValues?.length) {
        arr = fromCacheValues.map( (cache: any) => Monitor.fromCache(cache) );
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

export const monitorChecksCount = derived(
  [eventsArray],
  ([$eventsArray]) => {
    const countMap: Record<string, number> = {};
    $eventsArray.forEach((event: any) => {
      countMap[event.pubkey] = (countMap?.[event.pubkey] || 0) + 1;
    });
    return countMap;
  }
);

export const monitorRows = derived(
  [monitorsSorted, activeMonitorChecksCount, monitorChecksCount, nip05s],
  ([$monitorsSorted, $activeMonitorChecksCount, $monitorChecksCount, $nip05s]) => {
    return $monitorsSorted.map((monitor: Monitor) => {
      const row: Record<string, any> = new Object();
      row.id = monitor.pubkey;
      row.active = monitor.active;
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
      row.reportingOnline = $monitorChecksCount?.[monitor.pubkey] ?? $activeMonitorChecksCount?.[monitor.pubkey] ?? 0
      return row;
    })
  }
);


