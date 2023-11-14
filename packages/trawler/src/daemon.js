import lmdb from './lmdb.js'
import Logger from '@nostrwatch/logger'
import config from './config.js'

import { getSeedStatic } from '@nostrwatch/seed'
import { configureQueues } from './queue.js'
import { relayListWatcher } from './watcher.js'
import { isQueueActive, areAllQueuesEmpty, whenAllQueuesEmpty, whenAnyQueueIsActive, delay } from './utils.js'
import { relayId } from '@nostrwatch/utils'

import { open } from 'lmdb'

import { Relay } from '@nostrwatch/lmdb/schemas.js'

const logger = new Logger('daemon')

export default async () => {
  const do_backfill = config?.backfill_lmdb ? config.backfill_lmdb : false
  const is_backfilled = await lmdb.cachetime.get('backfilled')

  return new Promise( async (resolve) => {
    //configure the queues
    const {batchQueue, crawlQueue, postProcessQueue, batchWorker, crawlWorker, postProcessWorker, connection:$connection} = await configureQueues()
    const queues = {batchQueue, crawlQueue, postProcessQueue}
    const workers = {batchWorker, crawlWorker, postProcessWorker}
    const connection = $connection
    
    await delay(1000)

    //init
    

    const generateRelayBatches = () => {
      if(!isQueueActive(crawlQueue))
        batchQueue.add('batchRelays', {});
      else 
        setTimeout(generateRelayBatches, 1000*60)
    }
    generateRelayBatches()

    logger.info('starting watcher')

    const watcher = relayListWatcher({
      queues: queues,
      openSignal: whenAllQueuesEmpty, 
      closeSignal: whenAnyQueueIsActive
    })

    resolve({ queues, watcher })
  })
}
