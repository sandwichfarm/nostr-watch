// seeder.ts
import { delay } from "npm:@nostrwatch/utils";
import { DB } from "https://deno.land/x/sqlite/mod.ts";
import { getLogger, LogLevel } from "./logger.ts";
import { persistResult, seedNewRelay, saveSeederTimestamp, getSeederTimestamps } from "./db.ts";
import { NostrFetcher } from "npm:nostr-fetch@0.17.0";
import { logStatus, incrementNewRelaysFound } from "./status.ts";

const nostrNow = () => Math.round(Date.now() / 1000);

export interface SeederOptions {
  interval: number;
  sources: string[];
  options: {
    allowedNetworks?: string[];
    db?: { path: string };
    static?: { path: string };
    config?: string[];
    api?: { rest_api: string };
    events?: { pubkeys: string[]; relays: string[] };
    logLevel?: LogLevel;
  };
}

export class RelaySeeder {
  private interval: number;
  private sources: string[];
  private options: any;
  private logger = getLogger("Seeder");
  private relayList: Set<string> = new Set();
  private running: boolean = false;
  private db?: DB;
  private allowedNetworks: string[] = [];
  private lastSeedTimestamps: Record<string, number> = {};

  constructor(options: SeederOptions) {
    this.interval = options.interval;
    this.sources = options.sources;
    this.options = options.options;
    this.allowedNetworks = options.options.allowedNetworks || [];

    if ((this.sources.includes("cache") || this.sources.includes("db")) && options.options.db?.path) {
      this.db = new DB(options.options.db.path);
    }
    
    // Load the last seed timestamps from the database
    this.lastSeedTimestamps = getSeederTimestamps();
    this.logger.debug(`Loaded last seed timestamps: ${JSON.stringify(this.lastSeedTimestamps)}`);

    // Set logger level from config if available
    if (options.options?.logLevel) {
      this.logger.setLevel(options.options.logLevel);
    }
  }

  getRelays(): string[] {
    return Array.from(this.relayList);
  }

  getLastSeedTimestamps(): Record<string, number> {
    return this.lastSeedTimestamps;
  }

  async seed(): Promise<void> {
    let seeds: string[] = [];
    const timestamps: Record<string, number> = {};

    if (this.sources.includes("config")) {
      const [list, ts] = await this.seedFromConfig();
      seeds = seeds.concat(list);
      timestamps["config"] = ts;
    }
    if (this.sources.includes("static")) {
      const [list, ts] = await this.seedFromStatic();
      seeds = seeds.concat(list);
      timestamps["static"] = ts;
    }
    if (this.sources.includes("cache")) {
      const [list, ts] = await this.seedFromCache();
      seeds = seeds.concat(list);
      timestamps["cache"] = ts;
    }
    if (this.sources.includes("api")) {
      const [list, ts] = await this.seedFromAPI();
      seeds = seeds.concat(list);
      timestamps["api"] = ts;
    }
    
    if (this.sources.includes("events")) {
      const [list, ts] = await this.seedFromEvents();
      seeds = seeds.concat(list);
      timestamps["events"] = ts;
    }

    seeds.forEach(url => this.relayList.add(url));
    this.logger.debug(`Seeder aggregated ${this.relayList.size} unique relays from sources.`);

    // Only persist new relays
    let newRelaysCount = 0;
    for (const relay of this.relayList) {
      const network = this.allowedNetworks.length > 0 ? this.allowedNetworks[0] : "clearnet";
      if (seedNewRelay(relay, network)) {
        newRelaysCount++;
        this.logger.debug(`New relay found and seeded: ${relay}`);
      }
    }

    // Update and save the timestamps
    for (const method in timestamps) {
      this.lastSeedTimestamps[method] = timestamps[method];
      saveSeederTimestamp(method, timestamps[method]);
    }

    // Update session stats with new relays found
    if (newRelaysCount > 0) {
      incrementNewRelaysFound(newRelaysCount);
      this.logger.debug(`Added ${newRelaysCount} new relays to session stats.`);
    }

    this.logger.debug(`Seeded ${newRelaysCount} new relays out of ${this.relayList.size} total relays.`);
  }

  async seedFromConfig(): Promise<[string[], number]> {
    const relays = this.options.config && Array.isArray(this.options.config) ? this.options.config : [];
    this.logger.debug(`seedFromConfig: Found ${relays.length} relays from config.`);
    return [relays, nostrNow()];
  }

  async seedFromStatic(): Promise<[string[], number]> {
    try {
      if (!this.options.static?.path) {
        this.logger.warn("seedFromStatic: No static seed file path specified.");
        return [[], nostrNow()];
      }
      const fileContents = await Deno.readTextFile(this.options.static.path);
      let data: any;
      if (this.options.static.path.endsWith(".yaml") || this.options.static.path.endsWith(".yml")) {
        const { parse } = await import("https://deno.land/std@0.203.0/encoding/yaml.ts");
        data = parse(fileContents);
      } else {
        data = JSON.parse(fileContents);
      }
      const relays = data?.relays && Array.isArray(data.relays) ? data.relays : [];
      this.logger.debug(`seedFromStatic: Loaded ${relays.length} relays from static file.`);
      return [relays,  nostrNow()];
    } catch (e) {
      this.logger.error(`seedFromStatic: Error reading static seed file: ${e}`);
      return [[],  nostrNow()];
    }
  }

  async seedFromCache(): Promise<[string[], number]> {
    if (!this.db) {
      this.logger.error("seedFromCache: No database configured for seeding.");
      return [[], nostrNow()];
    }
    try {
      const rows = [...this.db.query("SELECT url, network FROM relay_status")];
      const relays: string[] = [];
      rows.forEach(row => {
        const [url, network] = row;
        if (this.allowedNetworks.length === 0 || this.allowedNetworks.includes(network as string)) {
          relays.push(url as string);
        }
      });
      this.logger.debug(`seedFromCache: Found ${relays.length} relays from cache.`);
      return [relays, nostrNow()];
    } catch (e) {
      this.logger.error(`seedFromCache: Error reading from DB: ${e}`);
      return [[], nostrNow()];
    }
  }

  async seedFromAPI(): Promise<[string[], number]> {
    if (!this.options.api?.rest_api) {
      this.logger.warn("seedFromAPI: No REST API specified in options.");
      return [[], nostrNow()];
    }
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      this.logger.debug("seedFromAPI: Fetching relay data from API...");
      const response = await fetch(`${this.options.api.rest_api}/online`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!response.ok) {
        this.logger.warn(`seedFromAPI: API response not OK: ${response.status}`);
        return [[], nostrNow()];
      }
      const responseData = await response.json();
      let relays: string[] = [];
      if (Array.isArray(responseData)) {
        relays = responseData;
      } else if (typeof responseData === "object" && responseData !== null) {
        relays = responseData.relays || [];
      }
      this.logger.debug(`seedFromAPI: Received ${relays.length} relays from API.`);
      return [relays, nostrNow()];
    } catch (e) {
      this.logger.error(`seedFromAPI: Error fetching from API: ${e}`);
      return [[], nostrNow()];
    }
  }

  async seedFromEvents(): Promise<[string[], number]> {
    if (!this.options.events?.pubkeys) {
      throw new Error("seedFromEvents: No pubkeys specified in events options.");
    }
    if (!this.options.events?.relays) {
      throw new Error("seedFromEvents: No relays specified in events options.");
    }
    
    let since = this.lastSeedTimestamps.events || 0;
    this.logger.debug(`Events: Starting with timestamp ${since}`);
    
    const kinds = [30166];
    const authors = this.options.events.pubkeys;
    const fetchFromRelays = this.options.events.relays;

    this.logger.debug(`Fetching events from relays: ${fetchFromRelays.join(', ')}`);
    this.logger.debug(`Looking for kind ${kinds[0]} events from authors: ${authors.join(', ')}`);
    this.logger.debug(`Since timestamp: ${since}`);
    
    const fetcher = NostrFetcher.init();
    
    try {
      this.logger.debug('Starting to fetch events...');
      const events = await fetcher.fetchAllEvents(
        fetchFromRelays, 
        { kinds, authors }, 
        { since }
      );

      const relays: string[] = [];
      let newest = since;
      let eventCount = 0;

      this.logger.debug('Processing events...');
      for await (const ev of events) {
        eventCount++;
        this.logger.debug(`Processing event ${eventCount}: ${ev.id}`);
        if (ev.created_at > newest) newest = ev.created_at;
        const relay = ev.tags.find((tag: string[]) => tag[0] === "d")?.[1];
        if (!relay) {
          this.logger.debug(`Event ${ev.id} has no relay tag`);
          continue;
        }
        this.logger.debug(`Found relay: ${relay}`);
        relays.push(relay);
      }

      this.logger.debug(`Processed ${eventCount} events`);
      fetcher.shutdown();
      this.logger.debug(`seedFromEvents: Extracted ${relays.length} relays from events.`);
      this.logger.debug(`Events: Updating timestamp from ${since} to ${newest}`);
      
      return [[...new Set(relays)], newest];
    } catch (error) {
      this.logger.error(`Error in seedFromEvents: ${error}`);
      fetcher.shutdown();
      return [[], since];
    }
  }
  

  async start(): Promise<void> {
    this.running = true;
    while (this.running) {
      await this.seed();
      await delay(this.interval);
    }
  }

  stop(): void {
    this.running = false;
    if (this.db) {
      this.db.close();
    }
  }
}
