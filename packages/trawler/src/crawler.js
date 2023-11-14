import "websocket-polyfill";
import { Blob } from 'buffer';

import { NostrFetcher } from 'nostr-fetch';
import { SimplePool } from 'nostr-tools';
import { simplePoolAdapter } from '@nostr-fetch/adapter-nostr-tools'

import Logger from "@nostrwatch/logger";
import { nowstr } from "../../utils/index.js";
import { parseRelayList } from "./parsers.js";
import { lastCrawledId, checkOnline }  from "./utils.js";

import { parseRelayNetwork } from "../../utils/index.js"

import lmdb from "./lmdb.js"
import config from "./config.js"

const logger = new Logger('crawler')

export const crawl = async function($job){
  const relaysChunk = $job.data.relays

  const pool = new SimplePool();
  const fetcher = NostrFetcher.withCustomPool(simplePoolAdapter(pool));

  const promises = [] 

  let relaysPersisted = new Set(),
      listCount = 0

  relaysChunk.forEach( async (relay) => {
    const relaySize = new Blob([relay]).size
    //hard limit on relay size: https://github.com/kriszyp/lmdb-js/issues/219
    console.debug(`checking ${relay} (${relaySize} bytes)`)
    
    if(relaySize > 1978)
      return logger.error(`relay ${relay} is too large (${relaySize} bytes), skipping`)

    promises.push( new Promise( async (resolve) => {  
      let lastEvent = 0
      const cacheSince = await lmdb.cachetime.get( lastCrawledId(relay) )
      let since = cacheSince?.v || 0
      if(`${since}`.length > 10) since = Math.round(since/1000)
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
          if( await lmdb.note.exists(ev) ) {
            await lmdb.cachetime.set( lastCrawledId(relay), lastEvent )
            continue
          }

          const list = parseRelayList(ev)
          if(!(list instanceof Array)) 
            continue
          
          //prepare relays for lmdb
          const objList = list.map(relay => ({
            url: relay,
            network: parseRelayNetwork(relay),
            info: {},
            geo: {},
            dns: {},
            ipv4: {},
            ipv6: {},
            ssl: {},
            connect: false,
            read: false,
            write: false,
            readAuth: false,
            writeAuth: false, 
            readAuthType: "",
            writeAuthType: "", 
            connectLatency: -1,
            readLatency: -1,
            writeLatency:  -1,
            found: null,
            last_seen: null,
            last_checked: null
          }))

          const relayPersisted = await lmdb.relay.batch.insertIfNotExists(objList)
          relayPersisted.forEach(relay => relaysPersisted.add(relay))
        
          //store the note
          await lmdb.note.set.one(ev)

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
        //loop could terminate without every updating lastEvent, overwriting real values.
        await lmdb.cachetime.set( lastCrawledId(relay), lastEvent )

      resolve()
    }))
  })

  await Promise.all(promises)

  return [...relaysPersisted]
}