
import NDK, { NDKEvent } from '@nostr-dev-kit/ndk'

import { nostrawl } from 'nostrawl'
import sanitize from './sanitize.js'
import config from "./config.js"

const FILTERS = { 
  kinds: [2,3,10002,30002]
}



export const trawl = async () => {
  const relays = await fetch('https://api.nostr.watch/v1/online').then(res => res.json()).catch(console.error)
  
  const publishTo = new NDK({explicitRelayUrls: ['wss://lunchbox.sandwich.farm']})
  await publishTo.connect()
  console.log('connected to publishNdk')

  let count = 0

  const options = {
    filters: ,
    adapter: 'bullmq',
    queueName: `trawler/${process.env.DAEMON_PUBKEY}`,
    repeatWhenComplete: true,
    restDuration: 1000*60*5,
    strictTimestamps: true,
    relaysPerBatch: 10,
    since: 0,
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
    queueOptions: {
      removeOnComplete: true,
      removeOnFail: true
    },
    parser: async ($trawler, event) => {
      const $event = new NDKEvent(publishNdk, event)
      try {
        $event
          .publish()
            .then( async () => {
              await $trawler.cache.put(`has:${event.id}`, true);
            })
            .catch(() => {""})
      }
      catch(e){""}
      
    },
    validator: ($trawler, event) => {
      return $trawler.cache.get(`has:${event.id}`) === undefined? true : false
    }
  }

  const trawler = nostrawl(relays, options)

  trawler
    .on_worker('progress', (job, progress) => console.log(`[@${progress.last_timestamp}] ${progress.found} events found and ${progress.rejected} events rejected from  ${progress.relay} [${progress.total} total]`))
    .on_queue('drained', () => console.log(`queue is empty`))
    .on_worker('completed', (job) => console.log(`job #${job.id} completed`))

  trawler.run()
}

pabloIsSleeping()