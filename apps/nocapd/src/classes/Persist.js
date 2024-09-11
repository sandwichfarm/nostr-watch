import { PersistQueue, BullMQ } from '@nostrwatch/controlflow'
import { delay, RedisConnectionDetails } from "@nostrwatch/utils"

const JOB_OPTS = {
  removeOnComplete: true, 
  removeOnFail: true,
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 60*1000,
  }
}

export class Persist {

  $ = null
  key
  worker = () => {}
  workerFn = () => { console.log('workerFn has not been set') }

  constructor(slug){
    this.key = `persist6/${slug}`
    this.$ = PersistQueue(this.key)
    this.worker = new BullMQ.Worker(this.key, this.work.bind(this), { concurrency: 1, connection: RedisConnectionDetails() } )
    this.$.$Queue.resume()
  }

  async addJob(result){
    // console.log(`persist: ADD JOB ${result.url}`)
    return this.$.$Queue.add( 'persist', result, JOB_OPTS )
  }

  setWorker(fn){
    if(fn instanceof Function)
      this.workerFn = fn
  }

  async work(jd) {
    // console.log(`persist: BEGIN`)
    await this.workerFn(jd).catch(e => { this.log.error(e.message) })
    await delay(1)
    // console.log(`persist: SUCCESS`)
  }

}