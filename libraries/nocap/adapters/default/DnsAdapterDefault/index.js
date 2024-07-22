import fetch from 'cross-fetch'

const IPV4 = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
const IPV6 = /(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))/;


class DnsAdapterDefault {
  constructor(parent){ 
    this.$ = parent
  }
  async check_dns(){ 
    let result = {}, data = {}
    if(this.$.results.get('network') !== 'clearnet')
      return this.$.logger.debug('DNS check skipped for url not accessible over clearnet')
    let err = false
    let Url = new URL(this.$.url)
    let url = `${Url.protocol}//${Url.host}`.replace('wss://', '').replace('ws://', '').replace(/\/+$/, '');
    const query = `https://1.1.1.1/dns-query?name=${url}`
    const headers = { accept: 'application/dns-json' }
    const response = await fetch( query, { headers } ).catch((e) => { result = { status: "error", message: e.message, data } })   
    data = await response.json()
    data.ipv4 = getIpv4(data)
    data.ipv6 = getIpv6(data)
    if(!data?.Answer || data.Answer.length === 0 || Object.keys(data.Answer[0]) === 0)
      result = { status: "error", message: "No DNS Answer" }
    else
      result = { 
        status: "success",
        data
      }
    this.$.finish('dns', result)
  } 

}

const getIpv4 = (jsonData) => {
  return jsonData.Answer?.filter(answer => IPV4.test(answer.data)).map(answer => answer.data) || null;
}

const getIpv6 = (jsonData) => {
  return jsonData.Answer?.filter(answer => IPV6.test(answer.data)).map(answer => answer.data) || null;
}

export default DnsAdapterDefault