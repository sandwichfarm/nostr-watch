export const ResultDefaults = {
  url: "",
  network: "",
  adapters: [],
  checked_at: -1, 
  checked_by: "",
  connect: {},
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

  cleanResult(k, result={}){
    if(typeof k === 'string') {
      const { data, duration }  = this.get(k)
      result = { [k]: data, [`${k}_duration`]: duration }
      return result
    }
    else {
      result = {}
      for(const key of k) {
        const { data, duration } = this.get(key)
        result = { ...result, [key]: data, [`${key}_duration`]: duration }
      }
    }
    return result
  }

  get(key){
    // switch(key){
    //   case "url":
    //   case "checked_at":
    //   case "adapters":
    //   case "network":
    //   case "connect":
    //   case "read":
    //   case "write":
    //     return this._get(key)
    //   default:
    //     return this._get(key).data
    // }
    return this._get(key)
  }

  set(key, value){
    return this._set(key, value)
  }

  did(key){
    switch(key){
      case 'connect':
      case'read':
      case 'write':
        return this.get(key).data
    }
  }

  getIps(protocol='ipv4') {
    const answer = this.get('dns')?.Answer
    if(!answer || !answer.length)
      return []
    const regex = {}
    regex.ipv4 = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    regex.ipv6 = /(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))/;
    return answer.filter(answer => regex[protocol.toLowerCase()].test(answer.data)).map(answer => answer.data) || null;
  }

  raw(keys){
    return this._raw([ ...this.header_keys, ...keys])
  }

}