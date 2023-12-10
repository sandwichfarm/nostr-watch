export class NocapdQueues {
  constructor(config){
    /** @type {object} */
    this.managers = {}
    /** @type {BullQueue} */
    this.queue = null 
    /** @type {BullQueueEvents} */
    this.events = null 
    /** @type {BullWorker} */ 
    this.worker = null
    /** @type {WorkerManager} */
    this.managers = null 
    /** @type {Scheduler} */ 
    this.scheduler = null
    /** @type {object} */
    this.cb = {}

    this.pubkey = config?.pubkey? config.pubkey: null

    /** @type {array} */
    this.worker_events = ['completed', 'failed', 'progress', 'stalled', 'waiting', 'active', 'delayed', 'drained', 'paused', 'resumed']

    if(!this.pubkey)
      throw new Error(`NocapdQueues requires a pubkey`)
  }

  route(job){
    const { name } = job
    const daemonManager = name.split('@')[0]
    const daemonPubkey = name.split('@')[1]

    if(daemonPubkey !== this.pubkey) 
      console.warn(`[route] ${daemonPubkey} !== ${this.pubkey}`)

    if(!this.managers[daemonManager])
      throw new Error(`No manager found for ${daemonManager}`)

    return this.managers[daemonManager].work(job)
  }

  route_event(event, ...args){
    const job = args[0]
    let name = null

    if(typeof job === 'object')
      name = job.name
    else if (typeof job === 'string')
      name = job.split(':')[0]

    if(name) {
      const daemonManager = name.split('@')[0]
      const daemonPubkey = name.split('@')[1]
  
      if(daemonPubkey !== this.pubkey) 
        return this.log.warn(`[route_event] ${daemonPubkey} !== ${this.pubkey}`)
  
      if(!this.managers[daemonManager])
        throw new Error(`No manager found for ${daemonManager}`)
  
      return this.managers[daemonManager].cbcall(event, ...args)
    }
    else {
      this.cbcall(event, ...args)
    }

  }

  setWorker($worker){
    this.worker = $worker
    this.bind_events()
  }

  bind_events(){
    // if(!this.bindEvents) return
    this.worker_events.forEach(handler => {
      // console.log(`bind on_${handler} event handler on ${this.worker.name}:${this.constructor.name}`)
      this.worker.on(handler, (...args) => this.route_event(handler, ...args))
    })
  }

  on(event, handler){
    this.cb[event] = handler.bind(this)
  }

  cbcall(...args){
    const handler = [].shift.call(args)
    if(this?.[`on_${handler}`] && typeof this[`on_${handler}`] === 'function')
      this[`on_${handler}`](...args)
    if(typeof this.cb[handler] === 'function')
      this.cb[handler](...args)
  }

  populateAll(){
    Object.keys(this.managers).forEach( m => {
      this.managers[m].populator()
    })
  }

  pause(q){
    if(q)
      return this.queue?.[q].pause()
    Object.keys(this.queue).forEach(q => this.queue[q].pause())
  }

  start(q){
    if(q)
      return this.queue?.[q].start()
    Object.keys(this.queue).forEach(q => this.queue[q].start())
  }

  drain(q){
    if(q)
      return this.queue?.[q].drain()
    Object.keys(this.queue).forEach(q => this.queue[q].drain())
  }

  obliterate(q){
    if(q)
      return this.queue?.[q].obliterate()
    Object.keys(this.queue).forEach(q => this.queue[q].obliterate())
  }
}