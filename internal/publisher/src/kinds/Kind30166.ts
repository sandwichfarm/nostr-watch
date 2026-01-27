import { Event, NostrEvent, NostrEventTags } from '../Event.js'
import ngeotags from 'nostr-geotags';

interface GeoData {
  isp?: string;
  as?: string;
  asname?: string;
  latitude?: number;
  longitude?: number;
  [key: string]: any;
}

interface CheckData {
  url: string;
  network?: string;
  info?: {
    data?: {
      pubkey?: string;
      supported_nips?: (string|number)[];
      language_tags?: string[];
      tags?: string[];
      attributes?: string[];
      kinds?: (string|number)[];
      limitation?: {
        auth_required?: boolean;
        payment_required?: boolean;
        pow_required?: boolean;
        min_pow_difficulty?: number;
      };
      software?: string;
      version?: string;
    };
  };
  geo?: {
    data?: GeoData[];
  };
  ssl?: {
    data?: {
      valid_from: string;
      valid_to: string;
    };
  };
  dns?: {
    data?: {
      ipv4?: string[];
      ipv6?: string[];
    };
  };
  open?: {
    duration: number;
  };
  read?: {
    duration: number;
  };
  write?: {
    duration: number;
  };
}

export class Kind30166 extends Event { 

  private logger: {
    err: (msg: string) => void;
    info: (data: any) => void;
  };
  
  constructor(pubkey: string){
    const KIND = 30166
    super(KIND, pubkey)
    this.kind = KIND
    this.logger = {
      err: console.error,
      info: console.info
    }
  };

  _generateEvent(check: CheckData): NostrEvent {
    let content = "{}";
    const tags = this.generateTags(check);
    const nip11 = check.info?.data;

    if(nip11) {
      try {
        content = `${JSON.stringify(nip11)}`
      } catch (e) {
        this.logger.err(`generateEvent(): Error: ${e}`)
        this.logger.info(nip11)
      }
    };

    const event = {
      ...this.tpl(),
      content,
      tags
    };

    return event;
  };

  generateTags(check: CheckData): NostrEventTags {
    const protocol = new URL(check.url).protocol;

    const info = check?.info?.data;
    const geo = check?.geo?.data;
    const ssl = check?.ssl?.data;
    const dns = check?.dns?.data;

    const open = check?.open?.duration;
    const read = check?.read?.duration;
    const write = check?.write?.duration;

    let tags: NostrEventTags = [];

    tags.push(['d', check.url]);

    if( open && typeof open === 'number' && open > 0 ){
      tags.push(['rtt-open', String(Math.round(open))]);
    }

    if( read && typeof open === 'number' && read > 0 ){
      tags.push(['rtt-read', String(Math.round(read))]);
    }

    if( write && typeof open === 'number' && write > 0 ){
      tags.push(['rtt-write', String(Math.round(write))]);
    }
      
    if (check?.network && typeof check.network === 'string'){
      tags.push(['n', check.network]);
    }

    if (info){
      if (info?.pubkey && typeof info?.pubkey === 'string'){
        const regex = /^(?:[0-9a-f]{64})$/;
        if( regex.test(info.pubkey) ) {
          tags.push(['p', info.pubkey]);
        }
        else {
          // console.warn(`generateTags(): Invalid pubkey: ${info.pubkey}`)
        }
      }

      if(info?.supported_nips) {
        if(info.supported_nips instanceof Array) {
          for(const nip of info.supported_nips){
            tags.push(['N', String(nip)])
          }
        }
        else if(typeof info.supported_nips === 'number') { //re:pablo and his scalar values.
          tags.push(['N', String(info.supported_nips)])
        }
      }

      if(info?.language_tags) {
        for(const lang of info.language_tags){
          //TODO: validate language tags, attempt transform on invalids.
          tags.push(['L', 'ISO-639-1'])
          tags.push(['l', String(lang), 'ISO-639-1'])
        }
      }
    
      if(info?.tags) {
        for(const tag of info.tags){
          if(typeof tag === 'string'){
            tags.push(['t', String(tag)])
          }
        }
      }     
      
      if(info?.attributes && Array.isArray(info.attributes)) {
        info.attributes.length = 9
        for(const attr of info.attributes){
          if(typeof attr === 'string') {
            tags.push(['W', attr]);
          }
        }
      }

      if(info?.kinds && Array.isArray(info.kinds)){
        const { kinds } = info 
        kinds.length = 21;
        for(const kind of info.kinds){
          if(typeof kind === 'string' || typeof kind === 'number') {
            tags.push(['k', String(kind)]);
          }
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

      if (typeof info?.limitation?.min_pow_difficulty === 'number' && info?.limitation?.min_pow_difficulty > 0){
        tags.push(['R', 'pow', info.limitation.min_pow_difficulty.toString() ])
      }
      else {
        tags.push(['R', '!pow'])
      }

      if (info?.software && typeof info.software === 'string'){
        tags.push(['s', info.software])
      }

      if (info?.version && typeof info.version === 'string'){
        tags.push(['L', 'nip11.version'])
        tags.push(['l', info.version, 'nip11.version'])
      }
    }

    if(ssl && typeof ssl?.valid_from === 'string' && typeof ssl?.valid_to === 'string') {
      if (protocol === 'wss:') {
        const validFrom = new Date(ssl.valid_from).getTime()
        const validTo = new Date(ssl.valid_to).getTime()
        const isCurrent = validFrom < Date.now() && validTo > Date.now()
        tags.push(['R', isCurrent  ? 'ssl' : '!ssl'])
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

    const geoISP = (geo: GeoData, tags: NostrEventTags): NostrEventTags => {
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

    const dedupLabels = (tags: NostrEventTags): NostrEventTags => {
      let dedupedTags: NostrEventTags = [];
      let keys = new Map<string, Set<string>>();
  
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
              if (keys.has(key) && !keys.get(key)!.has(value)) {
                  keys.get(key)!.add(value);
                  dedupedTags.push(item);
              }
          }
      });
  
      return dedupedTags;
    }

    const removeLabels = (tags: NostrEventTags): NostrEventTags => {
      return tags.filter(t => t[0] !== 'l' && t[0] !== 'L')
    }

    const geoGTags = (geo: GeoData): NostrEventTags => {
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
      let ispTags: NostrEventTags = [],
          geoTags: NostrEventTags = [];

      for(const g of geo){
        ispTags = geoISP(g, ispTags)
        geoTags = [...geoTags, ...geoGTags(g)]
      }
      
      geoTags = [...removeLabels(geoTags), ...dedupLabels(geoTags)]
      ispTags = dedupLabels(ispTags)
      tags = [...tags, ...ispTags, ...geoTags]
    }
    
    tags.push(['l', 'draft7', 'nip66.draft'])

    return tags
  }
}
