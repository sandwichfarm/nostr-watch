import { parseRelayList } from "./parse.js";
import { parseRelayNetwork } from "@nostrwatch/utils"

export const calculateLastEvent = (ev, since, lastEvent) => {
  const timestamp = parseInt(ev.created_at)
  return timestamp>lastEvent? (timestamp>since? timestamp: since): lastEvent
}

export const addRelaysToCache = async (rcache, relayList) => {
  const ids = []
  for (const relayObj of relayList) {
    ids.push(await rcache.relay.insertIfNotExists(relayObj))
  }
  return ids.filter(id => id !== undefined)
}

export const relaysFromRelayList = async ( ev ) => {
  let relayList = parseRelayList(ev)
          
  if(!(relayList instanceof Array)) 
    return false
  
  relayList = relayList.map( relay => {
    return {
      url: relay,
      network: parseRelayNetwork(relay),
      online: null,
      ignore: false
    }
  })
  return relayList
}
