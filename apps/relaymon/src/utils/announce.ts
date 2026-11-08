import { publisherFactory, type PublicationContext } from "./publishTransport.ts";
import { getLogger, LogLevel } from "./logger.ts";
import { AnnounceMonitor } from "npm:@nostrwatch/announce";
import { getPublicKey } from "npm:nostr-tools";
import { hexToBytes } from "@noble/hashes/utils";
import { type QueueManager } from "./queueManager.ts";
import type { Config } from "../config/config.ts";
import { getErrorMessage } from "../types/errors.ts";
import { getPrivateKey } from "../core/daemon.ts";

const logger = getLogger("Announce");

export async function maybeAnnounce(config: Config, queueManager?: QueueManager, publication?: PublicationContext): Promise<void> {
  const createPublisher = publisherFactory(config, publication);
  let relaySet: Set<string>= new Set

  if (!config.monitor || !config.monitor.info) {
    logger.warn("Monitor metadata is missing; skipping announcement.");
    return;
  }

  // if (!config.announce?.relays || !Array.isArray(config.announce.relays) || config.announce.relays.length === 0) {
  //   logger.warn("Publisher relay list is missing; skipping announcement.");
  //   return;
  // }
  
  const { info: profile, owner, geo } = config?.monitor
  const { userMetaRelays } = config?.announce || {}
  const { relays:outboxRelays } = config?.publisher;
  const { networks } = config.relaymon || {}
  const { expires, timeout: timeouts } = config.relaymon?.checks?.options || {}
  const checks = config.relaymon?.checks?.enabled || []

  if(outboxRelays?.length) {
    outboxRelays.forEach( (relay:string) => relaySet.add(relay) )
  }

  if(userMetaRelays?.length) {
    userMetaRelays.forEach( (relay:string) => relaySet.add(relay) )
  }

  if(!expires) throw new Error("Check frequency (relaymon.checks.options.expires) is not set")

  // expires is already in ms after config processing (processConfigTimeValues)
  const frequency = (Math.round(expires / 1000)).toString()

  const sk = getPrivateKey();

  if (!sk) {
    logger.error("Missing or invalid RELAYMON_NSEC; cannot sign announcement.");
    return;
  }

  const pk = getPublicKey(hexToBytes(sk));

  const relays = Array.from(relaySet)

  const announcer = new AnnounceMonitor(
    pk,
    {
      publisherFactory: createPublisher,
      profile,
      owner,
      geo,
      outboxRelays,
      userDataRelays: userMetaRelays,
      networks,
      timeouts,
      frequency,
      checks,
      relays,
      clientTag: '@nostrwatch/relaymon',
    }
  );

  announcer.generate();

  try {
    await announcer.sign(sk);
  } catch (error: unknown) {
    logger.error("Error signing announcement: " + getErrorMessage(error));
    if (publication) await announcer.close();
    return;
  }

  try {
    if (queueManager) {
      const queue = queueManager;
      const maxRetries = config.publisher.retry?.maxRetries ?? 5;
      const initialBackoffMs = config.publisher.retry?.initialBackoffMs ?? 60000;
      // Reuse this generation's signed events and ACK state across attempts.
      const publishJob = async (retryCount = 0, backoffMs = initialBackoffMs): Promise<void> => {
        try {
          await announcer.publish();
          logger.info("Monitor announcement published successfully via queue.");
          if (publication) await announcer.close();
        } catch (error: unknown) {
          logger.error("Failed to publish monitor announcement via queue: " + getErrorMessage(error));
          if (!publication?.stopping && retryCount < maxRetries) {
            const nextRetryCount = retryCount + 1;
            const nextBackoffMs = backoffMs * 2;
            logger.info(`Scheduling announcement retry ${nextRetryCount}/${maxRetries} in ${(nextBackoffMs / 1000).toFixed(1)}s`);
            const timer = setTimeout(() => {
              if (publication?.stopping) return;
              queue.addPublishJob(() => publishJob(nextRetryCount, nextBackoffMs), {
                isRetry: true,
                category: 'announce',
              });
            }, nextBackoffMs);
            publication?.onStop(() => clearTimeout(timer));
          } else {
            if (publication) await announcer.close();
            logger.error(`Exceeded maximum retries (${maxRetries}) for monitor announcement`);
          }
          // QueueManager owns failure metrics; it does not schedule retries.
          throw error;
        }
      };
      queue.addPublishJob(() => publishJob(), { isRetry: false, category: 'announce' });
      logger.info("Added monitor announcement to publish queue.");
    } else {
      // Fallback to direct publishing if no queue manager is available
      try { await announcer.publish(); } finally { if (publication) await announcer.close(); }
      logger.info("Monitor announcement published successfully.");
    }
  } catch (error: unknown) {
    logger.error("Failed to handle monitor announcement: " + getErrorMessage(error));
    throw error;
  }
}
