import mapper from 'object-mapper'
import ngeotags from 'nostr-geotags'
import Publish from '@nostrwatch/publisher'

import { WorkerManager } from '../classes/WorkerManager.js'

const publish30066 = new Publish.Kind30066()

export class AllManager extends WorkerManager {
  constructor($, rcache, opts){
    super($, rcache, opts)
    this.interval = 60*1000       //checks for expired items every...
    this.timeout = 15*1000
    this.timeoutBuffer = 1000
  }

  async work(job){
    this.log.debug(`${this.id()}:work()`, job.id)
    
    const error = (err) => { this.log.debug(`Could not run websocket check for ${job.data.relay}: ${err.message}`) }
    try {
      this.log.debug(`Running comprehensive check for ${job.data.relay}`)
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
      let result = {}
      await nocapd.check('all')
        .catch( err => {
          error(err)
        })
        .then( _result => {
          result = _result
        })
      // if(!result?.checked_at)
      //   result.checked_at = Date.now()
      return { result } 
    } 
    catch(err) {
      error(err)
      return { result: false }
    }
  }

  async on_completed(job, rvalue){
    const { relay:url } = job.data
    const { result  } = rvalue

    if(!result || !result?.connect?.data)
      return this.on_failed(job, new Error(`Nocap complete (all) check failed for ${url}`))

    const { checked_at } = result

    this.processed++
    this.progressMessage(url, result)
    
    const relay_id = await this.updateRelayCache(result)      
    const retry_id = await this.retry.setRetries( url, true )
    const lastChecked_id = await this.setLastChecked( url, Date.now() )

    const event30066Data = event30066DataFromResult( result )
    await publish30066.one(event30066Data)    
  }

  async on_failed(job, err){
    const { relay:url } = job.data
    this.log?.debug(`Websocket check failed for ${job.data.relay}: ${JSON.stringify(err)}`)
    const retry_id = await this.retry.setRetries( url, false )
    const lastChecked_id = await this.setLastChecked( url, Date.now() )
    const relay_id = await this.updateRelayCache({ url, connect: { data: false }} ) 
    this.progressMessage(url, null, true)
    this.processed++
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
  const labels = []
  const nips = []

  const dns = result.dns?.data || {}
  const isDns = Object.keys(dns)?.length > 0  

  const geo = transformGeoResult(result.geo?.data) || {}
  const isGeo = Object.keys(geo)?.length > 0

  const info = result.info?.data || {}
  const isInfo = Object.keys(info)?.length > 0

  const ssl = result.ssl?.data || {}
  const isSsl = Object.keys(ssl)?.length > 0
  
  eventData.url = result.url 
  eventData.online = result.connect.data

  eventData.rtt = []

  if(result?.network)
    eventData.network = result.network

  if(result?.connect?.duration > 0)
    eventData.rtt.push([ 'open', result.connect.duration ])

  if(result?.read?.duration > 0)
    eventData.rtt.push([ 'subscribe', result.read.duration ])

  if(result?.write?.duration > 0)
    eventData.rtt.push([ 'publish', result.write.duration ])

  if(eventData.retries > 0)
    eventData.retries = result.retries

  if(isGeo)
    eventData.geo = ngeotags(geo, { iso31662: true, iso3163: true })
  
  if(isInfo){
    if(info?.limitation?.payment_required === true)
      labels.push(['nip11.limitation', 'payment-required'])
    if(info?.limitation?.auth_required === true)
      labels.push(['nip11.limitation', 'auth-required'])
    if(info?.pubkey)
      labels.push(['nip11.pubkey', info.pubkey])
    if(info?.contact)
      labels.push(['nip11.contact', info.contact])
    if(info?.name)
      labels.push(['nip11.name', info.name])
    if(info?.software)
      labels.push(['nip11.software', info.software])
    if(info?.version)
      labels.push(['nip11.version', info.version])
    if(info?.supported_nips instanceof Array)
      info.supported_nips.forEach(nip => {
        nips.push(`${nip}`)
      })
    if(info?.tags)
      labels.push(['nip11.tags', ...info.tags])
    if(info?.language_tags)
      labels.push(['nip11.language_tags', ...info.language_tags ])
  }

  if(isSsl)
    eventData.ssltag = [ 'ssl', ssl?.valid === true? 'valid': 'invalid', `${new Date(ssl.valid_from).getTime()}`, `${new Date(ssl.valid_to).getTime()}` ]

  if(isGeo)
    if(geo?.as)
      labels.push(['as', geo.as])
    if(geo?.asn)
      labels.push(['asn', geo.asn])
    if(geo?.ip)
      labels.push([`ipv4`, geo.ip])

  if(labels.length)
    eventData.labels = labels

  if(nips.length)
    eventData.nips = nips

  return eventData
}

const transformGeoResult = geo => {  
  const map = {
    "as": "as",
    "asn": "asn",
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