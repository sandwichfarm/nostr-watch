import { Schema } from './Schema.class.js'

export class RelayCheck extends Schema {
  
  static defaults = {
    url: '',
    relay_id: '',
    checked_at: '',
    data: '',
    hash: ''
  }

  constructor(payload={}) {
    super({...RelayCheck.defaults, ...payload})
  }
}