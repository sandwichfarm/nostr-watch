import { WorkerManager } from '../classes/WorkerManager.js'

export class GeoManager extends WorkerManager {
  constructor($q, rdb, config){
    super($q, rdb, config)
    this.id = 'geo'
    this.frequency = 24*60*60*1000 //24 hours
  }
  async populator(){
    this.log.debug('Populating geo jobs')
    const { RelayCheckDns } = this.rdb.schemas
    const dnsNew = [...this.rdb.$.select(['url']).from( RelayCheckDns ).where( { RelayCheckDns: { last_checked: (v) => v < Date.now()-this.frequency } } )].flat()
    this.log.debug(`Found ${dnsNew.length} new dns jobs`)
    new Set([...dnsNew]).forEach(relay => {
      const job = { relay: relay, checks: ['dns', 'geo'], persists: ['geo'] }
      this.$.queue.add(job)
    })
  }
  async runner(job){
    this.log.debug(`Running geo check for ${job.data.relay.url}`)
    const { relay, checks } = job.data;
    const nocapd = new this.Nocap(relay);
    const result = await nocapd.check(checks, { geo_timeout: this.timeout });
    return result;
  }
};
