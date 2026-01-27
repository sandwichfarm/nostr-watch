import "websocket-polyfill";
import TimeAgo from 'javascript-time-ago';
import en from 'javascript-time-ago/locale/en';
import { NostrFetcher } from 'nostr-fetch';
import { SimplePool, Event, Filter } from 'nostr-tools';
import { simplePoolAdapter } from '@nostr-fetch/adapter-nostr-tools';
import { open } from 'lmdb';
import { mergeDeepRight } from 'ramda';
import { TrawlerOptions, Progress } from '../types';
import { EventEmitter } from 'tseep';
import { logger, Logger, LogLevel } from '../utils';

TimeAgo.addDefaultLocale(en);
const timeAgo = new TimeAgo('en-US');

export default class NTTrawler extends EventEmitter {
  protected queue: any;
  protected relays: string[];
  protected promises: Promise<any>[];
  protected defaults: TrawlerOptions;
  protected options: TrawlerOptions;
  protected cache: ReturnType<typeof open> | null;
  protected logger: Logger;

  constructor(relays: string[], options: Partial<TrawlerOptions> = {}) {
    super();
    this.queue = null;
    this.relays = relays;
    this.promises = [];
    this.defaults = {
      queueName: 'trawlerQueue',
      repeatWhenComplete: false,
      relaysPerBatch: 3,
      restDuration: 60 * 1000,
      progressEvery: 5000,
      filters: {},
      since: 0,
      sinceStrict: true,
      adapter: 'pqueue',
      nostrFetcherOptions: {},
      adapterOptions: {},
      workerOptions: {},
      queueOptions: {},
      cache: {
        enabled: true,
        path: './cache',
      },
      logLevel: LogLevel.INFO,
      parser: async () => {}
    };
    this.options = mergeDeepRight(this.defaults, options) as TrawlerOptions;
    this.cache = null;
    
    // Initialize logger with provided log level or default
    this.logger = logger.child(this.options.queueName || 'trawler');
    if (this.options.logLevel !== undefined) {
      this.logger.setLevel(this.options.logLevel);
    }
    
    if (this.relays.length < (this.options.relaysPerBatch ?? 3)) {
      this.options.relaysPerBatch = this.relays.length;
    }
    
    this.logger.debug('Trawler initialized', { 
      relays: this.relays.length,
      adapter: this.options.adapter,
      cacheEnabled: this.options.cache?.enabled
    });
  }

  async run(): Promise<void> {
    this.logger.info('Starting trawl run');
    let i = 0;
    await this.openCache();
    this.pause();
    this.logger.debug('Adding jobs for relay chunks');
    for (const chunk of this.chunk_relays()) {
      this.logger.trace(`Adding job ${i} for ${chunk.length} relays`, chunk);
      const $job = await this.addJob(i, chunk);
      i++;
    }
    this.logger.info(`Added ${i} jobs to the queue`);
    this.resume();
  }

  async countEvents(relay: string): Promise<number> {
    if (!this.cache) return 0;
    let results = [...this.cache.getRange()];
    results = results.filter(({ key }) => typeof key === 'string' && key.startsWith(`has:`));
    return results.length;
  }

  async countTimestamps(relay: string): Promise<number> {
    if (!this.cache) return 0;
    let events = [...this.cache.getRange()];
    events = events.filter(({ key }) => typeof key === 'string' && key?.startsWith(`has:`));
    return events.length;
  }

  async openCache(): Promise<void> {
    if (!this.options.cache?.enabled || !this.options.cache?.path) {
      this.logger.debug('Cache disabled, skipping');
      return;
    }
    
    this.logger.debug(`Opening cache at ${this.options.cache.path}`);
    this.cache = open({
      path: this.options.cache.path,
      compression: true
    });
    
    if (this.options?.after_cacheOpen instanceof Function) {
      this.logger.debug('Running after_cacheOpen callback');
      this.options.after_cacheOpen(this.cache);
    }
  }

  async trawl(chunk: string[], $job: any): Promise<void> {
    this.logger.info(`Trawling ${chunk.length} relays`, chunk);
    const pool = new SimplePool();
    const promises = chunk.map((relay) => new Promise(async (resolve, reject) => {
      try {
        this.logger.debug(`Setting up fetch for relay: ${relay}`);
        const fetcher = NostrFetcher.withCustomPool(simplePoolAdapter(pool));
        const since = this.getSince(relay);
        const progress: Progress = {
          found: 0,
          rejected: 0,
          last_timestamp: 0,
          highest_timestamp: 0,
          lowest_timestamp: 0,
          total: await this.countEvents(relay),
          relay: relay
        };

        this.logger.debug(`Starting with timestamp: ${since} for relay: ${relay}`);
        let lastProgressUpdate = 0;

        const it = fetcher.allEventsIterator(
          [relay],
          this.options.filters as Filter,
          { since }
        );

        for await (const event of it) {
          if(this.cache?.get(`event:${event.id}`)) {
            progress.rejected++;
            continue;
          }
          const passedValidation = this.options?.validator ? this.options.validator(this, event) : true;
          const doUpdateProgress = () => Date.now() - lastProgressUpdate > (this.options.progressEvery ?? 5000);

          progress.last_timestamp = event.created_at;
          if(progress.lowest_timestamp > event.created_at) {
            progress.lowest_timestamp = event.created_at;
          }
          if(progress.highest_timestamp < event.created_at) {
            progress.highest_timestamp = event.created_at;
          }
          
          if (!passedValidation) {
            this.logger.trace(`Event ${event.id} failed validation`, { relay });
            progress.rejected++;
            if (doUpdateProgress()) {
              lastProgressUpdate = Date.now();
              progress.total = await this.countEvents(relay);
              await this.updateProgress(progress, $job);
            }
            continue;
          }

          // Emit the event and call the parser for backward compatibility
          this.logger.debug(`Received valid event ${event.id} from ${relay}`);

          this.emit('event', event);
          this.cache?.put(`event:${event.id}`, event);
          progress.found++;

          if (this.options.parser) {
            await this.options.parser(this, event, $job);
          }

          if (doUpdateProgress()) {
            lastProgressUpdate = Date.now();
            progress.total = await this.countEvents(relay);
            await this.updateProgress(progress, $job);
          }
        }
        
        // Final progress update when done with a relay
        if (progress.found > 0 || progress.rejected > 0) {
          progress.total = await this.countEvents(relay);
          this.updateSince(relay, progress.highest_timestamp);
          await this.updateProgress(progress, $job);
        }
        
        this.logger.info(`Completed fetch for ${relay}`, {
          found: progress.found,
          rejected: progress.rejected,
          last_timestamp: new Date(progress.last_timestamp * 1000).toISOString(),
          highest_timestamp: new Date(progress.highest_timestamp * 1000).toISOString(),
          lowest_timestamp: new Date(progress.lowest_timestamp * 1000).toISOString(),
          percentage: progress.total > 0 ? `${((progress.found / progress.total) * 100).toFixed(1)}%` : 'N/A'
        });
        
        resolve(this.getSince(relay));
      } catch (error) {
        this.logger.error(`Error trawling relay: ${relay}`, error);
        this.emit('error', error);
        reject(error);
      }
    }));
    
    this.logger.debug(`Waiting for all ${promises.length} relay promises to settle`);
    await Promise.allSettled(promises);
    this.logger.info('Trawl completed for all relays in chunk');
  }

  chunk_relays(): string[][] {
    if (this.relays.length === 0) return [];
    const batchSize = this.options.relaysPerBatch ?? 3;
    if (this.relays.length <= batchSize) {
      this.logger.debug(`Creating single chunk for ${this.relays.length} relays`);
      return [this.relays];
    }
    
    const chunks: string[][] = [];
    for (let i = 0; i < this.relays.length; i += batchSize) {
      chunks.push(this.relays.slice(i, i + batchSize));
    }
    
    this.logger.debug(`Created ${chunks.length} relay chunks of size ${batchSize}`);
    return chunks;
  }

  getSince(relay: string): number {
    const cached = this.cache?.get(`lastUpdate:${relay}`);
    if (typeof cached === 'number') return cached;
    if (typeof this.options.since === 'number') return this.options.since;
    if (typeof this.options.since === 'object') {
      if (typeof this.options.since[relay] === 'number') return this.options.since[relay];
      return 0;
    }
    return 0;
  }

  async updateSince(key: string, timestamp: number): Promise<void> {
    await this.cache?.put(`lastUpdate:${key}`, timestamp);
  }

  async updateProgress(progress: Progress, $job: any): Promise<void> {
    // Log comprehensive progress info at debug level
    const timeSince = progress.last_timestamp > 0 
      ? timeAgo.format(progress.last_timestamp * 1000) 
      : 'N/A';
    
    this.logger.debug(`Progress update for ${progress.relay}`, {
      found: progress.found,
      rejected: progress.rejected,
      total: progress.total,
      last_timestamp: progress.last_timestamp,
      timeSince,
      percentage: progress.total > 0 ? `${((progress.found / progress.total) * 100).toFixed(1)}%` : 'N/A',
      jobId: $job?.id
    });
    
    // Emit progress event
    this.emit('progress', progress);
    // Implementation for queue-specific progress updates will be handled in derived classes
  }

  pause(): void {
    this.logger.info('Pausing trawler');
    // Implementation depends on the specific queue implementation
  }

  resume(): void {
    this.logger.info('Resuming trawler');
    // Implementation depends on the specific queue implementation
  }

  protected async addJob(index: number, chunk: string[]): Promise<any> {
    this.logger.debug(`Adding job ${index} with ${chunk.length} relays`);
    // Implementation depends on the specific queue implementation
    return null;
  }
}