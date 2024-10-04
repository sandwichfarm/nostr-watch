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

  set(key, fn){
    this.log.debug(`set('${key}'): with ${typeof fn}`)
    this[key] = fn
    if(key === 'worker') this.bind_events()
    return this
  }

  bind_events(){
    this.worker_events.forEach(handler => {
      this.log.debug(`bind_events(): binding ${handler} to ${this.worker.name}`)
      this.worker.on(handler, (...args) => this.checker.cbcall(handler, ...args))
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
    await this.queue.pause().catch(console.error)
    return this
  }

  async resume(){
    await this.queue.resume().catch(console.error)
    return this
  }

  async drain(){
    await this.queue.drain().catch(console.error)
    return this
  }

  async obliterate(){
    await this.queue.obliterate().catch(console.error)
    return this
  }
}