import hash from 'object-hash'

import { RetryManager } from '@nostrwatch/controlflow'
import { Nocap } from '@nostrwatch/nocap'
import { parseRelayNetwork, delay, lastCheckedId } from '@nostrwatch/utils'
import timestring from 'timestring'

import chalk from 'chalk';


export class WorkerManager {
  constructor($q, rcache, opts){
    // if(opts?.id)
    //   throw new Error('WorkerManager needs an id')
    /** @type {NWQueue} */
    this.$ = $q

    this.shortname = this.slug().replace('Manager', '').toLowerCase()

    // this.retry = new RetryManager(`nocapd/${this.shortname}`, opts.retry)
    this.retry = new RetryManager(`nocapd`, opts.retry)

    /** @type {db} */
    this.rcache = rcache

    /** @type {object} */
    this.cb = {}
    
    /** @type {string} */
    this.pubkey = process.env?.DAEMON_PUBKEY

    /** @type {number} */
    this.priority = opts?.checks?.[this.shortname]?.priority? opts.checks[this.shortname].priority: 10

    /** @type {number} */
    this.concurrency = opts?.concurrency? opts.concurrency: 1

    this.expires = opts?.checks?.[this.shortname]?.expires? timestring(opts.checks[this.shortname].expires, 'ms'): 60*60*1000

    this.interval = opts?.checks?.[this.shortname]?.interval? timestring(opts.checks[this.shortname].interval, 'ms'): 60*1000

    this.networks = opts?.networks? opts.networks: ['clearnet']

    this.bindEvents = true

    /** @type {number} */
    this.timeout = opts?.timeout? opts.timeout: 5000

    this.log = opts?.logger? opts.logger.logger: console

    /** @type {function} */
    this.scheduler = opts?.scheduler? opts.scheduler.bind(this): () => { console.warn(`scheduler not defined for ${this.id}`) }

    this.opts = opts

    /** @type {array} */
    this.worker_events = ['completed', 'failed', 'progress', 'stalled', 'waiting', 'active', 'delayed', 'drained', 'paused', 'resumed']

    /** @type {array} */
    this.queue_events = ['active', 'completed', 'delayed', 'drained', 'error', 'failed', 'paused', 'progress', 'resumed', 'stalled', 'waiting']

    /** @type {Nocap} */  
    this.Nocap = Nocap

    if(!this?.on_completed || !(this.on_completed instanceof Function))
      throw new Error(`${this.slug()}: on_completed needs to be defined and a function`)
    
    this.log.info(`${this.id()} initialized`)

    // this.stats = setInterval( async () => await this.counts(), 30*1000 )

    this.delay = delay

    this.processed = 0

    this.total = 0
  }

  calculateProgress() {
    if (this.total === 0) return "0.00%"; // Prevent division by zero
    let percentage = (this.processed / this.total) * 100;
    return percentage.toFixed(2) + "%";
  }

  progressMessage(url, result={}, error=false){
    const failure = chalk.red;
    const success = chalk.bold.green;
    const mute = chalk.gray
    this.log.info(
      `[${chalk.bgBlack(this.calculateProgress())}]`, 
        `${mute(this.processed)}/${mute(this.total)}`,
      `${url}:`, 
      result?.connect?.data? success("online"): failure("offline")),
      error? chalk.gray.italic('error'): ''
  }

  siblingKeys(){
    return Object.keys(this.$.managers).filter(key => key !== this.constructor.name)
  }

  siblings(){
    const result = {}
    this.siblingKeys().forEach( key => {
      result[key] = this.$.managers[key]
    })
    return result
  }

  id(){
    return `${this.slug()}@${this.pubkey}`
  }

  slug(){
    return this.constructor.name
  }

  async counts(){
    const counts = await this.$.queue.getJobCounts()
    this.log.info(`[stats] active: ${counts.active}, completed: ${ counts.completed }, failed: ${counts.failed}, prioritized: ${counts.prioritized}, delayed: ${counts.delayed}, waiting: ${counts.waiting}, paused: ${counts.paused}, total: ${counts.completed} / ${counts.active} + ${counts.waiting + counts.prioritized}`)
    return counts
  }

  cbcall(...args){
    const handler = [].shift.call(args)
    if(this?.[`on_${handler}`] && typeof this[`on_${handler}`] === 'function')
      this[`on_${handler}`](...args)
    if(typeof this.cb[handler] === 'function')
      this.cb[handler](...args)
  }

  hasChanged(data1, data2){
    this.log.debug(`hasChanged: ${hash(data1) !== hash(data2)}`)
    return hash(data1) !== hash(data2)
  }

  on(event, handler){
    this.cb[event] = handler.bind(this)
  }

  jobId(relay){
    return `${this.id()}:${relay}`
  }

  async _work(job){
    if(job.id.startsWith(this.id())) {
      this.log.debug(`[work] ${job.id} is a ${this.slug()} job, running...`)
      return this.work()
    }
    this.log.debug(`[work] ${job.id} is not a ${this.slug()} job, passing to next worker`)
  }

  async work(job){
    throw new Error(`work() not implemented by subclass "${this.slug()}"`)
  }

  async _populator(){
    this.log.debug(`${this.id()}:_populator()`)
    let relays
    if(this?.populator instanceof Function)
      relays = await this.populator()
    else 
      relays = await this.getRelays()
    await this.$.worker.pause()
    await this.addRelayJobs(relays)
    delay(1000)
    await this.$.worker.resume()
  }

  async addRelayJobs(relays){
    for await ( const relay of relays ){
      const $job = await this.addRelayJob({ relay })
      if($job?.id)
        this.total++
    }
    const c = await this.counts()
  }

  async addRelayJob(jdata){
    const jobOpts = {
      priority: this.priority,
      removeOnComplete: true,
      removeOnFail: true
    }
    this.log.debug(`Adding job for ${this.slug()}: ${JSON.stringify(jdata)}`)
    return this.$.queue.add( this.id(), jdata, { jobId: this.jobId(jdata.relay), ...jobOpts})
  }

  cacheId(url){
    return lastCheckedId(this.shortname, url)
  }

  async setLastChecked(url, date=Date.now()){
    return this.rcache.cachetime.set( this.cacheId(url), date )
  }

  async getLastChecked(url, date=Date.now()){
    return this.rcache.cachetime.get.one( this.cacheId(url) )
  }

  async updateRelayCache(result){
    const { url } = result
    const relay_id = this.rcache.relay.id(result.url)
    const promises = new Array()
    let   record = new Object()

    for( const key of ['info', 'dns', 'geo', 'ssl'] ){
      if(result?.[key]?.data && Object.keys(result[key].data)?.length){
        const promise = new Promise( async (resolve, reject) => { 
          const _record = { url: url, relay_id, updated_at: Date.now(), hash: hash(result[key].data), data: result[key].data }
          const _check_id = await this.rcache.check[key].insert(_record)
          if(!_check_id)
            reject()
          record = {...record, ...{ [key]: _check_id }}
          resolve()
        })
        promises.push(promise)
      }
    }
    await Promise.allSettled(promises)
    record.url = url
    record.online = result.connect.data
    const $id = await this.rcache.relay.patch(record)
    // console.log('---')
    // console.log($id)
    // console.log(this.rcache.relay.get.one(url))
    // console.log('---')
    return $id
  }

  async getRelays() {
    const allRelays = await this.rcache.relay.get.all();
    const onlineRelays = [];
    const uncheckedRelays = [];
    const expiredRelays = [];
    for (const relay of allRelays) {
      const lastChecked = await this.rcache.cachetime.get.one(this.cacheId(relay.url));
      const isExpired = await this.isExpired(relay.url, lastChecked);
      const isOnline = relay?.online === true

      if (isOnline && isExpired) {
        onlineRelays.push(relay.url);
      } else if (!lastChecked) {
        uncheckedRelays.push(relay.url);
      } else if (isExpired) {
        expiredRelays.push({ url: relay.url, lastChecked });
      }
    }
    expiredRelays.sort((a, b) => a.lastChecked - b.lastChecked);
    this.log.info(`online: ${await this.rcache.relay.get.online()?.length}, \
    online & expired: ${onlineRelays.length}, \
    expired: ${expiredRelays.length}, \
    unchecked: ${uncheckedRelays.filter(this.qualifyNetwork.bind(this)).length}, \
    total: ${allRelays.length}`)
    const deduped = [...onlineRelays, ...uncheckedRelays, ...expiredRelays.map(r => r.url)];

    const relaysFiltered = deduped.filter(this.qualifyNetwork.bind(this))
    const truncateLength = this.get_truncate_length(allRelays)
    return relaysFiltered.slice(0, truncateLength)
  }

  get_truncate_length(relays){
    let length = relays.length
    if(typeof this.opts?.checks?.all?.max === 'number')
      length = this.opts.checks.all.max
    if(typeof this.opts?.checks?.all?.max === 'string' )
      length = evaluateMaxRelays(this.opts.checks.all.max, relays)
    return length < relays.length? length: relays.length
  }

  qualifyNetwork(url){
    const network = parseRelayNetwork(url)
    return this.networks.includes(network)
  }

  async isExpired(url, lastChecked) {
      const retries = await this.retry.getRetries(url);
      const expiry = retries > 0 ? await this.retry.getExpiry(url) : this.expires;
      return lastChecked < Date.now() - expiry;
  }

  async on_drained(){
    this.total = 0
    this.processed = 0
  }

}

const evaluateMaxRelays = (evaluate, relays) => {
  try {
    return parseInt( eval( evaluate ) )
  }
  catch(e){
    this.log.error(`Error evaluating config.nocapd.checks.all.max -> "${config.nocapd.checks.all.max}": ${e.message}`)
  }
}