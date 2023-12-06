
import { WorkerManager } from '../classes/WorkerManager.js'
import transform from '@nostrwatch/transform'

export class WelcomeManager extends WorkerManager {
  constructor($q, rdb, config){
    super($q, rdb, config)
    this.id = 'welcome'
    this.frequency = 6*60*60*1000 //6 hours
    this.concurrency = 5
    this.timeout = 10000
    
  }
  async runner(job){
    const { relay, checks } = job.data
    this.log.info(`Running welcome check for ${relay}`)
    const nocapd = new this.Nocap(relay)
    // nocapd
    //   .on('error', (...args) => console.log('error', ...args))
    //   .on('ok', (...args) => console.log('ok', ...args))
    //   .on('notice', (...args) => console.log('notice', ...args))
    //   .on('event', (...args) => console.log('event', ...args))
    //   .on('open', (...args) => console.log('open', ...args))
    //   .on('change', (...args) => console.log('change', ...args))
    const result = await nocapd.check(checks, { connect_timeout: this.timeout, read_timeout: this.timeout, write_timeout: this.timeout })
    nocapd.close()
    return result
  }
  async populator(){
    const { Relay } = this.rdb.schemas
    const relaysNew = [...this.rdb.$.select().from( Relay ).where( { Relay: { last_checked: (v) => v < 0 } } )].flat()
    this.log.info(`Found ${relaysNew.length} new welcome jobs`)
    relaysNew.forEach(relay => {
      // const job = { relay: relay.Relay.url, checks: ['connect', 'read', 'write', 'info', 'dns', 'geo', 'ssl'] }
      ['websocket', 'info', 'geo', 'ssl'].forEach(check => {
        let runCheck = []
        if(check === 'websocket') 
          runCheck = ['connect', 'read', 'write']
        if(check === 'geo')
          runCheck = ['dns', 'geo']
        else  
          runCheck = [check]
        const job = { relay: relay.Relay.url, checks: runCheck, type: check }
        this.addJob(job)
      })
      // console.log(job)
      // process.exit()
    })
    this.$worker.resume()
    await this.$.queue.resume()
  }
  async on_completed(job, result){
    this.log.warn(`Job ${job.id} completed`)
    let persists = job.data?.persists? job.data.persists: job.data.checks
    if(persists.includes('connect')) {
      persists = persists.filter(persist => !['connect', 'read', 'write'].includes(persist)) 
      if(result['connect']?.status !== 'error') persists.push('websocket')
    }
    const relayId = this.rdb.relay.id(job.data.relay)
    result.relay_id = relayId
    for( let key of persists){
      if(result[key]?.status === 'error') continue
      const Transform = transform[key]; 
      const transformer = new Transform();
      transformer.fromNocap(result, result[key])
      const rdbRecord = transformer.toJSON()
      
      console.log(rdbRecord)
      console.log(key, 'here')
      process.exit()
      const id = await this.rdb.check[key].insert(rdbRecord)
      await this.rdb.relay.patch({ url: result.url, [key]: id });
    }
    if(job.data.checks.includes('websocket'))
      this.rdb.relay.patch({ url: result.url, last_checked: Date.now() });
  }
}