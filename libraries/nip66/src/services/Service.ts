import { IEvent } from "@base/interfaces";
import { defaultWebsocketAdapterOptions, ICacheAdapter, IWebsocketAdapter, SubscribeHandlers, WebsocketRequestBody, type WebsocketAdapterOptions } from "@base/core";
import { IAdaptersArgument } from "@base/interfaces/IAdaptersArgument";
import { Filter } from "nostr-tools";
import { EventEmitter } from "tseep";
import { isPRE, isRE } from "@base/utils";

type EventHandler = (event: IEvent) => any;

export interface FetchOptions extends WebsocketRequestBody {}

export class Service {
  protected cacheAdapter: ICacheAdapter;
  protected websocketAdapter: IWebsocketAdapter;
  emitter: EventEmitter;

  constructor(adapters: IAdaptersArgument, emitter: EventEmitter) {
    this.cacheAdapter = adapters.cacheAdapter;
    this.websocketAdapter = adapters.websocketAdapter;
    this.emitter = emitter;
  }

  async modifyCacheFilters(filters: Filter[]): Promise<Filter[]> {
    console.warn('modifyCacheFilters not implemented');
    return filters;
  }

  async modifyWebsocketFilters(filters: Filter[]): Promise<Filter[]> {
    console.warn('modifyWebsocketFilters not implemented');
    return filters;
  }

  async _fetch(args: FetchOptions, callbacks?: SubscribeHandlers): Promise<IEvent[]> {
    const { filters, relays, options } = args;
    
    const events = new Map<string, IEvent>();
  
    const generateId = (event: IEvent): string | undefined => {
      if (isPRE(event)) {
        const dtagv = event.tags.find(t => t[0] === 'd')?.[1];
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
  
    // Check cache
    const cacheEvents = await this.cacheAdapter.REQ(await this.modifyCacheFilters(filters));
    if (callbacks?.onevents) callbacks.onevents(cacheEvents);
    if (callbacks?.onevent) {
      for (const event of cacheEvents) {
        callbacks.onevent(event);
      }
    }
  
    cacheEvents.forEach(maybeAddEventToMap);
  
    // Prepare relay callbacks
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
  
    // Check relays
    const websocketEvents: IEvent[] = await this.websocketAdapter.fetch(
      {
        relays: relays || [],
        filters: await this.modifyWebsocketFilters(filters),
        options: options || defaultWebsocketAdapterOptions,
      },
      _callbacks
    ) as IEvent[];

    if(websocketEvents instanceof Array) {
      websocketEvents.forEach(maybeAddEventToMap);
    }
    return Array.from(events.values());
  }
  
}