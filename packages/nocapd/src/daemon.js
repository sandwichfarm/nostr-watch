import NocapdWrapper from './NocapWrapper.js'
import relaydb from '@nostwatch/relaydb'
import { NocapdQueue, BullQueue, BullQueueEvents, BullWorker } from '@nostrwatch/controlflow'
import { RelayRecord } from '@nostrwatch/relaydb'
import { relayId } from '@nostrwatch/utils'
import { Scheduler } from '@nostrwatch/scheduler'
import { RelayCheckWebsocket, RelayCheckResultInfo, RelayCheckResultDns, RelayCheckResultGeo, RelayCheckResultSsl } from '@nostrwatch/transform'

const rdb = new relaydb(process.env.RELAY_DB_PATH || './.lmdb')

const relays = db.relay.all()

const initWorkers = (config) => {
  if(config?.workers?.length > 0)
    throw new Error('config.workers needs to be an array of WorkerManagers')
  const $q = new NWQueue()
  const schedule = {}
  $q.managers = {}
  $q.queue = new NocapdQueue()
  $q.events = new BullQueueEvents($q.queue.name)
  config.managers.forEach(Manager => {
    $q.managers[Manager.name] = new Manager($q, rdb, Manager.config)
    $q.managers[Manager.name].$worker = new BullWorker($q.queue.name, $q.managers[Manager.name].handle, { jobType: Manager.name, concurrency: $q.managers[Manager.name].concurrency })
    schedule[Manager.name] = { name: Manager.name, frequency: $q.managers[Manager.name].frequency }
  })
  $q.scheduler = new Scheduler({})
  return $q
}

export const daemon = () => {
  initWorkers({
    managers: [ 
      { name: 'WelcomeManager', config: WelcomeManager }, 
      { name: 'WebsocketManager', config: WebsocketManager }, 
      { name: 'InfoManager', config: InfoManager }, 
      { name: 'DnsManager', config: DnsManager }, 
      { name: 'GeoManager', config: GeoManager }, 
      { name: 'SslManager', config: SslManager}]
  })
}