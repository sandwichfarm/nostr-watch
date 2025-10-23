import { Event } from '../Event.js'
import ngeotags from 'nostr-geotags';

export class Kind30166 extends Event { 
  
  constructor(pubkey){
    const KIND = 30166
    super(KIND, pubkey)
    this.kind = KIND
    this.discoverable = {tags: ['d', 'n', 'l', 'N', 's', 't', 'R']}
    this.human_readable = false
    this.machine_readable = true
  }

  _generateEvent(check){
    let content = "{}"
    const tags = this.generateTags(check)
    const nip11 = check.info?.data

    if(nip11) {
      try {
        content = `${JSON.stringify(nip11)}`
      } catch (e) {
        this.logger.err(`generateEvent(): Error: ${e}`)
        this.logger.info(nip11)
      }
    }

    const event = {
      ...this.tpl(),
      content,
      tags
    }

    return event
  }

  generateTags(check){
    const protocol = new URL(check.url).protocol

    const info = check?.info?.data
    const geo = check?.geo?.data
    const ssl = check?.ssl?.data
    const dns = check?.dns?.data

    const open = check?.open?.duration
    const read = check?.read?.duration
    const write = check?.write?.duration

    const network = check?.network

    let tags = []

    tags.push(['d', check.url])

    if( open && open > 0 ){
      tags.push(['rtt-open', String(Math.round(open))])
    }

    if( read && read > 0 ){
      tags.push(['rtt-read', String(Math.round(read))])
    }

    if( write && write > 0 ){
      tags.push(['rtt-write', String(Math.round(write))])
    }
      
    if (check?.network){
      tags.push(['n', check.network])
    }

    if (info){
      if (info?.pubkey && typeof info?.pubkey === 'string'){
        const regex = /^(?:[0-9a-f]{64})$/;
        if( regex.test(info.pubkey) ) {
          tags.push(['p', info.pubkey])
        }
        else {
          // console.warn(`generateTags(): Invalid pubkey: ${info.pubkey}`)
        }
      }

      if(info?.supported_nips && Array.isArray(info.supported_nips)) {
        for(const nip of info.supported_nips){
          tags.push(['N', String(nip)])
        }
      } 
      else if(info?.supported_nips && !Array.isArray(info?.supported_nips)) {
        if(typeof info?.supported_nips === 'number') {
          tags.push(['N', info.supported_nips.toString()])
        }
        tags.push(['error', 'nip11: supported_nips is not an array'])
      }

      if(info?.language_tags) {
        for(const lang of info.language_tags){
          tags.push(['L', 'ISO-639-1'])
          tags.push(['l', String(lang), 'ISO-639-1'])
        }
      }
    
      if(info?.tags) {
        for(const tag of info.tags){
          tags.push(['t', String(tag)])
        }
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

      if (typeof info?.limitation?.min_pow_difficulty === 'number' && info.limitation.min_pow_difficulty > 0){
        tags.push(['R', 'pow', info.limitation.min_pow_difficulty?.toString()])
      }
      else {
        tags.push(['R', '!pow'])
      }

      if (info?.software){
        tags.push(['s', info.software])
      }

      if (info?.version ){
        tags.push(['L', 'nip11.version'])
        tags.push(['l', info.version, 'nip11.version'])
      }
    }

    if(ssl) {
      if (protocol === 'wss:') {
        const validFrom = new Date(ssl.valid_from).getTime()
        const validTo = new Date(ssl.valid_to).getTime()
        const current = validFrom < Date.now() && validTo > Date.now()
        tags.push(['R', current  ? 'ssl' : '!ssl'])
      }
      else {
        tags.push(['R', '!ssl'])
      }
    }

    if(dns) {
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
    }

    const geoISP = (geo, tags) => {
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
      return tags
    }

    const dedupLabels = (tags) => {
      let dedupedTags = [];
      let keys = new Map();
  
      tags.forEach(item => {
          if (item[0] === 'L') {
              const key = item[1];
              if (!keys.has(key)) {
                  keys.set(key, new Set());
                  dedupedTags.push(item);
              }
          } else if (item[0] === 'l') {
              const key = item[2];
              const value = item[1];
              if (keys.has(key) && !keys.get(key).has(value)) {
                  keys.get(key).add(value);
                  dedupedTags.push(item);
              }
          }
      });
  
      return dedupedTags;
    }

    const removeLabels = (tags) => {
      return tags.filter(t => t[0] !== 'l' && t[0] !== 'L')
    }

    const geoGTags = (geo) => {
      const gOpts = {
        isoAsNamespace: false,
        geohash: true,
        gps: false,
        countryCode: true,
        countryName: true,
        regionCode: true
      }
      return ngeotags(geo, gOpts);
    }

    if(geo && geo instanceof Array) {
      let ispTags = [],
          geoTags = [];

      for(const g of geo){
        ispTags = geoISP(g, ispTags)
        geoTags = geoGTags(g, tags)
      }
      
      geoTags = [...removeLabels(geoTags), ...dedupLabels(geoTags)]
      ispTags = dedupLabels(ispTags)
      tags = [...tags, ...ispTags, ...geoTags]
    }
    
    tags.push(['l', 'draft7', 'nip66.draft'])

    return tags
  }
}