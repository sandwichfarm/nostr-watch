import { fetch } from 'cross-fetch'

 class GeoAdapterDefault {
  constructor(parent){
    this.$ = parent
  }

  async check_geo(){ 
    let endpoint 
    const ips = this.$.results.getIps('ipv4')
    const ip = ips[ips?.length-1]
    if(typeof ip !== 'string')
      return this.$.finish('geo', { status: "error", message: 'No IP address. Run `dns` check first.', data: {} })
    if(this.config?.auth?.ip_api_key)
      endpoint = `https://pro.ip-api.com/json/${ip}?key=${this.config.auth.ip_api_key}`
    else 
      endpoint = `http://ip-api.com/json/${ip}`
    const headers = { 'accept': 'application/json' }
    const response = await fetch(endpoint, { headers }).catch(e => err=e)
    delete response.query
    delete response.status
    const result = { status: "success", data: await response.json() }
    this.$.finish('geo', result)
  }
}

export default GeoAdapterDefault