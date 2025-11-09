import { getLogger, LogLevel } from "./logger.ts";
import { AnnounceMonitor } from "npm:@nostrwatch/announce";
import { getPublicKey } from "npm:nostr-tools";
import { type QueueManager } from "./queueManager.ts";
import { timeString } from "../config/config.ts";
import type { Config } from "../config/config.ts";
import { getErrorMessage } from "../types/errors.ts";

const logger = getLogger("Announce");

export async function maybeAnnounce(config: Config, queueManager?: QueueManager): Promise<void> {
  if (!config.monitor || !config.monitor.info) {
    logger.warn("Monitor metadata is missing; skipping announcement.");
    return;
  }
  if (!config.announce?.relays || !Array.isArray(config.announce.relays) || config.announce.relays.length === 0) {
    logger.warn("Publisher relay list is missing; skipping announcement.");
    return;
  }

  const { info: profile, owner, geo, relays } = config.monitor
  const { userDataRelays } = config.announce?.relays || []
  const { networks } = config.relaymon || []
  const { expires, timeout: timeouts, checks } = config.relaymon?.checks?.options || {}

  if(!expires) throw new Error("Announce frequency is not set")

  const frequency = (Math.round(timeString(expires)/1000)).toString()


  const sk = Deno.env.get("DAEMON_PRIVKEY");

  if (!sk) {
    logger.error("Missing DAEMON_PRIVKEY; cannot sign announcement.");
    return;
  }

  const pk = getPublicKey(sk);

  const announcer = new AnnounceMonitor(
    pk,
    {
      profile,
      owner,
      geo,
      relays,
      networks,
      timeouts,
      frequency,
      checks,

      userDataRelays
    }
  );

  announcer.generate();

  try {
    await announcer.sign(sk);
  } catch (error: unknown) {
    logger.error("Error signing announcement: " + getErrorMessage(error));
    return;
  }

  try {
    if (queueManager) {
      // Use the queue manager to publish the announcement
      queueManager.addPublishJob(async () => {
        try {
          await announcer.publish();
          logger.info("Monitor announcement published successfully via queue.");
        } catch (error: unknown) {
          logger.error("Failed to publish monitor announcement via queue: " + getErrorMessage(error));
          throw error; // Rethrow to trigger retry mechanism
        }
      });
      logger.info("Added monitor announcement to publish queue.");
    } else {
      // Fallback to direct publishing if no queue manager is available
      await announcer.publish();
      logger.info("Monitor announcement published successfully.");
    }
  } catch (error: unknown) {
    logger.error("Failed to handle monitor announcement: " + getErrorMessage(error));
  }
}
