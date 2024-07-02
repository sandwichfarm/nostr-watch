import { writable, type Writable } from 'svelte/store';
import { relayDb, liveQuery, type ICheck } from '@nostrwatch/idb';

import { preferencesStore } from './preferencesStore';
// export * from '$lib/stores/checkCountStore';

export type CheckStatStore = Writable<Map<string, string[]>>;

interface CheckStatInterface {
  subscribe: CheckStatStore['subscribe'];
  update: CheckStatStore['update'];
  set: CheckStatStore['set'];
  sync: (relay: string) => Promise<void>;
}

const checkStats = (): CheckStatInterface => {
  const store: CheckStatStore = writable(new Map());
  const { subscribe, update, set } = store;
  let monitorPubkey: string | undefined;

  preferencesStore.subscribe(preferences => {
    monitorPubkey = preferences.primaryMonitorPubkey;
  });

  const sync = async (relay: string) => {
    relayDb.checks
      .where({ relay })
      .toArray()
      .then(results => {
        const uniquePubkeys = Array.from(new Set(results.map(check => check.monitorPubkey)));
        store.update(store => store.set(relay, uniquePubkeys));
      })
      .catch(error => {
        console.error(`Error fetching monitor counts for ${relay}:`, error);
      });
  };

  return {
    subscribe,
    update,
    set,
    sync,
  };
};


export const checkStatStore = checkStats();
