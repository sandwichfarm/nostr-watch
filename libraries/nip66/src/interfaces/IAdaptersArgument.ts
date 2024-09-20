import { ICacheAdapter } from '@base/core/CacheAdapter';
import { IWebsocketAdapter } from '@base/core/WebsocketAdapter';

export interface IAdaptersArgument {
  cacheAdapter: ICacheAdapter;
  websocketAdapter: IWebsocketAdapter;
}