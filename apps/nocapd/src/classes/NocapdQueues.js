export class NocapdQueues {
  constructor(config){
    /** @type {object} */
    // this.checks = {}
    /** @type {BullQueue} */
    this.queue = null 
    /** @type {BullQueueEvents} */
    this.events = null 
    /** @type {BullWorker} */ 
    this.worker = null
    // /** @type {WorkerManager} */
    this.checks = null 
    /** @type {Scheduler} */ 
    this.scheduler = null
    /** @type {object} */
    this.cb = {}
    /** @type {object} */
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

    // if(daemonPubkey !== this.pubkey) 
    //   console.warn(`[route] ${daemonPubkey} !== ${this.pubkey}`)

    if(!this.checks[daemonManager])
      throw new Error(`No manager found for ${daemonManager}`)

    return this.checks[daemonManager].work(job)
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
  
      // if(daemonPubkey !== this.pubkey) 
      //   return this.log.warn(`[route_event] ${daemonPubkey} !== ${this.pubkey}`)
  
      if(!this.checks[daemonManager])
        return 
        // this.log.warn(`No manager found for ${daemonManager} to handle ${event} event for pubkey: ${daemonPubkey}`)
  
      return this.checks[daemonManager].cbcall(event, ...args)
    }
    //these events apply to the worker not the manager an d don't have any parameters, 
    //so cannot be routed like completions and failures.
    else if( event === 'drained' ) {
      for( const manager in this.checks ) {
        this.checks[manager].cbcall(event)
      }
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
    this.worker_events.forEach(handler => {
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

  async populateAll(){
    const mkeys = Object.keys(this.checks)
    for await ( const mkey of mkeys ){
      // this.log.debug(`populateAll() -> ${mkey}:populator()`)
      await this.checks[mkey].populator()
    }
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