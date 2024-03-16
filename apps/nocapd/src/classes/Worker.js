import hash from 'object-hash'
import timestring from 'timestring'
import chalk from 'chalk';

import { RetryManager } from '@nostrwatch/controlflow'
import Logger from '@nostrwatch/logger'
import { Nocap } from '@nostrwatch/nocap'
import { parseRelayNetwork, delay, lastCheckedId } from '@nostrwatch/utils'
import Publish from '@nostrwatch/publisher'

export class NWWorker {
  
  constructor(pubkey, $q, rcache, config){
    this.pubkey = pubkey
    this.$ = $q
    this.rcache = rcache
    this.config = config
    this.setup()
    this.log.info(`${this.id()} initialized`)
  }

  setup(){
    this.setupDefaultValues()
    this.setupConfig()
    this.setupNocapOpts()
    this.setupJobOpts()
  }

  setupDefaultValues(){
    this.cb = {}
    this.processed = 0
    this.total = 0
    this.relayMeta = new Map()
    this.jobOpts = {}
    this.nocapOpts = {}
  }

  setupConfig(){
    this.opts = this.config.nocapd
    this.retry = new RetryManager(`nocapd/${this.pubkey}`, this.opts?.retry)
    this.checks = this.opts?.checks?.enabled.includes('all')? Nocap.checksSupported(): this.opts?.checks?.enabled
    this.checkOpts = this.opts?.checks?.options || {}
    this.timeout = this.setTimeout(this.checkOpts?.timeout)
    this.priority = this.checkOpts?.priority? this.checkOpts.priority: 10
    this.expires = this.checkOpts?.expires? timestring(this.checkOpts.expires, 'ms'): 60*60*1000
    this.interval = this.checkOpts?.interval? timestring(this.checkOpts.interval, 'ms'): 60*1000
    this.networks = this.opts?.networks? this.opts.networks: ['clearnet']
    this.log = this.config?.logger? this.config.logger: new Logger('nocap/$NWWorker')
  }

  setupNocapOpts(){
    this.nocapOpts = { 
      timeout: this.timeout,
      checked_by: this.pubkey
    }
  }

  setupJobOpts(){
    this.jobOpts ={
      removeOnComplete: {
        age: Math.round(this.expires/1000),
      },
      removeOnFail: 11,
    }
  }

  updateJobOpts(obj){
    this.jobOpts = { ...this.jobOpts, ...obj }
    return this.jobOpts
  }

  async populator(){
    this.log.info(`${this.id()}:_populator(): populating queue`)
    const relays = await this.getRelays()
    this.log.info(relays.length)
    await this.$.worker.pause()
    await this.addRelayJobs(relays)
    this.log.debug(`${this.id()}:_populator(): Added ${relays?.length} to queue`)
    delay(1000)
    await this.$.worker.resume()
  }

  async work(job){
    this.log.debug(`${this.id()}: work(): ${job.id} checking ${job.data?.relay} for ${this.opts?.checks?.enabled || "unknown checks"}`)
    const failure = (err) => { this.log.debug(`Could not run ${this.pubkey} check for ${job.data.relay}: ${err.message}`) }  
    try {
      const { relay:url } = job.data 
      const nocap = new Nocap(url, this.nocapOpts)
      const result = await nocap.check(this.opts.checks.enabled).catch(failure)
      return { result } 
    } 
    catch(err) {
      console.log(err)
      failure(new Error(`Failure inside work() block: ${err}`))
      return { result: { url: job.data.relay, open: { data: false }} }
    }
  }

  async on_completed(job, rvalue){
    this.log.debug(`on_completed(): ${job.id}: ${JSON.stringify(rvalue)}`)
    const { result } = rvalue
    let fail = result?.open?.data? false: true
    if(fail)
      await this.on_fail(result)
    else
      await this.on_success(result)
    await this.after_completed( result, fail )
  }

  async on_success(result){
    this.log.debug(`on_success(): ${result.url}`)
    this.progressMessage(result.url, result)
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
    this.log.debug(`on_fail(): ${result.url}`)
    this.progressMessage(result.url, null, true)
  }

  async after_completed(result, error=false){
    this.log.debug(`after_completed(): ${result.url}`)
    this.processed++
    await this.updateRelayCache( { ...result } )      
    await delay(200)
    await this.retry.setRetries( result.url, !error )
    await delay(200)
    await this.setLastChecked( result.url, Date.now() )
  }

  async on_drained(){
    //this.log.debug(`on_drained()`)  
    this.total = 0
    this.processed = 0
  }

  cbcall(...args){
    this.log.debug(`cbcall(): ${JSON.stringify(args)}`)
    const handler = [].shift.call(args)
    if(this?.[`on_${handler}`] && typeof this[`on_${handler}`] === 'function')
      this[`on_${handler}`](...args)
    if(typeof this.cb[handler] === 'function')
      this.cb[handler](...args)
  }

  async addRelayJobs(relays){
    this.log.debug(`Relay Counts: ${JSON.stringify(await this.counts())}`)
    for await ( const relay of relays ){
      const $job = await this.addRelayJob({ relay })
      if($job?.id)
        this.total++
    }
  }

  async addRelayJob(jdata){
    this.log.debug(`Adding job for ${jdata.relay} with ${this.opts.checks.enabled} nocap checks: ${JSON.stringify(jdata)}`)
    const priority = this.getPriority(jdata.relay)
    this.updateJobOpts({ priority })
    return this.$.queue.add( this.id(), jdata, { jobId: this.jobId(jdata.relay), ...this.jobOpts})
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
    progress += `${mute(this.processed)}/${mute(this.total)}  `
    progress += `${url}: `
    if(this.checks.includes('open'))
      progress += `${result?.open?.data === true? success("online"): failure("offline")} `
    if(this.checks.includes('read'))
      progress += `${result?.read?.data === true? success("readable"): failure("unreadable")} ` 
    if(this.checks.includes('write'))
      progress += `${result?.write?.data === true? success("writable"): failure("unwritable")} `
    if(this.checks.includes('dns'))
      progress += `${Object.keys(result?.dns?.data || {}).length? success("dns"): failure("dns")} `
    if(this.checks.includes('ssl'))
      progress += `${Object.keys(result?.ssl?.data || {}).length? success("ssl"): failure("ssl")} `
    if(this.checks.includes('geo'))
      progress += `${Object.keys(result?.geo?.data || {}).length? success("geo"): failure("geo")} `
    if(this.checks.includes('info'))
      progress += `${Object.keys(result?.info?.data || {}).length? success("info"): failure("info")} `
    
    progress += `${(result?.open?.duration+result?.read?.duration+result?.write?.duration)/1000} seconds  `
    progress += `${error? chalk.gray.italic('error'): ''}  ` 
    progress += `[${error? await this.retry.getRetries(url) + " retries": ""}]`

    this.log.info(progress)       
  }

  id(){
    return this.pubkey
  }

  async counts(){
    const counts = await this.$.queue.getJobCounts()
    this.log.info(`[stats] active: ${counts.active}, completed: ${ counts.completed }, failed: ${counts.failed}, prioritized: ${counts.prioritized}, delayed: ${counts.delayed}, waiting: ${counts.waiting}, paused: ${counts.paused}, total: ${counts.completed} / ${counts.active} + ${counts.waiting + counts.prioritized}`)
    return counts
  }

  hasChanged(data1, data2){
    const changed = hash(data1) !== hash(data2)
    //this.log.debug(`hasChanged: ${changed}`)
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

    for( const key of ['info', 'dns', 'geo', 'ssl'] ){
      const resultHasKey = result?.[key]?.data && Object.keys(result[key].data)?.length > 0
      if(resultHasKey){
        const persist_result = async (resolve, reject) => { 
          const _record = { url: url, relay_id, updated_at: Date.now(), hash: hash(result[key].data), data: result[key].data }
          const _check_id = await this.rcache.check[key].insert(_record)
          if(!_check_id)
            reject()
          record = {...record, ...{ [key]: _check_id }}
          resolve()
        }
        promises.push( new Promise( persist_result ) )
      }
    }
    await Promise.allSettled(promises)
    record.url = url
    if(result?.open?.data) record.online = result.open.data
    await delay(100)
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

}

const evaluateMaxRelays = (evaluate, relays) => {
  try {
    return parseInt( eval( evaluate ) )
  }
  catch(e){
    this.log.error(`Error evaluating this.opts.checks.options.max -> "${this?.opts?.checks?.options?.max} || "is undefined"": ${e?.message || "error undefined"}`)
  }
}