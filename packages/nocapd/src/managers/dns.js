import { WorkerManager } from '../classes/WorkerManager.js'
import transform from '@nostrwatch/transform'
import { Nocap } from '@nostrwatch/nocap'

const { RelayCheckResultDns } = transform

export class DnsManager extends WorkerManager {
  constructor($q, rdb, config){
    super($q, rdb, config)
    this.id = 'dns'
    this.frequency = 24*60*60*1000 //6 hours
  }
  async runner(job){
    this.log.debug(`Running dns check for ${job.data.relay.url}`)
    const { relay, checks } = job.data;
    const nocapd = new Nocap(relay);
    const dnsOld = this.rdb.checks.dns.get(relay.url)
    const dnsNew = await nocapd.check('dns')
    if(!this.hasChanged(dnsOld.data, dnsNew.data))
      return { skip: true }
    return dnsNew
  }
};