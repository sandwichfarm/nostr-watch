import "websocket-polyfill";
// import { Blob } from 'buffer';

import { NostrFetcher } from 'nostr-fetch';
import { SimplePool } from 'nostr-tools';
import { simplePoolAdapter } from '@nostr-fetch/adapter-nostr-tools'

import config from "./config.js"
import rcache from "./relaydb.js"
import Logger from "@nostrwatch/logger";
import sync from "./sync.js"

import { parseRelayList } from "./parsers.js";
import { lastTrawledId }  from "./utils.js";
import { parseRelayNetwork, relayId } from "@nostrwatch/utils"
import { SyncQueue, TrawlQueue } from "@nostrwatch/controlflow"

const logger = new Logger('trawler')

const ignore = ["wss://nostr.searx.is/"]

const { $Queue:$SyncQueue, $QueueEvents:$SyncEvents } = SyncQueue()
const { $Queue:$TrawlQueue, $QueueEvents:$TrawlEvents } = TrawlQueue()

let relaysPersisted,
    listCount

let promises,
    deferPersist,
    $currentJob

const addRelaysToCache = async (relayList) => {
  const ids = []
  for (const relayObj of relayList) {
    ids.push(await rcache.relay.insertIfNotExists(relayObj))
  }
  return ids.filter(id => id !== undefined)
}

const noteInCache = async (ev, relay, lastEvent) => {
  const exists = await rcache.note.exists(ev)
  if( exists )
    await rcache.cachetime.set( lastTrawledId(relay), lastEvent )
  return exists
}

const setLastEvent = (ev, since, lastEvent) => {
  const timestamp = parseInt(ev.created_at)
  return timestamp>lastEvent? (timestamp>since? timestamp: since): lastEvent
}

const determineSince = async (relay) => {
  const cacheSince = await rcache.cachetime.get.one( lastTrawledId(relay) )
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

const jobData = (relayList, roundtrip) => {
  return { 
    type: 'relay', 
    action: 'create', 
    condition: 'ifNotExists', 
    batch: true, 
    payload: relayList, 
    roundtrip
  }
}

export const trawl = async function($job){
  promises = new Array() 
  deferPersist = new Object()
  relaysPersisted = new Set()
  listCount = 0
  $currentJob = $job

  const relays = $job.data.relays.filter( relay => !ignore.includes(relay.url) )
  const pool = new SimplePool();
  const fetcher = NostrFetcher.withCustomPool(simplePoolAdapter(pool));
  const kinds = [ 2, 10002 ]

  relays.forEach( async (relay) => {
    
    promises.push(new Promise( async (resolve) => {
      let lastEvent = 0
      let since = await determineSince(relay)
      $job.updateProgress({ type: 'resuming', source: relay, since })
      try {      
        
        const it = await fetcher.allEventsIterator(
          [ relay ],
          { kinds },
          { since },
          { sort: true }
        )
        for await (const ev of it) {
          if(!kinds.includes(ev.kind)) {
            continue
          }
          lastEvent = setLastEvent(ev, since, lastEvent)
          if( await noteInCache(ev, relay, lastEvent) ) {
            continue 
          }
          const relayList = await relaysFromRelayList(ev)

          if(relayList === false) continue
          listCount++

          const cacheIds = await addRelaysToCache(relayList)

          for( const id of cacheIds ) {
            relaysPersisted.add(rcache.relay.get.one(id)?.url)
          }

          deferPersist[ev.id] = async () => await rcache.note.set.one(ev)

          if(cacheIds.length === 0) {
            await deferPersist[ev.id]()
            delete deferPersist[ev.id]
            continue
          }

          console.log(`found ${cacheIds.length} new relays`)
          
          const roundtrip = { 
            requestedBy: process.env.DAEMON_PUBKEY,
            source: relay, 
            trawlJobId: $job.id,
            eventId: ev.id
          }
          if(config?.trawler?.sync?.out?.events)
            roundtrip.syncEventsCallback = syncEventsCallback
          
          const data = jobData(relayList, roundtrip)
          await sync.relays.out(data)
        }
      }
      catch(err) {
        logger.err(`${relay}: ${err}`)
      }
      if(lastEvent > 0)
        await rcache.cachetime.set( lastTrawledId(relay), lastEvent )
      resolve()
    }))
  })
  await Promise.allSettled(Object.values(promises))
  if(relaysPersisted.size > 0 ){
    console.log(`${relaysPersisted.size} relays persisted: ${[...relaysPersisted]}`)
  }
  return [...Array.from(relaysPersisted)]
}

const watchQueue = () => {
  $SyncEvents.on( 'completed', async ({returnvalue}) => {
    const { result, roundtrip } = returnvalue
    const { requestedBy } = roundtrip
    if(requestedBy != process.env.DAEMON_PUBKEY) return 
    return finish(result, roundtrip)
  })
}

if(config?.trawler?.sync?.out?.queue)
  watchQueue()

const syncEventsCallback = ( { result, roundtrip} ) => {
  finish( result, roundtrip )
}

const finish = async (result, roundtrip) => {
  if(result === false || result.length == 0) return
  const { source, trawlJobId, eventId } = roundtrip
  const $trawlJob = await $TrawlQueue.getJob(trawlJobId)
  result.forEach(relay => relaysPersisted.add(relay))
  if(result?.length && result.length > 0) {
    if(deferPersist?.[eventId])
      await deferPersist[eventId]()
    if(relaysPersisted?.size && typeof $trawlJob?.updateProgress === 'function')
      await $trawlJob.updateProgress({ type: 'found', source, listCount, result, relaysPersisted, total: rcache.relay.count.all() })
  } 
  if(deferPersist?.[eventId])
    delete deferPersist[eventId]
}