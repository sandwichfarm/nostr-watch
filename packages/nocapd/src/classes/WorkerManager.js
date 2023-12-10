import hash from 'object-hash'

import { Nocap } from '@nostrwatch/nocap'

export class WorkerManager {
  constructor($parent, rdb, config){
    // if(config?.id)
    //   throw new Error('WorkerManager needs an id')
    /** @type {NWQueue} */
    this.$ = $parent

    /** @type {db} */
    this.rdb = rdb

    /** @type {object} */
    this.cb = {}
    
    /** @type {string} */
    this.pubkey = config?.pubkey? config.pubkey: null

    /** @type {number} */
    this.priority = config?.priority? config.priority: 1

    /** @type {number} */
    this.concurrency = config?.concurrency? config.concurrency: 1

    this.bindEvents = true

    /** @type {number} */
    this.timeout = config?.timeout? config.timeout: 5000

    this.log = config?.logger? config.logger.logger: console

    /** @type {function} */
    this.scheduler = config?.scheduler? config.scheduler.bind(this): () => { console.warn(`scheduler not defined for ${this.id}`) }

    /** @type {array} */
    this.worker_events = ['completed', 'failed', 'progress', 'stalled', 'waiting', 'active', 'delayed', 'drained', 'paused', 'resumed']

    /** @type {array} */
    this.queue_events = ['active', 'completed', 'delayed', 'drained', 'error', 'failed', 'paused', 'progress', 'resumed', 'stalled', 'waiting']

    /** @type {Nocap} */  
    this.Nocap = Nocap

    if(!(this.on_completed instanceof Function))
      throw new Error('WorkerManager on_completed needs to be a function')
    
    this.log.info(`${this.id()} initialized`)

    this.interval = 24*60*60*1000 //24h

    this.expires = 24*60*60*1000 //24h
  }

  siblingKeys(){
    return Object.keys(this.$.managers).filter(key => key !== this.constructor.name)
  }

  siblings(){
    const result = {}
    this.siblingKeys().forEach( key => {
      result[key] = this.$.managers[key]
    })
    return result
  }

  id(workerKey){
    if(!workerKey)
      workerKey = this.slug()
    return `${workerKey}@${this.pubkey}`
  }

  slug(){
    return this.constructor.name
  }

  // setWorker($worker){
  //   this.$worker = $worker 
  //   this.bind_events()
  // }

  cbcall(...args){
    const handler = [].shift.call(args)
    if(this?.[`on_${handler}`] && typeof this[`on_${handler}`] === 'function')
      this[`on_${handler}`](...args)
    if(typeof this.cb[handler] === 'function')
      this.cb[handler](...args)
  }

  hasChanged(data1, data2){
    this.log.debug(`hasChanged: ${hash(data1) !== hash(data2)}`)
    return hash(data1) !== hash(data2)
  }

  on(event, handler){
    this.cb[event] = handler.bind(this)
  }

  jobId(relay, workerKey){
    return `${this.id(workerKey)}:${relay}`
  }

  async _work(job){
    if(job.id.startsWith(this.id())) {
      this.log.warn(`[work] ${job.id} is a ${this.constructor.name} job, running...`)
      return this.work()
    }
    this.log.warn(`[work] ${job.id} is not a ${this.constructor.name} job, passing to next worker`)
  }

  async addJob(jdata, workerKey){
    const jobOpts = {
      priority: this.priority,
      removeOnComplete: {
        age: 60*10,
      },
      removeOnFail: {
        age: 60*10,
      }
    }
    if(!workerKey)
      workerKey = this.constructor.name
    this.log.debug(`Adding job for ${workerKey}: ${JSON.stringify(jdata)}`)
    this.$.queue.add(this.id(workerKey), jdata, { jobId: this.jobId(jdata.relay, workerKey), ...jobOpts})
  }

  async populator(){
    this.log.debug('Populator not defined')
    const relays = this.rdb.relay.get.allIds()
    relays.forEach(relay => { this.$.queue.add(this.constructor.name, { relay: relay, checks: [this.id] }) })
  }

  async on_completed(job, rvalue) {
    if(typeof rvalue !== 'object') return
    if(rvalue?.skip === true) return this.log.debug(`${this.constructor.name} check skipped for ${job.data.relay}`)
    const { result } = rvalue
    this.log.debug(`DS check complete for ${job.data.relay}: ${JSON.stringify(result)}`)
    const dnsId = await this.rdb.check.dns.insert(result)
    const relayUpdate = { url: result.url, info: { ref: dnsId, changed_at: Date.now() } }
    await this.rdb.relay.get.one(result.url)
    await this.rdb.relay.patch(relayUpdate)
  }
}