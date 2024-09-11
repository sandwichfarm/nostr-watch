
import { nostrawl } from 'nostrawl'

import Logger from '@nostrwatch/logger'
import cacheInit from '@nostrwatch/nwcache'
import { bootstrap } from '@nostrwatch/seed'

import { addRelaysToCache, relaysFromRelayList } from './helpers.js'

const kinds = [2, 3, 10002, 30002],
      filters = { kinds },
      logger = new Logger('trawler')
      // RELAYS_PUBLISH = config?.publisher?.to_relays?  config.publisher.to_relays: []
      
let   RELAYS_SCRAPE = [],
      $cache

// let listCount

let options = { 
  filters,
  adapter: 'bullmq',
  queueName: `trawler/${process.env.DAEMON_PUBKEY}`,
  repeatWhenComplete: true,
  restDuration: 1000*60*5,
  strictTimestamps: true,
  relaysPerBatch: 10,
  since: 0,
  nostrFetchOptions: {
    sort: true
  },
  adapterOptions: {
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379, 
      db: process.env.REDIS_DB || 0 
    }
  },
  queueOptions: {
    removeOnComplete: true,
    removeOnFail: true
  }
}

if(process?.env?.NWCACHE_PATH){
  options = { ...options, cache: { path: process.env.NWCACHE_PATH } }
}

const setup = async () => {
  logger.debug(`setup(): bootstrapping`)
  const seed = await bootstrap('trawler')
  RELAYS_SCRAPE = seed[0]
  logger.debug(`setup(): relays found: ${RELAYS_SCRAPE.length}`)
  // RELAYS_SCRAPE = await fetch('https://api.nostr.watch/v1/online').then(res => res.json()).catch(console.error)
}

const parser = async ($trawler, event) => {
  //check if the there are relays in the note.
  const relayList = await relaysFromRelayList(event)
  const relayListIsEmpty = relayList === false || relayList.length === 0
  if(relayListIsEmpty) {
    return
  }

  //if we have notes, let's update the cache and local counter
  const cacheIds = await addRelaysToCache($cache, relayList)
  // listCount++

  //add the note id to cache, so if we encounter it again, the validator can reject.
  await $trawler.cache.put(`has:${event.id}`, true)

  //debugging.
  const foundRelays = (await $cache.relay.get.many(cacheIds)).map( relay => relay.url )
  if(cacheIds.length > 0)
    logger.debug(`found ${cacheIds.length} new relays`, foundRelays)
}

const validator = ($trawler, event) => {
  const REJECT = false 
  const ACCEPT = true

  if(!kinds.includes(event.kind)) {
    return REJECT
  }
  const noteIsUnknown = $trawler.cache.get(`has:${event.id}`) === undefined
  return noteIsUnknown? ACCEPT: REJECT
}

const after_cacheOpen = (trawlerCache) => {
  //add nw extensions to nostrawl cache.
  logger.debug('after_cacheOpen(): adding nw extensions to nostrawl cache')
  $cache = cacheInit(trawlerCache)
}

export const trawl = async () => {
  logger.debug('trawl(): setup')
  await setup()
  logger.debug('trawl(): init [nostrawl]')
  const trawler = nostrawl( RELAYS_SCRAPE, {...options, parser, validator, after_cacheOpen } )
  logger.debug('trawl(): config [nostrawl]')
  trawler
    .on_worker('progress', async (job, progress) => {
      logger.info(`strings found: ${(await $cache.relay.get.all()).length} | session stats [accepted/rejected]: ${progress.found}/${progress.rejected} | lifetime total: ${progress.total}]`)
      // logger.info(`[@${progress.last_timestamp}] ${progress.found} events found and ${progress.rejected} events rejected from  ${progress.relay} [${progress.total} total]`)
    })
    .on_queue('drained', () => {
      logger.info(`queue is empty`)
    })
    .on_worker('completed', (job) => {
      logger.info(`job #${job.id} completed`)
    })
  logger.debug('trawl(): run [nostrawl]')
  trawler.run()
}