import { trawl } from './trawler.js';
import Logger from '@nostrwatch/logger'

import { TrawlQueue, BullMQ } from '@nostrwatch/controlflow'

const { Worker } = BullMQ

import { RedisConnectionDetails } from '@nostrwatch/utils'

export const configureQueues = async function(){

  const connection = RedisConnectionDetails()

  /**********
   * Trawler 
   */

  const trawlLogger = new Logger('trawler queue')

  //queue

  const trawler = TrawlQueue({ removeOnComplete: { age: 30*60*1000 }, removeOnFail: { age: 30*60*1000 }, timeout: 1000*60*10 })

  const trawlJobProgress = async ($job, progress) => {
    if(!(progress instanceof Object)) return trawlLogger.warn(`Progress data is not an object, it's a ${typeof progress}`)
    const { type, source } = progress 
    if(type === 'found'){
      const { source, listCount, result, relaysPersisted, total } = progress
      trawlLogger.info(`${source}: ${listCount} lists found, +${result?.length} relays persisted, ${relaysPersisted.size} total found in this chunk. ${total} total relays`)
    }
    if(type === 'resuming') {
      const { since } = progress
      trawlLogger.info(`${source} resuming from ${since}`)
    }
  }

  const trawlQueueDrained = () => {

  }
  
  trawler.$Queue.drain()

  // trawler.$Queue.on('drained', trawlQueueDrained)
  // trawler.$QueueEvents.on('progress', trawlJobProgress)

  const trawlJobCompleted = async ($job, foundRelays) => {
    trawlLogger.info(`trawlJob#${$job.id} found ${foundRelays.length} relays}`)
  }

  const trawlJobFailed = async ($job, err) => {
    trawlLogger.warn(`trawlJob ${$job.id} failed: ${err}`)
  }

  const trawlWorker = new Worker(trawler.$Queue.name, trawl, { concurrency: 1, maxStalledCount: 1, connection })
        trawlWorker.on('completed', trawlJobCompleted)
        trawlWorker.on('failed', trawlJobFailed)
        trawlWorker.on('progress', trawlJobProgress)

  return {
    trawlQueue: trawler.$Queue,
    trawlWorker
  }
}
