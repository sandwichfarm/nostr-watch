import { Schema } from './Schema.class.js'
import  { parseUrl, parseRelayNetwork } from '@nostrwatch/utils'

export class Relay extends Schema {
  static defaults = {
    url: '',

    // discriminator
    ignore: false,

    // qualifiers
    online: null,

    // static meta
    parent: null,
    network: '',
    hostname: '',
    protocol: '',

    // dynamic meta
    rtt: -1,
    info: null,
    geo: null,
    dns: null,
    ssl: null,
    
  };

  constructor(payload={}) {
    if(!payload?.url)
      throw new Error("Relay object must have a url property")

    const url = payload?.url
    delete payload.url
    super({...Relay.newRecord(url), ...payload})
  }

  static newRecord(relay){
    const $u = parseUrl(relay)
    const url = $u.toString(),
          protocol = $u.protocol,
          hostname = $u.hostname,
          network = parseRelayNetwork(url)
  
    return { ...this.defaults, url, protocol, hostname, network } 
  }
}