import { Validator } from '../classes/Validator.js'

export const NocapConfigDefaults = {
  connectTimeout: 5000,
  readTimeout: 5000,
  writeTimeout: 5000,
  infoTimeout: 5000,
  dnsTimeout: 5000,
  geoTimeout: 5000
};

export type NocapConfigType = typeof NocapConfigDefaults;

export class NocapConfig extends Validator {
  connectTimeout: number;
  readTimeout: number;
  writeTimeout: number;
  infoTimeout: number;
  dnsTimeout: number;
  geoTimeout: number;

  constructor(config?: Partial<NocapConfigType>) {
    super()
    this.setDefaults(NocapConfigDefaults)
    Object.assign(this, this.defaults, config);
  }
}