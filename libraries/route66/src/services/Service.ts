import { IEvent } from "@base/interfaces";
import type { ICacheAdapter, IWebsocketAdapter, SubscribeHandlers, WebsocketRequestBody,  WebsocketAdapterOptions } from "@base/core";
import { defaultWebsocketAdapterOptions } from "@base/core";
import { IAdaptersArgument } from "@base/interfaces/IAdaptersArgument";
import { Filter } from "nostr-tools";
import { deterministicHash, isPRE, isRE } from "@base/utils";

export interface IGroupedRelays {
  userMeta?: string[];
  route66?: string[];
  appData?: string[];
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
  protected _subscriptions: Set<string> = new Set();

  constructor(adapters: IAdaptersArgument) {
    this.cacheAdapter = adapters.cacheAdapter;
    this.websocketAdapter = adapters.websocketAdapter;
  }

  get adapter(): ServiceAdaptersTypes {
    return { cache: this.cacheAdapter, websocket: this.websocketAdapter };
  }

  get nip66Relays(): string[] {
    return this._groupedRelays?.route66 || [];
  }

  get userMetaRelays(): string[]{
    return this._groupedRelays?.userMeta || [];
  }

  get subscriptions(): Set<string> {
    return this._subscriptions;
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

  async publish(args: WebsocketRequestBody): Promise<boolean> {
    await this.ready();
    let { hash, note, relays } = args
    if(!note) return false;
    if(!hash) {
      hash = note.id.slice(0, 21)
    }
    this.subscriptions.add(hash)
    await this.websocketAdapter.publish({ note, relays, hash });
    this.subscriptions.delete(hash)
    return false;
  }

  async subscribe(args: FetchOptions, callbacks?: SubscribeHandlers): Promise<IEvent[]> {
    await this.ready();
    let { filters, relays, options, hash } = args;
    if(!hash) {
      hash = deterministicHash(args)
    }
    this.subscriptions.add(hash)
    if(filters) {
      this.fetchFromCache(filters, callbacks);
    }
    if(callbacks) {
      callbacks.onclose = (subId: string) => {
        this.subscriptions.delete(subId)
        callbacks?.onclose?.(subId)
      }
    }
    const message: WebsocketRequestBody = { filters, relays, options, hash };
    const result = await this.websocketAdapter.subscribe(message, callbacks);
    if(!options?.keepAlive) {
      this.subscriptions.delete(hash)
    }
    return typeof result === 'boolean'? []: result;
  }

  async unsubscribe(hash: string) {
    await this.ready();
    this.websocketAdapter.unsubscribe(hash);
  }

  async unsubscribeMany(hashes: string[]) {
    await this.ready();
    hashes.forEach((hash) => {
      this.unsubscribe(hash);
    })
  }

  async unsubscribeAllActive(){
    await this.ready();
    this.subscriptions.forEach((hash) => {
      this.unsubscribe(hash);
    })
  }

  async unsubscribeAll(){
    await this.ready();
    this.websocketAdapter.unsubscribeAll();
  }

  async fetch(args: FetchOptions, callbacks?: SubscribeHandlers): Promise<IEvent[]> {
    await this.ready();
    if(!args.hash) {  
      args.hash = deterministicHash(args);
    }
    this.subscriptions.add(args.hash)
    const results = await this._fetch(args, callbacks);
    this.subscriptions.delete(args.hash)
    return results;
  }

  async countFromCache(filters: Filter[]): Promise<number> {
    await this.ready();
    return this.cacheAdapter.COUNT(filters);
  }

  async fetchFromCache(filters: Filter[], callbacks?: SubscribeHandlers): Promise<IEvent[]> {
    await this.ready();
    let cacheEvents: IEvent[] = [];
    cacheEvents = await this.cacheAdapter.REQ(filters);

    // if(cacheEvents.length){
      // console.log('cache hit', cacheEvents.length, filters)
    // }

    if (callbacks?.onevents) {
        callbacks.onevents(cacheEvents);
    }
    if (callbacks?.onevent) {
        for (const event of cacheEvents) {
            callbacks.onevent(event);
        }
    }

    return cacheEvents;
  }

  async fetchFromWebsocket(args: FetchOptions, callbacks?: SubscribeHandlers): Promise<IEvent[]> {
    await this.ready();
    // console.log('Service.fetchFromWebsocket: ready', args);
    const { relays, filters, options } = args;
    const websocketEvents: IEvent[] = await this.websocketAdapter.fetch(
        {
            relays: relays || [],
            filters,
            options: options || defaultWebsocketAdapterOptions,
        },
        callbacks
    ) as IEvent[];

    return websocketEvents instanceof Array ? websocketEvents : [];
  }

  async _fetch(args: FetchOptions, callbacks?: SubscribeHandlers): Promise<IEvent[]> {
    await this.ready();
    const { relays, options, sync } = args;
    let { filters } = args;
    let { returnResults } = options;

    filters = filters ?? [];

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

    if (sync) {
        filters = await this.modifyCacheFilters(filters);
    }

    const cacheEvents = await this.fetchFromCache(filters, callbacks);

    if(cacheEvents.length > 0) {
      cacheEvents.forEach(maybeAddEventToMap);
    }

    const _callbacks: SubscribeHandlers = {};

    if (callbacks?.onevent) {
        _callbacks.onevent = (event: IEvent) => {
            if (maybeAddEventToMap(event)) callbacks.onevent!(event);
        };
    }

    if (callbacks?.onevents) {
        _callbacks.onevents = (batch: IEvent[]) => {
            const newEvents: IEvent[] = [];
            for (const event of batch) {
                if (maybeAddEventToMap(event)) newEvents.push(event);
            }
            if (newEvents.length > 0) callbacks.onevents!(newEvents);
        };
    }

    const websocketEvents = await this.fetchFromWebsocket(args, _callbacks);
    websocketEvents.forEach(maybeAddEventToMap);

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