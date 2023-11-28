// import fetch from 'cross-fetch'
import { fetch } from 'fetch-h2'
import doh from 'dohjs'

class DnsAdapterDefault {
  constructor(parent){ 
    this.$ = parent
  }
  async check_dns(){ 
    let result, data = {}
    if(this.$.results.get('network') !== 'clearnet')
      return this.$.logger.warn('DNS check skipped for url not accessible over clearnet')
    let err = false
    let url = this.$.url.replace('wss://', '').replace('ws://', '')
    const query = `https://1.1.1.1/dns-query?name=${url}`
    const headers = { accept: 'application/dns-json' }
    const response = await fetch( query, { headers } ).catch((e) => { result = { status: "error", message: e.message, data } })
    data = await response.json()
    if(!result)
      result = { status: "success", data }
    this.$.finish('dns', result)
  } 

  filterIPv4FromDoh(jsonData) {
    const ipv4Regex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return jsonData.Answer.filter(answer => ipv4Regex.test(answer.data)).map(answer => answer.data) || null;
  }

  filterIPv6FromDoh(jsonData) {
    const ipv6Regex = /(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))/;
    return jsonData.Answer.filter(answer => ipv6Regex.test(answer.data)).map(answer => answer.data) || null;
  }

}

export default DnsAdapterDefault