import  { RelayCheck } from './Check.js'

export class RelayCheckSsl extends RelayCheck {

  static defaults = {
    ...RelayCheck.defaults,
    valid_from: 0,
    valid_to: 0
  }

  constructor(payload={}) {
    super({ ...RelayCheckSsl.defaults, ...payload })
  }

}