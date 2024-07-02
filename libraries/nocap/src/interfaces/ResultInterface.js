export const ResultDefaults = {
  url: "",
  network: "",
  adapters: [],
  checked_at: -1, 
  checked_by: "",
  audit: [],
  open: {},
  read: {},
  write: {},
  info: {},
  dns: {},
  geo: {},
  ssl: {},
}

import { Validator } from '../classes/Validator.js'

export class ResultInterface extends Validator {
  constructor(){
    super()
    Object.assign(this, ResultDefaults)
    this.header_keys = ['url', 'network', 'adapters', 'checked_at', 'checked_by']
    this.defaults = Object.freeze(ResultDefaults)
  }

  cleanResult(k, result={}, ignore=[]){
    if(typeof k === 'string') {
      const { data, duration }  = this.get(k)
      result = { [k]: data, [`${k}_duration`]: duration }
      return result
    }
    else {
      result = {}
      for(const key of k) {
        if(ignore.includes(key)) continue
        const { data, duration } = this.get(key)
        result = { ...result, [key]: data, [`${key}_duration`]: duration }
      }
    }
    return result
  }

  removeFromResult(remove=[]){
    if(!remove.length) return 
    const result = { ...this.result }
    for(const key of remove){
      delete result[key]
      delete result[`${key}_duration`]
    }
    return result
  }

  get(key){
    return this._get(key)
  }

  set(key, value){
    return this._set(key, value)
  }

  did(key){
    switch(key){
      case 'open':
      case'read':
      case 'write':
        return this.get(key).data
    }
  }

  get_ip(protocol='ipv4') {
    return ResultInterface.getIp(this.get('dns'), protocol)
  }

  get_ips(protocol='ipv4') {
    return ResultInterface.getIps(this.get('dns'), protocol)
  }

  raw(keys, ignore=[]){
    keys = keys.filter(key => !ignore.includes(key));
    return this._raw([ ...this.header_keys, ...keys])
  }

  static getIp(dns, protocol){
    const answer = getIps(protocol, dns)
    return answer?.[0] || null
  }

  static getIps(dns, protocol){
    const answer = dns?.raw?.data?.Answer
    if(!answer || !answer.length)
      return []
    const regex = {}
    regex.ipv4 = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    regex.ipv6 = /(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))/;
    return answer.filter(answer => regex[protocol.toLowerCase()].test(answer.data)).map(answer => answer.data) || null;
  }



}