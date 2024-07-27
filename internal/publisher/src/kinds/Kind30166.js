import { PublisherNocap } from '../Publisher.js'
import ngeotags from 'nostr-geotags';

export class Kind30166 extends PublisherNocap { 
  constructor(){
    const KIND = 30166
    super(KIND)
    this.kind = KIND
    this.discoverable = {tags: ['d', 'n', 'l', 'N', 's', 't', 'R']}
    this.human_readable = false
    this.machine_readable = true
  }

  generateEvent(check){
    let content
    const tags = Kind30166.generateTags(check)
    try {
      content = `${JSON.stringify(check.content)}`
    } catch (e) {
      content = "{}"
      this.logger.err(`generateEvent(): Error: ${e}`)
      this.logger.info(check.content)
    }
    const event = {
      ...this.tpl(),
      content,
      tags
    }
    return event
  }

  static generateTags(check){
    const protocol = new URL(check.url).protocol

    const info = check?.info?.data || {}
    const geo = check?.geo?.data || {}
    const ssl = check?.ssl?.data || {}
    const dns = check?.dns?.data || {}

    const open = check?.open?.duration
    const read = check?.read?.duration
    const write = check?.write?.duration

    let tags = []

    tags.push(['d', check.url])

    if( open && open > 0 ){
      tags.push(['rtt-open', String(open)])
    }

    if( read && read > 0 ){
      tags.push(['rtt-read', String(read)])
    }

    if( write && write > 0 ){
      tags.push(['rtt-write', String(write)])
    }
      
    if (check?.network){
      tags.push(['n', check.network])
    }

    if (info){
      if (info?.pubkey && typeof info?.pubkey === 'string'){
        tags.push(['p', info.pubkey])
      }

      for(const nip in info.supported_nips){
        tags.push(['N', String(nip)])
      }

      for(const lang in info.language_tags){
        //TODO: validate language tags, attempt transform on invalids.
        tags.push(['L', 'ISO-639-1'])
        tags.push(['l', String(lang), 'ISO-639-1'])
      }
    
      for(const tag in info.tags){
        tags.push(['t', String(tag)])
      }

      if (info?.limitation?.auth_required === true){
        tags.push(['R', 'auth'])
      }
      else {
        tags.push(['R', '!auth'])
      }

      if (info?.limitation?.payment_required === true){
        tags.push(['R', 'payment'])
      }
      else {
        tags.push(['R', '!payment'])
      }

      if (info?.software){
        tags.push(['s', info.software])
      }

      if (info?.version ){
        tags.push(['L', 'nip11.version'])
        tags.push(['l', info.version, 'nip11.version'])
      }
    }

    if (ssl && protocol === 'wss:') {
      const validFrom = new Date(ssl.valid_from).getTime()
      const validTo = new Date(ssl.valid_to).getTime()
      const current = validFrom < Date.now() && validTo > Date.now()
      tags.push(['R', current  ? 'ssl' : '!ssl'])
    }
    else if(protocol !== 'wss:') {
      tags.push(['R', '!ssl'])
    }

    if (dns?.ipv4?.length){
      tags.push(['L', 'dns.ipv4'])
      for(const ipv4 of dns.ipv4){
        tags.push(['l', ipv4, 'dns.ipv4'])
      }
    }

    if (dns?.ipv6?.length){
      tags.push(['L', 'dns.ipv6'])
      for(const ipv6 of dns.ipv6){
        tags.push(['l', ipv6, 'dns.ipv6'])
      }
    }

    if (geo?.isp){
      tags.push(['L', 'host.isp'])
      tags.push(['l', geo.isp, 'host.isp'])
    }

    if (geo?.as){
      tags.push(['L', 'host.as'])
      tags.push(['l', geo.as, 'host.as'])
    }

    if (geo?.asname){
      tags.push(['L', 'host.asn'])
      tags.push(['l', geo.asname, 'host.asn'])
    }

    if(geo && geo instanceof Object) 
      tags = [...tags, ...ngeotags(geo, {isoAsNamespace: false})];

    tags.push(['l', 'draft7', 'nip66.draft'])

    return tags
  }
}