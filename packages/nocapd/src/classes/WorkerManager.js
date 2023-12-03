import hash from 'object-hash'

import transform from '@nostrwatch/transform'
import { Nocap } from '@nostrwatch/nocap'


export class WorkerManager {
  constructor($q, rdb, config){
    // if(config?.id)
    //   throw new Error('WorkerManager needs an id')
    /** @type {NWQueue} */
    this.$ = $q

    /** @type {db} */
    this.rdb = rdb

    /** @type {object} */
    this.cb = {}
    
    // /** @type {string} */
    // this.id = config.id 

    /** @type {BullWorker} */
    this.$worker = null

    /** @type {number} */
    this.priority = config?.priority? config.priority: 1

    /** @type {number} */
    this.concurrency = config?.concurrency? config.concurrency: 1

    /** @type {number} */
    this.timeout = config?.timeout? config.timeout: 5000

    this.log = config?.logger? config.logger.logger: console

    // /** @type {number} */
    // this.frequency = config?.frequency? config.frequency: 60*60*1000 //1hour default

    // /** @type {function} */
    // this.handler = config?.handler? config.handler.bind(this): () => { console.warn(`handler not defined for ${this.id}`) }

    // /** @type {function} */
    // this.populator = config?.populator? config.populator.bind(this): this._populator.bind(this)

    /** @type {function} */
    this.scheduler = config?.scheduler? config.scheduler.bind(this): () => { console.warn(`scheduler not defined for ${this.id}`) }

    /** @type {array} */
    this.worker_events = ['completed', 'failed', 'progress', 'stalled', 'waiting', 'active', 'delayed', 'drained', 'paused', 'resumed']

    /** @type {array} */
    this.queue_eventst = ['active', 'completed', 'delayed', 'drained', 'error', 'failed', 'paused', 'progress', 'resumed', 'stalled', 'waiting']

    /** @type {Nocap} */  
    this.Nocap = Nocap

    // if(!(this.handler instanceof Function))
    //   throw new Error('WorkerManager handler needs to be a function')
    // if(!(this.populator instanceof Function))
    //   throw new Error('WorkerManager populator needs to be a function')
    // if(!(this.scheduler instanceof Function))
    //   throw new Error('WorkerManager scheduler needs to be a function')
    if(!(this.on_complete instanceof Function))
      throw new Error('WorkerManager on_complete needs to be a function')
  }

  bind_events(){
    Object.keys(this.eventHanders).forEach(handler => this.$worker.on(handler, (...args) => this.cbcall(handler, args)))
  }

  cbcall(handler, ...args){
    [].shift.call(args,1)
    if(this?.[`on_${handler}`] && typeof this[`_${handler}`] === 'function')
      this[`on_${handler}`](...args)
    if(typeof this.cb[handler] === 'function')
      this.cb[handler](...args)
  }

  async on_complete(job, result){
    this.log.debug('Job completed')
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

  hasChanged(data1, data2){
    this.log.debug(`hasChanged: ${hash(data1) !== hash(data2)}`)
    return hash(data1) !== hash(data2)
  }

  on(event, handler){
    this.cb[event] = handler.bind(this)
  }

  async addJob(job){
    this.log.debug(`Adding job: ${JSON.stringify(job)}`)
    this.$.queue.add(this.constructor.name, job)
  }

  async populator(){
    this.log.debug('Populator not defined')
    const relays = this.rdb.relay.get.allIds()
    relays.forEach(relay => { this.$.queue.add(this.constructor.name, { relay: relay, checks: [this.id] }) })
  }
}