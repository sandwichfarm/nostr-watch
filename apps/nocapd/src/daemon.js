import schedule from 'node-schedule'
import timestring from 'timestring'
import chalk from 'chalk'
import mapper from 'object-mapper'

import relaycache from '@nostrwatch/nwcache'
import { AnnounceMonitor } from '@nostrwatch/announce'

import { NWWorker } from './classes/Worker.js'
import { NocapdQueue, BullMQ } from '@nostrwatch/controlflow'
const { Worker } = BullMQ

import { NocapdQueues } from './classes/NocapdQueues.js'
import { parseRelayNetwork, capitalize, loadConfig, RedisConnectionDetails } from "@nostrwatch/utils"

import { bootstrap } from '@nostrwatch/seed'

import Logger from '@nostrwatch/logger'


const log = new Logger('nocapd')
const rcache = relaycache(process.env.NWCACHE_PATH || './.lmdb')

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
  console.dir(conf)
  console.dir(announce.events)
  console.dir(announce.events['10166'].tags)
  await announce.publish( conf.relays )
}

const schedulePopulator = ($check) =>{
  const rule = new schedule.RecurrenceRule();
  rule.start = Date.now(); // Set the start time
  rule.rule = `*/${Math.round($check.interval / 1000)} * * * * *`; // Set the frequency in seconds
  return schedule.scheduleJob(rule, async () => { 
    log.info(`running schedule for ${$check.slug}.populator`)
    await $check.populator()
  })
}

const scheduleSyncRelays = async () =>{
  if(!config?.nocapd?.seed?.options?.events) return
  // await syncRelaysIn()
  const interval = config?.nocapd?.seed?.options?.events?.interval || 60*60
  log.info(`scheduling syncRelaysIn() every ${timestring(interval, 'm')} minutes`)
  const rule = new schedule.RecurrenceRule();
  rule.start = Date.now(); // Set the start time
  rule.rule = `*/${timestring(interval)} * * * * *`; // Set the frequency in seconds
  return schedule.scheduleJob(rule, syncRelaysIn )
}

const syncRelaysIn = async () => {
    const syncData = await bootstrap('nocapd')
    const relays = syncData[0].map(r => { return { url: r, online: null, network: parseRelayNetwork(r), info: "", dns: "", geo: "", ssl: "" } })
    const persisted = await rcache.relay.batch.insertIfNotExists(relays)
    log.info(`synced ${persisted.length} relays`)
    return persisted
}

const initChecks = async ($q) => {
  const checks = {}
  const EnabledChecks = enabledChecks() || []
  for await ( const check of EnabledChecks ) {
    try {
      const nocapdConf = config || {}
      checks[check] = new NWWorker(check, $q, rcache, {...nocapdConf, logger: new Logger(check), pubkey: process.env.DAEMON_PUBKEY })
      schedulePopulator(checks[check])
    }
    catch(e){
      log.err(`Error initializing ${check}: ${e.message}`)
    }
  }
  await scheduleSyncRelays()
  return checks
}

const initWorker = async () => {
  const $q = new NocapdQueues({ pubkey: process.env.DAEMON_PUBKEY })
  const { $Queue:$NocapdQueue, $QueueEvents:$NocapdQueueEvents } = NocapdQueue()
  const connection = RedisConnectionDetails()
  await $NocapdQueue.pause()
  await $NocapdQueue.drain()
  const concurrency = config?.nocapd?.bullmq?.worker?.concurrency? config.nocapd.bullmq.worker.concurrency: 1
  log.info(`Worker concurrency: ${concurrency}`)
  const $worker = new Worker($NocapdQueue.name, $q.route.bind($q), { concurrency, connection } )
  await $worker.pause()
  
  $q.queue = $NocapdQueue
  $q.events = $NocapdQueueEvents
  $q.setWorker($worker)
  $q.checks = await initChecks($q)
  
  await $q.populateAll()
  await $q.queue.resume() 
  
  return $q
}

const enabledChecks = () => {
  const eman = []
  return config?.nocapd?.checks?.enabled instanceof Array? config.nocapd.checks.enabled: 'all'
}

const maybeBootstrap = async () => {
  log.info(`Boostrapping..`)
  if(rcache.relay.count.all() === 0){
    const persisted = await syncRelaysIn()
    log.info(`Boostrapped ${persisted.length} relays`)
  }
}

const header = () => {
  console.log(chalk.bold(`

@nostrwatch/  
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
  config = await loadConfig()
  await maybeAnnounce()
  await maybeBootstrap()
  const $q = await initWorker()
  return {
    $q
  }
}