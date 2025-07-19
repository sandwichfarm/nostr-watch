import NTTrawler from './Trawler.js'

class NTQueue extends NTTrawler {
  constructor(relays, options) {
    super(relays, options)
    this.$q = null
    this.queue 
    this.worker
    this.cb = {}
    this.since = {}
    this.repeatTimeout = null
  }

  async _on(key, ...args){
    //console.log(`NTQueue._on(${key})`)
    if(this.cb?.[key])
      this.cb[key](...args)
    if(this?.[`handle_${key}`] && typeof this?.[`handle_${key}`] === 'function')
      this?.[`handle_${key}`](...args)
  }

  on(key, callback){
    //console.log(`NTQueue.on(${key})`)
    this.cb[key] = callback
    return this
  }

  on_queue(key, data){
    //console.log(`NTQueue.on_queue(${key})`)
    this.on(`queue_${key}`, data)
    return this
  }

  on_worker(key, data){
    //console.log(`NTQueue.on_worker(${key})`)
    this.on(`worker_${key}`, data)
    return this
  }

  async handle_queue_drained($job, result){
    //console.log(`NTQueue.handle_queue_drained()`)
    const timeoutExists = this.repeatTimeout && !this.repeatTimeout._destroyed
    if(this.options?.repeatWhenComplete && !timeoutExists) {
      //console.log(`Resting for ${Math.round(this.options?.restDuration/1000)} seconds and then picking up where we left off`)
      this.repeatTimeout = setTimeout( () => this.run(), this.options?.restDuration )
    }
  }

  addFirstJob(fn, target){
    //console.log('addFirstJob()')
    
  }

  pause(key){
    //console.log('pause()')
    this.$q.pause(key)
  }

  clear(key){
    //console.log('clear()')
    this.$q.clear(key)
  }

  start(key){
    //console.log('start()')
    this.$q.start(key)
  }

  stop(key){
    //console.log('stop()')
    this.$q.stop(key)
  }
}

export default NTQueue