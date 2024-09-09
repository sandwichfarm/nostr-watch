import { PersistQueue, BullMQ } from '@nostrwatch/controlflow'
import { RedisConnectionDetails } from "@nostrwatch/utils"

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
  workerFn = () => {}

  constructor(slug){
    this.key = `persist6/${slug}`
    this.$ = PersistQueue(this.key)
    this.worker = new BullMQ.Worker(this.key, this.work.bind(this), { concurrency: 1, connection: RedisConnectionDetails() } )
  }

  async addJob(result){
    // console.log(`persist: added ${result.url}`)
    return this.$.$Queue.add( 'persist', result, JOB_OPTS )
  }

  setWorker(fn){
    this.workerFn = fn
  }

  async work(jd) {
    await this.workerFn(jd).catch(e => { throw new Error(e) })
  }

}