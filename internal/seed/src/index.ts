// seeder.ts
import { setTimeout as delay } from 'node:timers/promises';
import { readFile } from 'node:fs/promises';
import { load as yamlParse } from 'js-yaml';

// Import dependencies
import { NostrFetcher } from 'nostr-fetch';
import { parseRelayNetwork } from '@nostrwatch/utils';
import * as nostrwatchDB from '@nostrwatch/db';
import nostrings from '@nostrwatch/nostrings';

import { getLogger, LogLevel } from './utils/logger.js';

const nostrNow = () => Math.round(Date.now() / 1000);

export interface SeederOptions {
  interval: number;
  sources: string[];
  options: {
    db?: { path: string; enableWAL?: boolean };
    static?: { path: string };
    config?: string[];
    api?: { rest_api: string };
    events?: { pubkeys: string[]; relays: string[] };
    allowedNetworks?: string[];
    logLevel?: LogLevel;
    isRelayBlocked?: (relay: string) => boolean;
  };
}

export class RelaySeeder {
  private interval: number;
  private sources: string[];
  private options: any;
  private logger = getLogger("Seeder");
  private relayList: Set<string> = new Set();
  private running: boolean = false;
  private allowedNetworks: string[] = [];
  private lastSeedTimestamps: Record<string, number> = {};
  private isRelayBlocked: (relay: string) => boolean;

  constructor(options: SeederOptions) {
    this.interval = options.interval;
    this.sources = options.sources;
    this.options = options.options;
    this.allowedNetworks = options.options.allowedNetworks || [];
    
    // Load the last seed timestamps from the database
    this.lastSeedTimestamps = nostrwatchDB.getSeederTimestamps();
    this.logger.debug(`Loaded last seed timestamps: ${JSON.stringify(this.lastSeedTimestamps)}`);

    // Set logger level from config if available
    if (options.options?.logLevel) {
      this.logger.setLevel(options.options.logLevel);
    }
    
    // Initialize the relay block function
    this.isRelayBlocked = options.options.isRelayBlocked || ((relay: string) => false);
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
    let relays: string[] = [];

    try {
      // Try each seeding strategy, but don't let individual failures stop the entire process
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

      if(!seeds.length) {
        this.logger.warn("No seeds found, skipping seeding");
        return [];
      }

      // Add all found relay URLs to the set
      for (const url of seeds) {
        try {
          // nostrings.sanitize.relayUrls expects an array, but we're processing one URL at a time
          const sanitizedUrls = nostrings.sanitize.relayUrls([url]);
          if (sanitizedUrls && sanitizedUrls.length > 0) {
            sanitizedUrls.forEach((sanitized: string) => this.relayList.add(sanitized));
          }
        } catch (error) {
          this.logger.error(`Error sanitizing relay URL ${url}: ${error}`);
        }
      }
      this.logger.debug(`Seeder aggregated ${this.relayList.size} unique relays from sources.`);

      // Validate allowed networks
      if (!this.allowedNetworks || this.allowedNetworks.length === 0) {
        this.logger.warn("No allowed networks specified in config, using default 'clearnet'");
        this.allowedNetworks = ["clearnet"]; // Default to clearnet instead of failing
      }
      
      this.logger.debug(`Seeding relays using allowed networks: ${this.allowedNetworks.join(', ')}`);

      // Only persist new relays
      let newRelaysCount = 0;
      relays = Array.from(this.relayList).filter(relay => {
        try {
          // Check if the relay is blocked by the passed block function
          if (this.isRelayBlocked(relay)) {
            this.logger.debug(`Skipping relay ${relay} - blocked by isRelayBlocked function`);
            return;
          }
          
          // Use parseRelayNetwork to determine the correct network for this relay URL
          let detectedNetwork;
          try {
            detectedNetwork = parseRelayNetwork(relay);
          } catch (parseError) {
            this.logger.warn(`Failed to parse network for ${relay}: ${parseError}. Using '${detectedNetwork}' as fallback.`);
            return;
          }
          
          // Check if the detected network is in our allowed networks
          if (!this.allowedNetworks.includes(detectedNetwork)) {
            this.logger.debug(`Skipping relay ${relay} - network ${detectedNetwork} not in allowed networks: ${this.allowedNetworks.join(', ')}`);
            return;
          }
          
        } catch (relayError) {
          this.logger.error(`Error processing relay ${relay}: ${relayError}`);
          return;
        }
        return true;
      }); 
    } catch (error) {
      this.logger.error(`Unhandled error in seed method: ${error}`);
    }
    return relays
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
      const fileContents = await readFile(this.options.static.path, 'utf8');
      let data: any;
      if (this.options.static.path.endsWith(".yaml") || this.options.static.path.endsWith(".yml")) {
        data = yamlParse(fileContents);
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
    try {
      const rows = [...nostrwatchDB.db.query("SELECT url, network FROM relay_status")];
      const relays: string[] = [];
      rows.forEach(row => {
        const url = row[0] as string;
        const network = row[1] as string;
        if (this.allowedNetworks.length === 0 || this.allowedNetworks.includes(network)) {
          relays.push(url);
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
        // Using type assertion to avoid TypeScript error
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
    this.logger.debug(`Since timestamp: ${since}`);
    
    const fetcher = NostrFetcher.init();
    
    try {
      this.logger.debug('Starting to fetch events...');
      const events = (fetcher as any).allEventsIterator(
        fetchFromRelays, 
        { kinds, authors }, 
        { since: Math.round(Date.now() / 1000)-60*60*24 }
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

  async seedFromDB(): Promise<[string[], number]> {
    if (!this.options.db?.path) {
      this.logger.warn("seedFromDB: No database path specified in options.");
      return [[], nostrNow()];
    }
    
    // Make sure we have some allowed networks
    this.logger.debug(`seedFromDB: Checking allowed networks: ${JSON.stringify(this.allowedNetworks)}`);
    if (!this.allowedNetworks || this.allowedNetworks.length === 0) {
      this.logger.warn("seedFromDB: No allowed networks specified, using default 'clearnet'");
      this.allowedNetworks = ["clearnet"]; // Default to clearnet instead of failing
    }
    
    this.logger.debug(`seedFromDB: Using allowed networks: ${this.allowedNetworks.join(', ')}`);
    
    try {
      this.logger.debug(`seedFromDB: Initializing database connection to ${this.options.db.path}`);
      
      // Initialize the DB with WAL mode for better concurrency
      const enableWAL = this.options.db.enableWAL !== false; 
      this.logger.debug(`seedFromDB: Initializing DB with WAL mode: ${enableWAL}`);
      try {
        nostrwatchDB.initDB(this.options.db.path, enableWAL);
      } catch (dbInitError) {
        this.logger.error(`Failed to initialize nostrwatchDB: ${dbInitError}`);
        return [[], nostrNow()]; // Return empty array on initialization failure
      }
      
      // Get all relays
      const relays: string[] = [];
      const networkStats: Record<string, number> = {};
      
      try {
        const rows = [...nostrwatchDB.db.query("SELECT url, network FROM relay_status")];
        this.logger.debug(`seedFromDB: Retrieved ${rows.length} relays from database, filtering by network`);
        
        for (const row of rows) {
          try {
            const url = row[0] as string;
            const dbNetwork = row[1] as string;
            
            let detectedNetwork = "clearnet"; // Default
            try {
              detectedNetwork = parseRelayNetwork(url);
            } catch (parseError) {
              this.logger.warn(`Failed to parse network for ${url}: ${parseError}. Using '${detectedNetwork}' as fallback.`);
            }
            
            networkStats[detectedNetwork] = (networkStats[detectedNetwork] || 0) + 1;
            
            if (this.allowedNetworks.includes(detectedNetwork)) {
              relays.push(url);
            }
            
            if (dbNetwork !== detectedNetwork) {
              this.logger.debug(`Network mismatch for ${url}: stored as ${dbNetwork}, detected as ${detectedNetwork}`);
            }
          } catch (rowError) {
            this.logger.error(`Error processing row: ${rowError}`);
          }
        }
        this.logger.debug(`Network distribution of retrieved relays: ${JSON.stringify(networkStats)}`);
        this.logger.debug(`seedFromDB: Filtered to ${relays.length} relays matching networks: ${this.allowedNetworks.join(', ')}`);
        return [relays, nostrNow()];
      } catch (queryError) {
        this.logger.error(`seedFromDB: Query error: ${queryError}`);
        return [[], nostrNow()];
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
  }
}
