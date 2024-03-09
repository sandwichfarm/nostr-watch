import hash from 'object-hash'

import timestring from 'timestring'
import chalk from 'chalk';

import { RetryManager } from '@nostrwatch/controlflow'
import { Nocap } from '@nostrwatch/nocap'
import { parseRelayNetwork, delay, lastCheckedId } from '@nostrwatch/utils'
import Publish from '@nostrwatch/publisher'

export class NWWorker {
  constructor(check, $q, rcache, opts){

    this.$ = $q

    this.slug = check

    // this.retry = new RetryManager(`nocapd/${this.slug}`, opts.retry)
    this.retry = new RetryManager(`nocapd/${this.slug}`, opts.retry)

    this.rcache = rcache

    this.cb = {}
    
    this.pubkey = process.env?.DAEMON_PUBKEY

    const checkOpts = opts?.checks?.options
    this.timeout = this.setTimeout(checkOpts?.timeout)
    this.priority = checkOpts?.priority? checkOpts.priority: 10
    this.expires = checkOpts?.expires? timestring(checkOpts.expires, 'ms'): 60*60*1000
    this.interval = checkOpts?.interval? timestring(checkOpts.interval, 'ms'): 60*1000

    this.networks = opts?.networks? opts.networks: ['clearnet']

    this.log = opts?.logger? opts.logger.logger: console

    this.scheduler = opts?.scheduler? opts.scheduler.bind(this): () => { console.warn(`scheduler not defined for ${this.id}`) }

    this.opts = opts

    this.worker_events = ['completed', 'failed', 'progress', 'stalled', 'waiting', 'active', 'delayed', 'drained', 'paused', 'resumed']

    this.queue_events = ['active', 'completed', 'delayed', 'drained', 'error', 'failed', 'paused', 'progress', 'resumed', 'stalled', 'waiting']

    this.Nocap = Nocap

    if(!this?.on_completed || !(this.on_completed instanceof Function))
      throw new Error(`${this.slug}: on_completed needs to be defined and a function`)
    
    this.log.info(`${this.id()} initialized`)
    
    this.delay = delay

    this.processed = 0

    this.total = 0

    this.relayMeta = new Map()
  }

  get_key_for_check(){
    switch(this.slug){
      case "geo":
        return ['dns', 'geo']
      case "websocket":
        return ['open', 'read', 'write']
      default:
        return this.slug
    }
  }

  async work(job){
    const failure = (err) => { this.log.debug(`Could not run ${this.slug} check for ${job.data.relay}: ${err.message}`) }  
    try {
      this.log.debug(`${this.id()}:work()`, job.id)
      this.log.debug(`Running ${this.slug} check for ${job.data.relay}`)
      const { relay:url } = job.data 
      const dpubkey = this.pubkey
      const nocapOpts = { 
        timeout: this.timeout,
        checked_by: dpubkey,
        rejectOnConnectFailure: true
      }
      const nocapd = new this.Nocap(url, nocapOpts)
      let result = {}
      //geo requires data from dns check first
      const check = this.get_key_for_check()
      await nocapd.check(check)
        .catch( err => {
          failure(`Failure inside check(): ${err}`)
        })
        .then( _result => {
          result = _result
        })
      return { result } 
    } 
    catch(err) {
      failure(`Failure inside work() block: ${err}`)
      return { result: false }
    }
  }

  async on_completed(job, rvalue){
    const { relay:url } = job.data
    const { result  } = rvalue

    if(!result || !result?.open?.data)
      return this.on_failed(job, new Error(`Nocap.check('${this.slug}'): failed for ${url}`))

    
    // console.log('PUBLISHING', url, result?.open?.data, result?.read?.data, result?.write?.data)

    const { checked_at } = result

    const publish30066 = new Publish.Kind30066()
    const publish30166 = new Publish.Kind30166()  

    await publish30066.one( result )    
    await publish30166.one( result )   

    this.processed++
    
    await this.updateRelayCache(result)      
    await this.retry.setRetries( url, true )
    await this.setLastChecked( url, Date.now() )

    this.progressMessage(url, result)
     
  }

  async on_failed(job, err){
    const { relay:url } = job.data
    this.log?.debug(`Websocket check failed for ${job.data.relay}: ${JSON.stringify(err)}`)
    const retry_id = await this.retry.setRetries( url, false )
    const lastChecked_id = await this.setLastChecked( url, Date.now() )
    const relay_id = await this.updateRelayCache({ url, open: { data: false }} ) 
    this.progressMessage(url, null, true)
    this.processed++
  }

  calculateProgress() {
    if (this.total === 0) return "0.00%"; // Prevent division by zero
    let percentage = (this.processed / this.total) * 100;
    return percentage.toFixed(2) + "%";
  }

  async progressMessage(url, result={}, error=false){
    const failure = chalk.red;
    const success = chalk.bold.green;
    const mute = chalk.gray
    this.log.info(
      `[${chalk.bgBlack(this.calculateProgress())}] `+
      `${mute(this.processed)}/${mute(this.total)}  `+
      `${url}: ${result?.open?.data === true? success("online"): failure("offline")} ${result?.read?.data === true? success("readable"): failure("unreadable")} ${result?.write?.data === true? success("writable"): failure("unwritable")}  `+
      `${(result?.open?.duration+result?.read?.duration+result?.write?.duration)/1000} seconds  `+
      `${error? chalk.gray.italic('error'): ''}  ` +
      `[${error? await this.retry.getRetries(url) + " retries": ""}]`)
      
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
    return `${this.slug}@${this.pubkey}`
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
      this.log.debug(`[work] ${job.id} is a ${this.slug} job, running...`)
      return this.work()
    }
    this.log.warn(`[work] ${job.id} is not a ${this.slug} job, passing to next worker`)
  }

  // async work(job){
  //   throw new Error(`work() not implemented by subclass "${this.slug}"`)
  // }

  static getShortName(slug){
    return slug.replace('Manager', '').toLowerCase()
  }

  async populator(){
    const relays = await this.getRelays()
    this.log.info(relays.length)
    await this.$.worker.pause()
    await this.addRelayJobs(relays)
    this.log.debug(`${this.id()}:_populator(): Added ${relays?.length} to queue`)
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
    const priority = this.getPriority(jdata.relay)
    const jobOpts = {
      priority: priority,
      removeOnComplete: true,
      removeOnFail: true
    }
    this.log.debug(`Adding job for ${this.slug}: ${JSON.stringify(jdata)}`)
    return this.$.queue.add( this.id(), jdata, { jobId: this.jobId(jdata.relay), ...jobOpts})
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
    return lastCheckedId(this.slug, url)
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
          // console.log(_check_id)
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
    record.online = result.open.data
    const $id = await this.rcache.relay.patch(record)
    return $id
  }

  async getRelays() {
    const allRelays = await this.rcache.relay.get.all();
    const onlineRelays = [];
    const uncheckedRelays = [];
    let expiredRelays = [];

    this.relayMeta = new Map()
  
    for (const relay of allRelays) {
      const lastChecked = await this.rcache.cachetime.get.one(this.cacheId(relay.url));
      const retries = await this.retry.getRetries(relay.url);
      const isExpired = await this.isExpired(relay.url, lastChecked);
      const isOnline = relay?.online === true;
  
      let group = '';
      if (isOnline && isExpired) {
        onlineRelays.push(relay.url);
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
  
    this.log.info(`online: ${await this.rcache.relay.get.online()?.length}, \
    online & expired: ${onlineRelays.length}, \
    expired: ${expiredRelays.length}, \
    unchecked: ${uncheckedRelays.filter(this.qualifyNetwork.bind(this)).length}, \
    total: ${allRelays.length}`);
  
    const deduped = [...new Set([...onlineRelays, ...uncheckedRelays, ...expiredRelays])];
    const relaysFiltered = deduped.filter(this.qualifyNetwork.bind(this));
    const truncateLength = this.get_truncate_length(allRelays);
  
    return relaysFiltered.slice(0, truncateLength);
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
    this.log.error(`Error evaluating config.nocapd.checks.all.max -> "${config.nocapd.checks.options.max}": ${e.message}`)
  }
}