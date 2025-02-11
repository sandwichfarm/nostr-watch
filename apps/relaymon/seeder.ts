// seeder.ts
import { delay } from "npm:@nostrwatch/utils";
import { DB } from "https://deno.land/x/sqlite/mod.ts";
import { getLogger } from "./logger.ts";
import { persistResult } from "./db.ts";

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
  };
}

export class RelaySeeder {
  private interval: number;
  private sources: string[];
  private options: any;
  private logger = getLogger("RelaySeeder");
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

    console.log("Seed sources:", this.sources);

    if ((this.sources.includes("cache") || this.sources.includes("db")) && options.options.db?.path) {
      this.db = new DB(options.options.db.path);
    }
  }

  getRelays(): string[] {
    return Array.from(this.relayList);
  }

  getLastSeedTimestamps(): Record<string, number> {
    return this.lastSeedTimestamps;
  }

  async seed(): Promise<void> {
    console.log('seeding');
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
      console.log('seeding events');
      const [list, ts] = await this.seedFromEvents();
      seeds = seeds.concat(list);
      timestamps["events"] = ts;
    }

    seeds.forEach(url => this.relayList.add(url));
    // this.lastSeedTimestamps = timestamps;
    this.logger.info(`Seeder aggregated ${this.relayList.size} unique relays from sources.`);

    for (const relay of this.relayList) {
      const result = {
        url: relay,
        checked_at: -1,
        network: this.allowedNetworks.length > 0 ? this.allowedNetworks[0] : "clearnet"
      };
      persistResult(result);
    }
  }

  async seedFromConfig(): Promise<[string[], number]> {
    const relays = this.options.config && Array.isArray(this.options.config) ? this.options.config : [];
    this.logger.info(`seedFromConfig: Found ${relays.length} relays from config.`);
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
      this.logger.info(`seedFromStatic: Loaded ${relays.length} relays from static file.`);
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
      this.logger.info(`seedFromCache: Found ${relays.length} relays from cache.`);
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
      this.logger.info("seedFromAPI: Fetching relay data from API...");
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
      this.logger.info(`seedFromAPI: Received ${relays.length} relays from API.`);
      return [relays, nostrNow()];
    } catch (e) {
      this.logger.error(`seedFromAPI: Error fetching from API: ${e}`);
      return [[], nostrNow()];
    }
  }

  async seedFromEvents(): Promise<[string[], number]> {
    console.log('importing events');
    if (!this.options.events?.pubkeys) {
      throw new Error("seedFromEvents: No pubkeys specified in events options.");
    }
    if (!this.options.events?.relays) {
      throw new Error("seedFromEvents: No relays specified in events options.");
    }
    
    // Retrieve the last seed timestamp for events; default to 0 if not set.
    let since = this.lastSeedTimestamps.events || 0;
  
    const { NostrFetcher } = await import("npm:nostr-fetch");
    const fetcher = NostrFetcher.init();
    const kinds = [30166];
    const authors = this.options.events.pubkeys;
    const fetchFromRelays = this.options.events.relays;
    
    // Pass the last seed timestamp to fetchAllEvents so that only new events are fetched.
    const events = await fetcher.fetchAllEvents(fetchFromRelays, { kinds, authors }, { since });
    const relays: string[] = [];
    let newest = since; // Initialize with the previous since value
    for await (const ev of events) {
      // Update the newest timestamp if the event is later.
      if (ev.created_at > newest) newest = ev.created_at;
      const relay = ev.tags.find((tag: string[]) => tag[0] === "d")?.[1];
      if (!relay) continue;
      relays.push(relay);
    }
    fetcher.shutdown();
    this.logger.info(`seedFromEvents: Extracted ${relays.length} relays from events.`);
    
    // Update the last seed timestamp for events to the newest event time.
    this.lastSeedTimestamps.events = newest;
    return [[...new Set(relays)], newest];
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
