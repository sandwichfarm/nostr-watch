import fetch from 'cross-fetch';
import { 
  AbstractAdapter, 
  type IResult, 
  type IAdapter,
  type Nocap as Base,
  type IResultData,
  AdapterType
} from '@nostrwatch/nocap';

const resultTpl: IResultData = { data: null, duration: -1 };

// Regular Expressions for IP Validation
const IPV4 = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
const IPV6 = /(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))/;

// Helper Functions
const getIpv4 = (jsonData: any): string[] | null => {
  return jsonData.Answer?.filter((answer: any) => IPV4.test(answer.data)).map((answer: any) => answer.data) || null;
};

const getIpv6 = (jsonData: any): string[] | null => {
  return jsonData.Answer?.filter((answer: any) => IPV6.test(answer.data)).map((answer: any) => answer.data) || null;
};

const error = (message: string, data: Record<string, any> = {}): IResultData => {
  const r: IResultData = { ...resultTpl, status: "error", message };
  if (Object.keys(data).length > 0) r.data = data;
  return r;
};

export class DnsAdapterDefault extends AbstractAdapter implements IAdapter {

  static type: AdapterType = 'dns';
  readonly slug: string = 'DnsAdapterDefault';
  
  constructor(parent: Base){ 
    super(parent);
  }

  initialize(): void {
    // Any initialization logic if necessary
  }

  async check_dns(): Promise<void> { 
    let result: IResultData = { data: null, duration: -1, status: "error", message: "Unknown error" };
    let data: Record<string, any> = {};
    let urlIsIp = false;

    try {
      const Url = new URL(this.base.url);
      const host = Url.hostname;
      const network = this.base?.results?.get('network')

      if(network !== 'clearnet') {
        this.base.logger?.debug('DNS check skipped for URL not accessible over clearnet');
        const result = { ...resultTpl, status: "error", message: "Relay is not clearnet, cannot check DNS." };
        this.base.finish('dns', result);
      }

      if(IPV4.test(host)) {
        urlIsIp = true;
        data.ipv4 = [this.base.url];
      }
      else if(IPV6.test(host)) {
        urlIsIp = true;
        data.ipv6 = [];
      }

      if(!urlIsIp) {
        const sanitizedUrl = `${Url.protocol}//${Url.hostname}`.replace('wss://', '').replace('ws://', '').replace(/\/+$/, '');
        const query = `https://1.1.1.1/dns-query?name=${sanitizedUrl}`;
        const headers = { accept: 'application/dns-json' };

        const response = await fetch(query, {
          headers,
          redirect: 'error',
          credentials: 'omit',
          referrerPolicy: 'no-referrer',
          cache: 'no-store'
        }).catch((e) => { result = error(e.message, data); return null; });
        
        if (response) {
          const jsonData = await response.json();
          data = jsonData;
          data.ipv4 = getIpv4(jsonData);
          data.ipv6 = getIpv6(jsonData);
        }
      }

      if(!urlIsIp && (!data?.Answer || data.Answer.length === 0 || Object.keys(data.Answer[0]).length === 0) )
        result = error("No DNS Answer");
      else
        result = { 
          ...resultTpl,
          status: "success",
          data
        };
    }
    catch(e){
      result = error((e as Error).message);
    }

    this.base.finish('dns', result);
    return
  } 

}

export default DnsAdapterDefault;
