import { NDKEvent } from "@nostr-dev-kit/ndk";
import { relayDb, RelayTransform } from "@nostrwatch/idb";

export const populateRelays = async ( monitorPubkey: string): Promise<number> => {  
  const events = await relayDb.events.where({monitorPubkey}).toArray()
  let mostRecent = 0
  events.forEach(async (event) => {
    const relay = (await RelayTransform( event.event ))?.relay
    if(!relay) return
    if(relay) {
      if(relay.lastSeen > mostRecent) mostRecent = relay.lastSeen
      console.log(`adding relay ${relay.relay}`)
      await relayDb.relays.put(relay)
    }
  })
  return mostRecent
};