/// <reference lib="deno.ns" />

import { config as dotenvConfig } from "https://deno.land/x/dotenv@v3.2.2/mod.ts";
import { loadConfig } from "./config.ts";
import { trawl } from './trawl.ts';
import Logger from '@nostrwatch/logger';

// Initialize environment variables
await dotenvConfig({ export: true });

const logger = new Logger('Main');

logger.debug(`Current Directory: ${Deno.cwd()}`);

// Run the trawler with configuration and handle any errors
try {
  // Load the configuration
  const config = await loadConfig();
  
  // Pass the configuration to the trawl function
  const trawlOptions = {
    dbPath: Deno.env.get('TRAWLER_DB_PATH') || config?.trawler?.db?.path,
    enableWAL: Deno.env.get('TRAWLER_DB_WAL') !== undefined
      ? Deno.env.get('TRAWLER_DB_WAL') !== 'false'
      : config?.trawler?.db?.enableWAL,
    nostrawlOptions: {
      relaysPerBatch: config?.trawler?.relaysPerBatch || 10,
      adapterOptions: {
        concurrency: config?.trawler?.concurrency || 2
      }
    }
  };
  
  logger.info(`Starting trawler with options: ${JSON.stringify(trawlOptions, null, 2)}`);
  
  // Start trawling and keep the process running
  await trawl(trawlOptions);
  
  // Create a never-resolving promise to keep the process alive
  await new Promise(() => {
    // This promise intentionally never resolves
    // It keeps the process running until manually terminated
  });
} catch (error) {
  logger.error(error instanceof Error ? error.message : String(error));
  Deno.exit(1);
} 
