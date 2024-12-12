import {  WorkerOptions, AdapterWorkerResult, AdapterWebsocketWorker, IAdapterWebsocketWorker, SubscribeHandlers, WebsocketRequest } from "@nostrwatch/nip66/core"

import { IEvent } from "@nostrwatch/nip66/interfaces";
import { AdapterWebsocketWorkerCommand } from "@nostrwatch/nip66/core";

import { Filter } from "nostr-tools";

import { IWebsocketAdapterCallbacks } from '@nostrwatch/nip66/core'

import { NostrFetcher, type FetchFilter } from 'nostr-fetch';
import { simplePoolAdapter } from '@nostr-fetch/adapter-nostr-tools-v2'
import { SimplePool } from 'nostr-tools';
import { SubCloser } from 'nostr-tools/abstract-pool';
import { defaultWebsocketAdapterOptions, defaultWebsocketRequestBody, WebsocketAdapterResult, WebsocketAdapterOptions, WebsocketRequestBody } from 'node_modules/@nostrwatch/nip66/src/core';

import PQueue from "p-queue";

const queue = new PQueue({ concurrency: 10 });

interface NostrToolsWorkerCommand extends AdapterWebsocketWorkerCommand {}

interface NostrToolsWorkerResult extends AdapterWorkerResult {}

interface NostrToolsWorkerOptions extends WorkerOptions {
  relays?: string[]
}

const defaultRelays = ['wss://relaypag.es', 'wss://relay.nostr.watch', 'wss://purplepag.es', 'wss://user.kindpag.es']

export class NostrToolsWorker extends AdapterWebsocketWorker implements IAdapterWebsocketWorker {

  protected relays: string[];
  protected _pool?: SimplePool;
  protected _fetcher?: NostrFetcher;
  protected subs: Map<string, any> = new Map();
  protected _callbacks?: IWebsocketAdapterCallbacks = {};
  protected _salt: string = 'nip66'
  protected _controller: AbortController = new AbortController();
  protected _signal: AbortSignal = this._controller.signal;
  protected _signalIsInternal: boolean = true;  

  constructor( options: NostrToolsWorkerOptions ){
    //console.log('NostrToolsWorker: constructor', options)
    super(options)
    const pool = new SimplePool();
    this._pool = pool
    this._fetcher = NostrFetcher.withCustomPool(simplePoolAdapter(pool))
    this.relays = options?.relays ? options.relays : defaultRelays
  }

  async setup(command: NostrToolsWorkerCommand): Promise<void> {}

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
    if(this?.pool) return;
    const pool = new SimplePool();
    this._pool = pool
    this._fetcher = NostrFetcher.withCustomPool(simplePoolAdapter(pool))
  }

  async _subscribe(request: WebsocketRequestBody = defaultWebsocketRequestBody, callbacks?: SubscribeHandlers): Promise<IEvent[] | boolean> {
    return queue.add(() => {
      console.log('!!!! NostrToolsWorker: _subscribe: queue running now')
      return new Promise(async (resolve, reject) => {
        let { filters, relays, options, hash } = request;
        const { stream, keepAlive } = options ?? defaultWebsocketAdapterOptions;
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
          this.subs.delete(hash as string);
        }
        const oneose = () => {
          callbacks?.oneose?.();
          if(keepAlive) return;
          this.subs.get(hash as string)?.(); //closer
          if(stream){
            resolve(count > 0)
          }
          else {
            resolve(result)
          }
        }
        //console.log('NostrToolsWorker: _subscribe: this.pool.subscribeMany', effectiveRelays, filters)
        const closer = this.pool!.subscribeMany(
          effectiveRelays,
          filters,
          { onevent, oneose, onclose }
        );
        this.subs.set(hash as string, closer.close.bind(closer));
      });
    }) as Promise<IEvent[] | boolean>;
  }

  async _fetch(request: WebsocketRequestBody = defaultWebsocketRequestBody, callbacks?: SubscribeHandlers): Promise<IEvent[] | boolean> {
    return queue.add(async () => {
      if(!this.fetcher) throw new Error('No fetcher available');
      let { filters, relays, options, hash } = request;
      const { stream } = options ?? defaultWebsocketAdapterOptions;
      const effectiveRelays = relays ?? this.relays;
      if (!effectiveRelays || effectiveRelays.length === 0) {
        throw new Error('No relays available for fetching.');
      }
      this.subs.set(hash as string, this.fetcher.shutdown.bind(this.fetcher));
      filters = Array.isArray(filters) ? filters : [filters];
      await this.connect();
      const events = []
      let count = 0
      // const fetchPromises: Promise<IEvent[] | boolean>[] = [];
      //console.log(`running ${filters.length} fetches.`)
      for (let filter of filters) {
        //console.log(`NostrToolsWorker: _fetch #${count}: filter`, filter)
        events.push(await new Promise<IEvent[] | boolean>(async (resolve) => {
          const { since, until, ...remainingFilter } = filter;
          const range: Record<string, number> = {};
          if (since) range['since'] = since;
          if (until) range['until'] = until;
          delete filter.since 
          delete filter.until
          let count = 0;
          const events = new Set<IEvent>();
          const onevent = (event: IEvent) => {
            events.add(event as IEvent);
            if(stream){
              count++;
              callbacks!.onevent?.(event);
            }
          }
          const oneose = () => {
            if(stream) {
              resolve(count > 0)
            }
            else {
              resolve(Array.from(events));
            }
            callbacks?.oneose?.();
            // this.fetcher?.shutdown();
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
            oneose();
          } catch (error) {
            console.warn('Error during fetch:', error);
            resolve([]);
          }
        }));
        //console.log(`NostrToolsWorker: _fetch #${count}: complete`)
        count++
      }
      callbacks?.onclose?.();
      this.subs.delete(hash as string);
      const result = events.flat();
      return options?.stream? result.length > 0: result;
    }) as Promise<IEvent[] | boolean>;
  }

  closeSubscription(hash?: string): void {}

  unsubscribe({ hash }: WebsocketRequestBody): void {
    if(!hash) return
    if(!this.subs.has(hash as string)) return
    const closer = this.subs.get(hash as string);
    if(typeof closer === 'function') {
      closer();
    }
    if(typeof closer?.close === 'function') {
      closer.close();
    }
  }

  disconnect(): void {
    if(!this._validateRequest()) return
    this.pool?.close(this.relays as string[]);
  }

  abort(): void {
    for(const closer of this.subs.values()){
      if(typeof closer === 'function') {
        closer();
      }
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