import { writable, type Writable } from 'svelte/store';
import { liveQuery, relayDb, type ICheck } from '@nostrwatch/idb';
import { preferencesStore } from './preferencesStore';
import { checkStatStore } from './checkStatStore';
import { storeKey } from '.';
// export * from '$lib/stores/checkCountStore';

export type CheckStore = Writable<Map<string, ICheck>>;



interface ChecksInterface {
  subscribe: CheckStore['subscribe'];
  update: CheckStore['update'];
  set: CheckStore['set'];
  sync: (relay: string, monitorPubkey: string) => Promise<void>;
}

const checks = (): ChecksInterface => {
  const store: CheckStore = writable(new Map());
  const { subscribe, update, set } = store;
  let monitorPubkey: string | undefined;

  preferencesStore.subscribe(preferences => {
    monitorPubkey = preferences.primaryMonitor;
  });

  const populate = async () => {
    const record = await relayDb.checks.toArray();
    if (record) {
      const records = new Map()
      record.forEach(check => {
        update(store => store.set(check.relay, check));
      });
    }
  }

  const sync = async (relay: string, monitorPubkey: string) => {
    const record = await relayDb.checks.where({ relay, monitorPubkey }).first();
    if (record) {
      update(store => store.set(storeKey(relay, monitorPubkey), record));
    }
  };

  return {
    subscribe,
    update,
    set,
    sync,
  };
};

const updateChecks = (checks: ICheck[]) => {
  checksStore.update(store => {
    const updatedStore = new Map(store);
    checks.forEach(check => {
      updatedStore.set(storeKey(check.relay, check.monitorPubkey), check);
      // checkStatStore.sync(check.relay);
    });
    return updatedStore;
  });
}

liveQuery( () => relayDb.checks.toArray() ).subscribe(updateChecks);

export const populateChecksStore = () => {
  relayDb.checks.toArray().then(updateChecks);
}

export const checksStore = checks();

// export function getRelayCheckByMonitor(relay: string, monitsrPubkey: string) {
//   relayDb.checks.where({ relay, monitorPubkey }).first()
//     .then(result => {
//       if (result) {
//         checkStore.update(store => {
//           const updatedStore = new Map(store);
//           updatedStore.set(relay, result);
//           return updatedStore;
//         });
//       }
//     })
//     .catch(error => {
//       console.error(`Error fetching check data for ${relay}:`, error);
//     });
// }
