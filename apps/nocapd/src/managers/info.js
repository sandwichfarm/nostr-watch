import { WorkerManager } from '../classes/WorkerManager.js'

export class InfoManager extends WorkerManager {

  constructor($q, nwc, config){
    super($q, nwc, config)
    this.interval = 5*60*1000       //checks for expired items every...
    this.expires = 6*60*60*1000     //6 hours
    this.timeout = 15*1000
    this.timeoutBuffer = 1000
    this.priority = 20
  }

  async populator(){
    const { Relay } = this.nwc.schemas
    const relays = this.nwc.cachetime.expired('info')
    this.log.info(`Found ${relays.length} new info jobs`)
    relays.forEach(relay => {
      const job = { relay }
      this.addJob(job)
    })
  }

  async work(job){
    const { relay } = job.data;
    const infoOldId = this.nwc.relay.get.one(relay)?.info?.ref
    let infoOld = {}
    if(infoOldId) {
      const record = this.nwc.checks.info.get(infoOldId)
      infoOld = record?.data
    }
    const nocap = new this.Nocap(relay);
    const infoCheck = await nocap.check('info')
    const infoNew = infoCheck?.info?.data
    if(!this.hasChanged(infoNew, infoOld))
      return { skip: true, result: { url: relay } }
    return { result: infoCheck }
  }

  async on_completed(job, rvalue){
    if(typeof rvalue !== 'object') return
    const { result } = rvalue
    const persist = !rvalue?.skip && rvalue.skip !== true
    let infoId = null
    if(persist){
      this.log.debug(`Info check complete for ${job.data.relay}: ${JSON.stringify(result)}`)
      const infoId = await this.nwc.check.info.insert(result)
    }
    const record = await this.nwc.relay.get.one(result.url)
    if(record.info === null || persist) {
      await this.nwc.relay.patch({ 
        url: result.url, 
        info: { 
          name: result?.info?.data?.name || null, 
          description: result?.info?.data?.description || null, 
          software: result?.info?.data?.software || null, 
          version: result?.info?.data?.version || null, 
          supported_nips: result?.info?.data?.supported_nips || [], 
          limitations: result?.info?.data?.limitations || {}, 
          ref: infoId || null, 
          changed_at: infoId? Date.now(): null
        } 
      })
    }
  }

  async on_failed(job, err){
    this.log.info(`Info check failed for ${job.data.relay}: ${JSON.stringify(err)}`)
  }

}