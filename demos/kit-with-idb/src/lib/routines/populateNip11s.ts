import { NDKEvent } from "@nostr-dev-kit/ndk";
import { relayDb, RelayTransform } from "@nostrwatch/idb";
import { nip11Store } from "../stores/nip11Store";

export const populateNip11s = async ( monitorPubkey: string): Promise<number>  => {  
  const events = await relayDb.events.where({monitorPubkey}).toArray()
  let mostRecent = 0
  events.forEach(async (event) => {
    const nip11 = (await RelayTransform( event.event ))?.nip11
    if(!nip11) return
    if(nip11) {
      if(nip11.createdAt > mostRecent) mostRecent = nip11.createdAt
      console.log(`adding nip11 ${nip11.nid}`)
      await relayDb.nip11s.put(nip11)
    }
  })
  return mostRecent
};