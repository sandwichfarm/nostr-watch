import hash from 'object-hash'
import timestring from 'timestring'
import chalk from 'chalk';

import { RetryManager } from '@nostrwatch/controlflow'
import Logger from '@nostrwatch/logger'

import { parseRelayNetwork, delay, lastCheckedId } from '@nostrwatch/utils'
import Publish from '@nostrwatch/publisher'

import { Nocap } from "@nostrwatch/nocap"
import nocapAdapters from "@nostrwatch/nocap-every-adapter-default"


export class NWWorker {
  
  constructor(pubkey, $q, rcache, config){
    this.pubkey = pubkey
    this.$ = $q
    this.rcache = rcache
    this.config = config
    this.setup()
    this.log.info(`${this.id()} initialized`)
    this.jobs = {}
    this.cache_counts = {}
  }

  setup(){
    this.setupDefaultValues()
    this.setupConfig()
    this.setupNocapOpts()
    this.setupJobOpts()
    this.setupInstances()
  }

  setupDefaultValues(){
    this.cb = {}
    this.processed = 1
    this.total = 0
    this.relayMeta = new Map()
    this.jobOpts = {}
    this.nocapOpts = {}
    this.hard_stop = false
  }

  setupConfig(){
    this.opts = this.config.nocapd
    
    this.checks = this.opts?.checks?.enabled.includes('all')? Nocap.checksSupported(): this.opts?.checks?.enabled
    this.checkOpts = this.opts?.checks?.options || {}
    this.timeout = this.setTimeout(this.checkOpts?.timeout)
    this.priority = this.checkOpts?.priority? this.checkOpts.priority: 10
    this.expires = this.checkOpts?.expires? timestring(this.checkOpts.expires, 'ms'): 60*60*1000
    this.interval = this.checkOpts?.interval? timestring(this.checkOpts.interval, 'ms'): 60*1000
    this.networks = this.opts?.networks? this.opts.networks: ['clearnet']
    this.log = this.config?.logger? this.config.logger: new Logger('nocap/$NWWorker')
    
  }

  setupInstances(){
    this.retry = new RetryManager(`nocapd/${this.pubkey}`, this.opts?.retry, this.rcache)
  }

  setupNocapOpts(){
    this.nocapOpts = { 
      timeout: this.timeout,
      checked_by: this.pubkey
    }
  }

  setupJobOpts(){
    this.jobOpts ={
      removeOnComplete: false,
      removeOnFail: {
        age: timestring('10m', 's')
      }
    }
  }

  updateJobOpts(obj){
    this.jobOpts = { ...this.jobOpts, ...obj }
    return this.jobOpts
  }

  async populator(){
    this.log.debug(`populator()`)
    await this.$.worker.pause()
    const relays = await this.getRelays()
    // if(relays.length > 0)
    await this.addRelayJobs(relays)
    // else 
    //   this.setTimeout( this.populator.bind(this), this.interval)
    return async () => await this.$.worker.resume()
  }

  async work(job){
    this.log.debug(`${this.id()}: work(): ${job.id} checking ${job.data?.relay} for ${this.opts?.checks?.enabled || "unknown checks"}`)
    const failure = (err) => { this.log.err(`Could not run ${this.pubkey} check for ${job.data.relay}: ${err.message}`) }  
    try {
      const { relay:url } = job.data 
      const nocap = new Nocap(url, this.nocapOpts)
      await nocap.useAdapters(Object.values(nocapAdapters))
      const result = await nocap.check(this.opts.checks.enabled).catch(failure)
      // console.log(url, result)
      return { result } 
    } 
    catch(err) {
      failure(new Error(`Failure inside work() block: ${err}`))
      return { result: { url: job.data.relay, open: { data: false }} }
    }
  }

  async on_error(job, err){
    if(this.hard_stop) return
    this.log.debug(`on_error(): ${job.id}: ${err}`)
    await this.on_fail( job )
  }

  async on_completed(job, rvalue){
    if(this.hard_stop) return
    this.log.debug(`on_completed(): ${job.id}: ${JSON.stringify(rvalue)}`)
    const { result } = rvalue
    if(!result?.url) return console.error(`url was empty:`, job.id)
    let fail = result?.open?.data? false: true
    this.progressMessage(result.url, result, fail)
    if(fail)
      await this.on_fail( result )
    else
      await this.on_success( result )
    await this.after_completed( result, fail )
  }

  async on_success(result){
    if(this.hard_stop) return
    this.log.debug(`on_success(): ${result.url}`)
    if(this.config?.publisher?.kinds?.includes(30066) ){
      const publish30066 = new Publish.Kind30066()
      await publish30066.one( result )   
    }
    if(this.config?.publisher?.kinds?.includes(30166) ){
      const publish30166 = new Publish.Kind30166()  
      await publish30166.one( result )
    }
  }

  async on_fail(result){
    if(this.hard_stop) return
    this.log.debug(`on_fail(): ${result.url}`)
  }

  async after_completed(result, error=false){
    if(this.hard_stop) return
    this.log.debug(`after_completed(): ${result.url}`)
    await this.updateRelayCache( { ...result } )      
    await this.retry.setRetries( result.url, !error )
    await this.setLastChecked( result.url, Date.now() )
  }

  cbcall(...args){
    if(this.hard_stop) return
    this.log.debug(`cbcall(): ${JSON.stringify(args)}`)
    const handler = [].shift.call(args)
    if(this?.[`on_${handler}`] && typeof this[`on_${handler}`] === 'function')
      this[`on_${handler}`](...args)
    if(typeof this.cb[handler] === 'function')
      this.cb[handler](...args)
  }

  async resetProgressCounts(){
    const c = await this.counts()
    this.total = c.prioritized + c.active
    this.processed = 1
    this.log.debug(`total jobs: ${this.total}`)
  }

  async drainSmart(){
    const expiredJobs = []
    Object.values(this.jobs).forEach( async (job) => {
      if(!job?.data?.relay) return
      const url = job.data.relay
      if(typeof url !== 'string') {
        delete this.jobs[job.id]
        return this.log.warn(`drainSmart(): url must be string! ${url}: ${typeof url}`)
      }
      const $relay = this.rcache.relay.get.one(url)
      const online = $relay?.online === true
      const expired = await this.isExpired(url, timestring(job.timestamp, "ms"))
      if(!expired && online) return 
      this.log.debug(`drainSmart(): removing expired job: ${url}: online? ${online}, expired? ${this.isExpired(url, timestring(job.timestamp, "ms"))}`)
      delete this.jobs[job.id]
      expiredJobs.push(job.remove().catch(e => this.log.debug(`drainSmart(): Could not remove job: ${job.id}: Error:`, e)))
    })
    await Promise.all(expiredJobs).catch(e => this.log.debug(`drainSmart(): Promise.all(expiredJobs): Error: `, e))
  }
  
  async addRelayJobs(relays){
    this.log.debug(`addRelayJobs(): for ${relays.length} relays`)
    await this.drainSmart()
    relays.forEach( async (relay) => {
      let job = this.jobs?.[this.jobId(relay)]
      if(job) {
        await job.remove()
                .then(  () => this.log.debug(`job removed: ${this.jobId(relay)}`))
                .catch( e => this.log.debug(`Could not remove job: ${relay}: Error:`, e))
      }
      job = await this.addRelayJob({ relay })
      this.jobs[job.id] = job
    })
    const jobs = Object.values(this.jobs)
    if(jobs.length > 0) await Promise.all(jobs)
  }
  
  async addRelayJob(jdata){
    this.log.debug(`Adding job for ${jdata.relay} with ${this.opts.checks.enabled} nocap checks: ${JSON.stringify(jdata)}`)
    const jobId = this.jobId(jdata.relay)
    const priority = this.getPriority(jdata.relay)
    this.updateJobOpts({ priority })
    return this.$.queue.add( this.id(), jdata, { jobId, ...this.jobOpts})
  }

  calculateProgress() {
    this.log.debug(`calculateProgress()`)
    if (this.total === 0) return "0.00%"; // Prevent division by zero
    let percentage = (this.processed / this.total) * 100;
    return percentage.toFixed(2) + "%";
  }

  async progressMessage(url, result={}, error=false){
    this.log.debug(`progressMessage()`)
    const failure = chalk.red;
    const success = chalk.bold.green;
    const mute = chalk.gray
    let progress = ''
    progress += `[${chalk.bgBlack(this.calculateProgress())}] `
    progress += `${mute(this.processed++)}/${mute(this.total)}  `
    progress += `${url}: `
    if(this.checks.includes('open'))
      progress += `${result?.open?.data === true? success("online"): failure("offline")} `
    if(this.checks.includes('read'))
      progress += `${result?.read?.data === true? success("readable"): failure("unreadable")} ` 
    if(this.checks.includes('write'))
      progress += `${result?.write?.data === true? success("writable"): failure("unwritable")} `
    if(this.checks.includes('ssl'))
      progress += `${Object.keys(result?.ssl?.data || {}).length? success("ssl"): failure("ssl")} `
    if(this.checks.includes('dns'))
      progress += `${Object.keys(result?.dns?.data || {}).length? success("dns"): failure("dns")} `
    if(this.checks.includes('geo'))
      progress += `${Object.keys(result?.geo?.data || {}).length? success("geo"): failure("geo")} `
    if(this.checks.includes('info'))
      progress += `${Object.keys(result?.info?.data || {}).length? success("info"): failure("info")} `
    
    if(!error){
      progress += `${(result?.open?.duration+result?.read?.duration+result?.write?.duration)/1000} seconds  `
    }
    
    if(error) {
      const retries = await this.retry.getRetries(url)
      progress += `${error? chalk.gray.italic('error'): ''}  ` 
      progress += `[${retries !== null? retries: 0} retries]`
    }

    this.log.info(progress)       
  }

  id(){
    return this.pubkey
  }

  async counts(){
    const counts = await this.$.queue.getJobCounts()
    if(counts.prioritized + counts.active > 0) {
      this.log.info(chalk.magenta.bold(`=== [queue stats] active: ${counts.active} - completed: ${ counts.completed }  -  failed: ${counts.failed}  -  prioritized: ${counts.prioritized}  -  delayed: ${counts.delayed}  -  waiting: ${counts.waiting}  -  paused: ${counts.paused}  -  total: ${counts.completed} / ${counts.active} + ${counts.waiting + counts.prioritized} ===`))
      this.show_cache_counts()
    }
    return counts
  }

  hasChanged(data1, data2){
    const changed = hash(data1) !== hash(data2)
    return changed
  }

  on(event, handler){
    this.cb[event] = handler.bind(this)
  }

  jobId(relay){
    return `${this.id()}:${relay}`
  }

  setTimeout(config){
    this.timeout = {
      open: 3000,
      read: 3000,
      write: 3000,
      info: 2000,
      dns: 1000,
      geo: 1000,
      ssl: 1000
    }
    if(config instanceof Object){
      return this.timeout = {...this.timeout, ...config}
    }
    if(config instanceof Number){
      for (let key in this.timeout) {
        this.timeout[key] = config;
      }
      return this.timeout
    }
  }

  getPriority(relay){
    const {group, retries} = this.relayMeta.get(relay)
    const format = i => Math.ceil(i)
    if(group === 'online')
      return format(this.priority/2)
    if(group === 'unchecked')
      return format(this.priority)
    if(group === 'expired'){
      if(retries > 30)
        return format(this.priority*10)
      else if(retries > 16)
        return format(this.priority*8)
      else if(retries > 8)
        return format(this.priority*7)
      else if(retries > 6)
       return format(this.priority*6)
      else if( retries > 3)
        return format(this.priority*5)
      else 
        return format(this.priority*4)
    }
  }

  cacheId(url){
    return lastCheckedId(this.pubkey, url)
  }

  async setLastChecked(url, date=Date.now()){
    return this.rcache.cachetime.set( this.cacheId(url), date )
  }

  async getLastChecked(url){
    return this.rcache.cachetime.get.one( this.cacheId(url) )
  }

  async updateRelayCache(result){
    const { url } = result
    const relay_id = this.rcache.relay.id(result.url)
    const promises = new Array()
    let   record = new Object()

    record.url = url
    record.online = result?.open?.data? true: false

    for( const key of ['info', 'dns', 'geo', 'ssl'] ){
      const resultHasKey = result?.[key]?.data && Object.keys(result[key].data)?.length > 0
      if(resultHasKey){
        const persist_result = async (resolve, reject) => { 
          this.log.debug(`persist_result(${key})`)
          const _record = { url: url, relay_id, updated_at: Date.now(), hash: hash(result[key].data) }
          if(key === 'ssl') _record.data = JSON.stringify({ valid_to: result[key].data.valid_to, valid_from: result[key].data.valid_from })
          else              _record.data = JSON.stringify(result[key].data)
          const _check_id = await this.rcache.check[key].insert(_record)
          if(!_check_id)
            reject(new Error(`Could not persist ${_check_id} check`))
          record[key] = _check_id
          resolve()
        }
        promises.push( new Promise( persist_result ) )
      }
    }
    await Promise.all(promises)
    await delay(100)
    const $id = await this.rcache.relay.patch(record)
    return $id
  }

  async getRelays() {
    this.log.debug(`getRelays()`)
    const allRelays = await this.rcache.relay.get.all();
    const onlineRelays = []
    const onlineExpiredRelays = [];
    const uncheckedRelays = [];
    let expiredRelays = [];
    let truncateLength

    this.relayMeta = new Map()
  
    for (const relay of allRelays) {
      if(!this.qualifyNetwork(relay.url)) continue

      this.log.debug(`getRelays() relay: ${relay.url}`)

      this.log.debug(`getRelays() relay: ${relay.url}: lastChecked()`)
      const lastChecked = await this.rcache.cachetime.get.one(this.cacheId(relay.url));
      this.log.debug(`getRelays() relay: ${relay.url}: retries()`)
      const retries = await this.retry.getRetries(relay.url);
      this.log.debug(`getRelays() relay: ${relay.url}: isExpired()`)
      const isExpired = lastChecked? await this.isExpired(relay.url, lastChecked): true;
      const isOnline = relay?.online === true;

      if(isOnline) onlineRelays.push(relay.url);
  
      let group = '';
      if (isOnline && isExpired) {
        onlineExpiredRelays.push(relay.url);
        group = 'online';
      } else if (!lastChecked) {
        uncheckedRelays.push(relay.url);
        group = 'unchecked';
      } else if (isExpired) {
        expiredRelays.push({ url: relay.url, lastChecked, retries });
        group = 'expired';
      }
      this.relayMeta.set(relay.url, { group, retries: retries > 0 ? retries : undefined });
    }
  
    expiredRelays = expiredRelays.sort((a, b) => a.retries - b.retries).map(r => r.url);
  
    await this.store_cache_counts(allRelays.length, onlineRelays.length, onlineExpiredRelays.length, expiredRelays.length, uncheckedRelays.length)
  
    const deduped = [...new Set([...onlineExpiredRelays, ...uncheckedRelays, ...expiredRelays])];
    const relaysFiltered = deduped.filter(this.qualifyNetwork.bind(this));
    
    if(this.opts?.checks?.options?.max){
      truncateLength = this.get_truncate_length(allRelays);
      return relaysFiltered.slice(0, truncateLength);
    }
    return relaysFiltered   
  }

  async store_cache_counts(allRelays, online, onlineExpired, expired, unchecked){
      this.cache_counts = { allRelays, online, onlineExpired, expired, unchecked }
  }

  show_cache_counts(){
    let cacheMessage = ''
    cacheMessage += `=== [cache stats] online: ${this.cache_counts.online}  -  `
    cacheMessage += `online & expired: ${this.cache_counts.onlineExpired}  -  `
    cacheMessage += `expired: ${this.cache_counts.expired}  -  `
    cacheMessage += `unchecked: ${this.cache_counts.unchecked}  -  `
    cacheMessage += `total: ${this.cache_counts.allRelays} ===`
    this.log.info(chalk.blue.bold(cacheMessage));
  }

  get_truncate_length(relays){
    let length = relays.length
    if(typeof this.opts?.checks?.options?.max === 'number')
      length = this.opts.checks.options.max
    if(typeof this.opts?.checks?.options?.max === 'string' )
      length = evaluateMaxRelays(this.opts.checks.options.max, relays)
    return length < relays.length? length: relays.length
  }

  qualifyNetwork(url){
    const network = parseRelayNetwork(url)
    return this.networks.includes(network)
  }

  async isExpired(url, lastChecked) {
      let retries = await this.retry.getRetries(url);
      retries = retries === null? 0: retries
      const expiry = retries > 0 ? this.retry.getExpiry(url) : this.expires;
      return lastChecked < Date.now() - expiry;
  }

}

const evaluateMaxRelays = (evaluate, relays) => {
  try {
    relays;
    return parseInt( eval( evaluate ) )
  }
  catch(e){
    this.log.err(`Error evaluating this.opts.checks.options.max -> "${this?.opts?.checks?.options?.max} || "is undefined"": ${e?.message || "error undefined"}`)
  }
}