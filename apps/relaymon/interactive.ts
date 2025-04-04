#!/usr/bin/env deno run --allow-all

/**
 * RelayMon Interactive CLI
 * 
 * Entry point that delegates to modular implementation.
 * 
 * If you encounter database errors, try:
 * 1. Running deno task start -c config.yaml first
 * 2. Testing database access with: deno run --allow-all apps/relaymon/src/cli/interactive/db-init-test.ts config.yaml
 * 3. Make sure your database path is correct in config.yaml
 */

import { runInteractive } from "./src/cli/interactive/index.ts";

// Main function
async function main() {
  // Parse command line arguments
  const args = Deno.args;
  
  // Parse config path from arguments
  let configPath = "./config.yaml";
  const configArgIndex = Math.max(args.indexOf("-c"), args.indexOf("--config"));
  if (configArgIndex !== -1 && configArgIndex < args.length - 1) {
    configPath = args[configArgIndex + 1];
  }
  
  // Run the interactive CLI
  await runInteractive(configPath);
}

// Call main function
if (import.meta.main) {
  main().catch(error => {
    console.error(`Error in main function: ${error.message}`);
    console.error(error.stack);
    console.error("\nTROUBLESHOOTING:");
    console.error("1. Run 'deno task start -c config.yaml' first to initialize the database");
    console.error("2. Check your database path in config.yaml");
    console.error("3. Test database access with: deno run --allow-all apps/relaymon/src/cli/interactive/db-init-test.ts config.yaml");
    Deno.exit(1);
  });
} 