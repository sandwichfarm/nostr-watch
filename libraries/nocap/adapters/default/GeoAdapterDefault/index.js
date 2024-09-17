import { fetch } from 'cross-fetch'

const IPV4 = /\b(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g;


 class GeoAdapterDefault {
  constructor(parent){
    this.$ = parent
  }

  isNodeEnvironment() {
    return typeof global !== 'undefined' && global?.process?.versions?.node;
  }

  getApiKey() {
    if (this.isNodeEnvironment()) {
      return process.env.IP_API_KEY ? process.env.IP_API_KEY : this.$.config.adapterOptions.geo.apiKey;
    } else {
      return this.$.config.adapterOptions.geo.apiKey;
    }
  }

  async getGeoData(ip){
    const API_KEY = this.getApiKey();
    const FIELDS = 'proxy,mobile,timezone,continent,continentCode,country,countryCode,region,regionName,city,district,zip,lat,lon,isp,as,asname,query'

    let response; 
    let endpoint;

    if(API_KEY)
      endpoint = `https://pro.ip-api.com/json/${ip}?key=${API_KEY}&fields=${FIELDS}`
    else 
      endpoint = `http://ip-api.com/json/${ip}?fields=${FIELDS}`

    response = await fetch(endpoint, { 'accept': 'application/json' }).catch(this.$.logger.error)

    delete response.query
    delete response.status

    return response.json()
  }

  getGeo() {
    return this.$.config.adapterOptions.geo.api;
  }

  async check_geo(){ 
    
    const result = { status: "success", data: [] }
    const dns = this.$.results.get('dns')?.data
    const hasDns = dns?.ipv4?.length || dns?.ipv6?.length
    
    this.$.logger.debug(`geo has dns: ${hasDns} - ${JSON.stringify(dns)}`)

    if(IPV4.test(this.$.url)) {
      const ip = this.$.url.match(IPV4)[0]; 
      result.data.push(await this.getGeoData(ip))
    } 
    else if(!hasDns) {
      return this.$.finish('geo', result)
    }
    else {
      const ips = [...dns?.ipv4||[], ...dns?.ipv6||[]]
      for(const ip of ips) {
        result.data.push(await this.getGeoData(ip))
      }
    }

    this.$.logger.debug(`geo result: ${result}`)
    this.$.finish('geo', result)
  }
}

export default GeoAdapterDefault