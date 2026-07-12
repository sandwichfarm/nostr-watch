import fetch from 'cross-fetch';
// import { torfetch } from '@sandwichfarm/torfetch'

import { 
  AbstractAdapter, 
  type IResultData,
  type IAdapter,
  type Nocap as Base,
  AdapterType
} from '@nostrwatch/nocap';

const resultTpl: IResultData = { data: null, duration: -1 };
const NIP11_MAX_BODY_BYTES = 128 * 1024;

const error = (message: string, data: Record<string, any> = {}): IResultData => {
  const r: IResultData = { ...resultTpl, status: "error", message };
  if (Object.keys(data).length > 0) r.data = data;
  return r;
};

const isJsonContentType = (contentType: string): boolean => {
  const mime = contentType.split(';', 1)[0]?.trim().toLowerCase() ?? '';
  return mime === 'application/json' || mime === 'text/json' || mime.endsWith('+json');
};

const readBodyWithLimit = async (response: Response): Promise<string> => {
  const contentLength = response.headers.get('content-length');
  if (contentLength && Number(contentLength) > NIP11_MAX_BODY_BYTES) {
    throw new Error(`NIP-11 response exceeds ${NIP11_MAX_BODY_BYTES} bytes.`);
  }

  const body = await response.text();
  if (new TextEncoder().encode(body).byteLength > NIP11_MAX_BODY_BYTES) {
    throw new Error(`NIP-11 response exceeds ${NIP11_MAX_BODY_BYTES} bytes.`);
  }
  return body;
};

export class InfoAdapterDefault extends AbstractAdapter implements IAdapter {

  static type: AdapterType = 'info';
  readonly slug: string = 'InfoAdapterDefault';
  
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
    const network = this?.base?.results?.get('network')
    const requestInit = {
      method,
      headers,
      signal,
      redirect: 'error' as const,
      credentials: 'omit' as const,
      referrerPolicy: 'no-referrer' as const,
      cache: 'no-store' as const
    };

    if (url.protocol === 'ws:') {
      url.protocol = 'http:';
    } else if (url.protocol === 'wss:') {
      url.protocol = 'https:';
    }

    try {
      let response;
      if(network === 'tor') {
        response = await fetch(url.toString(), requestInit).catch((e) => {
          result = error(e.message, data);
          return null;
        });
        // response = await torfetch(url.toString(), { method, headers, signal }).catch((e) => {
        //   result = error(e.message, data);
        //   return null;
        // });
      } else {  
        response = await fetch(url.toString(), requestInit).catch((e) => {
          result = error(e.message, data);
          return null;
        });
      }
      if (response) {
        const contentType = response.headers.get('content-type')?.trim() ?? '';
        if (!response.ok || response.redirected) {
          result = error(`NIP-11 request failed with HTTP ${response.status}.`, data);
        } else if (contentType && !isJsonContentType(contentType)) {
          result = error(`Unsupported NIP-11 content-type: ${contentType}`, data);
        } else {
          const body = await readBodyWithLimit(response);
          const parsed = JSON.parse(body);
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            result = error('NIP-11 response must be a JSON object.', data);
          } else {
            data = parsed;
            result = {
              ...resultTpl,
              status: "success",
              data
            };
          }
        }
      }
    } catch (e) {
      result = error((e as Error).message, data);
    }
    
    this.base.finish('info', result);
    return 
  }
}

export default InfoAdapterDefault;
