import schedule from 'node-schedule'

import relaydb from '@nostrwatch/relaydb'
import { NocapdQueue, BullQueueEvents, BullWorker, Scheduler } from '@nostrwatch/controlflow'
import { RedisConnectionDetails } from '@nostrwatch/utils'

import { NocapdQueues } from './classes/NocapdQueues.js'

import { WelcomeManager }  from './managers/welcome.js'
import { WebsocketManager } from './managers/websocket.js'
import { GeoManager } from './managers/geo.js'
import { DnsManager } from './managers/dns.js'
import { InfoManager } from './managers/info.js'
import { SslManager } from './managers/ssl.js'

import Logger from '@nostrwatch/logger'

const log = new Logger('nocapd')

const rdb = relaydb(process.env.RELAYDB_PATH || './.lmdb')

const scheduleJob = (manager) =>{
  const rule = new schedule.RecurrenceRule();
  rule.start = Date.now(); // Set the start time
  rule.rule = `*/${Math.round(manager.frequency / 1000)} * * * * *`; // Set the frequency in seconds
  return schedule.scheduleJob(rule, () => manager.populator())
}

const initWorkers = async (config) => {
  if(config?.workers?.length > 0)
    throw new Error('config.workers needs to be an array of WorkerManagers')
  const $q = new NocapdQueues()
  const schedules = []
  $q.managers = {}
  $q.queue = NocapdQueue()
  await $q.queue.pause()
  await $q.queue.drain()
  await $q.queue.clean(  -1, // 1 minute
  -1, // max number of jobs to clean
  'active')
  await $q.queue.clean(  -1, // 1 minute
  -1, // max number of jobs to clean
  'stalled')
  // await $q.queue.obliterate()
  await $q.queue.resume() 

  $q.events = new BullQueueEvents($q.queue.name, {connection: RedisConnectionDetails()})
  config.managers.forEach(Manager => {
    const mname = Manager.name
    $q.managers[mname] = new Manager($q, rdb, { logger: new Logger(mname) })
    // console.log($q.queue.name, $q.managers[mname].runner,  { jobType: mname, concurrency: $q.managers[mname].concurrency, priority: $q.managers[mname].priority, connection: RedisConnectionDetails() })
    const $worker = new BullWorker($q.queue.name, $q.managers[mname].runner.bind($q.managers[mname]), { jobType: mname, concurrency: $q.managers[mname].concurrency, priority: $q.managers[mname].priority, connection: RedisConnectionDetails() })
    $q.managers[mname].setWorker($worker)
    // schedule.push({ name: mname, frequency: $q.managers[mname].frequency, handler: $q.managers[mname].populator.bind($q.managers[mname]) })
    // schedules.push(scheduleJob($q.managers[mname]))
    // process.exit()
    $q.managers[mname].populator()
  })
  setInterval( async () => console.log(await $q.queue.getJobCounts()), 5000)
  
  // $q.scheduler = new Scheduler(schedule)
  // console.log($q.scheduler.analysis)
  $q.schedules = schedules
  return $q
}

export const Nocapd = () => {
  const $q = initWorkers({
    managers: [ 
      WelcomeManager, 
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