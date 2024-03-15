import Logger from '@nostrwatch/logger'

export class NocapdQueues {
  constructor(opts){
    this.setup(opts)
    if(!this.pubkey)
      throw new Error(`NocapdQueues requires a pubkey`)
  }

  setup(opts){
    this.pubkey = opts?.pubkey? opts.pubkey: null
    this.log = this.opts?.logger? this.opts.logger: new Logger('nocap/$NocapdQueues')
    this.cb = {}
    this.queue = null 
    this.events = null 
    this.worker = null
    this.checker = null
    this.worker_events = ['completed', 'failed', 'progress', 'stalled', 'waiting', 'active', 'delayed', 'drained', 'paused', 'resumed']
  }

  route_event(event, ...args){
    // this.log.info(`route_event(): ${event}, ${args || "no event args"}`)
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

  set(key, fn){
    // this.log.info(`set('${key}'): with ${typeof fn}`)
    this[key] = fn
    if(key === 'worker') this.bind_events()
    return this
  }

  bind_events(){
    this.worker_events.forEach(handler => {
      //this.log.debug(`bind_events(): binding ${handler} to ${this.worker.name}`)
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

  async pause(){
    return await this.queue.pause()
  }

  async resume(){
    return await this.queue.resume()
  }

  async drain(){
    return await this.queue.drain()
  }

  async obliterate(){
    return await this.queue.obliterate()
  }
}