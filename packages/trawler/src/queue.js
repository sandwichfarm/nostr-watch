import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import { RedisConnectionDetails } from '@nostrwatch/utils'

import { trawl } from './trawler.js';
import Logger from '@nostrwatch/logger'

import { TrawlQueue } from '@nostrwatch/controlflow'

import checkCache from './check-cache.js'

import config from './config.js'

export const configureQueues = async function(){

  const connection = new Redis()

  /**********
   * Trawler 
   */

  const trawlLogger = new Logger('trawler queue')

  //queue

  const trawler = TrawlQueue({ removeOnComplete: { age: 30*60*1000 }, removeOnFail: { age: 30*60*1000 }, timeout: 1000*60*10 })

  const trawlJobProgress = async ($job, progress) => {
    // console.log(Object.keys($job.data))
    trawlLogger.info(`progress: ${progress}`)
  }

  const trawlQueueDrained = () => {}
  
  trawler.$Queue.drain()

  trawler.$Queue.on('drained', trawlQueueDrained)
  // trawler.$QueueEvents.on('progress', trawlJobProgress)

  const trawlJobCompleted = async ($job, foundRelays) => {
    trawlLogger.info(`trawlJob#${$job.id} found ${foundRelays.length} relays}`)
  }

  const trawlJobFailed = async ($job, err) => {
    trawlLogger.warn(`trawlJob ${$job.id} failed: ${err}`)
  }

  const trawlWorker = new Worker(trawler.$Queue.name, trawl, { concurrency: 1, maxStalledCount: 1 })
        trawlWorker.on('completed', trawlJobCompleted)
        trawlWorker.on('failed', trawlJobFailed)
        trawlWorker.on('progress', trawlJobProgress)

  return {
    trawlQueue: trawler.$Queue,
    trawlWorker,
    connection
  }
}
