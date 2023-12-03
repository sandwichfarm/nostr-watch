import { WorkerManager } from '../classes/WorkerManager.js'
import transform from '@nostrwatch/transform'
const { RelayCheckWebsocket, RelayRecord } = transform


export class WebsocketManager extends WorkerManager {
  constructor($q, rdb, config){
    super($q, rdb, config)
    this.id = 'websocket'
    this.frequency = 1*60*60*1000 //1 hour
  }
  async runner(job){
    this.log.debug(`Running websocket check for ${job.data.relay.url}`)
    const { relay } = job.data
    const nocapd = new this.Nocap(relay)
    const result = await nocapd.check(['connect', 'read', 'write'], { connnect_timeout: this.timeout })
    return result 
  }
  async populator(){
    this.log.debug(`Populating websocket check`)
    const relays = [...this.rdb.$.select(['url']).from( RelayRecord ).where( 
      { Relay: (R) => 
        {
          const hasBeenChecked = R.last_checked > 0
          const wsUnchecked = R.read === null && R.write === null 
          const newRelay = hasBeenChecked && wsUnchecked
          const expired = R.last_checked < (new Date() - this.frequency)
          return newRelay || expired
        }
      })].flat()
      this.log.debug(`Found ${relays.length} new websocket jobs`)
      relays.forEach(relay => {
      const job = { relay: relay, checks: ['connect'] }
      this.addJob(job)
    })
  }
  async on_complete(job, result){
    this.log.debug(`Websocket check complete for ${job.data.relay.url}`)
    const persists = job.data.persists? job.data.persists: job.data.checks
    for( const key in persists){
      const transformer = new transform[key](result, 'nocap');
      const rdbRecord = transformer.toJson()
      const id = this.rdb.check[key].insert(rdbRecord)
      await this.rdb.relay.patch({ url: result.url, [key]: id });
    }
    if(job.data.checks.includes('websocket'))
      this.rdb.relay.patch({ url: result.url, last_checked: Date.now() });
  }
}