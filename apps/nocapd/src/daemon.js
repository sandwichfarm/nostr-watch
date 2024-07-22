import "websocket-polyfill";

import schedule from 'node-schedule'
import Deferred from 'promise-deferred'

import timestring from 'timestring'
import chalk from 'chalk'
import mapper from 'object-mapper'

import { AnnounceMonitor } from '@nostrwatch/announce'
import { NocapdQueue, BullMQ } from '@nostrwatch/controlflow'
import Logger from '@nostrwatch/logger'
import relaycache from '@nostrwatch/nwcache'
import { bootstrap } from '@nostrwatch/seed'
import { parseRelayNetwork, delay, loadConfig, RedisConnectionDetails } from "@nostrwatch/utils"

import { NWWorker } from './classes/Worker.js'
import { NocapdQueues } from './classes/NocapdQueues.js'

import migrate from './migrate/index.js'

const PUBKEY = process.env.DAEMON_PUBKEY
const log = new Logger('@nostrwatch/nocapd')

let rcache
let config 
let $q

const populateQueue = async () => { 
  const resume = await $q.checker.populator() 
  await delay(2000)
  await $q.checker.resetProgressCounts()
  resume()
  // lastPopulate = Date.now()
}

const checkQueue = async () => {
  const counts = await $q.checker.counts()
  const enqueue = counts.prioritized + counts.active
  if(enqueue > 0) return log.debug(`checkQueue(): ${$q.queue.name}: ${enqueue} events active`)
  // log.debug(`drained: ${$q.queue.name}`)
  populateQueue()
}

const setIntervals = () => {
  // intervalSyncRelays = setInterval( syncRelaysIn, timestring(config?.nocapd?.seed?.options?.events?.interval, "ms") || timestring("1h", "ms"))
  schedulePopulator()
  scheduleSyncRelays()
  // intervalPopulate = setInterval( checkQueue, timestring( config?.nocapd?.checks?.options?.interval, "ms" ))
}

const initWorker = async () => {
  const connection = RedisConnectionDetails()
  log.info(`initWorker(): connecting to redis at`, connection)
  const concurrency = config?.nocapd?.bullmq?.worker?.concurrency? config.nocapd.bullmq.worker.concurrency: 1
  const ncdq = NocapdQueue(`nocapd/${config?.monitor?.slug}` || null)
  $q = new NocapdQueues({ pubkey: PUBKEY, logger: new Logger('@nostrwatch/nocapd:queue-control'), redis: connection })
  await $q
    .set( 'queue'  , ncdq.$Queue )
    .set( 'events' , ncdq.$QueueEvents )
    .set( 'checker', new NWWorker(PUBKEY, $q, rcache, {...config, logger: new Logger('@nostrwatch/nocapd:worker'), pubkey: PUBKEY }) )
    .set( 'worker' , new BullMQ.Worker($q.queue.name, $q.route_work.bind($q), { concurrency, connection, ...queueOpts() } ) )
  
  await $q.queue.drain()
  // await $q.queue.obliterate()
  await $q.checker.drainSmart()
  setIntervals()
  // $q.events.on('drained', populateQueue)
  await populateQueue()
  $q.resume()
  log.info(`initialized: ${$q.queue.name}`)
  return $q
}

const stop = async(signal) => {
  log.info(`Received ${signal}`);
  log.info(`Gracefully shutting down...`)
  $q.worker.hard_stop = true
  log.info(`shutdown progress: schedule.gracefulShutdown()`)
  schedule.gracefulShutdown()
  log.info(`shutdown progress: $q.worker.pause()`)
  $q.worker.pause()
  log.info(`shutdown progress: $q.queue.pause()`)
  $q.queue.pause()
  await rcache.$.close()
  log.info(`shutdown progress: $q.queue.drain()`)
  await $q.queue.drain()
  log.info(`shutdown progress: checking active jobs`)
  // const {active:numActive} = await $q.queue.getJobCounts('active')
  // if(numActive > 0) {
  //   log.info(`shutdown progress: ${numActive} active jobs`)
  //   await new Promise( resolve => {
  //     const intVal = setInterval(async () => {
  //       const {active:numActive} = await $q.queue.getJobCounts('active')
  //       if(numActive === 0) {
  //         clearInterval(intVal)
  //         resolve()
  //       }
  //     }, 1000)
  //   })
  //   log.info(`shutdown progress: no more jobs`)
  // }
  log.info(`shutdown progress: $q.queue.obliterate()`)
  await $q.queue.obliterate()
  // if(signal !== 'EAI_AGAIN'){

  // }
  // else {

  // }
  log.debug(`shutdown progress: await rcache.$.close()`)
  await rcache.$.close()
  log.debug(`shutdown progress: complete!`)
}

const maybeAnnounce = async () => {
  log.info(`maybeAnnounce()`)
  const map = {
    "publisher.kinds": "kinds",
    "nocapd.checks.options.timeout": "timeouts",
    "nocapd.checks.options.expires": "frequency",
    "nocapd.checks.enabled": "checks",
    "monitor.geo": "geo",
    "monitor.owner": "owner",
    "publisher.to_relays": "relays",
    "monitor.info": "profile"
  }
  const conf = mapper(config, map)
  conf.frequency = timestring(conf.frequency, 's').toString()
  const announce = new AnnounceMonitor(conf)
  announce.generate()
  announce.sign( process.env.DAEMON_PRIVKEY )
  await announce.publish( conf.relays )
}

const scheduleSeconds = (name, intervalMs, cb) => {
  log.info(`${name}: scheduling to fire every ${timestring(intervalMs, "s")} seconds`)
  const rule = new schedule.RecurrenceRule();
  const _interval = timestring(intervalMs, "s")
  rule.start = Date.now(); 
  rule.rule = `*/${_interval} * * * * *`; 
  return schedule.scheduleJob(rule, async () => await cb())
}

const schedulePopulator = () =>{
  const name = "checkQueue()"
  const intervalMs = $q.checker.interval
  const job = async () => { 
    log.info(chalk.grey.italic(`=== scheduled population check for ${$q.queue.name} every ${timestring(intervalMs, "s")} seconds ===`))
    await checkQueue()
  }
  return scheduleSeconds(name, intervalMs, job)
}

const scheduleSyncRelays = () =>{
  const name = "scheduleSyncRelays()"
  if(!config?.nocapd?.seed?.options?.events) return
  const intervalMs = config.nocapd.seed.options.events.interval
  log.info(`syncRelaysIn(): scheduling to fire every ${timestring(intervalMs, "s")} seconds`)
  const job = async () => {
    await syncRelaysIn() 
  }
  return scheduleSeconds(name, intervalMs, job)
}

const syncRelaysIn = async () => {
    log.debug(`syncRelaysIn()`)
    const syncData = await bootstrap('nocapd')
    log.debug(`syncRelaysIn(): found ${syncData[0].length} *maybe new* relays`)
    const relays = syncData[0].map(r => { return { url: new URL(r).toString(), online: null, network: parseRelayNetwork(r), info: "", dns: "", geo: "", ssl: "" } })
    log.debug(`syncRelaysIn(): Persisting ${relays.length} relays`, relays)
    const persisted = await rcache.relay.batch.insertIfNotExists(relays).catch(console.error)
    log.debug(`syncRelaysIn(): Persisted ${persisted} new relays`)
    console.log('fucking relays', await this.rcache.relay.get.all().length)
    if(persisted.length === 0) return 0
    log.info(chalk.yellow.bold(`Persisted ${persisted.length} new relays`))
    return persisted
}

const queueOpts = () => {
  return {
    lockDuration: 2*60*1000
  }
}

const maybeBootstrap = async () => {
  log.info(`Bootstrapping...`)
  if(rcache.relay.count.all() === 0){
    const persisted = await syncRelaysIn()
    log.info(`Boostrapped ${persisted.length} relays`)
  }
}

const globalHandlers = () => {
  const signals = ['SIGINT', 'SIGTERM', 'SIGHUP'];
  
  signals.forEach(signal => {
    process.on(signal, async () => await gracefulShutdown(signal));
  });

  process.on('uncaughtException', async (error) => {
    console.error('Uncaught Exception:', error);
  });
  
  process.on('unhandledRejection', async (reason, promise) => {
    console.error('Unhandled Rejection:', promise.catch(console.error));
  });  

  $q.worker.on('error', async (err) => {
    console.error('Worker Error: ', err);
    if(err?.code === 'EAI_AGAIN' || JSON.stringify(err).includes('EAI_AGAIN')){
      const code = err?.code? err.code: '[code undefined!]'
      gracefulShutdown(code)
    }
  })
}

async function gracefulShutdown(signal) {
  console.log(`Received ${signal}`);
  await stop(signal)
  process.exit(9);
}

export const Nocapd = async () => {
  config = await loadConfig().catch( (err) => { log.err(err); process.exit() } )
  await delay(2000)
  rcache = relaycache(process.env.NWCACHE_PATH || './.lmdb')
  await migrate(rcache)
  await delay(1000)
  // await maybeAnnounce()
  await maybeBootstrap()
  $q = await initWorker()
  globalHandlers()
  return {
    $q,
    stop
  } 
}
