class WorkerManager {
  constructor($q, rdb, config){
    if(config?.id)
      throw new Error('WorkerManager needs an id')
    /** @type {NWQueue} */
    this.$ = $q

    /** @type {db} */
    this.rdb = rdb

    /** @type {object} */
    this.cb = {}
    
    /** @type {string} */
    this.id = config.id 

    /** @type {BullWorker} */
    this.$worker = null

    /** @type {relaydb} */
    this.db = config.db

    /** @type {number} */
    this.priority = config.priority? config.priority: 1

    /** @type {number} */
    this.concurrency = config.concurrency? config.concurrency: 1

    /** @type {number} */
    this.timeout = config.timeout? config.timeout: 5000

    /** @type {number} */
    this.frequency = config.frequency? config.frequency: 60*60*1000 //1hour default

    /** @type {function} */
    this.handler = config.handler? config.handler.bind(this): () => { console.warn(`handler not defined for ${this.id}`) }

    /** @type {function} */
    this.populator = config.populator? config.populator.bind(this): this._populator.bind(this)

    /** @type {function} */
    this.scheduler = config.scheduler? config.scheduler.bind(this): () => { console.warn(`scheduler not defined for ${this.id}`) }

    /** @type {array} */
    this.worker_events = ['completed', 'failed', 'progress', 'stalled', 'waiting', 'active', 'delayed', 'drained', 'paused', 'resumed']
    
    /** @type {array} */
    this.queue_eventst = ['active', 'completed', 'delayed', 'drained', 'error', 'failed', 'paused', 'progress', 'resumed', 'stalled', 'waiting']

    if(!(this.handler instanceof Function))
      throw new Error('WorkerManager handler needs to be a function')
    if(!(this.populator instanceof Function))
      throw new Error('WorkerManager populator needs to be a function')
    if(!(this.scheduler instanceof Function))
      throw new Error('WorkerManager scheduler needs to be a function')
    if(!(this.on_complete instanceof Function))
      throw new Error('WorkerManager on_complete needs to be a function')
  }

  bind_events(){
    Object.keys(this.eventHanders).forEach(handler => this.$worker.on(handler, (...args) => this.cbcall(handler, args)))
  }

  cbcall(handler, ...args){
    [].shift.call(args,1)
    if(typeof this.cb[handler] === 'function')
      this.cb[handler](...args)
  }

  hasChanged(data1, data2){
    return hash(data1) !== hash(data2)
  }

  on(event, handler){
    this.cb[event] = handler.bind(this)
  }

  async handle(job){  
    return this.handler(job)
  }

  async addJob(job){
    $.queue.add(this.constructor.name, job)
  }

  async populate(){
    return this.populator()
  }

  async _populator(){
    const relays = db.relays.get.allIds()
    relays.forEach(relay => { this.$.queue.add(this.constructor.name, { relay: relay }) })
  },
}