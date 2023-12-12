
import Logger from '@nostrwatch/logger'

import rdb from './relaydb.js'
import config from './config.js'

import { configureQueues } from './queue.js'
import { whenAllQueuesEmpty, whenAnyQueueIsActive } from './utils.js'
import { bootstrap } from './bootstrap.js'
import { chunkArray } from './utils.js'


const logger = new Logger('daemon')

const populateTrawler = async ($tq) => {
  const relaysPerChunk = config?.trawl_concurrent_relays || 50;
  const seeded = rdb.relay.count.all() > 0
  const useCache = config?.check_cache && config?.seed_sources.includes('cache')
  if(seeded && useCache) await checkCache()
  let bootstrapRelays = await bootstrap()
  const batches = chunkArray(bootstrapRelays, relaysPerChunk)
  batches.forEach( (batch, index) => {
    logger.info(`adding batch ${index} to trawlQueue`)
    $tq.add(`trawlBatch${index}`, { relays: batch })
  })
}

export default async () => {
  return new Promise( async (resolve) => {
    const {trawlQueue} = await configureQueues()
    const queues = {trawlQueue}
    await populateTrawler(trawlQueue)
    whenAllQueuesEmpty([trawlQueue], () => {
      populateTrawler()
    })
    whenAnyQueueIsActive([trawlQueue], () => {})
    const watcher = null
    resolve({ queues, watcher })
  })
}
