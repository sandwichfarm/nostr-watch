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

const PUBKEY = process.env.DAEMON_PUBKEY
const log = new Logger('@nostrwatch/nocapd')

let rcache
let config 
let $q

const populateQueue = async () => { 
  log.info(`drained: ${$q.queue.name}`)
  await $q.checker.populator() 
  await delay(2000)
  await $q.checker.resetProgressCounts()
}

const initWorker = async () => {
  const connection = RedisConnectionDetails()
  const concurrency = config?.nocapd?.bullmq?.worker?.concurrency? config.nocapd.bullmq.worker.concurrency: 1
  const ncdq = NocapdQueue(`nocapd/${config?.monitor?.slug}` || null)
  $q = new NocapdQueues({ pubkey: PUBKEY, logger: new Logger('@nostrwatch/nocapd:queue-control'), redis: connection })
  await $q
    .set( 'queue'  , ncdq.$Queue )
    .set( 'events' , ncdq.$QueueEvents )
    .set( 'checker', new NWWorker(PUBKEY, $q, rcache, {...config, logger: new Logger('@nostrwatch/nocapd:worker'), pubkey: PUBKEY }) )
    .set( 'worker' , new BullMQ.Worker($q.queue.name, $q.route_work.bind($q), { concurrency, connection, ...queueOpts() } ) )
    .drain()
  await $q.obliterate().catch(()=>{})
  setInterval( syncRelaysIn, timestring(config?.nocapd?.seed?.options?.events?.interval, "ms") || timestring("1h", "ms"))
  $q.events.on('drained', populateQueue)
  await populateQueue()
  $q.resume()
  log.info(`initialized: ${$q.queue.name}`)
  return $q
}

const stop = async() => {
  log.info(`Gracefully shutting down...`)
  $q.worker.hard_stop = true

  log.debug(`shutdown progress: $q.worker.pause()`)
  await $q.worker.pause()
  // log.debug(`shutdown progress: $q.worker.stop()`)
  // await $q.worker.stop()
  log.debug(`shutdown progress: $q.queue.drain()`)
  await $q.queue.drain()
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

const schedulePopulator = ($checker) =>{
  const rule = new schedule.RecurrenceRule();
  rule.start = Date.now(); // Set the start time
  rule.rule = `*/${timestring($checker.interval, "s")} * * * * *`; // Set the frequency in seconds
  return schedule.scheduleJob(rule, async () => { 
    log.info(`running schedule for ${$checker.pubkey}.populator`)
    await $checker.populator()
  })
}

const scheduleSyncRelays = () =>{
  if(!config?.nocapd?.seed?.options?.events) return
  const interval = timestring(config?.nocapd?.seed?.options?.events?.interval, "s") || timestring("1h", "s")
  log.info(`scheduling syncRelaysIn() every ${interval/60} minutes`)
  const rule = new schedule.RecurrenceRule();
  rule.start = Date.now(); // Set the start time
  rule.rule = `*/${interval} * * * * *`; // Set the frequency in seconds
  return schedule.scheduleJob(rule, syncRelaysIn )
}

const syncRelaysIn = async () => {
    log.debug(`syncRelaysIn()`)
    const syncData = await bootstrap('nocapd')
    log.debug(`syncRelaysIn(): synced ${syncData[0].length} relays`)
    const relays = syncData[0].map(r => { return { url: r, online: null, network: parseRelayNetwork(r), info: "", dns: "", geo: "", ssl: "" } })
    const persisted = await rcache.relay.batch.insertIfNotExists(relays)
    log.debug(`syncRelaysIn(): persisted ${persisted.length} relays`)
    log.info(`synced ${persisted.length} relays`)
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

const header = () => {
  console.log(chalk.bold(`

@nostrwatch/nocapd  
                                                   dP
                                                   88
88d888b. .d8888b. .d8888b. .d8888b. 88d888b. .d888b88
88'  \`88 88'  \`88 88'  \`"" 88'  \`88 88'  \`88 88'  \`88
88    88 88.  .88 88.  ... 88.  .88 88.  .88 88.  .88
dP    dP \`88888P' \`88888P' \`88888P8 88Y888P' \`88888P8
                                    88               
                                    dP               

`))
}

// export const Nocapd = async () => {
//   const lmdbConnected = new Deferred()

//   const lmdbRetry = async (e) => {
//     log.warn(`lmdb is in a mood, retrying in 2 seconds. Here's its' error btw: ${e}`)
//     await delay(2000)
//     await lmdbConnect()
//   }
  
//   const lmdbConnect = async () => {
//     await relaycache(process.env.NWCACHE_PATH || './.lmdb')
//       .then( lmdbConnected.resolve )
//       .catch( lmdbRetry )
//   }

//   const init = async () =>{
//     header()
//     config = await loadConfig().catch( (err) => { log.err(err); process.exit() } )
//     await delay(2000)
//     lmdbConnect()
//     rcache = await lmdbConnected.promise
//     await delay(1000)
//     await maybeAnnounce()
//     await maybeBootstrap()
//     $q = await initWorker()
//     return {
//       $q,
//       stop
//     }
//   }

//   try {
//     init()
//   }
//   catch(e){
//     await delay(2000)
//     init()
//   }
  
// }

export const Nocapd = async () => {
  header()
  config = await loadConfig().catch( (err) => { log.err(err); process.exit() } )
  await delay(2000)
  rcache = relaycache(process.env.NWCACHE_PATH || './.lmdb')
  await delay(1000)
  await maybeAnnounce()
  await maybeBootstrap()
  $q = await initWorker()
  return {
    $q,
    stop
  } 
}
