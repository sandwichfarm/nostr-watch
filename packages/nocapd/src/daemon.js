import schedule from 'node-schedule'

import relaycache from '@nostrwatch/relaycache'
import { NocapdQueue, BullMQ, Scheduler } from '@nostrwatch/controlflow'
import { RedisConnectionDetails } from '@nostrwatch/utils'

import { NocapdQueues } from './classes/NocapdQueues.js'
import { parseRelayNetwork, relayId, capitalize, loadConfig } from "@nostrwatch/utils"

// import { AllManager }  from './managers/all.js'
// import { WelcomeManager }  from './managers/welcome.js'
// import { WebsocketManager } from './managers/websocket.js'
// import { GeoManager } from './managers/geo.js'
// import { DnsManager } from './managers/dns.js'
// import { InfoManager } from './managers/info.js'
// import { SslManager } from './managers/ssl.js'

import { bootstrap } from '@nostrwatch/seed'

import Logger from '@nostrwatch/logger'

const { QueueEvents, Worker } = BullMQ
const log = new Logger('nocapd')
const rcache = relaycache(process.env.NWCACHE_PATH || './.lmdb')

let config 

const scheduleJob = (manager) =>{
  const rule = new schedule.RecurrenceRule();
  rule.start = Date.now(); // Set the start time
  rule.rule = `*/${Math.round(manager.frequency / 1000)} * * * * *`; // Set the frequency in seconds
  return schedule.scheduleJob(rule, () => manager.populator())
}

const initManagers = async ($q, config) => {
  config.managers.forEach(async Manager => {
    const mpath = `./managers/${Manager}.js`
    const imp = await import(mpath).catch( e => log.err(`Error importing ${mpath}: ${e.message}`) )
    try {
      const mname = imp[Manager].name
      const $manager = new imp[Manager]($q, rcache, { logger: new Logger(mname), pubkey: process.env.DAEMON_PUBKEY })
      $q.managers[mname] = $manager
    }
    catch(e){
      log.err(`Error initializing ${Manager}: ${e.message}`)
    }
  })
}

const initWorkers = async (config) => {
  if(config?.managers?.length === 0 || !(config?.managers instanceof Array))
    throw new Error('config.workers needs to be an array of WorkerManagers')
  const $q = new NocapdQueues({ pubkey: process.env.DAEMON_PUBKEY })
  const { $Queue:$NocapdQueue, $QueueEvents:$NocapdQueueEvents } = NocapdQueue()
  $q.queue = $NocapdQueue
  await $q.queue.pause()
  await $q.queue.drain()
  $q.events = $NocapdQueueEvents
  $q.managers = initManagers($q, config)
  const $worker = new Worker($q.queue.name, $q.route.bind($q), { concurrency: 10 } )
  await $worker.pause()
  $q.setWorker($worker)
  await $q.populateAll()
  await $q.queue.resume() 
  return $q
}

const enabledWorkerManagers = () => {
  const eman = []
  for( const manager of Object.keys(config?.nocapd?.checks) ) {
    if(config?.nocapd?.checks?.[manager]?.enabled === true)
      eman.push(`${capitalize(manager)}Manager`)
  }
  return eman
}

export const Nocapd = async () => {
  config = await loadConfig()
  if(rcache.relay.count.all() === 0){
    let relays = await bootstrap('nocapd')
    console.log(`found ${relays.length} relays`)
    relays = relays
      .map(r => { return { url: r, network: parseRelayNetwork(r), online: null, geo: [], attributes: [] } })
    const persisted = await rcache.relay.batch.insertIfNotExists(relays)
    console.log('persisted:', persisted.length)
  }
  const $q = await initWorkers({
    managers: enabledWorkerManagers() || [],
  })
  return {
    stop: () => {
      console.log('stopping')
    },
    $q
  }
}