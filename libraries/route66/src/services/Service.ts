import { IEvent } from "@base/interfaces";
import type { ICacheAdapter, IWebsocketAdapter, SubscribeHandlers, WebsocketRequestBody,  WebsocketAdapterOptions } from "@base/core";
import { defaultWebsocketAdapterOptions } from "@base/core";
import { IAdaptersArgument } from "@base/interfaces/IAdaptersArgument";
import { Filter } from "nostr-tools";
import { deterministicHash, isPRE, isRE } from "@base/utils";
import { StateManager } from "@base/managers/StateManager";
import { NostrEvent } from "@base/models";
import { SOURCE } from "@base/models/Event";

export interface IGroupedRelays {
  userMeta?: string[];
  route66?: string[];
  appData?: string[];
}

// export interface WebsocketRequestBody extends WebsocketRequestBody {}

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

  async subscribe(args: WebsocketRequestBody, callbacks?: SubscribeHandlers, nocache: boolean = false): Promise<IEvent[]> {
    await this.ready();
    let { filters, relays, options, hash } = args;
    if(!hash) {
      hash = deterministicHash(args)
    }
    this.subscriptions.add(hash)

    let result: IEvent[] = [];
    
    if(filters && !nocache) {
      let cacheCallbacks: SubscribeHandlers = {}
      if(callbacks) {
        cacheCallbacks = this.addSymbolToCallbacks(callbacks, 'cache');
        this.fetchFromCache(filters, cacheCallbacks);
      }
      else {
        result = this.addSymbolToEvents(await this.fetchFromCache(filters), 'cache');
      }
    }

    let wsCallbacks: SubscribeHandlers = {}
    if(callbacks) {
      callbacks.onclose = (subId: string) => {
        this.subscriptions.delete(subId)
        callbacks?.onclose?.(subId)
      }
      wsCallbacks = this.addSymbolToCallbacks(callbacks, 'ws');
    }
    if(options?.stream === true){
      await this.websocketAdapter.subscribe(args, wsCallbacks);
    }
    else {
      result = this.addSymbolToEvents(await this._fetch(args, wsCallbacks), 'ws');
    }
    if(!options?.keepAlive) {
      this.subscriptions.delete(hash)
    }

    return options?.stream && callbacks? []: result;
  }

  subscribeRelatives(note: IEvent | NostrEvent, relays?: string[], callbacks?: SubscribeHandlers): Promise<IEvent[]> {
    const { id } = note
    const filters: Filter[] = [
        { kinds: [9735, 9321], '#e': [id] },  //zaps
        { kinds: [1, 7, 1111], '#e': [id] },  //commments, mentions
        { kinds: [1111], '#E': [id] }         //NIP-22 comments
    ]
    relays = [ ...(relays || []), 'wss://relay.damus.io' ]
    const options: WebsocketAdapterOptions  = {
        cache: true,
        stream: true,
        returnResults: true,
        keepAlive: false
    }
    const args: WebsocketRequestBody = {
        filters,
        relays,
        options,
        priority: 5
    }
    return this.subscribe(args, callbacks) as Promise<IEvent[]>
  }

  private addSymbolToCallbacks(callbacks: SubscribeHandlers, symbolValue: string): SubscribeHandlers {
    const newCallbacks = {...callbacks}
    newCallbacks.onevent = (event: IEvent) => {
      event[SOURCE] = symbolValue
      callbacks.onevent?.(event)
    }
    newCallbacks.onevents = (events: IEvent[]) => {
      events = events.map( event => {
        event[SOURCE] = symbolValue
        return event
      })
      callbacks.onevents?.(events)
    }
    return newCallbacks;
  }

  private addSymbolToEvents(events: IEvent[], symbolValue: string): IEvent[] {
    return events.map( event => {
      event[SOURCE] = symbolValue
      return event
    })
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

  async fetch(args: WebsocketRequestBody, callbacks?: SubscribeHandlers): Promise<IEvent[]> {
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

    if(cacheEvents?.length){
      StateManager.emit('events', cacheEvents);
      if (callbacks?.onevents) {
        callbacks.onevents(cacheEvents);
      }
      if (callbacks?.onevent) {
        callbacks.onevent(event);
      }
  
    }
    return cacheEvents?.length? cacheEvents: [];
  }

  async fetchFromWebsocket(args: WebsocketRequestBody, callbacks?: SubscribeHandlers): Promise<IEvent[]> {
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
    if(websocketEvents instanceof Array){
      StateManager.emit('events', websocketEvents);
    }
    return websocketEvents instanceof Array ? websocketEvents : [];
  }

  async _fetch(args: WebsocketRequestBody, callbacks?: SubscribeHandlers): Promise<IEvent[]> {
    await this.ready();
    const { relays, options } = args;
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
        StateManager.emit('events', cacheEvents);
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

    if(Object.keys(_callbacks).length === 0) {
      StateManager.emit('events', websocketEvents);
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