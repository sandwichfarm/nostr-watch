import { fetch } from 'cross-fetch';
import Nocap from "../../../src/classes/Base.ts";

interface GeoResult {
  status: string;
  message?: string;
  data: any;
}

class GeoAdapterDefault {
  private $: Nocap;  // The type should be specified to match the parent object's structure

  constructor(parent: Nocap) {
    this.$ = parent;
  }

  isNodeEnvironment(): boolean {
    return typeof global !== 'undefined' && !!global.process && !!global.process.versions && !!global.process.versions.node;
  }

  getApiKey(): string | undefined {
    if (this.isNodeEnvironment()) {
      return process.env.IP_API_KEY ?? this.$.config.adapterOptions.geo.apiKey;
    } else {
      return this.$.config?.adapterOptions?.geo?.apiKey;
    }
  }

  async check_geo(): Promise<void> {
    let endpoint: string;
    const iparr: string[] | undefined = this.$.results.get('dns')?.data.ipv4;
    if (!iparr || iparr.length === 0) {
      return this.$.finish('geo', { status: "error", message: 'No IP address. Run `dns` check first.', data: {} });
    }
    const ip = iparr[iparr.length - 1];
    const apiKey = this.getApiKey();
    const fields = 'proxy,mobile,timezone,continent,continentCode,country,countryCode,region,regionName,city,district,zip,lat,lon,isp,as,asname,query';
    
    if (typeof ip !== 'string') {
      return this.$.finish('geo', { status: "error", message: 'Invalid IP address format.', data: {} });
    }

    if (apiKey) {
      endpoint = `https://pro.ip-api.com/json/${ip}?key=${apiKey}&fields=${fields}`;
    } else {
      endpoint = `http://ip-api.com/json/${ip}?fields=${fields}`;
    }

    const headers = { 'accept': 'application/json' };
    try {
      const response = await fetch(endpoint, { headers });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const resultData = await response.json();
      delete resultData.query; // Remove query and status from the results if needed
      delete resultData.status;
      const result: GeoResult = { status: "success", data: resultData };
      this.$.finish('geo', result);
    } catch (error) {
      this.$.logger.warn(`Geo check failed: ${error}`);
      this.$.finish('geo', { status: "error", message: error.message, data: {} });
    }
  }
}

export default GeoAdapterDefault;
