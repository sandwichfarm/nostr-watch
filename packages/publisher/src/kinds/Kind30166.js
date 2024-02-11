import mapper from 'object-mapper'
import ngeotags from 'nostr-geotags'

import { Publisher } from '../Publisher.js'

export class Kind30166 extends Publisher { 
  constructor(){
    super()
    this.kind = 30166
    this.discoverable = ['d', 'n', 'l', 'N', 's', 't', 'R']
    this.human_readable = false
    this.machine_readable = false
  }

  generateEvent(data){
    let tags = []

    data.geo.data = transformGeoResult(data.geo.data)

    tags.push(['d', data.url])

    if(data?.network){
      tags.push(['n', data.network])
    }

    for(const nip in data.info.data.supported_nips){
      tags.push(['N', String(nip)])
    }

    for(const lang in data.info.data.language_tags){
      tags.push(['l', String(lang)])
    }

    for(const tag in data.info.data.tags){
      tags.push(['t', String(tag)])
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

    if(data?.info?.data?.software){
      tags.push(['s', data.info.data.software])
    }

    if(data?.geo?.data){
      tags = [...tags, ...ngeotags(data.geo.data, { iso31662: true, iso3163: true, cityName: true })]
    }

    return {
      ...this.tpl(),
      tags
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
    "continent": "contentName",
    "continentCode": "continentCode",
    "lat": "lat",
    "lon": "lon",
    "query": "ip"
  }
  return mapper(geo, map)
}