import { NDKEvent } from "@nostr-dev-kit/ndk";
import { relayDb, RelayTransform } from "@nostrwatch/idb";

export const populateChecks = async ( monitorPubkey: string): Promise<number> => {  
  const events = await relayDb.events.where({monitorPubkey}).toArray()
  let mostRecent = 0
  events.forEach(async (event) => {
    const check = (await RelayTransform( event.event ))?.check
    if(!check) return
    if(check) {
      if(check.createdAt > mostRecent) mostRecent = check.createdAt
      console.log(`adding check ${check.nid}`)
      await relayDb.checks.put(check)
    }
  })
  return mostRecent
};