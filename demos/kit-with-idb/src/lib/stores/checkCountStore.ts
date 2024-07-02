import { writable, type Writable } from 'svelte/store';
import { relayDb, liveQuery, type ICheck } from '@nostrwatch/idb';

export const checkStatStore = writable({});

export function getRelayMonitorCounts(relay: string) {
  relayDb.checks
    .where({ relay })
    .toArray()
    .then(results => {
      const uniquePubkeys = new Set(results.map(check => check.monitorPubkey));
      checkStatStore.update(store => {
        return { ...store, [relay]: uniquePubkeys.size };
      });
    })
    .catch(error => {
      console.error(`Error fetching monitor counts for ${relay}:`, error);
    });
}

