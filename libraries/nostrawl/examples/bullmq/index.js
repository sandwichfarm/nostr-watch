import { nostrawl } from '../../src/index.js'
import dotenv from 'dotenv'

dotenv.config()



const relays = ["wss://relay.damus.io","wss://nostr-pub.wellorder.net","wss://nostr.mom","wss://nostr.slothy.win","wss://global.relay.red"]

const event_ids = new Set()

const options = {
  filters: { kinds: [3] },
  adapter: 'bullmq',
  queueName: 'ContactLists',
  repeatWhenComplete: true,
  restDuration: 60*60*1000,
  strictTimestamps: true,
  relaysPerBatch: 10,
  since: Math.round(Date.now()/1000-(60*60*6)),
  nostrFetchOptions: {
    sort: true
  },
  adapterOptions: {
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379, 
      db: process.env.REDIS_DB || 0 
    }
  },
  workerOptions: {},
  queueOptions: {},
  parser: async (event) => {
    event_ids.add(event.id)
    // console.log(event.created_at)
  },
  validator: (event) => {
    if(event_ids.has(event.id))
      return false 
    return true
  } 
}

const trawler = nostrawl(relays, options )

trawler
  .on_worker('progress', (job, progress) => console.log(`[@${progress.last_timestamp}] ${progress.found} events found and ${progress.rejected} events rejected from  ${progress.relay}`))
  .on_queue('drained', () => console.log(`queue is empty`))
  .on_worker('completed', (job) => console.log(`Job #${job.id} completed`))

trawler.run()