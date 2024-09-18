import { IWebsocketAdapterMethods, IWebsocketAdapterCallbacks } from '@nostrwatch/nip66/core'
import { IEvent } from '@nostrwatch/nip66/interfaces';

import { NostrFetcher, type FetchFilter } from 'nostr-fetch';
import { simplePoolAdapter } from '@nostr-fetch/adapter-nostr-tools-v2'
import { SimplePool } from 'nostr-tools';
import type { Filter } from 'nostr-tools';
import { isForInStatement } from 'typescript';
import { SubCloser } from 'nostr-tools/abstract-pool';

//10166: 1
//0,10002: 10
//30166: 20

export interface NostrToolsSubscribeParams {
  //reqd
  filters: Filter[] | Filter
  stream?: boolean 
  keepAlive?: boolean 
  //nt callbacks
  callbacks?: SubscribeHandlers
  signal?: AbortSignal
  //following are ignored if callbacks are provided
}

const nostrToolsSubscribeParams: NostrToolsSubscribeParams = {
  filters: [],
  stream: true
}

export interface SubscribeHandlers {
  onevent?: (event: any) => void
  oneose?: () => void
  onclose?: () => void
}

export class NostrToolsMethods implements IWebsocketAdapterMethods {
  protected relays?: string[];
  protected _pool?: SimplePool;
  protected _fetcher?: NostrFetcher;
  protected subs: Map<string, any> = new Map();
  protected _callbacks?: IWebsocketAdapterCallbacks = {};
  protected _salt: string = 'nip66'
  protected _controller: AbortController = new AbortController();
  protected _signal: AbortSignal = this._controller.signal;
  protected _signalIsInternal: boolean = true;  

  // accessors
  get pool(): SimplePool | undefined {  
    return this._pool;
  }

  get fetcher(): NostrFetcher | undefined {
    return this._fetcher;
  }

  get callbacks(): IWebsocketAdapterCallbacks | undefined {
    return this._callbacks;
  }

  get signal(): AbortSignal { 
    return this._signal;
  }

  async connect(): Promise<void> {
    console.log('NostrToolsMethods: connect')  
    if(this?.pool)
      return console.warn('[NostrToolsAdapter] Error connecting: pool already exists')  
    this._pool = new SimplePool();
    this._fetcher = NostrFetcher.withCustomPool(simplePoolAdapter(new SimplePool()))
  }

  async subscribe( filters: Filter[] | Filter): Promise<void>{
    console.log('NostrToolsMethods: subscribe', filters)
    if(!(filters instanceof Array)){
      filters = [filters]
    }
    this._subscribe({filters})
  }
  
  //low-level subscription handler with various return methods.
  async _subscribe(params: NostrToolsSubscribeParams): Promise<IEvent[] | void> {
    if(params?.keepAlive){
      return this._subscribeKeepAlive(params);
    }
    else {
      return this._subscribeArchive(params);
    }
  }

  async _subscribeKeepAlive(params: NostrToolsSubscribeParams): Promise<IEvent[] | void> {
    let { filters, callbacks, stream, signal } = { ...nostrToolsSubscribeParams, ...params };
    callbacks = callbacks ?? {} as SubscribeHandlers;
    
    const { kinds } = filters as Filter;

    let handler: SubCloser | undefined;

    if(!(filters instanceof Array)){
      filters = [filters]
    }

    if(signal){
      this._signal = signal;
      this._signalIsInternal = false;
    }

    const setHandler = async () => {
      const _h: SubCloser | void = await this._subscribeMany(filters, callbacks) as SubCloser;
      if(!_h) return
      handler = _h;
    }

    if(!callbacks?.oneose){
      callbacks.oneose = () => {}
    }

    if(!callbacks?.onclose){
      callbacks.onclose = async () => {
        await setHandler()
      }
    }

    await setHandler()
  }

  private async _subscribeMany(filters: Filter[], handlers: SubscribeHandlers): Promise<SubCloser | void> { 
    let { onevent, oneose, onclose } = handlers ?? {};
    if(!this?.pool) {
      await this.connect()
      if(!this?.pool) 
        return console.warn('NostrToolsWorker subscribe: no pool available');
    }
    if(!this?.relays) return console.warn('NostrToolsWorker subscribe: no relays available');
    if(!onevent) return console.warn('NostrToolsWorker onevent: no callback provided');

    this.pool.subscribeMany(
      [...this.relays],
      filters,
      {
        onevent,
        oneose,
        onclose,
      }
    )
  }

  async _subscribeArchive(params: NostrToolsSubscribeParams): Promise<IEvent[] | void> {
    console.log(`NostrToolsMethods: _subscribeArchive`, params)
    let { filters, callbacks, stream, signal } = { ...nostrToolsSubscribeParams, ...params };
    const { onevent, oneose, onclose } = callbacks ?? {};
    const { kinds } = filters as Filter;

    if(!(filters instanceof Array)){
      filters = [filters]
    }

    if(signal){
      this._signal = signal;
      this._signalIsInternal = false;
    }
  
    const fetches: Promise<IEvent[]>[] = [];
  
    if (!this?.fetcher || !this?.pool) await this.connect()
    if (!this?.relays) return console.warn('NostrToolsWorker subscribe: no relays available');

    for (let filter of filters) {
      const fetch: Promise<IEvent[]> = new Promise(async (resolve, reject) => {
        try {
          const events = new Set<IEvent>();
          const since = filter?.since ?? undefined;
          const until = filter?.until ?? undefined;
  
          const range: Record<string, number> = {};
          if (since) range['since'] = since;
          if (until) range['until'] = until;
    
          delete filter.since;
          delete filter.until;
    
          Object.keys(filter).forEach((key: string) => filter[key as keyof typeof filter] === undefined && delete filter[key as keyof typeof filter]);
    
          const cleanedFilter: FetchFilter = { ...filter } as FetchFilter;
    
          const postIter = (this.fetcher as NostrFetcher).allEventsIterator(
            this.relays as string[],
            cleanedFilter,
            range,
            { skipFilterMatching: true, signal }
          );
    
          if (!onevent) return console.warn('NostrToolsWorker onevent: no callback provided');
    
          for await (const ev of postIter) {
            if (stream) {
              onevent(ev as IEvent);
            } 
            events.add(ev as IEvent);
          }
          const result = Array.from(events) as IEvent[];
  
          resolve(result);
        }
        finally {
          this.fetcher?.shutdown()
        }
      });
      
      fetches.push(fetch);
    }

    const result: IEvent[] = (await Promise.all(fetches)).flat();

    // if(oneose) {
    //   oneose(Array.from(result));
    // }
    console.log(`!!! Result: ${result.length} events`)

    return result
  }

  async fetch(filters: Filter[] | Filter): Promise<IEvent[]>{
    if(!(filters instanceof Array)){
      filters = [filters]
    }
    return this._fetch({filters}) as Promise<IEvent[]>
  }
  
  //return events
  async _fetch(params: NostrToolsSubscribeParams): Promise<IEvent[] | void>{
    const fetchParams = {
      stream: false
    }
    if(params?.callbacks?.oneose){
      delete params.callbacks?.oneose  
    }
    return this._subscribe({...params, ...fetchParams});
  }

  unsubscribe(subId?: string): void {
    //using nostrfetch so no subid or unsubscribe, but we can abort and shutdown!
    this.terminate();
  }

  disconnect(): void {
    if(!this._validateRequest()) return
    this.pool?.close(this.relays as string[]);
  }

  abort(): void {
    if(this._signalIsInternal){
      this._controller.abort();
      this._controller = new AbortController();
      this._signal = this._controller.signal;
    }
    else {
      console.warn('Abort signal is not internal. Cannot abort, abort provided signal instead'); ;
    }
  }

  close(relays?: string[]): void {
    this.pool?.close(relays ?? this.relays as string[]);
  }

  terminate(): void {
    if(!this._validateRequest()) return
    this.abort();
    this.fetcher?.shutdown();
    this.close();
  }

  async getEvents(filter: Filter): Promise<IEvent[] | undefined> {
    if(!this._validateRequest()) return
    const events = await (this.pool as SimplePool).querySync(this.relays as string[], filter)
    return events as unknown as IEvent[];
  }

  async getEvent(filter: Filter): Promise<IEvent | undefined> {
    if(!this._validateRequest()) return
    const event = await (this.pool as SimplePool).get(this.relays as string[], filter)
    return event as unknown as IEvent;
  }

  private _validateRequest(): boolean {
    if(!this.pool) {
      console.error('No pool available');
      return false
    }
    if(!this.relays) {
      console.error('No relays available');
      return false
    }
    return true
  }
}