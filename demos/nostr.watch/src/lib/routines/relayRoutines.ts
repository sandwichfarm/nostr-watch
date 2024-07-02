import { eventsPurgeAge, liveQuery, monitorDb } from "@nostrwatch/idb"
import { monitorStore } from "$lib/stores"
import type { NDKRelayMonitor } from "@nostr-dev-kit/ndk"

let monitors = new Set()

export const relayRoutines = {
  monitors.keys().forEach(async (monitorPubkey) => {
    monitors.get(monitorPubkey).frequency
    eventsPurgeAge();  
  })
}

