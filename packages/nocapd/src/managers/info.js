import { RelayCheckResultInfo } from '@nostrwatch/transform'
import { WorkerManager } from '../classes/WorkerManager'

export default class extends WorkerManager {
  constructor(config){
    super(config)
    this.id = 'info'
    this.frequency = 6*60*60*1000 //6 hours
  }
  async runner(job){
    const { relay } = job.data;
    const nocapd = new this.Nocap(relay);
    const infoOld = this.rdb.checks.info.get(db.relay.get(relay).info)
    const infoNew = await nocapd.check('info').data
    if(!this.hasChanged(infoNew, infoOld))
      return { skip: true }
    return infoNew
  }
}