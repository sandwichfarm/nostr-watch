import BrowserDetector from 'browser-dtector';
import PQueue from "p-queue";

import { NostrFetcher, type FetchFilter } from 'nostr-fetch';
import { simplePoolAdapter } from '@nostr-fetch/adapter-nostr-tools-v2'
import { Filter, SimplePool } from "nostr-tools";
import { SubCloser, AbstractSimplePool } from 'nostr-tools/abstract-pool';

import {  WorkerOptions, AdapterWorkerResult, AdapterWebsocketWorker, IAdapterWebsocketWorker, SubscribeHandlers, WebsocketRequest } from "@nostrwatch/route66/core"

import { AdapterWebsocketWorkerCommand, IWebsocketAdapterCallbacks, defaultWebsocketAdapterOptions, defaultWebsocketRequestBody, WebsocketAdapterResult, WebsocketAdapterOptions, WebsocketRequestBody  } from '@nostrwatch/route66/core'
import { IEvent } from "@nostrwatch/route66/interfaces";

const queue = new PQueue({ concurrency: 10 });

interface NostrToolsWorkerCommand extends AdapterWebsocketWorkerCommand {}

interface NostrToolsWorkerResult extends AdapterWorkerResult {}

interface NostrToolsWorkerOptions extends WorkerOptions {
  relays?: string[]
}

const bdetect = new BrowserDetector(navigator.userAgent);
const agent = bdetect.parseUserAgent();

const defaultRelays = ['wss://relaypag.es', 'wss://relay.nostr.watch', 'wss://purplepag.es', 'wss://user.kindpag.es']

export class NostrToolsWorker extends AdapterWebsocketWorker implements IAdapterWebsocketWorker {

  protected relays: string[];
  protected _pool?: SimplePool;
  protected _fetcher?: NostrFetcher;
  protected subs: Map<string, any> = new Map();
  protected _callbacks?: IWebsocketAdapterCallbacks = {};
  protected _salt: string = 'route66'
  protected _signalIsInternal: boolean = true;  
  protected _filtersQueue: Filter[] = [];

  constructor( options: NostrToolsWorkerOptions ){
    super(options);
    this.init();
    this.relays = options?.relays ? options.relays : defaultRelays;
  }

  init(){
    this.poolInit();
    this.fetcherInit();
  }

  poolInit(){
    this._pool = new SimplePool();
  }

  fetcherInit(force: boolean = false){
    if(!this?.pool) {
      this.poolInit();
      if(!this.pool) throw new Error('No pool available')  
    }
    if(!force && this.fetcher) return;
    if(agent.name === 'Safari') {
      this._fetcher = NostrFetcher.init();
    } else {
      this._fetcher = NostrFetcher.withCustomPool(simplePoolAdapter(this.pool))
    }
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

  async connect(): Promise<void> {
    if(this?.pool) return;
    const pool = new SimplePool();
    this._pool = pool
    this._fetcher = NostrFetcher.withCustomPool(simplePoolAdapter(pool))
  }

  async _publish(request: WebsocketRequestBody = defaultWebsocketRequestBody): Promise<boolean> {
    let { relays, note } = request;
    relays = relays ?? this.relays;
    if(!note) return false;
    if(!relays.length) return false;
    if(!this.pool) await this.connect();
    const result = (this.pool as AbstractSimplePool).publish(relays as string[], note)
    await Promise.any(result);
    const success = result.filter((r: any) => r.status === 'fulfilled').length > 0;
    return success;
  }

  private cleanRelayUrls(relays: string[]): string[] {
    return relays.filter((r: string) => !r.includes(','));
  }

  async _subscribe(request: WebsocketRequestBody = defaultWebsocketRequestBody, callbacks?: SubscribeHandlers): Promise<IEvent[] | boolean> {
    let { filters, relays, options, hash, priority } = request;
    const { stream, keepAlive } = options ?? defaultWebsocketAdapterOptions;
    priority = priority ?? 0;

    // console.log('NostrToolsWorker:subscribe:filters', filters)

    const subby = async (): Promise<IEvent[] | boolean> => {
      return new Promise(async (resolve, reject) => {
        const effectiveRelays = this.cleanRelayUrls(relays ?? this.relays);
        const result: IEvent[] = [];
        let count: number = 0;
        if (!effectiveRelays || effectiveRelays.length === 0) {
          throw new Error('No relays available for subscription.');
        }
        if(!filters) filters = [];
        filters = Array.isArray(filters) ? filters : [filters];
        await this.connect();
        
        const onevent = (event: IEvent) => {
          if(this.signal.aborted) return;
          if(stream){
            callbacks!.onevent?.(event);
            count++
          }
          else {
            result.push(event);
          }
        }

        const onclose = (reasons: string[] = []) => {
          callbacks?.onclose?.(reasons?.[0] || 'unknown');
          this.subs.delete(hash as string);  
        }

        const oneose = () => {
          if(this.signal.aborted) return;
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

        const closer = this.pool!.subscribeMany(
          effectiveRelays,
          filters,
          { onevent, oneose, onclose }
        );
        
        this.subs.set(hash as string, () => {
          closer.close()
        });
      });
    }
    
    if(keepAlive){
      subby()
    }
    else {
      return queue.add(subby, { priority }) as Promise<IEvent[] | boolean>;
    }
  }

  async _fetch(
    request: WebsocketRequestBody = defaultWebsocketRequestBody,
    callbacks?: SubscribeHandlers
  ): Promise<IEvent[] | boolean> {
    return queue.add(async () => {
      let { filters, relays, options, hash } = request;
  
      this.fetcherInit();
      // console.log('NostrToolsWorker:fetch:filters', filters);
  
      const { stream } = options ?? defaultWebsocketAdapterOptions;
      const effectiveRelays = this.cleanRelayUrls(relays ?? this.relays);
  
      if (!effectiveRelays || effectiveRelays.length === 0) {
        throw new Error('No relays available for fetching.');
      }
  
      // Track active subscriptions
      this.subs.set(hash as string, (this.fetcher as NostrFetcher).shutdown.bind(this.fetcher));
  
      // Normalize filters
      if (!filters) filters = [];
      filters = Array.isArray(filters) ? filters : [filters];
      await this.connect();
  
      const events: (IEvent[] | boolean)[] = [];
      let count = 0;
  
      // console.log('NostrToolsWorker: _fetch: filters', filters);
  
      for (let filter of filters) {
        if (this.signal.aborted) return;
  
        const { since, until, ...remainingFilter } = filter;
        const range: Record<string, number> = {};
        if (since) range.since = since;
        if (until) range.until = until;
  
        let totalEvents = 0;
  
        try {
          // console.log('allEventsIterator:filter', remainingFilter)
          const eventMap = new Map<string, IEvent>();
          const iterator = this.fetcher!.allEventsIterator(
            effectiveRelays,
            remainingFilter as FetchFilter,
            range,
            {
              signal: this.signal,
              skipFilterMatching: true,
              skipVerification: true,
              abortSubBeforeEoseTimeoutMs: 20000,
              connectTimeoutMs: 5000,
            }
          );
  
          // Process events in the iterator
          for await (const event of iterator) {
            if (this.signal.aborted) return;
            if (eventMap.has(event.id)) continue;
  
            eventMap.set(event.id, event as IEvent);
            totalEvents++;
  
            if (stream) {
              callbacks?.onevent?.(event);
            }
          }
  
          if (stream) {
            // Resolve to boolean for streaming mode
            events.push(totalEvents > 0);
          } else {
            // Collect unique events for non-streaming mode
            events.push(Array.from(eventMap.values()));
          }
  
          // Callbacks after End of Stream
          callbacks?.oneose?.();
  
        } catch (error) {
          console.warn('Error during fetch:', error);
        }
  
        // console.log(`NostrToolsWorker: _fetch #${count}: complete, total events: ${totalEvents}`);
        count++;
      }

      if(agent.name === 'Safari') {
          this.fetcher?.shutdown();
      } 
  
      // Cleanup after all filters are processed
      callbacks?.onclose?.(hash as string);
      this.subs.delete(hash as string);
  
      // Aggregate and return results
      const result = events.flat();
      return options?.stream ? result.length > 0 : result;
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
    //console.log('WEBSOCKET WORKER ABORTED')
    this.controller.abort();
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