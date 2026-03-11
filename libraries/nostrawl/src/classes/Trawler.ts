import TimeAgo from 'javascript-time-ago';
import en from 'javascript-time-ago/locale/en';
import { Relay, SyncDirection } from 'applesauce-relay';
import { open } from 'lmdb';
import { mergeDeepRight } from 'ramda';
import { TrawlerOptions, Progress, NostrEvent } from '../types';
import { EventEmitter } from 'tseep';
import { logger, Logger, LogLevel } from '../utils';

TimeAgo.addDefaultLocale(en);
const timeAgo = new TimeAgo('en-US');

interface Nip77CacheEntry {
  supported: boolean;
  checkedAt: number;
}

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
      adapterOptions: {},
      workerOptions: {},
      queueOptions: {},
      cache: {
        enabled: true,
        path: './cache',
      },
      relayOptions: {},
      negentropyEnabled: true,
      negentropyCapabilityCacheTTL: 3600,
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
      cacheEnabled: this.options.cache?.enabled,
      negentropyEnabled: this.options.negentropyEnabled
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
    const promises = chunk.map((relayUrl) => this.trawlRelay(relayUrl, $job));
    this.logger.debug(`Waiting for all ${promises.length} relay promises to settle`);
    await Promise.allSettled(promises);
    this.logger.info('Trawl completed for all relays in chunk');
  }

  private async trawlRelay(relayUrl: string, $job: any): Promise<void> {
    const relay = new Relay(relayUrl, {
      keepAlive: 0,
      ...this.options.relayOptions,
    });

    try {
      this.logger.debug(`Setting up fetch for relay: ${relayUrl}`);
      const progress: Progress = {
        found: 0,
        rejected: 0,
        last_timestamp: 0,
        highest_timestamp: 0,
        lowest_timestamp: 0,
        total: await this.countEvents(relayUrl),
        relay: relayUrl
      };

      let usedNegentropy = false;

      if (this.options.negentropyEnabled !== false) {
        const cached = this.getNip77Cache(relayUrl);
        if (!cached || cached.supported !== false) {
          try {
            await this.trawlWithNegentropy(relay, relayUrl, progress, $job);
            usedNegentropy = true;
            this.setNip77Cache(relayUrl, true);
          } catch (err) {
            this.logger.debug(`Negentropy failed for ${relayUrl}, falling back to REQ`, err);
            this.setNip77Cache(relayUrl, false);
          }
        } else {
          this.logger.debug(`Skipping negentropy for ${relayUrl} (cached as unsupported)`);
        }
      }

      if (!usedNegentropy) {
        await this.trawlWithRequest(relay, relayUrl, progress, $job);
      }

      // Final progress update when done with a relay
      if (progress.found > 0 || progress.rejected > 0) {
        progress.total = await this.countEvents(relayUrl);
        this.updateSince(relayUrl, progress.highest_timestamp);
        await this.updateProgress(progress, $job);
      }

      this.logger.info(`Completed ${usedNegentropy ? 'negentropy' : 'REQ'} fetch for ${relayUrl}`, {
        found: progress.found,
        rejected: progress.rejected,
        last_timestamp: progress.last_timestamp > 0
          ? new Date(progress.last_timestamp * 1000).toISOString()
          : 'N/A',
        highest_timestamp: progress.highest_timestamp > 0
          ? new Date(progress.highest_timestamp * 1000).toISOString()
          : 'N/A',
        lowest_timestamp: progress.lowest_timestamp > 0
          ? new Date(progress.lowest_timestamp * 1000).toISOString()
          : 'N/A',
        percentage: progress.total > 0
          ? `${((progress.found / progress.total) * 100).toFixed(1)}%`
          : 'N/A'
      });

    } catch (error) {
      this.logger.error(`Error trawling relay: ${relayUrl}`, error);
      this.emit('error', error);
    } finally {
      relay.close();
    }
  }

  private trawlWithNegentropy(
    relay: Relay,
    relayUrl: string,
    progress: Progress,
    $job: any
  ): Promise<void> {
    const filter = { ...this.options.filters };
    const cachedEvents = this.getCachedEvents();

    this.logger.debug(`Starting negentropy sync for ${relayUrl} with ${cachedEvents.length} cached events`);

    return new Promise<void>((resolve, reject) => {
      let lastProgressUpdate = 0;

      relay.sync(cachedEvents, filter as any, SyncDirection.RECEIVE).subscribe({
        next: (event: any) => {
          this.processEvent(event, relayUrl, progress, $job);

          const now = Date.now();
          if (now - lastProgressUpdate > (this.options.progressEvery ?? 5000)) {
            lastProgressUpdate = now;
            this.updateProgress(progress, $job);
          }
        },
        error: (err: any) => reject(err),
        complete: () => resolve()
      });
    });
  }

  private trawlWithRequest(
    relay: Relay,
    relayUrl: string,
    progress: Progress,
    $job: any
  ): Promise<void> {
    const since = this.getSince(relayUrl);
    const filter = { ...this.options.filters, since };

    this.logger.debug(`Starting REQ fetch for ${relayUrl} with since=${since}`);

    return new Promise<void>((resolve, reject) => {
      let lastProgressUpdate = 0;

      relay.request(filter as any, { reconnect: { count: 2, delay: 2000 } }).subscribe({
        next: (event: any) => {
          this.processEvent(event, relayUrl, progress, $job);

          const now = Date.now();
          if (now - lastProgressUpdate > (this.options.progressEvery ?? 5000)) {
            lastProgressUpdate = now;
            this.updateProgress(progress, $job);
          }
        },
        error: (err: any) => reject(err),
        complete: () => resolve()
      });
    });
  }

  private processEvent(
    event: NostrEvent,
    relayUrl: string,
    progress: Progress,
    $job: any
  ): void {
    // Dedup check
    if (this.cache?.get(`event:${event.id}`)) {
      progress.rejected++;
      return;
    }

    const passedValidation = this.options?.validator
      ? this.options.validator(this, event)
      : true;

    progress.last_timestamp = event.created_at;
    if (progress.lowest_timestamp === 0 || progress.lowest_timestamp > event.created_at) {
      progress.lowest_timestamp = event.created_at;
    }
    if (progress.highest_timestamp < event.created_at) {
      progress.highest_timestamp = event.created_at;
    }

    if (!passedValidation) {
      this.logger.trace(`Event ${event.id} failed validation`, { relay: relayUrl });
      progress.rejected++;
      return;
    }

    // Emit the event and call the parser for backward compatibility
    this.logger.debug(`Received valid event ${event.id} from ${relayUrl}`);

    this.emit('event', event);
    this.cache?.put(`event:${event.id}`, event);
    progress.found++;

    if (this.options.parser) {
      // Fire-and-forget: parser is async but we don't block the observable stream
      this.options.parser(this, event, $job).catch((err: any) => {
        this.logger.error(`Parser error for event ${event.id}`, err);
      });
    }
  }

  /**
   * Retrieve all cached events for use as the negentropy local store.
   * Returns minimal NostrEvent objects (only id and created_at are used
   * by the negentropy storage vector, but we include all fields).
   */
  private getCachedEvents(): NostrEvent[] {
    if (!this.cache) return [];

    const events: NostrEvent[] = [];
    for (const { key, value } of this.cache.getRange()) {
      if (typeof key === 'string' && key.startsWith('event:') && value) {
        events.push(value as NostrEvent);
      }
    }

    return events;
  }

  /**
   * Get cached NIP-77 capability result for a relay.
   * Returns null if not cached or if the cache entry has expired.
   */
  private getNip77Cache(relayUrl: string): Nip77CacheEntry | null {
    if (!this.cache) return null;

    const entry = this.cache.get(`nip77:${relayUrl}`) as Nip77CacheEntry | undefined;
    if (!entry) return null;

    const ttl = (this.options.negentropyCapabilityCacheTTL ?? 3600) * 1000;
    if (Date.now() - entry.checkedAt > ttl) return null;

    return entry;
  }

  /**
   * Cache the NIP-77 capability result for a relay.
   */
  private setNip77Cache(relayUrl: string, supported: boolean): void {
    if (!this.cache) return;
    this.cache.put(`nip77:${relayUrl}`, { supported, checkedAt: Date.now() });
  }

  addRelays(newRelays: string[]): void {
    const existing = new Set(this.relays);
    const added: string[] = [];
    for (const relay of newRelays) {
      if (!existing.has(relay)) {
        this.relays.push(relay);
        existing.add(relay);
        added.push(relay);
      }
    }
    if (added.length > 0) {
      this.logger.info(`Added ${added.length} new relays to trawler (total: ${this.relays.length})`);
    }
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
