// import { NostrEvent } from "@nostr-dev-kit/ndk";
import { relayDb, RelayTransform } from "@nostrwatch/idb";

export const populateSsls = async ( monitorPubkey: string): Promise<number> => {  
  const events = await relayDb.events.where({monitorPubkey}).toArray()
  let mostRecent = 0
  events.forEach(async (event) => {
    const timestamp = await putSsl(event.event)
    if(timestamp && timestamp > mostRecent) mostRecent = timestamp
  })
  return mostRecent
};

export const putSsl = async (event): Promise<number | undefined> => {
  const ssl = (await RelayTransform( event ))?.ssl
    if(!ssl) return
    if(ssl) {
      console.log(`adding ssl ${ssl.nid}`)
      await relayDb.ssls.put(ssl)
      return ssl.createdAt
    }
}