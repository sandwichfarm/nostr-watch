import { RelayCheckWebsocket } from '@nostrwatch/transform'

export default class extends WorkerManager {
  constructor(config){
    super(config)
    this.id = 'info'
    this.frequency = 6*60*60*1000 //6 hours
  },
  async runner(job){
    const { relay, checks } = job.data
    const nocapd = new NocapdWrapper(relay)
    const result = await nocapd.check(['connect', 'read', 'write'], { connnect_timeout: this.timeout })
    return result 
  },
  async populator(){
    const relays = db.$.select(['url']).from( RelayRecord ).where( 
      { Relay: (R) => 
        {
          const hasBeenChecked = R.last_checked > 0
          const wsUnchecked = R.read === null && R.write === null 
          const newRelay = hasBeenChecked && wsUnchecked
          const expired = R.last_checked < (new Date() - this.frequency)
          return newRelay || expired
        }
      }).flat()
      relays.forEach(relay => {
      const job = { relay: relay, checks: ['connect'] }
      this.addJob(job)
    })
  }
}