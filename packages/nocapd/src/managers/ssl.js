import { WorkerManager } from '../classes/WorkerManager.js'

export class SslManager extends WorkerManager {
  constructor($q, rdb, config){
    super($q, rdb, config)
    this.id = 'ssl'
    this.frequency = 24*60*60*1000 //6 hours
  }
  async populator(){
    // Implementation to be provided later
  }
  async runner(job){
    this.log.info(`Running ssl check for ${job.data.relay.url}`);
    const { relay, checks } = job.data;
    const nocapd = new this.Nocap(relay);
    const result = await nocapd.check(['ssl'], { ssl_timeout: this.timeout });
    return result;
  }
};