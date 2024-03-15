import mapper from 'object-mapper'
import ngeohash from 'ngeohash'

import { PublisherNocap } from '../Publisher.js'

export class Kind30066 extends PublisherNocap { 
  constructor(){
    super()
    this.kind = 30066
    this.discoverable = {tags: 'd'}
    this.human_readable = true
    this.machine_readable = true
  }

  generateEvent(data){
    let tags = Kind30066.generateTags(data)
    const content = Kind30066.generateContent(data)
    
    const event = {
      ...this.tpl(),
      content,
      tags
    }

    return event
  }

  static generateContent(data){
    let content = ''
    if(data?.info?.data){
      try {
        content = JSON.stringify(data.info.data)
      } catch(e) {}
    }
    return content
  }

  static generateTags(data){
    let tags = []

    const isRtt = data?.open?.data
    const isDns =  Object.keys(data?.dns?.data || {})?.length > 0
    const isInfo =  Object.keys(data?.info?.data || {})?.length > 0
    const isGeo =  Object.keys(data?.geo?.data || {})?.length > 0
    const isSsl =  Object.keys(data?.ssl?.data || {})?.length > 0

    if(!data?.url)
      throw new Error('URL is required in result')
  
    tags.push( ['d', data.url] )
  
    if(data?.network)
      tags.push( ['other', 'network', data.network] )
    if(isRtt) {
      if(data.open?.data)
        tags.push([ 'rtt', 'open', data.open.duration.toString() ])
      if(data?.read?.data)
        tags.push([ 'rtt', 'read', data.read.duration.toString() ])
      if(data?.write?.data)
        tags.push([ 'rtt', 'write', data.write.duration.toString() ])
    }    
  
    if(isInfo){
      if(data?.info){
        try {
          content = JSON.stringify(data.info)
        } catch(e) {}
      }

      if(data?.info?.data?.name)
        tags.push(['nip11', 'name', data.info.data.name])

      if(data?.info?.data?.description)
        tags.push(['nip11', 'desc', data.info.data.description])

      if(data?.info?.data?.limitation?.payment_required === true)
        tags.push(['nip11', 'payment_required', 'true'])
      else 
        tags.push(['nip11', 'payment_required', 'false'])

      if(data?.info?.data?.limitation?.auth_required === true)
        tags.push(['nip11', 'auth_required', 'true'])
      else 
        tags.push(['nip11', 'auth_required', 'false'])
      if(data?.info?.data?.pubkey)
        tags.push(['nip11', 'pubkey', data.info.data.pubkey])
      if(data?.info?.data?.contact)
        tags.push(['nip11', 'contact', data.info.data.contact])
      if(data?.info?.data?.software)
        tags.push(['nip11', 'software', data.info.data.software])
      if(data?.info?.data?.version)
        tags.push(['nip11', 'version', data.info.data.version])
      if(data?.info?.data?.supported_nips instanceof Array && data.info.data.supported_nips.length)
        tags.push(['nip11', 'supported_nips', ...data.info.data.supported_nips.map(n => n.toString())])
      if(data?.info?.data?.tags)
        tags.push(['nip11', 'tags', ...data.info.data.tags])
      if(data?.info?.data?.language_tags)
        tags.push(['nip11', 'language_tags', ...data.info.data.language_tags ])
    }
  
    if(isDns){
      if(data.dns?.data?.ipv4?.length)
        tags.push(['dns', 'ipv4', data.dns.data.ipv4[data.dns.data.ipv4.length-1]])
      if(data.dns?.data?.ipv6?.length)
        tags.push(['dns', 'ipv6', data.dns.data.ipv6[data.dns.data.ipv6.length-1]])
    }

    if(isGeo){
        data.geo.data = transformGeoResult(data.geo.data)
        if (typeof data.geo.data?.lat === 'number' && typeof data.geo.data?.lon === 'number')
          data.geo.data.geohash = ngeohash.encode(data.geo.data.lat, data.geo.data.lon)
        //technically associated to DNS but often found via IP->GEO
        if(data.geo.data?.as) 
          tags.push(['dns', 'as', data.geo.data?.as])
        if(data.geo.data?.asname)
          tags.push(['dns', 'asname', data.geo.data?.asname])
        if(data.geo.data?.isp)
          tags.push(['dns', 'isp', data.geo.data?.isp])
        if(data.geo.data?.isMobile)
          tags.push(['dns', 'is_mobile', data.geo.data?.isMobile? 'true': 'false'])
        if(data.geo.data?.isProxy)
          tags.push(['dns', 'is_proxy', data.geo.data?.isProxy? 'true': 'false'])
        //
        const geoIgnore = ['ip', 'as', 'asname', 'isp', 'is_mobile', 'is_proxy']
        for(const prop in data.geo.data){
          let val = data.geo.data[prop]
          if(geoIgnore.includes(prop)) continue 
          if(val instanceof Boolean){
            tags.push( [ 'geo', prop, val? 'true': 'false' ] )
          }    
          if(typeof val === 'string' && val.length){
            if( prop === 'regionCode' ) val = `${data.geo.data.countryCode}-${val}`
            tags.push( [ 'geo', prop, val ] )   
          }
          if(val instanceof Number || isFloat(val)){
            tags.push( [ 'geo', prop, val.toString() ] )
          }   
        }

        
    }

  
    if(isSsl){
      const sslIgnore = ['valid', 'days_remaining']
      data.ssl.data = transformSslResult(data.ssl.data)
      for(const prop in data.ssl.data){
        if(sslIgnore.includes(prop)) continue

        const val = data.ssl.data[prop]

        if(val instanceof Array){
          tags.push( [ 'ssl', prop, ...val ] )
          continue
        }

        if(val instanceof Number){
          tags.push( [ 'ssl', prop, val.toString() ] )
        }

        if(typeof val === 'string' && isTimeString(val)){
          tags.push( [ 'ssl', prop, ( Math.round(new Date(val).getTime()/1000) ).toString() ])
        }
        else if(typeof val === 'string'){
          tags.push( [ 'ssl', prop, val ] )
        }
        
        if(val instanceof Boolean){
          tags.push( [ 'ssl', prop, val? 'true': 'false' ] )
        }
      }
    }
    
    const countRttTags = tags.filter( tag => tag[0] === 'rtt' )?.length 

    return tags
  }
}

const transformGeoResult = geo => {  
  const map = {
    "as": "as",
    "asname": "asname",
    "isp": "isp",
    "mobile": "isMobile",
    "proxy": "isProxy",
    "lat": "lat",
    "lon": "lon",
    "query": "ip",
    "timezone": "tz",
    "district": "district",
    "city": "cityName",
    "region": "regionCode",
    "regionName": "regionName",
    "country": "countryName",
    "countryCode": "countryCode",
    // "continent": "contentName",
    // "continentCode": "continentCode"
  }
  return mapper(geo, map)
}

const transformSslResult = ssl => {  
    const map = {
      "publisher.kinds": "kinds",
    }
    return mapper(ssl, map)
}


const isTimeString = (str) => {
  return /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}\s+\d{4}\s+GMT\b/.test(str);
}

function isFloat(value) {
  return typeof value === 'number' && !Number.isInteger(value);
}