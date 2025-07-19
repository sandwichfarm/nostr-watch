import { Queue, QueueEvents, Worker } from 'bullmq';
// import Redis from 'ioredis';
import NTQueue from '../classes/Queue.js'

class BullMqAdapter extends NTQueue {
  constructor(relays, options) {
    super(relays, options)
    // console.log('BullMqAdapter()')
    this.opts(options)
  }

  async init(){
    // console.log('BullMqAdapter():init()')
    this.$q = {}
    await this.queue_init()
    this.worker_init()
  }

  async queue_init(){
    // console.log('BullMqAdapter:queue_init()')
    if(this.options?.$instance) {
      this.$q.queue = this.options.$instance
    } else {
      this.$q.queue = new Queue(this.options.queueName, this.options.queueOptions)
    }

    // await this.$q.queue.pause()
    // console.log('draining queue');
    // await this.$q.queue.drain();
    // console.log('queue drained');
    // console.log('obliterating queue');
    // await this.$q.queue.obliterate({ force: true });
    // console.log('queue obliterated');
    // await this.$q.queue.resume()
    
    
    const qEvents = new QueueEvents(this.$q.queue.name, { connection: this.options.adapterOptions.connection } );
    qEvents.on('active',      (...args) => this._on('queue_active',     ...args).catch(console.error))
    qEvents.on('completed',   (...args) => this._on('queue_completed',  ...args).catch(console.error))
    qEvents.on('failed',      (...args) => this._on('queue_failed',     ...args).catch(console.error))
    qEvents.on('progress',    (...args) => this._on('queue_progress',   ...args).catch(console.error))
    qEvents.on('waiting',     (...args) => this._on('queue_waiting',    ...args).catch(console.error))
    qEvents.on('drained',     (...args) => this._on('queue_drained',    ...args).catch(console.error))  
    qEvents.on('cleaned',     (...args) => this._on('queue_cleaned',    ...args).catch(console.error))
  }

  worker_init(){
    this.$q.worker = new Worker(this.$q.queue.name, async $job => await this.trawl($job.data.chunk, $job), this.options.workerOptions) 
    this.$q.worker.on('active',     (...args) => this._on('worker_active',    ...args).catch(console.error))
    this.$q.worker.on('completed',  (...args) => this._on('worker_completed', ...args).catch(console.error))
    this.$q.worker.on('failed',     (...args) => this._on('worker_failed',    ...args).catch(console.error))
    this.$q.worker.on('progress',   (...args) => this._on('worker_progress',  ...args).catch(console.error))
    this.$q.worker.on('waiting',    (...args) => this._on('worker_waiting',   ...args).catch(console.error))
    this.$q.worker.on('drained',    (...args) => this._on('worker_drained',   ...args).catch(console.error))
    this.$q.worker.on('cleaned',    (...args) => this._on('worker_cleaned',   ...args).catch(console.error))
  }

  opts(options){
    this.adapterDefaults = {
      connection: {
        host: '127.0.0.1',
        port: 6379,
        db: 0
      } 
    }

    if(this.options.adapterOptions?.redis){
      this.options.adapterOptions.connection = this.options.adapterOptions.redis
      delete this.options.adapterOptions.redis
    }
    this.options.adapterOptions = { ...this.adapterDefaults, ...this.options.adapterOptions }
    
    if(this.options.queueOptions?.$instance){
      this.options.$instance = this.options.queueOptions.$instance
      delete this.options.queueOptions.$instance
    }

    this.queueDefaults = {
      removeOnComplete: true,
      removeOnFail: true
    }
    this.options.queueOptions = { 
      ...this.queueDefaults, 
      ...this.options.queueOptions, 
      connection: this.options.adapterOptions.connection 
    }

    this.workerDefaults = {}
    this.options.workerOptions = { 
        ...this.workerDefaults, 
        ...this.options.workerOptions, 
        connection: this.options.adapterOptions.connection, 
        concurrency: 1 
      }
  }

  async updateProgress(progress, $job){
    // console.log('updateProgress()', progress)
    await $job.updateProgress(progress)
  }

  async addJob(index, chunk){
    // console.log(`BullMQAdapter.addJob()`, 'adding job', index, chunk)  
    return this.$q.queue.add(`chunk #${index}`, { chunk })
  }

  async pause(){
    // console.log('pausing')
    await this.$q.queue.pause()
  }

  async resume(){
    // console.log('resuming')
    await this.$q.queue.resume()
  }

  async clean(){
    // console.log('cleaning')
    await this.$q.queue.clean(0, 0, 'completed')
  }

  async close(){
    // console.log('closing')
    await this.$q.queue.close()
    await this.$q.worker.close()
  }

  queueApi(key, ...args){
    console.log('queueApi()', key, args)
    if(!(this.$q.queue?.[key] instanceof Function))
      return 
    return this.$q.queue?.[key](...args)
  }
  
  jobApi(key, ...args){
    // console.log('jobApi()', key, args)
    if(!(this.$q.worker?.[key] instanceof Function))
      return
    return this.$q.worker?.[key](...args)
  }
}

export default BullMqAdapter
