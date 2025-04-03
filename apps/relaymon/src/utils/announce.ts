import { getLogger, LogLevel } from "./logger.ts";
import { AnnounceMonitor } from "npm:@nostrwatch/announce";
import { getPublicKey } from "npm:nostr-tools";

const logger = getLogger("Announce");

export async function maybeAnnounce(config: any, queueManager?: any): Promise<void> {
  if (!config.monitor || !config.monitor.info) {
    logger.warn("Monitor metadata is missing; skipping announcement.");
    return;
  }
  if (!config.publisher?.relays || !Array.isArray(config.publisher.relays) || config.publisher.relays.length === 0) {
    logger.warn("Publisher relay list is missing; skipping announcement.");
    return;
  }

  const announcer = new AnnounceMonitor({
    slug: config.monitor.slug,
    name: config.monitor.info.name,
    about: config.monitor.info.about,
    nip05: config.monitor.info.nip05,
    owner: config.monitor.owner,
    geo: config.monitor.geo,
  }, getPublicKey(Deno.env.get("DAEMON_PRIVKEY")));

  const privkey = Deno.env.get("DAEMON_PRIVKEY");
  if (!privkey) {
    logger.error("Missing DAEMON_PRIVKEY; cannot sign announcement.");
    return;
  }

  announcer.generate();

  try {
    announcer.sign(privkey);
  } catch (error) {
    logger.error("Error signing announcement: " + error.message);
    return;
  }

  try {
    if (queueManager) {
      // Use the queue manager to publish the announcement
      queueManager.addPublishJob(async () => {
        try {
          const result = await announcer.publish();
          logger.info("Monitor announcement published successfully via queue.");
        } catch (error: any) {
          logger.error("Failed to publish monitor announcement via queue: " + error.message);
          throw error; // Rethrow to trigger retry mechanism
        }
      });
      logger.info("Added monitor announcement to publish queue.");
    } else {
      // Fallback to direct publishing if no queue manager is available
      const result = await announcer.publish();
      logger.info("Monitor announcement published successfully.");
    }
  } catch (error: any) {
    logger.error("Failed to handle monitor announcement: " + error.message);
  }
}
