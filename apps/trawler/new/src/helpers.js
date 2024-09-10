import { parseRelayList } from "./parse.js";
import { lastTrawledId }  from "./helpers.js";
import { parseRelayNetwork } from "@nostrwatch/utils"

export const addRelaysToCache = async (cache, relayList) => {
  const ids = []
  for (const relayObj of relayList) {
    ids.push(await cache.relay.insertIfNotExists(relayObj))
  }
  return ids.filter(id => id !== undefined)
}

export const noteInCache = async (cache, ev, relay, lastEvent) => {
  const exists = await cache.note.exists(ev)
  if( exists )
    await cache.cachetime.set( lastTrawledId(relay), lastEvent )
  return exists
}

export const setLastEvent = (ev, since, lastEvent) => {
  const timestamp = parseInt(ev.created_at)
  return timestamp>lastEvent? (timestamp>since? timestamp: since): lastEvent
}

export const determineSince = async (cache, relay) => {
  const cacheSince = await cache.cachetime.get.one( lastTrawledId(relay) )
  return cacheSince || 0
}

export const relaysFromRelayList = async ( ev ) => {
  let relayList = parseRelayList(ev)
          
  if(!(relayList instanceof Array)) 
    return false
  
  relayList = relayList.map( relay => {
    return {
      url: relay,
      network: parseRelayNetwork(relay),
      online: null
    }
  })
  return relayList
}
