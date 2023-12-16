import { WorkerManager } from '../classes/WorkerManager.js'

export class GeoManager extends WorkerManager {
  constructor($q, rdb, config){
    super($q, rdb, config)
    this.id = 'geo'
    this.interval = 24*60*60*1000 //1 day
    this.expires = 6*24*60*60*1000 //6 hours
    this.priority = 40
  }
  async populator(){
    this.log.info('Populating geo jobs')
    const { RelayCheckDns } = this.rdb.schemas
    const dnsNew = [...this.rdb.$.select(['url']).from( RelayCheckDns ).where( { RelayCheckDns: { last_checked: (v) => v < Date.now()-this.frequency } } )].flat()
    this.log.info(`Found ${dnsNew.length} new dns jobs`)
    new Set([...dnsNew]).forEach(relay => {
      const job = { relay: relay, checks: ['dns', 'geo'], persists: ['geo'] }
      this.$.queue.add(job)
    })
  }
  async work(job){
    this.log.info(`Running geo check for ${job.data.relay.url}`)
    const { relay, checks } = job.data;
    const nocapd = new this.Nocap(relay);
    const result = await nocapd.check(['dns'], { timeout: { ssl: this.timeout }});
    return result;
  }

  async on_complete(){

  }
};
