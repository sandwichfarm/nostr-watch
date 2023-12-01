import Nocap from '@nostrwatch/nocap'
import { RelayRecord } from '@nostrwatch/relaydb'

export default class extends WorkerManager {
  constructor(config){
    super(config)
    this.id = 'info'
    this.frequency = 6*60*60*1000 //6 hours
  }
  async populator(){
    const dnsNew = this.rdb.$.select(['url']).from( RelayRecord ).where( { Relay: { last_checked: (v) => v > Date.now()+this.frequency*1.1 } } ).flat()
    const geoUnset = this.rdb.$.select(['url']).from( RelayRecord ).where( { Relay: { geo: (v) => Object.keys(v).length === 0 } } ).flat()
    new Set([...dnsNew,...geoUnset]).forEach(relay => {
      const job = { relay: relay, checks: ['dns', 'geo'], persists: ['geo'] }
      this.$.queue.add(job)
    })
  }
  async runner(job){
    const { relay, checks } = job.data;
    const nocapd = new Nocap(relay);
    const result = await nocapd.check(checks, { geo_timeout: this.timeout });
    return result;
  }
};
