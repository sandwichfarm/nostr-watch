import mapper from 'object-mapper'
import ngeotags from 'nostr-geotags'

import { PublisherNocap } from '../Publisher.js'

export class Kind30166 extends PublisherNocap { 
  constructor(){
    const KIND =30166
    super(KIND)
    this.kind = KIND
    this.discoverable = {tags: ['d', 'n', 'l', 'N', 's', 't', 'R']}
    this.human_readable = false
    this.machine_readable = true
  }

  generateEvent(data){
    
    const tags = Kind30166.generateTags(data)

    return {
      ...this.tpl(),
      tags
    }
  }

  static generateTags(data){
    const protocol = new URL(data.url).protocol

    let tags = []

    tags.push(['d', data.url])
      
    if(data?.network){
      tags.push(['n', data.network])
    }
    if(data?.info){
      for(const nip in data.info.data.supported_nips){
        tags.push(['N', String(nip)])
      }

      for(const lang in data.info.data.language_tags){
        tags.push(['l', String(lang)])
      }
    
      for(const tag in data.info.data.tags){
        tags.push(['t', String(tag)])
      }
    }
  
    if(data?.info?.data?.limitation?.auth_required === true){
      tags.push(['R', 'auth'])
    }
    else {
      tags.push(['R', '!auth'])
    }
  
    if(data?.info?.data?.limitation?.payment_required === true){
      tags.push(['R', 'payment'])
    }
    else {
      tags.push(['R', '!payment'])
    }

    
    if(data?.ssl && protocol === 'wss:') {
      const current = data.ssl.data.valid_from < Date.now() && data.ssl.data.valid_to > Date.now()
      tags.push(['R', current  ? 'ssl' : '!ssl'])
    }
    else if(protocol !== 'wss:') {
      tags.push(['R', '!ssl'])
    }
  
    if(data?.info?.data?.software){
      tags.push(['s', data.info.data.software])
    }
  
    if(data?.geo?.data && Object.keys(data.geo.data).length > 0){
      const geod = transformGeoResult(data.geo.data)
      tags = [...tags, ...ngeotags(geod, { iso31662: true, iso31663: true, cityName: true })]
    }

    return tags
  }

  parse(event){
    return {
      url: event.tags.find(tag => tag[0] === 'd')?.[1],
      network: event.tags.find(tag => tag[0] === 'n')?.[1],
      info: {
        supported_nips: event.tags.filter(tag => tag[0] === 'N').map(tag => parseInt(tag[1])),
        language_tags: event.tags.filter(tag => tag[0] === 'l').map(tag => tag[1]),
        tags: event.tags.filter(tag => tag[0] === 't').map(tag => tag[1]),
        limitation: {
          auth_required: event.tags.find(tag => tag[0] === 'R' && tag[1].includes('auth')).map( tag => tag[1].includes('!')? false: true ),
          payment_required: event.tags.find(tag => tag[0] === 'R' && tag[1].includes('payment')).map( tag => tag[1].includes('!')? false: true )
        },
        software: event.tags.find(tag => tag[0] === 's')?.[1]
      },
      ssl: event.tags.find(tag => tag[0] === 'R' && tag[1].includes('ssl')).map( tag => tag[1].includes('!')? false: true ),
      geo: ngeotags.parse(event.tags)
    }
  }

}

const transformGeoResult = geo => {  
  const map = {
    "as": "asn",
    "asname": "as",
    "isp": "isp",
    "city": "cityName",
    "countryCode": "countryCode",
    "country": "countryName",
    "regionName": "regionName",
    // "continent": "contentName",
    // "continentCode": "continentCode",
    "lat": "lat",
    "lon": "lon",
    "query": "ip"
  }
  return mapper(geo, map)
}