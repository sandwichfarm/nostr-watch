import hash from 'object-hash'
import timestring from 'timestring'
import chalk from 'chalk';
import deferred from 'promise-deferred'; 

import { RetryManager } from '@nostrwatch/controlflow'
import Logger from '@nostrwatch/logger'

import { parseRelayNetwork, delay, lastCheckedId, parseUrl } from '@nostrwatch/utils'
import { Kind30166, Kind30166Child, Publisher } from '@nostrwatch/publisher'

import { Nocap } from "@nostrwatch/nocap"
import nocapAdapters from "@nostrwatch/nocap-every-adapter-default"

import { relayHostnameDedup } from '../hostnames.js';

const TIMEOUT = 2*60*1000

let errors = 0

export class NWWorker {
  key = 'relay-check'
  $
  rcache
  pubkey
  bus
  
  constructor(pubkey, $q, rcache, bus, config){
    this.pubkey = pubkey
    this.$ = $q
    this.rcache = rcache
    this.config = config
    this.setup()
    this.log.info(`${this.id()} initialized`)
    this.bus = bus
    this.publisher = new Publisher(this.pubkey, this.config.publisher?.to_relays)
  }

  setup(){
    this.setupConfig()

    this.cb = {}
    this.processed = 1
    this.total = 0
    this.relayMeta = new Map()
    this.cache_counts = {}
    this.jobs = {}
    this.hard_stop = false

    this.nocapOpts = { 
      timeout: this.timeout,
      checked_by: this.pubkey
    }

    this.jobOpts = {
      attempts: 1,
      removeOnComplete: {
        age: timestring(this.config.nocapd.checks.options.expires, 's')
      },
      removeOnFail: {
        age: timestring('10m', 's')
      }
    }
  
    this.timeout = {
      open: 3000,
      read: 3000,
      write: 3000,
      info: 2000,
      dns: 1000,
      geo: 1000,
      ssl: 1000
    }

    this.setupInstances()
  }

  setupConfig(){
    this.opts = this.config.nocapd
    this.checks = this.opts?.checks?.enabled.includes('all')? Nocap.checksSupported(): this.opts?.checks?.enabled
    this.checkOpts = this.opts?.checks?.options || {}
    this.timeout = this.setWorkerTimeouts(this.checkOpts?.timeout)
    this.priority = this.checkOpts?.priority? this.checkOpts.priority: 10
    this.expires = this.checkOpts?.expires? timestring(this.checkOpts.expires, 'ms'): 60*60*1000
    this.interval = this.checkOpts?.interval? timestring(this.checkOpts.interval, 'ms'): 60*1000
    this.networks = this.opts?.networks? this.opts.networks: ['clearnet']
    this.log = this.config?.logger? this.config.logger: new Logger('nocap/NWWorker')
  }

  setupInstances(){
    this.retry = new RetryManager(`nocapd/${this.pubkey}`, this.opts?.retry, this.rcache)
  }

  updateJobOpts(obj){
    const jobOpts = { ...this.jobOpts, ...obj }
    return jobOpts
  }

  async populator(){
    this.log.debug(`populator()`)
    const relays = await this.getRelays()
    await this.addRelayJobs(relays)
  }

  async syncQueue(){
    await this.cleanCompletedJobs() 
    await this.populateActivePendingJobs()
  }

  async populateActivePendingJobs(){
    let jobs = [...(await this.$.queue.getJobs(['active']))]
        jobs = [...jobs, ...(await this.$.queue.getJobs(['waiting']))]

    jobs.forEach( job => {
      this.jobs[job.id] = job
    })
  }

  async getActiveJobs(){
    return await this.$.queue.getJobs(['active'])
  }

  async getCompletedJobs(){
    return await this.$.queue.getJobs(['completed'])
  }

  async cleanCompletedJobs() {
    const jobs = await this.getCompletedJobs()
    jobs.forEach( job => {
      job.remove()
    })
  }

  async work(job){
    this.log.debug(`${this.id()}: work(): ${job.id} checking ${job.data?.relay} for ${this.opts?.checks?.enabled || "unknown checks"}`)
    const failure = (err) => { this.log.err(`Could not run ${this.pubkey} check for ${job.data.relay}: ${err.message}`) }  
    let result = {}
    try {
      const timeout = setTimeout(  //needed to prevent hanging jobs
        () => { throw new Error(`Job Timeout: ${job.id} after ${TIMEOUT/1000}s`) }, 
        TIMEOUT
      )
      const { relay:url } = job.data 
      const nocap = new Nocap(url, {...this.nocapOpts, logLevel: 'debug'})
      await nocap.useAdapters([...Object.values(nocapAdapters)])
      result = await nocap.check(this.opts.checks.enabled).catch(failure)
      clearTimeout(timeout) //don't forget to clear!
      return { result } 
    } 
    catch(err) {
      this.log.err(`Could not run ${this.pubkey} check for ${job.data.relay}: ${err.message}`)
      return { result: { url: job.data.relay, open: { data: false }} }
    }
  }

  async on_failed(job, err){
    this.log.warn(`on_failed(): ${job.id}: ${err}`)
  }   

  async on_error(job, err){
    this.log.debug(`on_error(): ${job.id}: ${err}`)
    await this.on_fail( job )
  }

  async on_completed(job, rvalue){
    if(this.hard_stop) return
    this.log.debug(`on_completed(): ${job.id}: ${JSON.stringify(rvalue)}`)
    let { result } = rvalue
    if(!result?.url) return this.log.error(`url was empty: ${job.id} ${result}`)
    let fail = result?.open?.data? false: true
    this.progressMessage(result.url, result, fail)
    delete this.jobs[job.id]
    if(fail) {
      await this.on_fail( result )
    }
    else {
      result = await relayHostnameDedup( result, this.rcache ).catch(console.error)
      await this.on_success( result )
    }
    await this.after_completed( result )
  }

  async on_success(result){
    const log = new Logger(`@nostrwatch/nocapd:hostname`)
    if(this.hard_stop) return
    log.debug(`on_success(): ${result.url}`)
    if(result.ignore) return log.warn(`on_success(): ${result.url} was ignored. Not checking and not publishing events.`)

    let k30166
    if(result?.parent){
      k30166 = new Kind30166Child(process.env.DAEMON_PUBKEY)
      log.debug(`on_success(): ${result.url} is a child of ${result.parent}`)
    }
    else {
      k30166 = new Kind30166(process.env.DAEMON_PUBKEY)
    }
    // const id = await publish30166.one( result, process.env.DAEMON_PRIVKEY ).catch(this.log.error.bind(this.log))  
    k30166.generateEvent( result )
    k30166.signEvent( process.env.DAEMON_PRIVKEY )
    const id = await this.publisher.publishEvent( k30166.json() )
    log.debug(`on_success(): ${result.url} published${result?.parent? ' child of '+result.parent: ''}: ${id}`)  
  }

  async on_fail(result){
    if(this.hard_stop) return
    this.log.debug(`on_fail(): ${result.url}`)
  }

  async after_completed(result){
    if(this.hard_stop) return
    this.log.debug(`after_completed(): ${result.url}`)
    const concurrency = this.config?.nocapd?.bullmq?.worker?.concurrency
    if(!concurrency || concurrency <= 1) {
      this.persist_result({ data: { result, type: this.key }})
    }
    else {
      this.bus.addJob({ result, type: this.key })
    }
  }
  
  async persist_result(job){
    const {result} = job.data
    this.log.debug(`inside persist_result()`)
    let err = false
    const fail = result?.open?.data? false: true
    const cacheError = (from, e) => err = { from, e}
    try {
      this.log.debug(`------${result.url}-------`)
      await this.updateRelayCache( { ...result } ).catch( e => cacheError('updateRelayCache', e) )
      this.log.debug('updateRelayCache')
      await this.retry.setRetries( result.url, !fail ).catch( e => cacheError('setRetries', e) )
      this.log.debug(`setRetries: ${result.url}: fail: ${fail}`)
      await this.setLastChecked( result.url ).catch( e => cacheError('setLastChecked', e) )
      this.log.debug(`setLastChecked: value = ${await this.getLastChecked(result.url)}`)
    }
    finally {
      if(err)
        this.log.error(`persist_result() failed: ${err.from}: ${err.e.message}`)
      else 
        this.log.debug(`success: ${result.url}: persisted via queue`)
    }
    this.log.debug('------------------')
  }

  cbcall(...args){
    // if(this.hard_stop) return
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
      expiredJobs.push(
        job.remove()
          .then( () => {
            delete this.jobs[job.id]
            this.log.debug(`drainSmart(): Job removed ${job.id}`)
          })
          .catch(e => this.log.debug(`drainSmart(): Could not remove job: ${job.id}: Error:`, e)))
    })
    await Promise.all(expiredJobs).catch(e => this.log.debug(`drainSmart(): Promise.all(expiredJobs): Error: `, e))
  }
  
  async addRelayJobs(relays){
    this.log.debug(`addRelayJobs(): for ${relays.length} relays`)
    await this.drainSmart()
    for(const relay of relays){
      let job = this.jobs?.[this.jobId(relay)]
      if(job) {
        await job.remove()
                .then(  () => this.log.debug(`job removed: ${this.jobId(relay)}`))
                .catch( e => this.log.debug(`Could not remove job: ${relay}: Error:`, e))
      }
      job = await this.addRelayJob({ relay })
      this.jobs[job.id] = job
    }
    const jobs = Object.values(this.jobs)
    if(jobs.length === 0) return 
    await Promise.allSettled(jobs)
  }
  
  async addRelayJob(job){
    this.log.debug(`Adding job for ${job.relay} with ${this.opts.checks.enabled} nocap checks: ${JSON.stringify(job.relay)}`)
    const jobId = this.jobId(job.relay)
    const priority = this.getPriority(job.relay)
    const jobOpts = this.updateJobOpts({ priority })
    return this.$.queue.add( this.id(), job, { jobId, ...jobOpts})
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

    let duration = 0
    const incD = ( _d ) => duration += _d > 0? _d: 0

    let progress = ''
    progress += `[${chalk.bgBlack(this.calculateProgress())}] `
    progress += `${mute(this.processed++)}/${mute(this.total)}  `
    progress += `${url}: `

    if(this.checks.includes('open')) {
      progress += `${result?.open?.data === true? success("online"): failure("offline")} `
      incD(result?.open?.duration)
    } 
    if(this.checks.includes('read')) {
      progress += `${result?.read?.data === true? success("readable"): failure("unreadable")} ` 
      incD(result?.read?.duration)
    }
    if(this.checks.includes('write')) {
      progress += `${result?.write?.data === true? success("writable"): failure("unwritable")} `
      incD(result?.write?.duration)
    }
    if(this.checks.includes('ssl')){
      progress += `${Object.keys(result?.ssl?.data || {}).length? success("ssl"): failure("ssl")} `
      incD(result?.ssl?.duration)
    }
    if(this.checks.includes('dns')){
      progress += `${Object.keys(result?.dns?.data || {}).length? success("dns"): failure("dns")} `
      incD(result?.dns?.duration)
    } 
    if(this.checks.includes('geo')){
      progress += `${Object.keys(result?.geo?.data || {}).length? success("geo"): failure("geo")} `
      incD(result?.geo?.duration)
    }
    if(this.checks.includes('info')){
      progress += `${Object.keys(result?.info?.data || {}).length? success("info"): failure("info")} `
      incD(result?.info?.duration)
    }    
    if(!error){
      progress += `${duration/1000} seconds  `
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
    this.log.info(chalk.magenta.bold(`=== [queue stats] active: ${counts.active} - completed: ${ counts.completed }  -  failed: ${counts.failed}  -  prioritized: ${counts.prioritized}  -  delayed: ${counts.delayed}  -  waiting: ${counts.waiting}  -  paused: ${counts.paused}  -  total: ${counts.completed} / ${counts.active} + ${counts.waiting + counts.prioritized} ===`))
    this.show_cache_counts()
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

  setWorkerTimeouts(config){
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
    const relayMeta = this.relayMeta.get(relay)
    if(!relayMeta) return this.priority
    const {group, retries} = relayMeta
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
    record.ignore = result?.ignore? true: false
    record.parent = result?.parent? result.parent: null
    record.checked_at = result?.checked_at > 0? result.checked_at: Date.now()
    record.rtt = result?.open?.duration? result.open.duration: -1;

    for( const key of ['info', 'dns', 'geo', 'ssl'] ){
      const resultHasKey = result?.[key]?.data && Object.keys(result[key].data)?.length > 0
      if(resultHasKey){
        const persist_result = async (resolve, reject) => { 
          
          this.log.debug(`persist_result(${key})`)
          const checked_at = result.checked_at
          const data = (key === 'ssl' && result.ssl.duration > 0)? JSON.stringify(sslData(result?.ssl?.data ?? {})): JSON.stringify( result[key].data ?? {} )
          const check_record = { url, relay_id, checked_at, data, hash: hash( result[key].data) }
          const check_id = await this.rcache.check[key].insert(check_record).catch( e => this.log.error(`Could not persist ${url} to ${key} check: ${e}`))
          
          if(!check_id)
            reject(new Error(`Could not persist ${check_id} check`))

          record[key] = check_id
          resolve()
        }
        promises.push( new Promise( persist_result ) )
      }
    }

    await Promise.all(promises)
    const $id = await this.rcache.relay.patch(record)
    return $id
  }

  async getRelays() {
    this.log.debug(`getRelays()`)
    
    const allRelays = await this.rcache.relay.get.all();
    const onlineRelays = []
    const onlineExpiredRelays = [];
    const uncheckedRelays = [];
    const ignoredRelays = allRelays.filter(r => r.ignore === true);
    const relaysWithParents = allRelays.filter(r => typeof r.parent === 'string' && r.parent.length > 0);
    const relaysAreParents = Array.from(new Set(relaysWithParents.map(r => r.parent)));

    let expiredRelays = [];
    let truncateLength
    errors = 0

    this.relayMeta = new Map()
  
    for (const relay of allRelays) {
      if (relay.ignore === true) continue;
      if(!this.qualifyNetwork(relay.url)) continue
      const lastChecked = await this.rcache.cachetime.get.one(this.cacheId(relay.url));
      const retries = await this.retry.getRetries(relay.url);
      const isExpired = lastChecked? await this.isExpired(relay.url, lastChecked): true;
      const isOnline = relay?.online === true;

      // this.log.debug(`getRelays() relay: ${relay.url}: lastChecked(): ${lastChecked}`)
      // this.log.debug(`getRelays() relay: ${relay.url}: retries(): ${retries}`)
      // this.log.debug(`getRelays() relay: ${relay.url}: isExpired(): ${isExpired}`)
      // this.log.debug(`getRelays() relay: ${relay.url}: isOnline(): ${isOnline}`)

      if(isOnline) 
        onlineRelays.push(relay.url);
  
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

    if(errors > 0)
      this.log.debug(`DATA INTEGRITY ERRORS #: ${errors}`)
  
    expiredRelays = expiredRelays.sort((a, b) => a.retries - b.retries).map(r => r.url);
  
    await this.store_cache_counts(allRelays.length, onlineRelays.length, onlineExpiredRelays.length, expiredRelays.length, uncheckedRelays.length, ignoredRelays.length, relaysWithParents.length, relaysAreParents.length)
  
    const deduped = [...new Set([...onlineExpiredRelays, ...uncheckedRelays, ...expiredRelays])];
    const relaysFiltered = deduped.filter(this.qualifyNetwork.bind(this));
    
    if(this.opts?.checks?.options?.max){
      truncateLength = this.get_truncate_length(allRelays);
      return relaysFiltered.slice(0, truncateLength);
    }
    return relaysFiltered   
  }

  async store_cache_counts( allRelays, online, onlineExpired, expired, unchecked, ignoredRelays, relaysWithParents, relaysAreParents ){
      this.cache_counts = { allRelays, online, onlineExpired, expired, unchecked, ignoredRelays, relaysWithParents, relaysAreParents }
  }

  show_cache_counts(){
    this.getRelays().then( () => {
      let cacheMessage = ''
      cacheMessage += `=== [cache stats] online: ${this.cache_counts.online}  -  `
      cacheMessage += `online & expired: ${this.cache_counts.onlineExpired}  -  `
      cacheMessage += `expired: ${this.cache_counts.expired}  -  `
      cacheMessage += `unchecked: ${this.cache_counts.unchecked}  -  `
      cacheMessage += `total: ${this.cache_counts.allRelays}  |   `
      cacheMessage += `ignored: ${this.cache_counts.ignoredRelays} -  `
      cacheMessage += `parents: ${this.cache_counts.relaysAreParents} -  `
      cacheMessage += `children: ${this.cache_counts.relaysWithParents} ===`
      

      this.log.info(chalk.blue.bold(cacheMessage));
    })
  }

  qualifyNetwork(url){
    const network = parseRelayNetwork(url)
    return this.networks.includes(network)
  }

  async isExpired(url, lastChecked) {
      let retries = await this.retry.getRetries(url);
      retries = retries === null? 0: retries
      const expiry = retries > 0 ? this.retry.getExpiry(url) : this.expires;
      const expired = lastChecked < Date.now() - expiry;
      const relay = await this.rcache.relay.get.one(url);
      if(relay.online && retries > 0) {
        errors++
        // console.log('isExpired():', `online?: ${relay.online}`, url, lastChecked, retries, expiry, expired)
      }
      return expired
  }

  get_truncate_length(relays){
    let length = relays.length
    if(typeof this.opts?.checks?.options?.max === 'number')
      length = this.opts.checks.options.max
    if(typeof this.opts?.checks?.options?.max === 'string' )
      length = evaluateMaxRelays(this.opts.checks.options.max, relays)
    return length < relays.length? length: relays.length
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

const sslData = (data) => {
  const result = {}
  result.valid_from = data?.valid_from
  result.valid_to = data?.valid_to
  result.fingerprint = data?.fingerprint
  // result.pubkey = data?.pubkey?.toString('hex')
  // result.pem_encoded = data?.pemEncoded
  // result.subjectaltname = data?.subjectaltname
  return result
}