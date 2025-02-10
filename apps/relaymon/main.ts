// main.ts
import { header } from "./header.ts";
import { loadConfig } from "./config.ts";
import { runDaemon } from "./daemon.ts";

async function main() {
  try {
    const config = await loadConfig("./config.yaml");
    console.log("Configuration loaded successfully.");
    await header();
    await runDaemon(config);
  } catch (error) {
    console.error("Error loading configuration or starting the daemon:", error);
  }
}

main();
