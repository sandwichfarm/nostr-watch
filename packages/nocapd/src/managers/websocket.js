import { WorkerManager } from '../classes/WorkerManager.js'

export class WebsocketManager extends WorkerManager {
  constructor($q, rdb, config){
    super($q, rdb, config)
    this.interval = 60*1000       //checks for expired items every...
    this.expires = 60*60*1000     //1 hour
    this.timeout = 30*1000
    this.timeoutBuffer = 1000
    this.priority = 10
  }

  async populator(){
    const { Relay } = this.rdb.schemas
    const relays = 
      [...this.rdb.$
        .select(['url'])
        .from( Relay )
        .where({ Relay: (R) => R.last_checked < (new Date() - this.expires)})
      ].flat()
    this.log.info(`Found ${relays.length} new websocket jobs`)
    relays.map(r=>r.url).forEach(relay => {
      this.addJob({ relay })
    })
  }

  async work(job){
    this.log.debug(`Running websocket check for ${job.data.relay}`)
    const { relay } = job.data
    const dpubkey = this.pubkey
    const nocapd = new this.Nocap(relay)
    const nocapOpts = { 
      timeout: { 
        connect: Math.floor(this?.timeout/3), 
        read: Math.floor(this?.timeout/3), 
        write: Math.floor(this?.timeout/3) 
      },
      checked_by: dpubkey 
    }
    const result = await nocapd.check(['connect', 'read', 'write'], nocapOpts)
    // nocapd.on('change', (res) => console.log('changed!', res))
    return { result } 
  }

  async on_completed(job, rvalue){
    const { result } = rvalue
    this.log.info(`Websocket check complete for ${job.data.relay}: connect: ${result.connect.data}, read: ${result.read.data}, write: ${result.write.data}`)
    // console.log(`@ insert (${result.url})`)
    this.rdb.check.websocket.insert(result)
    const relayUpdate = { url: result.url, checked_at: Date.now() }
    if(result.connect.data === true)
      relayUpdate.last_seen = Date.now()
    await this.rdb.relay.get.one(result.url).url
    await this.rdb.relay.patch(relayUpdate)
  }

  async on_failed(job, err){
    this.log.error(`Websocket check failed for ${job.data.relay}: ${JSON.stringify(err)}`)
  }
}