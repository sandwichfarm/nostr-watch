import Logger from '@nostrwatch/logger'

export class NocapdQueues {
  constructor(opts){
    this.setup(opts)
    if(!this.pubkey)
      throw new Error(`NocapdQueues requires a pubkey`)
  }

  setup(opts){
    this.pubkey = opts?.pubkey? opts.pubkey: null
    this.log = this.opts?.logger? this.opts.logger: new Logger('nocap/queue-manager')
    this.cb = {}
    this.queue = null 
    this.events = null 
    this.worker = null
    this.checker = null
    this.worker_events = ['completed', 'failed', 'progress', 'stalled', 'waiting', 'active', 'delayed', 'drained', 'paused', 'resumed']
  }

  async route_work(job){
    const name = job.name.split(':')[0]
    if(name !== this.pubkey) return this.log.debug(`work belongs to ${name}`)
    return this.checker.work(job)
  }

  route_event(event, ...args){
    this.log.debug(`route_event(): ${event}, ${args.length}, ${JSON.stringify(args) || "no event args"}`)
    const job = args[0]
    let name = null

    if(typeof job === 'object')
      name = job.name

    else if (typeof job === 'string')
      name = job.split(':')[0]

    // console.log(event, 'name', name, name === this.pubkey, args.length, args[2])

    if(name === this.pubkey) {
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
    this.log.debug(`set('${key}'): with ${typeof fn}`)
    this[key] = fn
    if(key === 'worker') this.bind_events()
    return this
  }

  bind_events(){
    this.worker_events.forEach(handler => {
      this.log.debug(`bind_events(): binding ${handler} to ${this.worker.name}`)
      this.worker.on(handler, (...args) => this.route_event(handler, ...args))
    })
  }

  on(event, handler){
    this.cb[event] = handler.bind(this)
    return this
  }

  cbcall(...args){
    const handler = [].shift.call(args)
    if(this?.[`on_${handler}`] && typeof this[`on_${handler}`] === 'function')
      this[`on_${handler}`](...args)
    if(typeof this.cb[handler] === 'function')
      this.cb[handler](...args)
  }

  async pause(){
    await this.queue.pause()
    return this
  }

  async resume(){
    await this.queue.resume()
    return this
  }

  async drain(){
    await this.queue.drain()
    return this
    
  }

  async obliterate(){
    await this.queue.obliterate()
    return this
  }
}