import { derived, writable, type Writable, get } from "svelte/store";
import type { ICheck } from "@nostrwatch/nip66/models";
import { eventsArray } from "./events.js";
import type { IMonitor, IEvent } from "@nostrwatch/nip66/models";
import { throttledDerived } from "$lib/utils/stores.js";
import { MonitorManager, StateManager } from "@nostrwatch/nip66";


export type Monitor = {
  priority?: number,
  registration?: IMonitor,
  relays?: string[],
  profile?: any
}

export const monitorsMap: Writable<Map<string, any>> = writable(new Map());

export const monitors = throttledDerived(
  monitorsMap, 
  ($monitorsMap) => {
    const arr = Array.from($monitorsMap.values());
    StateManager.set('cache:monitors', arr);
    return arr;
  },
  10
)

export const monitorRows = derived(
  monitorsMap,
  ($monitorsMap) => {
    const $monitors = Array.from($monitorsMap.values());
    return $monitors.map((monitor: Monitor) => {
      const row: Record<string, any> = new Object();
      row.id = monitor.registration.pubkey;
      row.pubkey = monitor.registration.pubkey;
      row.name = monitor.profile.name ?? null
      row.photo = monitor?.profile?.photo ?? monitor?.profile?.picture ?? null
      row.about = monitor?.profile?.about ?? null
      row.nip05 = monitor?.profile?.nip05 ?? null
      row.lud16 = monitor?.profile?.lud16 ?? null
      row.geohash = monitor?.registration?.geohash ?? null
      row.checks = monitor?.registration?.checks ?? null
      row.networks = monitor?.registration?.networks ?? null
      row.frequency = monitor?.registration?.frequency ?? null
      row.lastActive = monitor?.registration?.lastActive ?? null
      row.relays = monitor.relays ?? null
      const reportingOnline = get(monitorChecksCount)
      row.reportingOnline = reportingOnline?.[monitor.registration.pubkey] ?? 0
      return row;
    })
  }
);

export const prioritizedMonitors = derived(
  monitors,
  ($monitors) => {
    return MonitorManager.sortMonitorsByPriority($monitors);
  }
);

export const monitorChecksCount = throttledDerived(
  eventsArray, 
  ($eventsArray) => {
    const countMap: Record<string, number> = {};
    $eventsArray.forEach((event: any) => {
      countMap[event.pubkey] = (countMap?.[event.pubkey] || 0) + 1;
    });
    return countMap;
  },
  5000
);