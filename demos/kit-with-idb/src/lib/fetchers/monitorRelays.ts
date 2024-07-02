import { browser } from '$app/environment';

import NDK, { type NDKFilter } from "@nostr-dev-kit/ndk";

import { MonitorManager } from "@nostrwatch/kit";
import { MonitorCacheIdbAdapter, RelayCacheIdbAdapter } from "@nostrwatch/kit-adapter-idb";
import { relayDb, liveQuery } from '@nostrwatch/idb';

import { storable } from '$lib/stores/localStorageStore';

let primaryMonitorPubkey
const explicitRelayUrls = ['wss://purplepag.es', 'wss://relaypag.es', 'wss://history.nostr.watch'];

export const monitorRelays = liveQuery(() => relayDb.checks.where({primaryMonitorPubkey}).toArray());
export const knownRelays = liveQuery(() => relayDb.relays.toArray());

// knownRelays.subscribe(async (relays) => {
//   console.log(relays)
//   relayStore.set(relays);
//   const _checkStore = {};
//   const _checkCountStore = {};
//   relays.forEach(async (relay) => {
//     const {relay:url} = relay 
//     _checkStore[url] = getRelayChecksByMonitor(primaryMonitorPubkey);
//     _checkCountStore[url] = getRelayMonitorCounts(url)
//   });
//   checkStore.set(_checkStore);
//   checkCountStore.set(_checkCountStore);
// });

export const getRelayChecksByMonitor = async (monitorPubkey: string) => {
 return liveQuery(() => relayDb.checks.where({monitorPubkey}).toArray());
}

export const getRelayMonitorCounts = async (relay: string) => {
  // return liveQuery(() => relayDb.checks.where({relay}).count());
  return relayDb.checks.where({relay}).count()
 }

const statToFilter = (stats): Record<string, NDKFilter> => {
  const filter: Record<string, NDKFilter> = {};
  Object.keys(stats).forEach(key => {
    const since = stats[key]?.mostRecent
    if(!since) return
    filter[key] = { since }
  })
  return filter
}

export const initRelayData = async (ndk: NDK, _primaryMonitorPubkey: string): Promise<MonitorManager> => {
  primaryMonitorPubkey = _primaryMonitorPubkey
  // const lastCheckStore = storable('monitorStat');
  if (!browser) return console.warn('not in browser.');
  console.log('mounted');

  console.log('monitors init');
  const monitors = new MonitorManager(
    ndk, 
    {
      primaryMonitor: primaryMonitorPubkey,
      monitorCache: new MonitorCacheIdbAdapter(ndk),
      relayCache: new RelayCacheIdbAdapter(ndk)
    }, 
    undefined
  );
  const stats = await monitors.init()
  console.log('stats', stats)
  // await monitors.populateRelays(new Set([await monitors.cache.get(primaryMonitorPubkey)]))
  // lastCheckStore.set(stats)
  return monitors
}
