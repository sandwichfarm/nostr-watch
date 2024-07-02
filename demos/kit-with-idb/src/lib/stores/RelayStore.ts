// import { relayDb, type IRelay } from '@nostrwatch/idb';
// import { configureCustomStorageType, persisted } from '@square/svelte-store';

// export type RelaysDbKey = Record<string, string | number>;

// const defaultIRelay = { relay: "", lastSeen: -1, network: ""}

// const storageType = 'IDB.RELAYS'

// configureCustomStorageType(storageType, {
//   getStorageItem: (key: string): Promise<IRelay> => {
//     return relayDb.relays.get(JSON.parse(key))
//   },
//   setStorageItem: (key: string, value: IRelay): Promise<string> => {
//     return relayDb.relays.put(value)
//   },
//   removeStorageItem: (key) => {
//     return relayDb.relays.delete(key)
//   },
// });

// export const relays = (defaultValue: IRelay = defaultIRelay, key: RelaysDbKey) => {
//   return persisted(
//     defaultValue, 
//     JSON.stringify(key), 
//     { storageType, reloadable: true }
//   );
// }


import { writable, get, type Writable } from 'svelte/store';

import { relayDb, liveQuery, type IRelay } from '@nostrwatch/idb';
// import { checksStore, getRelayMonitorCounts,  } from './checksStore';
import { checksStore, nip11Store, checkStatStore } from './index';

export type RelayStore = IRelay[]
const relayData: Writable<RelayStore> = writable([]);

liveQuery( () => relayDb.relays.toArray()).subscribe( (_relays: IRelay[]) => relayData.set(_relays) );

export function relays() {
  const { subscribe, set:_set, update } = relayData

  const sync = (): Promise<void> => {
    return new Promise (async (resolve, reject) => {
      try {
          const data: RelayStore = await relayDb.relays.toArray()
          resolve(set(data));
      } catch (error) {
          console.error(error);
          reject (error);
      }
    })
  }

  const set = async (relays:RelayStore) => {
    relayDb.relays.bulkPut(relays)
    _set(relays);
  }

  return {
    subscribe,
    set,
    update,
    sync
  }
}


// const checksStore = checks();

const primaryMonitorPubkey = "9bbbb845e5b6c831c29789900769843ab43bb5047abe697870cb50b6fc9bf923"
// export const relayStore = writable([]);
export const monitorRelays = liveQuery(() => relayDb.checks.where({primaryMonitorPubkey}).toArray());
export const relayStore = liveQuery(() => relayDb.relays.toArray() );

// checksStore.subscribe(checks => {

// })

const updateRelays = async (relays: IRelay[]) => {
  relays.forEach((relay) => {
    const { relay: url } = relay; // Assuming relay object has 'relay' property to be used as URL
    // checksStore.sync(url, primaryMonitorPubkey);
    // nip11Store.sync(url, primaryMonitorPubkey);
  });
}

relayStore.subscribe( updateRelays );

export const populateRelaysStore = () => {
  // relayDb.relays.toArray().then(updateRelays);
}

// setContext('relays', relayStore);