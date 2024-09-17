import Logger from '@nostrwatch/logger'
import { PersistQueue, BullMQ } from '@nostrwatch/controlflow'
import { delay, RedisConnectionDetails } from "@nostrwatch/utils"

const JOB_OPTS = {
  delay: 1,
  removeOnComplete: true, 
  removeOnFail: true,
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 60*1000,
  }
}

export class ShortBus {

  $ = null
  key
  worker = () => {}
  workerFns = new Map()

  constructor(slug){
    this.key = `persist6/${slug}`
    this.$ = PersistQueue(this.key)
    this.worker = new BullMQ.Worker(this.key, this.work.bind(this), { concurrency: 1, connection: RedisConnectionDetails() } )
    this.$.$Queue.resume()
    this.log = new Logger('@nostrwatch/shortbus')
  }

  async addJob(payload){
    return this.$.$Queue.add( 'persist', payload, JOB_OPTS )
  }

  setWorker(key, fn){
    this.log.debug(`ShortBus::setWorker`, key)
    if(fn instanceof Function)
      this.workerFns.set(key, fn)
    this.log.debug(`ShortBus: ${this.workerFns.size} workers registered`)
  }

  async work(job) {
    await delay(1)
    const { type } = job.data
    for(let [key, fn] of this.workerFns) {
      if( type !== key ) continue;
      this.log.debug(`ShortBus: BEGIN ${key}`)
      try {
        await fn(job)?.catch(e => this.log.error(`Worker error ${e.message}`))
      }
      catch(e){
        this.log.error(`Worker error ${e.message}`)
      }
    }
  }

}