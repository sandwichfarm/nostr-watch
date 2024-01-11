import { fetch } from 'cross-fetch'

 class GeoAdapterDefault {
  constructor(parent){
    this.$ = parent
  }

  async check_geo(){ 
    let endpoint 
    const ips = this.$.results.getIps('ipv4')
    const ip = ips[ips?.length-1]
    const apiKey = process.env?.IP_API_KEY
    //todo, enable override via options
    const fields = 'continent,continentCode,countryCode,regionName,city,lat,lon,isp,as,asname,query'
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