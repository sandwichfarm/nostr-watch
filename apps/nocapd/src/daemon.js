// import schedule from 'node-schedule'

import timestring from 'timestring'
import chalk from 'chalk'
import mapper from 'object-mapper'

import { AnnounceMonitor } from '@nostrwatch/announce'
import { NocapdQueue, BullMQ } from '@nostrwatch/controlflow'
import Logger from '@nostrwatch/logger'
import relaycache from '@nostrwatch/nwcache'
import { bootstrap } from '@nostrwatch/seed'
import { parseRelayNetwork, loadConfig, RedisConnectionDetails } from "@nostrwatch/utils"

import { NWWorker } from './classes/Worker.js'
import { NocapdQueues } from './classes/NocapdQueues.js'

const PUBKEY = process.env.DAEMON_PUBKEY
const log = new Logger('nocapd')

let rcache
let config 

const maybeAnnounce = async () => {
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
  announce.sign( process.env.DAEMON_PRIVKEY  )
  await announce.publish( conf.relays )
}

// const schedulePopulator = ($checker) =>{
//   const rule = new schedule.RecurrenceRule();
//   rule.start = Date.now(); // Set the start time
//   rule.rule = `*/${Math.round($checker.interval / 1000)} * * * * *`; // Set the frequency in seconds
//   return schedule.scheduleJob(rule, async () => { 
//     log.info(`running schedule for ${$check.slug}.populator`)
//     await $checker.populator()
//   })
// }

// const scheduleSyncRelays = async () =>{
//   if(!config?.nocapd?.seed?.options?.events) return
//   const interval = config?.nocapd?.seed?.options?.events?.interval || 60*60
//   log.info(`scheduling syncRelaysIn() every ${timestring(interval, 'm')} minutes`)
//   const rule = new schedule.RecurrenceRule();
//   rule.start = Date.now(); // Set the start time
//   rule.rule = `*/${timestring(interval)} * * * * *`; // Set the frequency in seconds
//   return schedule.scheduleJob(rule, syncRelaysIn )
// }

const syncRelaysIn = async () => {
    log.info(`syncRelaysIn()`)
    const syncData = await bootstrap('nocapd')
    const relays = syncData[0].map(r => { return { url: r, online: null, network: parseRelayNetwork(r), info: "", dns: "", geo: "", ssl: "" } })
    const persisted = await rcache.relay.batch.insertIfNotExists(relays)
    log.info(`synced ${persisted.length} relays`)
    return persisted
}

const initWorker = async () => {
  const connection = RedisConnectionDetails()
  const concurrency = config?.nocapd?.bullmq?.worker?.concurrency? config.nocapd.bullmq.worker.concurrency: 1
  const $q = new NocapdQueues({ pubkey: PUBKEY, logger: new Logger('NocapdQueues') })
  const ncdq = NocapdQueue()
  $q
    .set( 'queue'  , ncdq.$Queue )
    .set( 'events' , ncdq.$QueueEvents )
    .set( 'checker', new NWWorker(PUBKEY, $q, rcache, {...config, logger: new Logger('NWWorker'), pubkey: PUBKEY }) )
    .set( 'worker' , new BullMQ.Worker($q.queue.name, job => $q.checker.work(job), { concurrency, connection } ) )
  await $q.drain().catch(console.warn)
  await $q.obliterate().catch(console.warn)
  await $q.checker.populator()
  await $q.resume()
  return $q
}

const maybeBootstrap = async () => {
  log.info(`Boostrapping...`)
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

export const Nocapd = async () => {
  header()
  config = await loadConfig().catch( (err) => { log.err(err); process.exit() } )
  rcache = relaycache(process.env.NWCACHE_PATH || './.lmdb')
  await maybeAnnounce()
  await maybeBootstrap()
  return {
    $q: await initWorker()
  }
}