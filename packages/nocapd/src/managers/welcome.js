
import { WorkerManager } from '../classes/WorkerManager.js'

export class WelcomeManager extends WorkerManager {
  constructor($q, rdb, config){
    super($q, rdb, config)
    this.id = 'welcome'
    this.frequency = 6*60*60*1000 //6 hours
    this.timeout = 10000
  }
  async runner(job){
    this.log.debug(`Running welcome check for ${job.data.relay.url}`)
    const { relay, checks } = job.data
    const nocapd = new this.Nocap(relay)
    const result = await nocapd.check(checks, { connnect_timeout: this.timeout })
    nocapd.close()
    this.persist(result)
  }
  async populator(){
    const relaysNew = [...this.rdb.$.select(['url']).from( this.rdb.schemas.Relay ).where( { Relay: { last_checked: (v) => v < 0 } } )].flat()
    this.log.debug(`Found ${relaysNew.length} new welcome jobs`)
    relaysNew.forEach(relay => {
      const job = { relay: relay, checks: ['connect', 'read', 'write', 'info', 'dns', 'geo', 'ssl'], persists: ['websocket', 'info', 'dns', 'geo', 'ssl'] }
      this.addJob(job)
    })
  }
}