
import { WorkerManager } from '../classes/WorkerManager.js'
import { ParseSelect, RelayRecord } from '@nostrwatch/nwcache'
const parseSelect = ParseSelect(RelayRecord, "Relay")

export class WelcomeManager extends WorkerManager {
  constructor(parent, rdb, config){
    super(parent, rdb, config)
    // this.id = 'welcome'
    this.interval = 60*1000 //1m
    this.expires = 60*1000 //24h
    this.concurrency = 1
    this.timeout = 10000
    this.bindEvents = false
    this.priority = 5
  }
  
  async work(job){
    // console.log(job.data)
    //welcomer doesn't produce any jobs. 
    console.warn(`[runner] Welcomer only produces jobs for other workers, so this should never fire!`)
  }

  async populator(){
    const { Relay } = this.rdb.schemas
    const select = parseSelect('url')
    const relaysNew = [...this.rdb.$.select( select ).from( Relay ).where( { Relay: { last_checked: (v) => v < 0 } } )].flat()
    this.log.info(`Found ${relaysNew.length} new welcome jobs`)
    relaysNew.map(r=>r.url).forEach(relay => {
      this.siblingKeys().forEach( async managerKey => await this.addJob( { relay }, managerKey ) )
    })
  }

  async on_completed(job, result){
    // console.log(result)
    console.warn(`[on_completed] Welcomer only produces jobs for other workers, so this should never fire!`)
  }
}