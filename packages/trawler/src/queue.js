import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import { RedisConnectionDetails } from '@nostrwatch/utils'

import { bootstrap } from './bootstrap.js'
import { chunkArray } from './utils.js'

import { crawl } from './crawler.js';
import Logger from '@nostrwatch/logger'

import config from './config.js'

const relaysPerChunk = config?.crawl_concurrent_relays || 50;

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
    const bootstrapRelays = await bootstrap()
    const batches = chunkArray(bootstrapRelays, relaysPerChunk)
    batches.forEach( (batch, index) => {
      batchLogger.info(`adding batch ${index} to crawlQueue`)
      crawlQueue.add(`crawlBatch${index}`, { relays: batch })
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
   * Crawler 
   */

  const crawlLogger = new Logger('crawler queue')

  //queue

  const crawlQueueDrained = () => {}

  const crawlQueue = new Queue('crawlQueue', { removeOnComplete: true, removeOnFail: true, timeout: 1000*60*10, connection: RedisConnectionDetails() })
        crawlQueue.on('drained', crawlQueueDrained)

  //job
  const crawlJob = async ($job) => {
    return crawl($job)
  }

  const crawlJobCompleted = async ($job, foundRelays) => {
    crawlLogger.info(`crawlJob#${$job.id} found ${foundRelays.length} relays}`)
  }

  const crawlJobFailed = async ($job, err) => {
    crawlLogger.info(`crawlJob ${$job.id} failed: ${err}`)
  }

  const crawlJobProgress = async ($job, progress) => {
    crawlLogger.info(progress)
  }

  const crawlWorker = new Worker('crawlQueue', crawlJob, { concurrency: 1, connection: RedisConnectionDetails(), maxStalledCount: 1 })
        crawlWorker.on('completed', crawlJobCompleted)
        crawlWorker.on('failed', crawlJobFailed)
        crawlWorker.on('progress', crawlJobProgress)

  return {
    batchQueue,
    crawlQueue,
    batchWorker,
    crawlWorker,
    connection
  }
}
