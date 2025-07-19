import PQueueAdapter from './adapters/PQueueAdapter.js';
import BullMqAdapter from './adapters/BullMqAdapter.js';  

export const nostrawl = (relays, options) => {
  console.log('nostrawl()')
  let $adapter
  switch (options?.adapter) {
    case 'bullmq':
      $adapter = new BullMqAdapter(relays, options)
      $adapter.init()
      return $adapter
    case 'pqueue':
    default:
      $adapter = new PQueueAdapter(relays, options)
      $adapter.init()
      return $adapter 
  }
}