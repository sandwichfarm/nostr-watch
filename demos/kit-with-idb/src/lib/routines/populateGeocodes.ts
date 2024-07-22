import { NDKEvent } from "@nostr-dev-kit/ndk";
import { relayDb, RelayTransform } from "@nostrwatch/idb";

export const populateGeocodes = async ( monitorPubkey: string): Promise<number> => {  
  const events = await relayDb.events.where({monitorPubkey}).toArray()
  let mostRecent = 0
  events.forEach(async (event) => {
    const geocode = (await RelayTransform( event.event ))?.geocodes
    if(!geocode) return
    if(geocode) {
      console.log(`adding geocode ${geocode.nid}`)
      await relayDb.geocodes.put(geocode)
    }
  })
  return mostRecent
};