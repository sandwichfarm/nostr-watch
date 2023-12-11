import "websocket-polyfill";
import { Blob } from 'buffer';
import Deferred from 'promise-deferred'

import { NostrFetcher } from 'nostr-fetch';
import { SimplePool } from 'nostr-tools';
import { simplePoolAdapter } from '@nostr-fetch/adapter-nostr-tools'

import rdb from "@nostrwatch/relaydb"
import rcache from "./relaydb.js"
import Logger from "@nostrwatch/logger";

import { parseRelayList } from "./parsers.js";
import { lastCrawledId }  from "./utils.js";
import { parseRelayNetwork, relayId, RedisConnectionDetails } from "@nostrwatch/utils"

import { SyncQueue, BullQueueEvents } from "@nostrwatch/controlflow"

const logger = new Logger('crawler')

const $SyncQueue = SyncQueue()
const $SyncEvents = new BullQueueEvents($SyncQueue.constructor.name, { connection: RedisConnectionDetails() } )

let relaysPersisted,
    listCount

let promises

export const crawl = async function($job){
  const relays = $job.data.relays
  const pool = new SimplePool();
  const fetcher = NostrFetcher.withCustomPool(simplePoolAdapter(pool));
  promises = new Object()
  relaysPersisted = new Set()
  listCount = 0
  relays.forEach( async (relay) => {
    const promid = `${$job.id}:${relay}`
    promises[promid] = new Deferred().promise
    const keySize = new Blob([relay]).size
    if(keySize > 1978)
      return logger.error(`relay ${relay} is too large (${relaySize} bytes), skipping`)
    let lastEvent = 0
    const cacheSince = await rcache.cachetime.get( lastCrawledId(relay) )
    let since = cacheSince?.v || 0
    $job.updateProgress(`${relay} resuming from ${since}`)
    try {      
      const it = await fetcher.allEventsIterator(
        [ relay ],
        { kinds: [ 2, 10002 ] },
        { since },
        { sort: true }
      )
      for await (const ev of it) {
        const timestamp = parseInt(ev.created_at)
        lastEvent = (timestamp>lastEvent? (timestamp>since? timestamp: since): lastEvent)
        if( await rcache.note.exists(ev) ) {
          await rcache.cachetime.set( lastCrawledId(relay), lastEvent )
          continue
        }
        const relayList = await relaysFromRelayList(ev)
        if(relayList === false) 
          continue
        $SyncQueue.add(
          'relay-insert', 
          { type: 'relay', acation: 'insert', condition: 'ifNotExists', payload: relayList, roundtrip: { relay: relay, crawlJobId: promid } },
          { priority: 1 }
        )
      }
    }
    catch(err) {
      logger.err(`error crawling ${relay}: ${err}`)
    }
    if(lastEvent > 0)
      await rcache.cachetime.set( lastCrawledId(relay), lastEvent )

  })
  console.log(promises)
  await Promise.all(Object.values(promises))
  return [...relaysPersisted]
}

export const relaysFromRelayList = async ( ev ) => {
  let relayList = parseRelayList(ev)
          
  if(!(relayList instanceof Array)) 
    return false
  
  relayList = relayList.map( relay => {
    return {
      id: relayId(relay),
      url: relay,
      network: parseRelayNetwork(relay)
    }
  })

  return relayList
}

const onRelaySync = async ($syncJob, rvalue) => {
  const $crawlJob = $SyncQueue.getJob(rvalue.crawlJobId)
  const { result, roundtrip } = rvalue 
  if(result === false) promises[roundtrip.crawlJobId].resolve()
  result.forEach(relay => relaysPersisted.add(relay))
  listCount++
  if(result?.length && result.length > 0) {
    await rcache.note.set.one(ev)
    if(relaysPersisted?.size)
      $crawlJob.updateProgress(`${roundtrip.relay}: ${listCount} lists found, +${result?.length} relays persisted, ${relaysPersisted.size} total found in this chunk`)
  }
  promises[roundtrip.crawlJobId].resolve()
}

$SyncEvents.on( 'completed', onRelaySync )