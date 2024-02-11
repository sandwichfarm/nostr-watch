import { Validator } from '../classes/Validator.js'

export const ConfigDefaults = {
  logLevel: 'info',
  checked_by: '',
  timeout: {
    connect: 10000,
    read: 10000,
    write: 10000,
    info: 10000,
    dns: 2000,
    geo: 2000,
    ssl: 2000
  },
  tor: {},
  adapterOptions: {},
  rejectOnConnectFailure: false
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
  
}