import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import { RedisConnectionDetails } from '@nostrwatch/utils'

import { bootstrap } from './bootstrap.js'
import { chunkArray } from './utils.js'

import { trawl } from './trawler.js';
import Logger from '@nostrwatch/logger'

import { TrawlQueue } from '@nostrwatch/controlflow'

import checkCache from './check-cache.js'

import config from './config.js'

import rdb from './relaydb.js'

const relaysPerChunk = config?.trawl_concurrent_relays || 50;

export const configureQueues = async function(){

  const connection = new Redis()

  /**********
   * Batcher
   */

  const batchLogger = new Logger('batch queue')

  //queue
  const batchQueue = new Queue('batchQueue', { removeOnComplete: true, removeOnFail: true, timeout: 1000*60*10, connection: RedisConnectionDetails()})

  //job
  const batchJob = async (job) => {
    if(rdb.relay.count.all() > 0) await checkCache()
    let bootstrapRelays = await bootstrap()
    const batches = chunkArray(bootstrapRelays, relaysPerChunk)
    batches.forEach( (batch, index) => {
      batchLogger.info(`adding batch ${index} to trawlQueue`)
      trawler.$Queue.add(`trawlBatch${index}`, { relays: batch })
    })
  }

  const batchJobCompleted = async (job, returnvalue) => {
    batchLogger.info(`batchJob ${job.id} completed`)
  }

  const batchJobFailed = async (job, err) => {
    batchLogger.err(`batchJob ${job.id} failed: ${err}`)
  }

  const batchWorker = new Worker('batchQueue', batchJob, { concurrency: 1, connection: RedisConnectionDetails(), blockingConnection: true })
        batchWorker.on('completed', batchJobCompleted);
        batchWorker.on('failed', batchJobFailed); 

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
    batchQueue,
    trawlQueue: trawler.$Queue,
    batchWorker,
    trawlWorker,
    connection
  }
}
