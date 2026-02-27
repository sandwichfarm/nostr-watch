import { getLogger, LogLevel } from "./logger.ts";
import { AnnounceMonitor } from "npm:@nostrwatch/announce";
import { getPublicKey } from "npm:nostr-tools";
import { type QueueManager } from "./queueManager.ts";
import { timeString } from "../config/config.ts";
import type { Config } from "../config/config.ts";
import { getErrorMessage } from "../types/errors.ts";
import { getPrivateKey } from "../core/daemon.ts";

const logger = getLogger("Announce");

export async function maybeAnnounce(config: Config, queueManager?: QueueManager): Promise<void> {
  let relaySet: Set<string>= new Set

  if (!config.monitor || !config.monitor.info) {
    logger.warn("Monitor metadata is missing; skipping announcement.");
    return;
  }

  // if (!config.announce?.relays || !Array.isArray(config.announce.relays) || config.announce.relays.length === 0) {
  //   logger.warn("Publisher relay list is missing; skipping announcement.");
  //   return;
  // }
  
  const { info: profile, owner, geo } = config?.monitor5
  const { userMetaRelays } = config?.announce || []
  const { relays:outboxRelays } = config?.publisher;
  const { networks } = config.relaymon || []
  const { expires, timeout: timeouts } = config.relaymon?.checks?.options || {}
  const checks = config.relaymon?.checks?.enabled || []

  if(outboxRelays?.length) {
    outboxRelays.forEach( (relay:string) => relaySet.add(relay) )
  }

  if(userMetaRelays?.length) {
    userMetaRelays.forEach( (relay:string) => relaySet.add(relay) )
  }

  if(!expires) throw new Error("Announce frequency is not set")

  const frequency = (Math.round(timeString(expires)/1000)).toString()

  const sk = getPrivateKey();

  if (!sk) {
    logger.error("Missing or invalid RELAYMON_NSEC; cannot sign announcement.");
    return;
  }

  const pk = getPublicKey(sk);

  const relays = Array.from(relaySet)

  const announcer = new AnnounceMonitor(
    pk,
    {
      profile,
      owner,
      geo,
      outboxRelays,
      networks,
      timeouts,
      frequency,
      checks,
      relays
    }
  );

  const announceEvents = announcer.generate();

  // Add client tag to all announcement events before signing
  for (const ev of Object.values(announceEvents)) {
    const generated = (ev as any)?.event ?? ev;
    if (generated?.tags && Array.isArray(generated.tags)) {
      generated.tags.push(['client', '@nostrwatch/relaymon']);
    }
  }

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
      }, { category: 'announce' });
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
