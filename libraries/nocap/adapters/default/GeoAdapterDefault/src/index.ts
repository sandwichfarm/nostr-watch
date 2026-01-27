  import { fetch } from 'cross-fetch';
  import { 
    AbstractAdapter, 
    type IResultData, 
    type IAdapter,
    type Nocap as Base,
    AdapterType
  } from '@nostrwatch/nocap';

  const IPV4 = /\b(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g;

  const resultTpl: IResultData = { data: null, duration: -1 };

  const isNodeEnvironment = (): boolean => typeof process !== 'undefined' && process?.versions?.node !== undefined;

  const error = (message: string, data: Record<string, any> = {}): IResultData => {
    const r: IResultData = { ...resultTpl, status: "error", message };
    if (Object.keys(data).length > 0) r.data = data;
    return r;
  };

  export class GeoAdapterDefault extends AbstractAdapter implements IAdapter {

    static type: AdapterType = 'geo';
    readonly slug: string = 'GeoAdapterDefault';
    
    constructor(parent: Base) { 
      super(parent);
    }

    initialize(): void {
      // Initialization logic
    }

    getApiKey(): string | undefined {
      if (isNodeEnvironment()) {
        return this.base?.config?.adapterOptions?.geo?.apiKey || process.env.IP_API_KEY;
      }
      return this.base?.config?.adapterOptions?.geo?.apiKey;
    }

    async getGeoData(ip: string): Promise<any> {
      const API_KEY = this.getApiKey();
      const FIELDS = 'proxy,mobile,timezone,continent,continentCode,country,countryCode,region,regionName,city,district,zip,lat,lon,isp,as,asname,query';
      const endpoint = API_KEY 
        ? `https://pro.ip-api.com/json/${ip}?key=${API_KEY}&fields=${FIELDS}`
        : `http://ip-api.com/json/${ip}?fields=${FIELDS}`;

      try {
        const response = await fetch(endpoint, { headers: { accept: 'application/json' } });
        const jsonResponse = await response.json();
        delete jsonResponse.query;
        delete jsonResponse.status;
        return jsonResponse;
      } catch (e: any) {
        this.base.logger?.error(e.message);
        return null;
      }
    }

    async check_geo(): Promise<void> {
      const result: IResultData = { ...resultTpl, status: "success", data: new Array() };
      const dns = this.base?.results?.get('dns')?.data;
      const hasDns = dns?.ipv4?.length || dns?.ipv6?.length;

      this.base?.logger?.debug(`geo has dns: ${hasDns} - ${JSON.stringify(dns)}`);

      if (IPV4.test(this.base.url)) {
        const ip = this.base.url.match(IPV4)?.[0];
        if (ip) {
          const geoData = await this.getGeoData(ip);
          if (result.data && geoData) {
            (result.data as any[]).push(geoData);
          }
        }
      } else if (!hasDns) {
        result.status = "error";
        result.message = "No DNS data available";
        await this.base.finish('geo', result);
        return 
      } else {
        const ips = [...(dns?.ipv4 || []), ...(dns?.ipv6 || [])];
        for (const ip of ips) {
          const geoData = await this.getGeoData(ip);
          if (geoData) {
            (result.data as any).push(geoData);
          }
        }
      }

      this?.base?.logger?.debug(`geo result: ${JSON.stringify(result)}`); 
      await this.base.finish('geo', result);
      return
    }
  }

  export default GeoAdapterDefault;
