import schedule from 'node-schedule'
import timestring from 'timestring'
import chalk from 'chalk'

import relaycache from '@nostrwatch/nwcache'
import { NocapdQueue, BullMQ } from '@nostrwatch/controlflow'

import { NocapdQueues } from './classes/NocapdQueues.js'
import { parseRelayNetwork, relayId, capitalize, loadConfig } from "@nostrwatch/utils"

import { bootstrap } from '@nostrwatch/seed'

import Logger from '@nostrwatch/logger'

const { Worker } = BullMQ
const log = new Logger('nocapd')
const rcache = relaycache(process.env.NWCACHE_PATH || './.lmdb')

let config 

const schedulePopulator = ($manager) =>{
  const rule = new schedule.RecurrenceRule();
  rule.start = Date.now(); // Set the start time
  rule.rule = `*/${Math.round($manager.interval / 1000)} * * * * *`; // Set the frequency in seconds
  return schedule.scheduleJob(rule, async () => { 
    log.info(`running schedule for ${$manager.slug()}._populator`)
    await $manager._populator()
  })
}

const scheduleSyncRelays = async () =>{
  if(!config?.nocapd?.sync?.in?.events) return
  // await syncRelaysIn()
  const interval = config.nocapd.sync.in.events?.interval || 60*60
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

const initManagers = async ($q) => {
  const managers = {}
  const enabledManagers = enabledWorkerManagers() || []
  for await ( const Manager of enabledManagers ) {
    const mpath = `./managers/${Manager}.js`
    const imp = await import(mpath)
    try {
      const mname = imp[Manager].name
      const nocapdConf = config?.nocapd || {}
      const $manager = new imp[Manager]($q, rcache, {...nocapdConf , logger: new Logger(mname), pubkey: process.env.DAEMON_PUBKEY })
      managers[mname] = $manager
      schedulePopulator($manager)
    }
    catch(e){
      log.err(`Error initializing ${Manager}: ${e.message}`)
    }
  }
  await scheduleSyncRelays()
  return managers
}

const initWorker = async () => {
  const $q = new NocapdQueues({ pubkey: process.env.DAEMON_PUBKEY })
  const { $Queue:$NocapdQueue, $QueueEvents:$NocapdQueueEvents } = NocapdQueue()
  await $NocapdQueue.pause()
  await $NocapdQueue.drain()

  const $worker = new Worker($NocapdQueue.name, $q.route.bind($q), { concurrency: 3 } )
  await $worker.pause()
  
  $q.queue = $NocapdQueue
  $q.events = $NocapdQueueEvents
  $q.setWorker($worker)
  $q.managers = await initManagers($q)
  
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

const maybeBootstrap = async () => {
  if(rcache.relay.count.all() === 0){
    const persisted = await syncRelaysIn()
    log.info(`Boostrappted ${persisted.length} relays`)
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
  await maybeBootstrap()
  const $q = await initWorker()
  return {
    $q
  }
}