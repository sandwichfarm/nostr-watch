import mapper from 'object-mapper'
import ngeotags from 'nostr-geotags'

import { RetryManager } from '@nostrwatch/controlflow'
import { parseRelayNetwork, lastCheckedId, delay } from '@nostrwatch/utils'
import Publish from '@nostrwatch/publisher'

import { WorkerManager } from '../classes/WorkerManager.js'

const publish30066 = new Publish.Kind30066()

export class AllManager extends WorkerManager {
  constructor($, rcache, config){
    super($, rcache, config)
    this.interval = 60*1000       //checks for expired items every...
    this.timeout = 9*1000
    this.timeoutBuffer = 1000
    this.priority = 10
    this.retry = new RetryManager('nocapd', 'check', this.rcache.relay.get.all())
  }

  cacheId(url){
    return lastCheckedId(this.id, url)
  }

  async populator(){
    this.log.debug(`${this.id()}:populator()`)
    await this.retry.init()
    const relaysUnchecked = await this.getUncheckedRelays()
    const relaysExpired = await this.retry.getExpiredRelays(this.cacheId.bind(this))
    let relays = [...new Set([...relaysUnchecked, ...relaysExpired])]
    relays = relays.map(r=>r.url).filter(relay => this.networks.includes(parseRelayNetwork(relay)))
    this.log.info(`expired: ${relaysExpired.length}, unchecked: ${relaysUnchecked.length}, total: ${relays.length}`)
    await this.$.worker.pause()
    await this.addRelayJobs(relays)
    this.log.info('Waiting for 5s...')
    await delay(5000)
    await this.$.worker.resume()
  }

  async work(job){
    const error = (err) => { this.log.error(`Error running websocket check for ${job.data.relay}: ${err.message}`) }
    try {
      this.log.debug(`Running websocket check for ${job.data.relay}`)
      const { relay:url } = job.data
      const dpubkey = this.pubkey
      const nocapOpts = { 
        timeout: { 
          connect: Math.floor(this?.timeout/3), 
          read: Math.floor(this?.timeout/3), 
          write: Math.floor(this?.timeout/3) 
        },
        checked_by: dpubkey 
      }
      const nocapd = new this.Nocap(url, nocapOpts)
      const result = await nocapd.check('all').catch(error)
      if( !result?.connect?.data )
        return { result: false }
      return { result } 
    } 
    catch(err) {
      this.processed++
      error(err)
      return { result: false }
    }
  }

  async on_completed(job, rvalue){
    const { relay:url } = job.data
    const { result  } = rvalue
    const { checked_at } = result
    this.processed++
    this.progressMessage(url, result)
    if(!result)
      return this.log.debug(`Nocap complete (all) check failed for ${url}`)
    this.retry.setRetries( url, true )
    await this.setLastChecked( url, checked_at )
    // this.log.debug(`Nocap complete (all) check complete for ${url}: connect: ${result?.connect?.data}, read: ${result?.read?.data}, write: ${result?.write?.data}`)
    result.retries = this.retry.getRetries(url)
    const event30066Data = event30066DataFromResult( result )
    await publish30066.one(event30066Data)
    // const event10066Data = event10066DataFromResult( result )
    // await publish10066.one(event10066Data)
  }

  async on_failed(job, err){
    const { relay:url } = job.data
    // console.log('url:onfailed', url)
    this.log?.debug(`Websocket check failed for ${job.data.relay}: ${JSON.stringify(err)}`)
    this.retry.setRetries(url, false)
    this.processed++
    this.progressMessage(url, null, true)
  }

  async getUncheckedRelays(){
    let unchecked = await this.rcache.cachetime.get.all()?.filter( relay => relay.online == null )
    if(this.networks.length)
      unchecked = unchecked?.filter( relay => this.networks.includes(relay.network) )
    return unchecked?.length? unchecked: []
  }
  
  async setLastChecked(url, date=Date.now()){
    await this.rcache.cachetime.set( lastCheckedId('online',url), date )
  }

  async setLastPublished(url, date=Date.now()){
    await this.rcache.cachetime.set( lastCheckedId('online',url), date )
  }
}

const truncatedResult = (result, type) => {
  const commonFields = ['connect', 'read', 'write'];
  const fieldsToRemove = {
    'websocket': ['info', 'dns', 'geo', 'ssl'],
    'dns': ['info', 'geo', 'ssl', ...commonFields],
    'info': ['geo', 'ssl', 'dns', ...commonFields],
    'geo': ['ssl', 'dns', 'info', ...commonFields],
    'ssl': ['dns', 'info', 'geo', ...commonFields]
  };
  const res = { ...result };
  fieldsToRemove[type].forEach(field => { 
    if(res?.[field])
      delete res[field]
  });
  return res;
};

const event30066DataFromResult = result => {
  const eventData = {}
  const attributes = []

  const geo = transformGeoResult(result.geo?.data) || {}
  const isGeo = Object.keys(geo)?.length > 0

  const info = result.info?.data || {}
  const isInfo = Object.keys(info)?.length > 0

  const ssl = result.ssl?.data || {}
  const isSsl = Object.keys(ssl)?.length > 0
  
  eventData.url = result.url 
  eventData.online = result.connect.data

  if(eventData.retries > 0)
    eventData.retries = result.retries

  if(isGeo)
    eventData.geo = ngeotags(geo, { iso31662: true })
  
  if(isInfo){
    if(info?.limitations?.payment_required === true)
      attributes.push('payment-required')
    if(info?.limitations?.auth_required === true)
      attributes.push('auth-required')
    if(info?.supported_nips instanceof Array)
      info.supported_nips.forEach(nip => attributes.push(`nip-${nip}`))
  }

  if(isSsl)
    attributes.push(ssl?.valid === true? 'ssl-valid' :'ssl-invalid') 

  if(isGeo)
    if(geo?.as)
      attributes.push(geo.as)
    if(geo?.ip)
      attributes.push(geo.ip)

  if(attributes.length)
    eventData.attributes = attributes

  return eventData
}

const transformGeoResult = geo => {  
  const map = {
    "as": "as",
    "city": "cityName",
    "countryCode": "countryCode",
    "regionName": "regionName",
    "continent": "contentName",
    "continentCode": "continentCode",
    "lat": "lat",
    "lon": "lon",
    "query": "ip",
  }
  return mapper(geo, map)
}