import { writable } from 'svelte/store';

import { relayDb, liveQuery } from '@nostrwatch/idb';

export const localCheckStore = writable({});

export function getLocalCheckRtt(relay) {
  const result = relayDb.checks.where({relay, monitorPubkey: 'currentuser'})
  if (result) {
    localCheckStore.update(store => {
      return { ...store, [relay]: result };
    });
  }
}