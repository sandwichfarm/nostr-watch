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
    this.log.info(`Running websocket check for ${job.data.relay.url}`)
    const { relay } = job.data
    const nocapd = new this.Nocap(relay)
    const result = await nocapd.check(['connect', 'read', 'write'], { connnect_timeout: this.timeout })
    return result 
  }
  async populator(){
    this.log.info(`Populating websocket check`)
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
      this.log.info(`Found ${relays.length} new websocket jobs`)
      relays.forEach(relay => {
      const job = { relay: relay, checks: ['connect'] }
      this.addJob(job)
    })
  }
  async on_complete(job, result){
    this.log.info(`Websocket check complete for ${job.data.relay.url}`)
    const transformer = new transform.RelayCheckWebsocket(result, 'nocap');
    const rdbRecord = transformer.toJson()
    const checkId = await this.rdb.check[key].insert(rdbRecord)
    await this.rdb.relay.patch({ url: result.url });
  }
}