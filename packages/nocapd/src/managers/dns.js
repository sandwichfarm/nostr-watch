import { RelayCheckResultDns } from '@nostrwatch/transform'
import Nocap from '@nostrwatch/nocap'

export default class extends WorkerManager {
  constructor(config){
    super(config)
    this.id = 'info'
    this.frequency = 6*60*60*1000 //6 hours
  }
  async runner(job){
    const { relay, checks } = job.data;
    const nocapd = new Nocap(relay);
    const dnsOld = this.rdb.checks.info.get(relay.url)
    const dnsNew = await nocapd.check('dns')
    if(!this.hasChanged(dnsOld, dnsNew.data))
      return { skip: true }
    return dnsNew
  }
};