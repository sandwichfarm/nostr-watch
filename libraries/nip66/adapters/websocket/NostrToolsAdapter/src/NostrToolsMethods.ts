import { IWebsocketAdapterMethods, IWebsocketAdapterCallbacks } from '@nostrwatch/nip66/core'
import { IEvent } from '@nostrwatch/nip66/interfaces';

import { NostrEvent, NostrFetcher, type FetchFilter } from 'nostr-fetch';
import { simplePoolAdapter } from '@nostr-fetch/adapter-nostr-tools-v2'
import { SimplePool } from 'nostr-tools';
import type { Filter } from 'nostr-tools';
import { isForInStatement } from 'typescript';
import { SubCloser } from 'nostr-tools/abstract-pool';
import { defaultSubscribeOptions, defaultWebsocketRequestBody, WebsocketAdapterResult, WebsocketAdapterSubscribeOptions, WebsocketRequestBody } from 'node_modules/@nostrwatch/nip66/src/core';


export interface NostrToolsSubscribeParams {
  relays?: Set<string>
  filters: Filter[] | Filter
  stream?: boolean 
  keepAlive?: boolean
  callbacks?: SubscribeHandlers
  signal?: AbortSignal
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
    if(this?.pool)
      return console.warn('[NostrToolsAdapter] Error connecting: pool  exists')  
    this._pool = new SimplePool();
    this._fetcher = NostrFetcher.withCustomPool(simplePoolAdapter(new SimplePool()))
  }

  async _subscribe(request: WebsocketRequestBody = defaultWebsocketRequestBody, callbacks?: SubscribeHandlers): Promise<IEvent[] | boolean> {
    console.log('NostrToolsMethods: _subscribe', request)
    return new Promise(async (resolve, reject) => {
      let { filters, relays, options } = request;
      const { stream } = options ?? defaultSubscribeOptions;
      const effectiveRelays = relays ?? this.relays;
      const result: IEvent[] = [];
      let count: number = 0;
      if (!effectiveRelays || effectiveRelays.length === 0) {
        throw new Error('No relays available for subscription.');
      }
      filters = Array.isArray(filters) ? filters : [filters];
      await this.connect();
      
      const onevent = (event: IEvent) => {
        if(stream){
          callbacks!.onevent?.(event);
          count++
        }
        else {
          result.push(event);
        }
      }
      const onclose = () => {
        callbacks?.onclose?.();
      }
      const oneose = () => {
        if(stream){
          resolve(count > 0)
        }
        else {
          resolve(result)
        }
        callbacks?.oneose?.();
      }
      console.log('NostrToolsMethods: _subscribe: this.pool.subscribeMany', effectiveRelays, filters)
      this.pool!.subscribeMany(
        effectiveRelays,
        filters,
        { onevent, oneose, onclose }
      );
    });
  }

  async _fetch(request: WebsocketRequestBody = defaultWebsocketRequestBody, callbacks?: SubscribeHandlers): Promise<IEvent[] | boolean> {
    let { filters, relays, options } = request;
    const { stream } = options ?? defaultSubscribeOptions;
    const effectiveRelays = relays ?? this.relays;
    if (!effectiveRelays || effectiveRelays.length === 0) {
      throw new Error('No relays available for fetching.');
    }
    filters = Array.isArray(filters) ? filters : [filters];
    await this.connect();
    const fetchPromises: Promise<IEvent[] | boolean>[] = [];
    for (let filter of filters) {
      const { since, until, ...remainingFilter } = filter;
      const range: Record<string, number> = {};
      if (since) range['since'] = since;
      if (until) range['until'] = until;
      delete filter.since 
      delete filter.until
      const fetchPromise = new Promise<IEvent[] | boolean>(async (resolve) => {
        let count = 0;
        const events = new Set<IEvent>();
        const onevent = (event: IEvent) => {
          events.add(event as IEvent);
          if(stream){
            count++;
            callbacks!.onevent?.(event);
          }
        }
        const onclose = () => {
          callbacks?.onclose?.();
        }
        const oneose = () => {
          resolve(Array.from(events));
          callbacks?.oneose?.();
          this.fetcher?.shutdown();
        }
        try {
          const iterator = this.fetcher!.allEventsIterator(
            effectiveRelays,
            remainingFilter as FetchFilter,
            range,
            { signal: this.signal }
          );
          for await (const event of iterator) {
            onevent(event as IEvent);
          }
          if(stream) {
            resolve(count > 0)
          }
          else {
            resolve(Array.from(events));
          }
          
          oneose();
        } catch (error) {
          console.warn('Error during fetch:', error);
          resolve([]);
        }
      });
      fetchPromises.push(fetchPromise);
    }
    const result = (await Promise.all(fetchPromises)).flat();
    return options?.stream? result.length > 0: result;
  }

  unsubscribe(hash?: string): void {
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