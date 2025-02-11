import { getLogger } from "./logger.ts";
import { AnnounceMonitor } from "npm:@nostrwatch/announce";

export async function maybeAnnounce(config: any): Promise<void> {
  const logger = getLogger("Announce");

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
  }, 'pubkey');

  const privkey = Deno.env.get("DAEMON_PRIVKEY");
  if (!privkey) {
    logger.error("Missing DAEMON_PRIVKEY; cannot sign announcement.");
    return;
  }

  try {
    announcer.signEvent(privkey);
  } catch (error) {
    logger.error("Error signing announcement: " + error.message);
    return;
  }

  const event = announcer.getEvent();
  try {
    await announcer.publishEvent(event, config.publisher.relays);
    logger.info("Monitor announcement published successfully.");
  } catch (error: any) {
    logger.error("Failed to publish monitor announcement: " + error.message);
  }
}
