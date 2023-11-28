import NocapdWrapper from './NocapWrapper.js'
import relaydb from '@nostwatch/relaydb'
import { NocapdQueue, BullQueueEvents, BullWorker } from '@nostrwatch/controlflow'

const db = new relaydb(process.env.RELAY_DB_PATH || './.lmdb')

const relays = db.relay.all()
const RelayCheckWebsocket = {
  url: "",
  connect: -1,
  read: -1,
  write: -1,
  connectLatency: -1,
  readLatency: -1,
  writeLatency: -1,
  checked_at: -1, 
  checked_by: ""
}

const $q = {} 
      $q.queue = new NocapdQueue()

      $q.worker = new BullWorker($q.queue.name, async job => {
        const { relay_id, checks } = job.data
        const relay = db.relay.get(relay_id)
        const nocapd = new NocapdWrapper(relay)
        await nocapd.run( checks )
        return true
      })

relays.forEach(relay => {
  
})
