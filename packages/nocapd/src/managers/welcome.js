import { RelayCheckWebsocket, RelayCheckResultInfo, RelayCheckResultDns, RelayCheckResultGeo, RelayCheckResultSsl } from '@nostrwatch/transform'
import { RelayRecord } from '@nostrwatch/relaydb'

export default class extends WorkerManager {
  constructor(config){
    super(config)
    this.id = 'info'
    this.frequency = 6*60*60*1000 //6 hours
    this.timeout = 10000
  }
  async runner(job){
    const { relay, checks } = job.data
    const nocapd = new this.Nocap(relay)
    const result = await nocapd.check(checks, { connnect_timeout: this.timeout })
    nocapd.close()
    this.persist(result)
  }
  async populator(){
    const relaysNew = db.$.select(['url']).from( RelayRecord ).where( { Relay: { last_checked: (v) => v < 0 } } ).flat()
    relaysNew.forEach(relay => {
      const job = { relay: relay, checks: ['connect'] }
      this.addJob(job)
    })
  }
}