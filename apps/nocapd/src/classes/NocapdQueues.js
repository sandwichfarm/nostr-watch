export class NocapdQueues {
  constructor(opts){
    this.setup(opts)
    if(!this.pubkey)
      throw new Error(`NocapdQueues requires a pubkey`)
  }

  setup(opts){
    this.pubkey = opts?.pubkey? opts.pubkey: null
    this.cb = {}
    this.queue = null 
    this.events = null 
    this.worker = null
    this.checker = null
    this.worker_events = ['completed', 'failed', 'progress', 'stalled', 'waiting', 'active', 'delayed', 'drained', 'paused', 'resumed']
    
  }

  route_event(event, ...args){
    const job = args[0]
    let name = null

    if(typeof job === 'object')
      name = job.name

    else if (typeof job === 'string')
      name = job.split(':')[0]

    if(name) {
      return this.checker.cbcall(event, ...args)
    }
    else if( event === 'drained' ) {
      this.checker.cbcall(event)
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