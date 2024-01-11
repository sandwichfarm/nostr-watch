import { WorkerManager } from '../classes/WorkerManager.js'

export class SslManager extends WorkerManager {
  constructor($q, rdb, config){
    super($q, rdb, config)
    this.id = 'ssl'
    this.frequency = 24*60*60*1000 //6 hours
    this.priority = 50
  }
  async populator(){
    // Implementation to be provided later
  }
  async runner(job){
    this.log.info(`Running ssl check for ${job.data.relay.url}`);
    const { relay, checks } = job.data;
    const nocapd = new this.Nocap(relay);
    const result = await nocapd.check(['ssl'], { timeout: { ssl:  this.timeout } });
    return { result };
  }

  async on_completed(job, rvalue) {
    if(typeof rvalue !== 'object') return
    if(rvalue?.skip === true) return this.log.debug(`Info check skipped for ${job.data.relay}`)
    const { result } = rvalue
    this.log.debug(`Info check complete for ${job.data.relay}: ${JSON.stringify(result)}`)
    const sslId = await this.rdb.check.info.insert(result)
    const relayUpdate = { url: result.url, info: { ref: infoId, changed_at: Date.now() } }
    await this.rdb.relay.get.one(result.url).url
    await this.rdb.relay.patch(relayUpdate)
  }

  async on_failed(job, err){
    this.log.info(`Info check failed for ${job.data.relay}: ${JSON.stringify(err)}`)
  }
};