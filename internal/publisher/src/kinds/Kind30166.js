import { PublisherNocap } from '../Publisher.js'

export class Kind30166 extends PublisherNocap { 
  constructor(){
    const KIND = 30166
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

    if( data?.open?.data ){
      tags.push(['rtt-open', data?.open?.duration])
    }

    if( data?.read?.data ){
      tags.push(['rtt-read', data?.read?.duration])
    }

    if( data?.write?.data ){
      tags.push(['rtt-write', data?.write?.duration])
    }
      
    if (data?.network){
      tags.push(['n', data.network])
    }

    if (data?.info){
      if (data?.info?.data?.pubkey){
        tags.push(['p', data.info.data.pubkey])
      }

      for(const nip in data.info.data.supported_nips){
        tags.push(['N', String(nip)])
      }

      for(const lang in data.info.data.language_tags){
        //TODO: validate language tags, attempt transform on invalids.
        tags.push(['L', 'ISO-639-1'])
        tags.push(['l', String(lang), 'ISO-639-1'])
      }
    
      for(const tag in data.info.data.tags){
        tags.push(['t', String(tag)])
      }

      if (data?.info?.data?.limitation?.auth_required === true){
        tags.push(['R', 'auth'])
      }
      else {
        tags.push(['R', '!auth'])
      }

      if (data?.info?.data?.limitation?.payment_required === true){
        tags.push(['R', 'payment'])
      }
      else {
        tags.push(['R', '!payment'])
      }

      if (data?.info?.data?.software){
        tags.push(['s', data.info.data.software])
      }

      if (data?.info?.data?.version ){
        tags.push(['L', 'nip11.version'])
        tags.push(['l', data.info.data.version, 'nip11.version'])
      }
    }

    if (data?.ssl && protocol === 'wss:') {
      const validFrom = new Date(data.ssl.data.valid_from).getTime()
      const validTo = new Date(data.ssl.data.valid_to).getTime()
      const current = validFrom < Date.now() && validTo > Date.now()
      tags.push(['R', current  ? 'ssl' : '!ssl'])
    }
    else if(protocol !== 'wss:') {
      tags.push(['R', '!ssl'])
    }

    if (data?.dns?.data?.ipv4?.length){
      tags.push(['L', 'dns.ipv4'])
      for(const ipv4 of data.dns.data.ipv4){
        tags.push(['l', ipv4, 'dns.ipv4'])
      }
    }

    if (data?.dns?.data?.ipv6?.length){
      tags.push(['L', 'dns.ipv6'])
      for(const ipv6 of data.dns.data.ipv6){
        tags.push(['l', ipv6, 'dns.ipv6'])
      }
    }

    if (data?.geo?.isp){
      tags.push(['L', 'host.isp'])
      tags.push(['l', data.dns?.data?.isp, 'host.isp'])
    }

    if (data?.geo?.as){
      tags.push(['L', 'host.as'])
      tags.push(['l', data.geo?.data?.as, 'host.as'])
    }

    if (data?.geo?.asn){
      tags.push(['L', 'host.asn'])
      tags.push(['l', data.geo?.data?.asname, 'host.asn'])
    }

    if (data?.geo?.data?.countryCode){
      tags.push(['L', 'ISO-3166-1:alpha-2'])
      tags.push(['l', data?.geo?.data?.countryCode, 'ISO-3166-1:alpha-2'])
    }

    if (data?.geo?.data?.cityName){
      tags.push(['L', 'watch.nostr.cityName'])
      tags.push(['l', data?.geo?.data?.cityName, 'watch.nostr.cityName'])
    }

    tags.push(['l', 'draft7', 'nip66.draft'])

    return tags
  }
}