import { fetch } from 'cross-fetch'

 class GeoAdapterDefault {
  constructor(parent){
    this.$ = parent
  }

  async check_geo(){ 
    let err
    let endpoint 
    const ipArr = this.$.results.get('ipv4')
    const ip = ipArr[ipArr?.length-1]
    if(!ip)
      this.$.finish('geo', { geo: { error: 'No IP address. Run dns check first.' }})
    if(this.config?.auth?.ip_api_key)
      endpoint = `https://pro.ip-api.com/json/${ip}?key=${this.config.auth.ip_api_key}`
    else 
      endpoint = `http://ip-api.com/json/${ip}`
    const headers = { 'accept': 'application/json' }
    const response = await fetch(endpoint, { headers }).catch(e => err=e)
    if(err) return this.throw(err)
    const json = await response.json()
    const result = { geo: json }
    this.$.finish('geo', result)
  }
}

export default GeoAdapterDefault