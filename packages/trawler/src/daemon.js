import lmdb from './lmdb.js'
import Logger from '@nostrwatch/logger'
import config from './config.js'


import { configureQueues } from './queue.js'
import { relayListWatcher } from './watcher.js'
import { isQueueActive, areAllQueuesEmpty, whenAllQueuesEmpty, whenAnyQueueIsActive, delay } from './utils.js'

const logger = new Logger('daemon')

export default async () => {
  return new Promise( async (resolve) => {
    //configure the queues
    const {batchQueue, crawlQueue, connection:$connection} = await configureQueues()
    const queues = {batchQueue, crawlQueue}

    // if(config?.debug?.drain_on_launch)  {
    //   logger.info('draining queues')
    //   await batchQueue.obliterate()
    //   await crawlQueue.obliterate()
    // }

    // await delay(10000)

    // const workers = {batchWorker, crawlWorker, postProcessWorker}
    // const connection = $connection
    // const generateRelayBatches = () => {
    //   if(!isQueueActive(crawlQueue))
    //     batchQueue.add('batchRelays', {});
    //   else 
    //     setTimeout(generateRelayBatches, 1000*60)
    // }
    batchQueue.add('batchRelays', {});
    // {repeat: {cron: '0 */2 * * *'}}
    // generateRelayBatches()

    whenAllQueuesEmpty([batchQueue, crawlQueue], () => {
      batchQueue.add('batchRelays', {});
    })


    // logger.info('starting watcher')

    const watcher = null
    // const watcher = relayListWatcher({
    //   queues: queues,
    //   openSignal: whenAllQueuesEmpty, 
    //   closeSignal: whenAnyQueueIsActive
    // })



    resolve({ queues, watcher })
  })
}
