import NDK, { NDKKind, NDKRelayMonitor,NDKRelayMeta } from "@nostr-dev-kit/ndk";
import { relayDb, RelayTransform } from "@nostrwatch/idb";

export const populateEvents = async ( monitor: NDKRelayMonitor ): Promise<number> => {  
  console.log(monitor.ndk)
  const filter = monitor.nip66Filter([NDKKind.RelayMeta], {limit: 1000})
  console.log('filter', filter) 
  const events = await monitor.ndk.fetchEvents(filter)
  let mostRecent = 0
  let count = 1
  console.log('events', events.size)
  events.forEach(async (event: NDKRelayMeta) => {
    if(event.created_at > mostRecent) mostRecent = event.created_at
    const _event = (await RelayTransform(event.rawEvent()))?.event
    await relayDb.events.put(_event)
    console.log(`${count++}/${events.size} event added ${event.id}`)
  })
  return mostRecent
};