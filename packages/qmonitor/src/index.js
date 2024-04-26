import NDK from "@nostr-dev-kit/ndk";
import Deferred from 'promise-deferred'

export class RelayMonitors {
  constructor(){
    this.monitors = {}
    this.$nostr = null
    this.$ipGeo = null
  }

  useAdapter(adapter, options){
    this.$nostr = new adapter({...options})
  }

  async all(){
    
  }

  async active(){
    this.$adapter.subscribe
  }

  async nearby(geo){
    if(geo?.ip) {
      if(!this.$ipGeo)
        throw new Error(`IP to Geo adapter is required to get nearby relays using IP.`)
      return this.$.getRelayByIp(geo.ip)
    }

    if(geo?.latlon)
      return this.get.nearby.latLon(geo.latlon)

    if(geo?.geohash)
      return this.get.nearby.gohash(geo.geohash)

    throw new Error(`No valid geo data provided.`)  
  }
}

export class RelayMonitor {
  constructor(o){
    if(!o?.pubkey) throw new Error(`Pubkey is required.`)
    if(!o.$adapter) throw new Error(`Adapter is required.`)
    this.pubkey = o.pubkey
    this.$adapter = o.$adapter
    this.data = new Deferred()
    this._init()
  }

  async _init(){
    const data = {}
    data.profile = await this._profile()
    data.relays = await this._relay_list()
    data.registration = await this._monitor_registration()
    this.data.resolve(data)
  }

  async _profile(){
    return this.$adapter.getProfile()
  }

  async _relay_list(){
    return this.$adapter.getRelayList()
  }

  async _monitor_registration(){
    return this.$adapter.getRegistration()
  }
}

export class RelayMonitorEvents {
  constructor(){
    
  }

  subscribe(){

  }
}