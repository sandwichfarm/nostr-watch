export const ResultDefaults = {
  url: "",
  network: "",
  connect: false,
  read: false,
  write: false,
  readAuth: false,
  writeAuth: false, 
  readAuthType: "",
  writeAuthType: "", 
  connectLatency: -1,
  readLatency: -1,
  writeLatency:  -1,
  info: {},
  infoLatency: -1,
  geo: {},
  geoLatency: -1,
  dns: {},
  dnsLatency: -1,
  ipv4: [],
  ipv6: [],
  ssl: {},
  sslLatency: -1,
  checked_at: null,
}

import { Validator } from '../classes/Validator.js'

export class ResultInterface extends Validator {
  constructor(){
    super()
    Object.assign(this, ResultDefaults)
    this.defaults = Object.freeze(ResultDefaults)
  }
}