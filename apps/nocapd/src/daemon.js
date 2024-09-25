import "websocket-polyfill";
import schedule from 'node-schedule'
import timestring from 'timestring'
import chalk from 'chalk'
import mapper from 'object-mapper'

import { AnnounceMonitor } from '@nostrwatch/announce'
import { NocapdQueue, BullMQ } from '@nostrwatch/controlflow'
import Logger from '@nostrwatch/logger'
import relaycache, { Schemas } from '@nostrwatch/nwcache'
import { bootstrap } from '@nostrwatch/seed'
import { parseRelayNetwork, delay, loadConfig, RedisConnectionDetails, parseUrl } from "@nostrwatch/utils"

import { NWWorker } from './classes/Worker.js'
import { ShortBus } from './classes/ShortBus.js'
import { NocapdQueues } from './classes/NocapdQueues.js'

import migrate from './migrate/index.js'

const PUBKEY = process.env.DAEMON_PUBKEY
const log = new Logger('@nostrwatch/nocapd')

let rcache,
    config, 
    $q,
    bus,
    jobs,
    concurrency = 1

const populateJobQueue = async () => { 
  const activeJobs = (await $q.checker.getActiveJobs()).map( j => j.id )
  if(activeJobs.length > 0)
    log.warn(`active jobs: ${activeJobs}`)
  await $q.checker.populator().catch(log.error)
  await $q.checker.resetProgressCounts().catch(log.error)
}

const maybePopulateJobs = async (queue) => {
  const counts = await queue.counts()
  const enqueue = counts.prioritized + counts.active
  if(enqueue > 0) {
    return log.debug(`maybePopulateJobs(): ${$q.queue.name}: ${enqueue} events active`)
  }
  await populateJobQueue()
}

const setSchedules = async () => {
  const relayPopulator = await scheduleRelayPopulator()
  const jobPopulator = await scheduleJobPopulator()
  return { relayPopulator, jobPopulator }
}

const initBus = () => {
  if(concurrency > 1) {
    bus = new ShortBus(config?.monitor?.slug)
  }
}

const initQueue = async () => {
  
  const connection = RedisConnectionDetails()
  log.info(`initQueue(): connecting to redis at`, connection)
  const ncdq = NocapdQueue(`nocapd/${config?.monitor?.slug}` || null)

  $q = new NocapdQueues({ pubkey: PUBKEY, logger: new Logger('@nostrwatch/nocapd:queue-control'), redis: connection })

  await $q
    .set( 'queue'  , ncdq.$Queue )
    .set( 'events' , ncdq.$QueueEvents )
    .set( 'checker', new NWWorker(PUBKEY, $q, rcache, bus, {...config, logger: new Logger('@nostrwatch/nocapd:worker'), pubkey: PUBKEY }) )
    .set( 'worker' , new BullMQ.Worker($q.queue.name, $q.checker.work.bind($q.checker), { concurrency, connection, ...queueOpts() } ) )

  await pause('initQueue()')
  
  await $q.checker.syncQueue()
  await $q.checker.drainSmart()
  await $q.drain()

  jobs = await setSchedules()

  await maybePopulateJobs($q.checker)  
  log.info(`initialized: ${$q.queue.name}`)
}

const stop = async(signal) => {
  log.info(`Received ${signal}`);
  log.info(`Gracefully shutting down...`)
  // $q.worker.hard_stop = true
  log.info(`shutdown progress: cancel jobs`)
  Object.keys(jobs).forEach( key => jobs[key].cancel() )
  log.info(`shutdown progress: schedule.gracefulShutdown()`)
  await schedule.gracefulShutdown()
  log.info(`shutdown progress: queue/workers pause()`)
  pause('stop()')
  log.info(`shutdown progress: close lmdb`)
  rcache.$.close()
  log.info(`shutdown progress: $q.queue.drain()`)
  $q.queue.drain()
  log.info(`shutdown progress: $q.queue.obliterate()`)
  $q.queue.obliterate()
  log.debug(`shutdown progress: complete!`)
}

const maybeAnnounce = async () => {
  log.debug(`maybeAnnounce()`)
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
  const announce = new AnnounceMonitor(conf, process.env.DAEMON_PUBKEY)
  try {
    log.debug(`announce.generate(): ${process.env.DAEMON_PUBKEY}`)
    announce.generate()
    announce.sign( process.env.DAEMON_PRIVKEY )
  } catch (e) {
    throw new Error(e)
  }
  await announce.publish().catch(e => { log.warn(e.message) })
}

function secondsToCron(seconds) {
  if (seconds < 0) {
      throw new Error("Seconds value must be non-negative.");
  }

  let sec = seconds % 60; 
  let minutes = Math.floor(seconds / 60) % 60;
  let hours = Math.floor(seconds / 3600) % 24;

  let cronSeconds = sec ? `*/${sec}` : "0";
  let cronMinutes = minutes ? `*/${minutes}` : "*";
  let cronHours = hours ? `*/${hours}` : "*";

  return `${cronSeconds} ${cronMinutes} ${cronHours} * * *`;
}

const scheduleSeconds = async (name, seconds, cb) => {
  if(seconds instanceof String || seconds < 1) {
    throw new Error(`scheduleSeconds(): ${name} must be a NUMBER greater-than 0 in SECONDS!`)
  }

  log.info(`${name}: scheduling to fire every ${seconds} seconds`)
  const rule = new schedule.RecurrenceRule();
  rule.start = Date.now(); 
  rule.rule = secondsToCron(seconds); 
  return schedule.scheduleJob(rule, async () => await cb())
}

const scheduleJobPopulator = () =>{
  const name = "maybePopulateJobs()"
  const seconds = Math.round($q.checker.interval/1000)
  const job = async () => { 
    log.info(chalk.grey.italic(`=== scheduled population check for ${$q.queue.name} every ${seconds} seconds ===`))
    await maybePopulateJobs($q.checker)
  }
  return scheduleSeconds(name, seconds, job)
}

const relayPopulatorOnTheShortBus = () => {
  if(concurrency > 1) {
    bus.setWorker('relay-import', persistRelays)
  }
}

const relayCheckerOnTheShortBus = () => {
  if(concurrency > 1) {
    bus.setWorker($q.checker.key, $q.checker.persist_result.bind($q.checker))
  }
}

const scheduleRelayPopulator = () =>{
  const name = "scheduleRelayPopulator()"
  const seedOpts = config?.nocapd?.seed
  if(!seedOpts || !config?.nocapd?.seed?.sources?.length) return
  const seconds = timestring(seedOpts.interval, "s")
  
  const job = async () => {
    log.debug(`Scheduled: populateRelays()`)
    await populateRelays().catch(log.error)
  }
  return scheduleSeconds(name, seconds, job)
}

const pause = async (caller = "unknown") => {
  log.info(`${caller} pausing: all queues/workers`)
  await $q.queue.pause()
  await $q.worker.pause()
  if(concurrency > 1) {
    await bus.$.$Queue.pause()
    await bus.worker.pause()
  }
  await delay(1000)
  log.info(`${caller} paused: all queues/workers`)
}

const resume = async (caller = "unknown") => {
  log.info(`${caller} resuming: all queues/workers`)
  await $q.queue.resume()
  await $q.worker.resume()
  if(concurrency > 1) {
    await bus.$.$Queue.resume()
    await bus.worker.resume()
  }
  await delay(1000)
  log.info(`${caller} resumed: all queues/workers`)
}


const normalizeUrl = (url) => {
  return parseUrl(r).toString()
}

const populateRelays = async ( skipJob = false ) => {
    log.debug(`populateRelays(): begin`)

    const { Relay } = Schemas
    const syncData = await bootstrap('nocapd').catch( () => log.warn('bootstrap() failed') );

    if(!syncData?.[0]) return log.error(`populateRelays(): no relays found in bootstrap data`)
    
    log.debug(`populateRelays(): found ${syncData?.[0].length} *maybe new* relays`)
    
    const relays = syncData[0].map( url => new Relay({ url }) )

    if(concurrency > 1 && !skipJob){
      bus.addJob({ relays, type: 'relay-import' })
    }
    else {
      await persistRelays({ data: { relays } }).catch(e => log.error(e))
    }
    
}

const persistRelays = async (job) => {
  let { relays } = job.data
  // relays = relayListHostnameDedup(relays, rcache)
  const persisted = await rcache.relay.batch.insertIfNotExists(relays).catch(console.error)
  if(persisted.length === 0) return 0
  log.info(chalk.yellow.bold(`Persisted ${persisted.length} new relays`))
}

const queueOpts = () => {
  return {
    lockDuration: 5*60*1000
  }
}

const maybeBootstrap = async () => {
  if(rcache.relay.count.all() === 0){
    log.info(`Bootstrapping...`)
    await populateRelays( true )
    return true
  } else {
    log.info(`Already bootstrapped.`)
    return false
  }
}

const globalHandlers = () => {
  const signals = ['SIGINT', 'SIGTERM', 'SIGHUP'];
  
  signals.forEach(signal => {
    process.on(signal, async () => await gracefulShutdown(signal));
  });

  process.on('uncaughtException', async (error) => {
    log.error('Uncaught Exception:', error);
  });
  
  process.on('unhandledRejection', async (reason, promise) => {
    log.error('Unhandled Rejection:', promise.catch(console.error));
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
  await stop(signal)
  process.exit(9);
}

export const Nocapd = async () => {
  log.info('Starting Nocapd...')
  config = await loadConfig().catch( (err) => { log.err(err); process.exit() } )
  log.info('Loaded config')
  const lmdbOpts = config?.lmdb ?? {}
  concurrency = config?.nocapd?.bullmq?.worker?.concurrency? config.nocapd.bullmq.worker.concurrency: 1
  rcache = relaycache(process.env.NWCACHE_PATH || './.lmdb', lmdbOpts)
  log.info('Loaded cache...')
  await delay(5000)
  await migrate(rcache)
  log.info('ran migrations...')

  // await maybeAnnounce()
  // log.info('announced...')

  await populateRelays( true )
  
  // if(await maybeBootstrap()) 
  //   log.info('Bootstrapped')

  initBus()
  await initQueue()

  relayPopulatorOnTheShortBus()
  relayCheckerOnTheShortBus()

  globalHandlers()

  delay(2000)
  await resume('initQueue()')
  return {
    $q,
    stop
  } 
}
