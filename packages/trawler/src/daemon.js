import schedule from 'node-schedule'

import rdb from './relaydb.js'
import config from "./config.js"
import checkCache from './check-cache.js'
import publish from './publish.js'
import Logger from '@nostrwatch/logger'

import { configureQueues } from './queue.js'
import { bootstrap } from '@nostrwatch/seed'
// import { whenAllQueuesEmpty, whenAnyQueueIsActive,  } from './utils.js'
import { chunkArray, msToCronTime } from "@nostrwatch/utils"

const {trawlQueue} = await configureQueues()

const logger = new Logger('daemon')

let busy = false


const populateTrawler = async (relays) => {
  await trawlQueue.pause()
  const relaysPerChunk = config?.trawl_concurrent_relays || 50;
  const batches = chunkArray(relays, relaysPerChunk)
  batches.forEach( (batch, index) => {
    logger.info(`adding batch ${index} to trawlQueue`)
    trawlQueue.add(`trawlBatch${index}`, { relays: batch })
  })
  await trawlQueue.resume()
}

const maybeCheckRelays = async () => {
  const seeded = rdb.relay.count.all() > 0
  const useCache = config?.trawler?.check?.enabled || false
  if(!seeded || !useCache || busy === true) return
  logger.info('maybeCheckRelays(): checking relays, pausing TrawlerQueue')
  busy = true
  await trawlQueue.pause()
  await checkCache()
  await trawlQueue.resume()
  busy = false
  logger.info('maybeCheckRelays(): checked relays, resuming TrawlerQueue')
}


const maybePublishRelays = async () => {
  const publishingEnabled = config?.trawler?.sync?.relays?.out?.events
  if(!publishingEnabled || busy === true ) return
  logger.info('maybePublishRelays(): publishing relays, pausing TrawlerQueue')
  busy = true
  await trawlQueue.pause()
  await publish.all()
  await trawlQueue.resume()
  busy = false
  logger.info('maybePublishRelays(): published relays, resuming TrawlerQueue')
}

const schedules = () => {
  const publishEveryMs = config?.trawler?.publish?.interval? parseInt(eval(config.trawler.publish.interval)): 4*60*60*1000
  schedule.scheduleJob( msToCronTime(publishEveryMs), maybePublishRelays )

  const checkEveryMs = config?.trawler?.check?.interval? parseInt(eval(config.trawler.check.interval)): 12*60*60*1000
  schedule.scheduleJob( msToCronTime(checkEveryMs), maybeCheckRelays )
}

export default async () => {
  return new Promise( async (resolve) => {
    schedules()
    await maybeCheckRelays()
    await maybePublishRelays()
    const relays = await bootstrap('trawler')
    await populateTrawler( relays )
    resolve({ queues: { trawlQueue }, watcher: null })
  })
}
    // whenAllQueuesEmpty([trawlQueue], () => {
    //   populateTrawler()
    // })
    // whenAnyQueueIsActive([trawlQueue], () => {})