import { writable } from 'svelte/store';
import { relayDb, liveQuery, type Observable } from '@nostrwatch/idb';
import { queueStore } from '$lib/stores/QueueStore';

const localPing = writable(new Map());

async function fetchPingTimes() {
  const relays = await relayDb.relays.toArray();

  relays.forEach(async (relay) => {
    const { relay: url } = relay;
    const { result } = await queueStore.addTask(url);

    localPing.update(map => {
      const newMap = new Map(map); // Create a copy of the current map
      newMap.set(url, result.duration); // Update the map with new data
      return newMap; // Return the updated map
    });
  });
}

// Ensure this function is called somewhere in your component lifecycle
fetchPingTimes();

export { localPing };