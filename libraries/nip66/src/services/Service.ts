import { IEvent } from "@base/interfaces";
import type { ICacheAdapter, IWebsocketAdapter, SubscribeHandlers, WebsocketRequestBody,  WebsocketAdapterOptions } from "@base/core";
import { defaultWebsocketAdapterOptions } from "@base/core";
import { IAdaptersArgument } from "@base/interfaces/IAdaptersArgument";
import { Filter } from "nostr-tools";
import { EventEmitter } from "tseep";
import { isPRE, isRE } from "@base/utils";

type EventHandler = (event: IEvent) => any;

export interface IGroupedRelays {
  userMeta?: string[];
  nip66?: string[];
}

export interface FetchOptions extends WebsocketRequestBody {
  sync?: boolean;
}

export type ServiceAdaptersTypes = {
  cache: ICacheAdapter;
  websocket: IWebsocketAdapter;
}

export class Service {
  protected cacheAdapter: ICacheAdapter;
  protected websocketAdapter: IWebsocketAdapter;
  protected _groupedRelays: IGroupedRelays = {};
  protected _ready: boolean = false;

  constructor(adapters: IAdaptersArgument) {
    this.cacheAdapter = adapters.cacheAdapter;
    this.websocketAdapter = adapters.websocketAdapter;
  }

  get adapter(): ServiceAdaptersTypes {
    return { cache: this.cacheAdapter, websocket: this.websocketAdapter };
  }

  get nip66Relays(): string[] {
    return this._groupedRelays?.nip66 || [];
  }

  get userMetaRelays(): string[]{
    return this._groupedRelays?.userMeta || [];
  }

  async ready(): Promise<void> {
    while (!this._ready) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  async modifyCacheFilters(filters: Filter[]): Promise<Filter[]> {
    console.warn('modifyCacheFilters not implemented');
    return filters;
  }

  async modifyWebsocketFilters(filters: Filter[]): Promise<Filter[]> {
    console.warn('modifyWebsocketFilters not implemented');
    return filters;
  }

  async subscribe(args: FetchOptions, callbacks?: SubscribeHandlers): Promise<IEvent[] | boolean | undefined> {
    const { filters, relays, options } = args;
    const message: WebsocketRequestBody = { filters, relays, options };
    const result = await this.websocketAdapter.subscribe(message, callbacks);
    return result;
  }

  async fetch(args: FetchOptions, callbacks?: SubscribeHandlers): Promise<IEvent[] | boolean | undefined> {
    console.warn('Service.fetch() not implemented');
    return this._fetch(args, callbacks);
  }

  async _fetch(args: FetchOptions, callbacks?: SubscribeHandlers): Promise<IEvent[]> {
    const { relays, options, sync } = args;
    let { filters } = args
    let { returnResults } = options
    
    const events = new Map<string, IEvent>();
  
    const generateId = (event: IEvent): string | undefined => {
      if (isPRE(event)) {
        const dtagv = event.tags.find((t: string[]) => t[0] === 'd')?.[1];
        return dtagv ? `${event.pubkey}:${event.kind}:${dtagv}` : undefined;
      }
      return isRE(event) ? `${event.pubkey}:${event.kind}` : event.id;
    };
  
    const maybeAddEventToMap = (event: IEvent): boolean => {
      const id = generateId(event);
      if (!id || events.has(id)) return false;
      events.set(id, event);
      return true;
    };

    if(sync){
      filters = await this.modifyCacheFilters(filters)
    }
    let cacheEvents: IEvent[] = [];
    let highestTimestampPerPubkey: Map<string, number> = new Map();
    // if(returnResults) {
      cacheEvents = await this.cacheAdapter.REQ(filters);
      highestTimestampPerPubkey = cacheEvents.reduce((acc, event) => {
        const timestamp = event.created_at as number;
        if (!acc.has(event.pubkey) || acc.get(event.pubkey)! < timestamp) {
          acc.set(event.pubkey, timestamp);
        }
        return acc;
      }, new Map())

      if (callbacks?.onevents) {
        callbacks.onevents(cacheEvents);
      }
      if (callbacks?.onevent) {
        for (const event of cacheEvents) {
          callbacks.onevent(event);
        }
      }
      cacheEvents.forEach(maybeAddEventToMap);
    // }
  
    const _callbacks: SubscribeHandlers = {};
  
    if (callbacks?.onevent) {
      _callbacks.onevent = (event: IEvent) => {
        if (maybeAddEventToMap(event)) callbacks.onevent!(event);
      };
    }
  
    if (callbacks?.onevents) {
      _callbacks.onevents = (batch: IEvent[]) => {
        const newEvents = [];
        for (const event of batch) {
          if (maybeAddEventToMap(event)) newEvents.push(event);
        }
        if (newEvents.length > 0) callbacks.onevents!(newEvents);
      };
    }

    if(sync){
      // filters = filters.map((filter: Filter) => {
      //   const author = filter.authors?.[0]
      //   if(!author) return filter;
      //   filter.since = highestTimestampPerPubkey.get(author) || filter.since;
      //   filter.until = Math.round(Date.now() / 1000);
      //   return filter;
      // })
    }
  
    const websocketEvents: IEvent[] = await this.websocketAdapter.fetch(
      {
        relays: relays || [],
        filters,
        options: options || defaultWebsocketAdapterOptions,
      },
      _callbacks
    ) as IEvent[];

    if(websocketEvents instanceof Array) {
      websocketEvents.forEach(maybeAddEventToMap);
    }
    const finalEvents = Array.from(events.values());
    return this.modifyReturnedEvents(finalEvents);
  }

  async modifyReturnedEvents(events: IEvent[]): Promise<IEvent[]> {
    console.warn('modifyReturnedEvents not implemented');
    return events;
  }

  addRelay(to: keyof IGroupedRelays, relay: string): void {
    if (!this._groupedRelays?.[to]) this._groupedRelays[to] = [];
    this._groupedRelays?.[to].push(relay);
  }

  removeRelay(from: keyof IGroupedRelays, relay: string): void {
    if (!this._groupedRelays?.[from]) return;
    this._groupedRelays[from] = this._groupedRelays[from].filter((r) => r !== relay);
  }
  
}