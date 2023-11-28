import { Validator } from '../classes/Validator.js'

export const ConfigDefaults = {
  logLevel: 'info',
  connectTimeout: 5000,
  readTimeout: 5000,
  writeTimeout: 5000,
  infoTimeout: 5000,
  dnsTimeout: 5000,
  geoTimeout: 5000
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
}