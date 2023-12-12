
import Logger from '@nostrwatch/logger'

import { configureQueues } from './queue.js'
import { whenAllQueuesEmpty, whenAnyQueueIsActive } from './utils.js'

const logger = new Logger('daemon')

export default async () => {
  return new Promise( async (resolve) => {
    const {batchQueue, trawlQueue} = await configureQueues()
    const queues = {batchQueue, trawlQueue}
    
    batchQueue.add('batchRelays', {});

    whenAllQueuesEmpty([batchQueue, trawlQueue], () => {
      batchQueue.add('batchRelays', {});
    })
    whenAnyQueueIsActive([batchQueue, trawlQueue], () => {})

    const watcher = null

    resolve({ queues, watcher })
  })
}
