/// <reference lib="deno.ns" />

// Deno-native seeder adapted from relaymon's seeder
import { delay } from "https://deno.land/std@0.214.0/async/delay.ts";
import { parseRelayNetwork } from "@nostrwatch/utils/network";
import { DB } from "https://deno.land/x/sqlite/mod.ts";
import { getLogger, LogLevel } from "./logger.ts";
import * as nostrwatchDB from "@nostrwatch/db";
import nostrings from '@nostrwatch/nostrings';
import { Relay } from "applesauce-relay";
import { merge, lastValueFrom, toArray } from "rxjs";

const nostrNow = () => Math.round(Date.now() / 1000);

export interface SeederOptions {
  interval: number;
  sources: string[];
  options: {
    allowedNetworks?: string[];
    db?: { path: string; enableWAL?: boolean };
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
  private options: SeederOptions['options'];
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
    try {
      this.lastSeedTimestamps = nostrwatchDB.getSeederTimestamps();
      this.logger.debug(`Loaded last seed timestamps: ${JSON.stringify(this.lastSeedTimestamps)}`);
    } catch (_) {
      this.lastSeedTimestamps = {};
    }

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

  async seed(): Promise<string[]> {
    let seeds: string[] = [];
    const timestamps: Record<string, number> = {};

    try {
      if (this.sources.includes("config")) {
        try {
          const [list, ts] = await this.seedFromConfig();
          seeds = seeds.concat(list);
          timestamps["config"] = ts;
        } catch (error) {
          this.logger.error(`Error in seedFromConfig: ${error}`);
        }
      }

      if (this.sources.includes("static")) {
        try {
          const [list, ts] = await this.seedFromStatic();
          seeds = seeds.concat(list);
          timestamps["static"] = ts;
        } catch (error) {
          this.logger.error(`Error in seedFromStatic: ${error}`);
        }
      }

      if (this.sources.includes("cache")) {
        try {
          const [list, ts] = await this.seedFromCache();
          seeds = seeds.concat(list);
          timestamps["cache"] = ts;
        } catch (error) {
          this.logger.error(`Error in seedFromCache: ${error}`);
        }
      }

      if (this.sources.includes("api")) {
        try {
          const [list, ts] = await this.seedFromAPI();
          seeds = seeds.concat(list);
          timestamps["api"] = ts;
        } catch (error) {
          this.logger.error(`Error in seedFromAPI: ${error}`);
        }
      }

      if (this.sources.includes("events")) {
        try {
          const [list, ts] = await this.seedFromEvents();
          seeds = seeds.concat(list);
          timestamps["events"] = ts;
        } catch (error) {
          this.logger.error(`Error in seedFromEvents: ${error}`);
        }
      }

      if (this.sources.includes("db")) {
        try {
          this.logger.debug("Starting seedFromDB strategy");
          const [list, ts] = await this.seedFromDB();
          seeds = seeds.concat(list);
          timestamps["db"] = ts;
          this.logger.debug(`seedFromDB completed, got ${list.length} relays`);
        } catch (error) {
          this.logger.error(`Error in seedFromDB: ${error}`);
        }
      }

      if (!seeds.length) {
        this.logger.warn("No seeds found, skipping seeding");
        return [];
      }

      // Sanitize and collect relay URLs
      for (const url of seeds) {
        try {
          const sanitizedUrls = nostrings.sanitize.relayUrls([url]);
          if (sanitizedUrls && sanitizedUrls.length > 0) {
            sanitizedUrls.forEach((sanitized: string) => this.relayList.add(sanitized));
          }
        } catch (error) {
          this.logger.error(`Error sanitizing relay URL ${url}: ${error}`);
        }
      }
      this.logger.debug(`Seeder aggregated ${this.relayList.size} unique relays from sources.`);

      if (!this.allowedNetworks || this.allowedNetworks.length === 0) {
        this.logger.warn("No allowed networks specified in config, using default 'clearnet'");
        this.allowedNetworks = ["clearnet"];
      }

      this.logger.debug(`Seeding relays using allowed networks: ${this.allowedNetworks.join(', ')}`);

      // Filter by allowed networks
      const relays = Array.from(this.relayList).filter(relay => {
        try {
          let detectedNetwork = "clearnet";
          try {
            detectedNetwork = parseRelayNetwork(relay);
          } catch (_) {
            return false;
          }

          if (!this.allowedNetworks.includes(detectedNetwork)) {
            this.logger.debug(`Skipping relay ${relay} - network ${detectedNetwork} not in allowed networks`);
            return false;
          }

          return true;
        } catch (relayError) {
          this.logger.error(`Error processing relay ${relay}: ${relayError}`);
          return false;
        }
      });

      // Save timestamps
      for (const method in timestamps) {
        try {
          this.lastSeedTimestamps[method] = timestamps[method];
          nostrwatchDB.saveSeederTimestamp(method, timestamps[method]);
        } catch (timeError) {
          this.logger.error(`Error saving timestamp for ${method}: ${timeError}`);
        }
      }

      return relays;
    } catch (error) {
      this.logger.error(`Unhandled error in seed method: ${error}`);
      return [];
    }
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
        const { parse } = await import("https://deno.land/std@0.218.2/yaml/mod.ts");
        data = parse(fileContents);
      } else {
        data = JSON.parse(fileContents);
      }
      const relays = data?.relays && Array.isArray(data.relays) ? data.relays : [];
      this.logger.debug(`seedFromStatic: Loaded ${relays.length} relays from static file.`);
      return [relays, nostrNow()];
    } catch (e) {
      this.logger.error(`seedFromStatic: Error reading static seed file: ${e}`);
      return [[], nostrNow()];
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
        relays = (responseData as any).relays || [];
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

    const relayInstances = fetchFromRelays.map(
      (url: string) => new Relay(url, { keepAlive: 0 })
    );

    try {
      this.logger.debug('Starting to fetch events...');
      const events$ = merge(
        ...relayInstances.map((r: Relay) => r.request({ kinds, authors, since } as any))
      );
      const events = await lastValueFrom(events$.pipe(toArray()), { defaultValue: [] as any[] });

      const relays: string[] = [];
      let newest = since;

      for (const ev of events) {
        if (ev.created_at > newest) newest = ev.created_at;
        const relay = ev.tags.find((tag: string[]) => tag[0] === "d")?.[1];
        if (!relay) continue;
        relays.push(relay);
      }

      this.logger.debug(`Processed ${events.length} events`);
      this.logger.debug(`seedFromEvents: Extracted ${relays.length} relays from events.`);

      return [[...new Set(relays)], newest];
    } catch (error) {
      this.logger.error(`Error in seedFromEvents: ${error}`);
      return [[], since];
    } finally {
      relayInstances.forEach((r: Relay) => r.close());
    }
  }

  async seedFromDB(): Promise<[string[], number]> {
    if (!this.options.db?.path) {
      this.logger.warn("seedFromDB: No database path specified in options.");
      return [[], nostrNow()];
    }

    if (!this.allowedNetworks || this.allowedNetworks.length === 0) {
      this.allowedNetworks = ["clearnet"];
    }

    try {
      // Try read-only mode first for better concurrency
      try {
        const tempDb = new DB(this.options.db.path, { mode: "read" });
        const relays: string[] = [];

        try {
          const rows = tempDb.query("SELECT url, network FROM relay_status");
          for (const row of rows) {
            const url = row[0] as string;
            let detectedNetwork = "clearnet";
            try {
              detectedNetwork = parseRelayNetwork(url);
            } catch (_) { /* use default */ }

            if (this.allowedNetworks.includes(detectedNetwork)) {
              relays.push(url);
            }
          }
          tempDb.close();
          this.logger.debug(`seedFromDB: Found ${relays.length} relays from database`);
          return [relays, nostrNow()];
        } catch (innerError) {
          try { tempDb.close(); } catch (_) { /* ignore */ }
          throw innerError;
        }
      } catch (readOnlyError) {
        // Fall back to standard approach via nostrwatchDB
        this.logger.warn(`seedFromDB: Read-only mode failed, trying standard approach`);
        const enableWAL = this.options.db.enableWAL !== false;
        try {
          nostrwatchDB.initDB(this.options.db.path, enableWAL);
        } catch (dbInitError) {
          this.logger.error(`Failed to initialize nostrwatchDB: ${dbInitError}`);
          return [[], nostrNow()];
        }

        const relays: string[] = [];
        const rows = [...nostrwatchDB.db.query("SELECT url, network FROM relay_status")];
        for (const row of rows) {
          const url = row[0] as string;
          let detectedNetwork = "clearnet";
          try {
            detectedNetwork = parseRelayNetwork(url);
          } catch (_) { /* use default */ }

          if (this.allowedNetworks.includes(detectedNetwork)) {
            relays.push(url);
          }
        }
        this.logger.debug(`seedFromDB: Found ${relays.length} relays from database (standard mode)`);
        return [relays, nostrNow()];
      }
    } catch (e) {
      this.logger.error(`seedFromDB: Error retrieving relays from database: ${e}`);
      return [[], nostrNow()];
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
