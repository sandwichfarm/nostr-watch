import { fetch } from 'cross-fetch'

 class GeoAdapterDefault {
  constructor(parent){
    this.$ = parent
  }

  async check_geo(){ 
    let endpoint 
    const iparr = this.$.results.get('dns')?.data.ipv4
    const ip = iparr[iparr.length-1]
    const apiKey = typeof process !== 'undefined' && process?.env?.IP_API_KEY? process.env.IP_API_KEY: this.$.config.adapterOptions.geo.apiKey
    //todo, enable override via options
    const fields = 'proxy,mobile,timezone,continent,continentCode,country,countryCode,region,regionName,city,district,zip,lat,lon,isp,as,asname,query'
    if(typeof ip !== 'string')
      return this.$.finish('geo', { status: "error", message: 'No IP address. Run `dns` check first.', data: {} })
    if(apiKey)
      endpoint = `https://pro.ip-api.com/json/${ip}?key=${apiKey}&fields=${fields}`
    else 
      endpoint = `http://ip-api.com/json/${ip}?fields=${fields}`
    const headers = { 'accept': 'application/json' }
    const response = await fetch(endpoint, { headers }).catch(this.$.logger.warn)
    delete response.query
    delete response.status
    const result = { status: "success", data: await response.json() }
    this.$.finish('geo', result)
  }
}

export default GeoAdapterDefault