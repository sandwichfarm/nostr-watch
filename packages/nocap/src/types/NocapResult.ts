import { Validator } from '../classes/Validator.js'

// Define default values for RelayResult properties
export const NocapResultDefaults = {
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
  writeLatency: -1,
  info: {},
  infoLatency: -1,
  geo: {},
  geoLatency: -1,
  dns: {},
  dnsLatency: -1,
  ipv4: [] as string[],
  ipv6: [] as string[],
  ssl: {},
  sslLatency: -1,
  checked_at: null as Date | null,
};

// Infer the type for RelayResult properties from the defaults
export type NocapResultType = typeof NocapResultDefaults;

// RelayResult class
export class NocapResult extends Validator {
  url: string;
  network: string;
  connect: boolean;
  read: boolean;
  write: boolean;
  readAuth: boolean;
  writeAuth: boolean;
  readAuthType: string;
  writeAuthType: string;
  connectLatency: number;
  readLatency: number;
  writeLatency: number;
  info: object;
  infoLatency: number;
  geo: object;
  geoLatency: number;
  dns: object;
  dnsLatency: number;
  ipv4: string[];
  ipv6: string[];
  ssl: object;
  sslLatency: number;
  checked_at: Date | null;

  constructor() {
    super()
    this.setDefaults(NocapResultDefaults)
    Object.assign(this, this.defaults);
  }
}
