import { getLogger, LogLevel } from "./logger.ts";
import { AnnounceMonitor } from "npm:@nostrwatch/announce";
import { getPublicKey } from "npm:nostr-tools";

const logger = getLogger("Announce");

export async function maybeAnnounce(config: any): Promise<void> {
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
    announcer.sign(privkey);
  } catch (error) {
    logger.error("Error signing announcement: " + error.message);
    return;
  }

  try {
    await announcer.publish();
    logger.info("Monitor announcement published successfully.");
  } catch (error: any) {
    logger.error("Failed to publish monitor announcement: " + error.message);
  }
}
