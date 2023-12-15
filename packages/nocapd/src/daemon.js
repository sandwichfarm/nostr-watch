import schedule from 'node-schedule'

import relaycache from '@nostrwatch/relaycache'
import { NocapdQueue, BullQueueEvents, BullWorker, Scheduler } from '@nostrwatch/controlflow'
import { RedisConnectionDetails } from '@nostrwatch/utils'

import { NocapdQueues } from './classes/NocapdQueues.js'

import { AllManager }  from './managers/all.js'
import { WelcomeManager }  from './managers/welcome.js'
import { WebsocketManager } from './managers/websocket.js'
import { GeoManager } from './managers/geo.js'
import { DnsManager } from './managers/dns.js'
import { InfoManager } from './managers/info.js'
import { SslManager } from './managers/ssl.js'

import { bootstrap } from '@nostrwatch/seed'

import Logger from '@nostrwatch/logger'

const log = new Logger('nocapd')

const rcache = relaycache(process.env.RELAYDB_PATH || './.lmdb')

const scheduleJob = (manager) =>{
  const rule = new schedule.RecurrenceRule();
  rule.start = Date.now(); // Set the start time
  rule.rule = `*/${Math.round(manager.frequency / 1000)} * * * * *`; // Set the frequency in seconds
  return schedule.scheduleJob(rule, () => manager.populator())
}

const initWorkers = async (config) => {
  if(config?.workers?.length > 0)
    throw new Error('config.workers needs to be an array of WorkerManagers')
  const $q = new NocapdQueues({ pubkey: process.env.DAEMON_PUBKEY })
  const schedule = []
  $q.managers = {}
  $q.queue = NocapdQueue()
  await $q.queue.pause()
  await $q.queue.drain()
  // await $q.queue.obliterate()

  $q.events = new BullQueueEvents($q.queue.name, {connection: RedisConnectionDetails()})
  config.managers.forEach(Manager => {
    const mname = Manager.name
    const $manager = new Manager($q, rcache, { logger: new Logger(mname), pubkey: process.env.DAEMON_PUBKEY })
    // console.log($q.queue.name, $manager.runner,  { jobType: mname, concurrency: $manager.concurrency, priority: $manager.priority, connection: RedisConnectionDetails() })
    schedule.push({ name: mname, interval: $manager.interval, handler: $manager.populator.bind($manager) })
    // schedules.push(scheduleJob($manager))
    // process.exit()
    // $manager.populator()
    $q.managers[mname] = $manager
  })

  const $worker = new BullWorker($q.queue.name, $q.route.bind($q), { concurrency: 3 } )
  $q.setWorker($worker)
  $q.populateAll()
  $q.scheduler = new Scheduler(schedule)
  await $q.queue.resume() 
  return $q
}

export const Nocapd = async () => {
  if(rcache.relays.count.all() === 0){
    const relays = await bootstrap('nocapd')
    relays
      .map(r => { url: r })
      .forEach(relayObj => rcache.relay.insertIfNotExists(relayObj))
  }
  
  const $q = initWorkers({
    managers: [ 
      AllManager,
      // WelcomeManager, 
      // WebsocketManager, 
      // InfoManager,
      // DnsManager,
      // GeoManager,
      // SslManager
    ]
  })
  return {
    stop: () => {
      console.log('stopping')
      // $q.schedules.forEach( job => {
      //   schedule.gracefulShutdown(job);
      // })
      // Object.keys($q.managers).forEach( m => {
      //   $q.managers[m].$worker.pause()
      // })
    },
    $q
  }
}