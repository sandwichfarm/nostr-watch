import "websocket-polyfill";
import { Blob } from 'buffer';

import { NostrFetcher } from 'nostr-fetch';
import { SimplePool } from 'nostr-tools';
import { simplePoolAdapter } from '@nostr-fetch/adapter-nostr-tools'

import rdb from "./relaydb.js"
import { ResultInterface } from "@nostrwatch/nocap";
import Logger from "@nostrwatch/logger";

import { parseRelayList } from "./parsers.js";
import { lastCrawledId, checkOnline }  from "./utils.js";
import { parseRelayNetwork } from "../../utils/index.js"

const logger = new Logger('crawler')

export const crawl = async function($job){
  const relays = $job.data.relays
  const pool = new SimplePool();
  const fetcher = NostrFetcher.withCustomPool(simplePoolAdapter(pool));
  const promises = [] 

  let relaysPersisted = new Set(),
      listCount = 0

  relays.forEach( async (relay) => {
    const rlog = new Logger(relay)
    
    const keySize = new Blob([relay]).size
    if(keySize > 1978)
      return logger.error(`relay ${relay} is too large (${relaySize} bytes), skipping`)

    promises.push( new Promise( async (resolve) => {  
      let lastEvent = 0
      const cacheSince = await rdb.cachetime.get( lastCrawledId(relay) )
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
          if( await rdb.note.exists(ev) ) {
            await rdb.cachetime.set( lastCrawledId(relay), lastEvent )
            continue
          }

          let relayList = parseRelayList(ev)
          
          if(!(relayList instanceof Array)) 
            continue
          
          //prepare relays for rdb
          relayList = relayList.map( relay => {
            const result = new ResultInterface()
            result.set('url', relay)
            result.set('network', parseRelayNetwork(relay))
            return result.dump()
          })

          const listPersisted = await rdb.relay.batch.insertIfNotExists(relayList)
          listPersisted.forEach(relay => relaysPersisted.add(relay))

          //store the note
          await rdb.note.set.one(ev)

          //increment counter
          listCount++

          if(relaysPersisted?.size)
            $job.updateProgress(`${relay}: ${listCount} new lists found, ${relaysPersisted.size} new relays found`)
        }
      }
      catch(err) {
        logger.err(`error crawling ${relay}: ${err}`)
        resolve()
      }

      if(lastEvent > 0)
        await rdb.cachetime.set( lastCrawledId(relay), lastEvent )
      
      resolve()
    }))
  })

  await Promise.all(promises)

  return [...relaysPersisted]
}