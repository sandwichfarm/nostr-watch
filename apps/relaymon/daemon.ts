import { QueueManager } from "./queueManager.ts";
import { Worker } from "./worker.ts";
import { RelaySeeder } from "./seeder.ts";
import { getLogger } from "./logger.ts";
import { delay } from "npm:@nostrwatch/utils";
import { getExpiredRelays } from "./db.ts";
import { maybeAnnounce } from "./announce.ts";

export async function runDaemon(config: any): Promise<void> {
  const logger = getLogger("Daemon");

  await maybeAnnounce(config);

  const queueManager = new QueueManager(
    config.queue.workerConcurrency,
    2
  );
  const pubkey = Deno.env.get("DAEMON_PUBKEY") || "";
  const worker = new Worker(pubkey, queueManager, config);

  const seeder = new RelaySeeder({
    interval: config.relaymon.seed.interval,
    sources: config.relaymon.seed.sources,
    options: {
      ...config.relaymon.seed.options,
      allowedNetworks: config.relaymon.networks,
      config: config?.seed || [],
    },
  });
  seeder.start();

  async function checkExpiredRelays() {
    console.log('checking expired relays');
    while (true) {
      const expiredRelays = getExpiredRelays(
        config.relaymon.checks.options.expires,
        config.relaymon.networks
      );
      logger.info(`Found ${expiredRelays.length} expired relays in the DB.`);
      
      let toEnqueue: string[] = [];
      const maxValue = config.relaymon.checks.options.max;
      if (typeof maxValue === "number") {
        toEnqueue = expiredRelays.slice(0, maxValue);
      } else if (typeof maxValue === "string" && maxValue.trim().endsWith("%")) {
        const percentage = parseFloat(maxValue) / 100;
        const count = Math.ceil(expiredRelays.length * percentage);
        toEnqueue = expiredRelays.slice(0, count);
      } else {
        toEnqueue = expiredRelays;
      }

      for (const relay of toEnqueue) {
        queueManager.addCheckJob(async () => {
          await worker.processRelay(relay);
        });
      }
      await delay(config.relaymon.checks.options.interval);
    }
  }

  await Promise.all([
    checkExpiredRelays(),
  ]);
}
