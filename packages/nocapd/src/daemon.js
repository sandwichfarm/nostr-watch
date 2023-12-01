import relaydb from '@nostwatch/relaydb'
import { NocapdQueue, BullQueueEvents, BullWorker } from '@nostrwatch/controlflow'
import { NocapdQueues } from './classes/NocapdQueues.js'
import { Scheduler } from '@nostrwatch/scheduler'

import { WelcomeManager } from './managers/welcome.js'
import { WebsocketManager } from './managers/websocket.js'
import { GeoManager } from './managers/geo.js'
import { DnsManager } from './managers/dns.js'
import { InfoManager } from './managers/info.js'
import { SslManager } from './managers/ssl.js'

const rdb = new relaydb(process.env.RELAYDB_PATH || './.lmdb')

const initWorkers = (config) => {
  if(config?.workers?.length > 0)
    throw new Error('config.workers needs to be an array of WorkerManagers')
  const $q = new NocapdQueues()
  const schedule = {}
  $q.managers = {}
  $q.queue = new NocapdQueue()
  $q.events = new BullQueueEvents($q.queue.name)
  config.managers.forEach(Manager => {
    const name = Manager.name
    $q.managers[name] = new Manager($q, rdb, Manager.config)
    $q.managers[name].$worker = new BullWorker($q.queue.name, $q.managers[name].handle, { jobType: name, concurrency: $q.managers[name].concurrency })
    schedule[name] = { name, frequency: $q.managers[name].frequency, handler: $q.managers[name].populator }
  })
  $q.scheduler = new Scheduler(schedule)
  return $q
}

export const daemon = () => {
  return initWorkers({
    managers: [ 
      WelcomeManager, 
      WebsocketManager, 
      InfoManager,
      DnsManager,
      GeoManager,
      SslManager
    ]
  })
}