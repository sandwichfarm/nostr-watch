
import Logger from '@nostrwatch/logger'


import { configureQueues } from './queue.js'
import { whenAllQueuesEmpty, whenAnyQueueIsActive } from './utils.js'

const logger = new Logger('daemon')

export default async () => {
  return new Promise( async (resolve) => {
    const {batchQueue, crawlQueue, connection:$connection} = await configureQueues()
    const queues = {batchQueue, crawlQueue}
    batchQueue.add('batchRelays', {});

    whenAllQueuesEmpty([batchQueue, crawlQueue], () => {
      batchQueue.add('batchRelays', {});
    })
    whenAnyQueueIsActive([batchQueue, crawlQueue], () => {})

    const watcher = null
    // const watcher = relayListWatcher({
    //   queues: queues,
    //   openSignal: whenAllQueuesEmpty, 
    //   closeSignal: whenAnyQueueIsActive
    // })

    resolve({ queues, watcher })
  })
}
