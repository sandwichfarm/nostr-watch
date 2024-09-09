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

  async check_geo(){ 
    let endpoint 
    let ip
    const result = { status: "success", data: {} }
    const dns = this.$.results.get('dns')?.data
    const hasDns = dns?.ipv4.length || dns?.ipv6.length
    this.$.logger.debug(`geo has dns: ${hasDns} - ${JSON.stringify(dns)}`)

    if(IPV4.test(this.$.url)) {
      ip = this.$.url.match(IPV4)[0]; 
    } 
    else if(!hasDns) {
      return this.$.finish('geo', result)
    }
    else {
      const iparr = dns?.ipv4
      ip = iparr[iparr?.length-1]
    }
    this.$.logger.debug(`geo ip: ${ip}`)

    const apiKey = this.getApiKey();
    this.$.logger.debug(`geo api key: ${apiKey}`)
    
    //todo, enable override via options
    const fields = 'proxy,mobile,timezone,continent,continentCode,country,countryCode,region,regionName,city,district,zip,lat,lon,isp,as,asname,query'
    if(typeof ip !== 'string')
      return this.$.finish('geo', { status: "error", message: 'No IP address. Run `dns` check first.', data: {} })
    if(apiKey)
      endpoint = `https://pro.ip-api.com/json/${ip}?key=${apiKey}&fields=${fields}`
    else 
      endpoint = `http://ip-api.com/json/${ip}?fields=${fields}`
    const headers = { 'accept': 'application/json' }
    const response = await fetch(endpoint, { headers }).catch(this.$.logger.error)
    delete response.query
    delete response.status
    result.data = await response.json()

    this.$.logger.debug(`geo result: ${result}`)
    this.$.finish('geo', result)
  }
}

export default GeoAdapterDefault