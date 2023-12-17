import { WorkerManager } from '../classes/WorkerManager.js'
import { Nocap } from '@nostrwatch/nocap'

export class DnsManager extends WorkerManager {
  constructor($q, rdb, config){
    super($q, rdb, config)
    this.id = 'dns'
    this.interval = 24*60*60*1000 //6 hours
    this.expires = 6*24*60*60*1000 //6 hours
    this.priority = 30
    
  }

  async populator(){
    const { Relay } = this.rdb.schemas
    const relays = this.rdb.relay.get.null('dns', ['url']).map(r=>r.url) 
    this.log.info(`Found ${relays.length} new info jobs`)
    relays.forEach(relay => {
      const job = { relay }
      this.addJob(job)
    })
  }


  async work(job){
    this.log.debug(`Running dns check for ${job.data.relay.url}`)
    const { relay } = job.data;
    const nocapd = new Nocap(relay);
    const dnsOld = this.rdb.checks.dns.get.one(relay.url)
    const result = await nocapd.check('dns')
    if(!this.hasChanged(dnsOld.data, result.dns))
      return { skip: true }
    return { result }
  }

  async on_completed(job, rvalue) {
    if(typeof rvalue !== 'object') return
    if(rvalue?.skip === true) return this.log.debug(`Info check skipped for ${job.data.relay}`)
    const { result } = rvalue
    this.log.debug(`DS check complete for ${job.data.relay}: ${JSON.stringify(result)}`)
    const dnsId = await this.rdb.check.dns.insert(result)
    const relayUpdate = { url: result.url, info: { ref: dnsId, changed_at: Date.now() } }
    await this.rdb.relay.get.one(result.url)
    await this.rdb.relay.patch(relayUpdate)
  }

  async on_failed(job, err){
    this.log.info(`Info check failed for ${job.data.relay}: ${JSON.stringify(err)}`)
  }
};