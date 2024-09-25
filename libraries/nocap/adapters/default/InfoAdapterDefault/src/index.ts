import fetch from 'cross-fetch';
import { 
  AbstractAdapter, 
  type IResultData,
  type IAdapter,
  type Nocap as Base
} from '@nostrwatch/nocap';

const resultTpl: IResultData = { data: null, duration: -1 };

const error = (message: string, data: Record<string, any> = {}): IResultData => {
  const r: IResultData = { ...resultTpl, status: "error", message };
  if (Object.keys(data).length > 0) r.data = data;
  return r;
};

export class InfoAdapterDefault extends AbstractAdapter implements IAdapter {
  
  constructor(parent: Base) { 
    super(parent);
  }

  initialize(): void {}

  async check_info(): Promise<void> {
    let result: IResultData = { data: null, duration: -1, status: "error", message: "Unknown error" };
    let data: Record<string, any> = {};
    
    const controller = new AbortController();
    const { signal } = controller;
    const url = new URL(this.base.url);
    const headers = { "Accept": "application/nostr+json" };
    const method = 'GET';

    if (this?.base?.results?.get('network') === 'tor') {
      url.protocol = 'onion:';
    } else if (url.protocol === 'ws:') {
      url.protocol = 'http:';
    } else if (url.protocol === 'wss:') {
      url.protocol = 'https:';
    }

    try {
      const response = await fetch(url.toString(), { method, headers, signal }).catch((e) => {
        result = error(e.message, data);
        return null;
      });

      if (response) {
        data = await response.json();
        result = { 
          ...resultTpl,
          status: "success",
          data
        };
      }
    } catch (e) {
      result = error((e as Error).message, data);
    }
    
    this.base.finish('info', result);
    return 
  }
}

export default InfoAdapterDefault;