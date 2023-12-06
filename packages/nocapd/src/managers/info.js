import { WorkerManager } from '../classes/WorkerManager.js'

export class InfoManager extends WorkerManager {
  constructor($q, rdb, config){
    super($q, rdb, config)
    this.id = 'info'
    this.frequency = 6*60*60*1000 //6 hours
  }
  async runner(job){
    this.log.info(`Running info check for ${job.data.relay.url}`)
    const { relay } = job.data;
    const nocapd = new this.Nocap(relay);
    const infoOld = this.rdb.checks.info.get(this.rdb.relay.get(relay).info)
    const infoNew = await nocapd.check('info').data
    if(!this.hasChanged(infoNew, infoOld))
      return { skip: true }
    return infoNew
  }
}