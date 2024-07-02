import { derived, writable } from 'svelte/store';

import { monitorDb, liveQuery, type IMonitor } from '@nostrwatch/idb';
import { getContext, setContext } from 'svelte';
import NDK, { NDKRelayMonitor } from '@nostr-dev-kit/ndk';
import { storeKey } from '.';
import { NDK_CONTEXT } from '$lib/contextKeys';
    
export type MonitorStore = Map<string, IMonitor>

interface MonitorInterface {
  subscribe: MonitorStore['subscribe'];
  update: MonitorStore['update'];
  set: MonitorStore['set'];
  sync: (monitorPubkey: string) => Promise<void>;
}

const monitorData = writable(new Map());

liveQuery( () => monitorDb.monitors.toArray()).subscribe( (_monitors: IMonitor[]) => monitorData.set(dbToMap(_monitors)) );

export function monitors() {
  const { subscribe, set, update } = monitorData

  const sync = (): Promise<void> => {
    return new Promise (async (resolve, reject) => {
      try {
          const data: MonitorStore = dbToMap(await monitorDb.monitors.toArray())
          resolve(set(data));
      } catch (error) {
          console.error(error);
          reject (error);
      }
    })
  }

  return {
    subscribe,
    set,
    update,
    sync
  }
}

const dbToMap = (monitors: IMonitor[]): MonitorStore => {
  return monitors.reduce(function(map, monitor: IMonitor) {
    map[monitor.monitorPubkey] = monitor;
    return map;
  }, new Map());
}

const updateMonitors = (monitors: IMonitor[]) => {
  monitorsStore.update(store => {
    monitors.forEach(monitor => {
      store.set(monitor.monitorPubkey, monitor);
    });
    return store;
  });
}

export const monitorsStore = monitors();

liveQuery( () => monitorDb.monitors.toArray() ).subscribe(updateMonitors);

// export const monitorProfiles = derived(
// 	monitorsStore,
// 	($monitorsStore) => {
//     const profiles = new Map()
//     const ndk: NDK = getContext(NDK_CONTEXT)
//     Array.from($monitorsStore.keys()).forEach(async (pubkey) => {
//       const user = await ndk.getUser(pubkey)
//       profiles.set(pubkey, await user.fetchProfile())
//     })
//     return profiles
//   }
// );



