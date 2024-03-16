import { Validator } from '../classes/Validator.js'

export const ConfigDefaults = {
  logLevel: 'info',
  checked_by: '',
  timeout: {
    open: 10000,
    read: 10000,
    write: 10000,
    info: 10000,
    dns: 5000,
    geo: 5000,
    ssl: 5000
  },
  tor: {},
  adapterOptions: {
    websocket: {},
    info: {},
    geo: {},
    dns: {},
    ssl: {}
  },
  autoDepsIgnoredInResult: true,
  removeFromResult: [],
  failAllChecksOnConnectFailure: true,
  rejectOnConnectFailure: false,
  websocketAlwaysTerminate: true
}

/**
 * ConfigInterface 
 * 
 * @class
 * @classdesc Configuration class for Check
 * @param {object} config - The configuration object for the check
 */
export class ConfigInterface extends Validator {
  constructor(config){
    super()
    Object.assign(this, ConfigDefaults, config)
    this.defaults = Object.freeze(ConfigDefaults)
  }

  get(key){
    this._get(key)
  }

  set(key, value){
    this._set(key, value)
  }

  eq(key, value){
    return this._get(key) === value
  }

  gt(key, value){
    try { 
      return this._get(key) > value
    }
    catch(e){
      console.warn(`the value of "key" (arg 1) and the value (arg 2) must both be numbers (int, float)`)
    }
  }

  lt(key, value){
    try { 
      return this._get(key) < value
    }
    catch(e){
      console.warn(`the value of "key" (arg 1) and the value (arg 2) must both be numbers (int, float)`)
    }
  }

  is(key, value){
    return this.eq(key, value)
  }
  
}