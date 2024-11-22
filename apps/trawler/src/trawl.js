
import { nostrawl } from 'nostrawl'

import Logger from '@nostrwatch/logger'
import cacheInit from '@nostrwatch/nwcache'
import { bootstrap } from '@nostrwatch/seed'
import Migrations from './migrate.js'

import { addRelaysToCache, relaysFromRelayList } from './helpers.js'

const kinds = [2, 3, 10002, 30002],
      filters = { kinds },
      logger = new Logger('trawler')
      
let   RELAYS_SCRAPE = [],
      $cache = null

let options = { 
  filters,
  adapter: 'bullmq',
  queueName: `trawler/2`,
  repeatWhenComplete: true,
  restDuration: 1000*60*5,
  strictTimestamps: true,
  relaysPerBatch: 1,
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
  options = { ...options, cache: { path: './cache/nostrawl' } }
  console.log(options)
}

const setup = async () => {
  logger.debug(`setup(): bootstrapping`)
  const seed = await bootstrap('trawler')
  // RELAYS_SCRAPE = Array.from(new Set(['wss://user.kindpag.es', 'wss://purplepag.es',seed[0]]))
  RELAYS_SCRAPE = Array.from(new Set(['wss://user.kindpag.es', 'wss://purplepag.es']))
  logger.debug(`setup(): relays found: ${RELAYS_SCRAPE.length}`)
}

const parser = async ($trawler, event) => {

  const relayList = await relaysFromRelayList(event)
  const relayListIsEmpty = relayList === false || relayList.length === 0
  if(relayListIsEmpty) {
    return
  }

  const cacheIds = await addRelaysToCache($cache, relayList)

  await $trawler.cache.put(`has:${event.id}`, true)

  const foundRelays = (await $cache.relay.get.many(cacheIds)).map( relay => relay.url )
  if(cacheIds.length > 0)
    logger.info(`found ${cacheIds.length} new relays: ${foundRelays.join(', ')}`)
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

const after_cacheOpen = async (trawlerCache) => {
  logger.info('after_cacheOpen(): adding nw extensions to nostrawl cache')
  $cache = cacheInit(trawlerCache)
  await Migrations($cache)
}

export const trawl = async () => {

  logger.debug('trawl(): setup')
  await setup()
  logger.debug('trawl(): init [nostrawl]')
  const trawler = nostrawl( RELAYS_SCRAPE, {...options, parser, validator, after_cacheOpen } )
  logger.debug('trawl(): config [nostrawl]')
  trawler
    .on_worker('progress', async (job, progress) => {
      logger.info(`[@${progress.last_timestamp}] ${progress.found} events found and ${progress.rejected} events rejected from  ${progress.relay} [${progress.total} total]`)
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