import Logger from "@nostrwatch/logger";
import { parseRelayList } from "./parsers.js";
import NDK from "@nostr-dev-kit/ndk";
import lmdb from "./lmdb.js";
import { now } from "@nostrwatch/utils";
import config from "./config.js"

const logger = new Logger('watcher')

export const relayListWatcher = async function(options) {
  const { openSignal, closeSignal, queues } = options

  const since = lmdb.cachetime.get('watcher_last_update') || 0;
  const relayListProviders = config?.relay_list_providers || [];

  if(!relayListProviders.length) 
    return logger.warn('relay_list_providers not set in config')
  
  if(!relayListProviders?.length)
    return logger.warn('RELAY_LIST_PROVIDERS not set in .env')
  
  const ndk = new NDK({
    explicitRelayUrls: relayListProviders,
  });

  let subscription

  openSignal([queues.batchQueue, queues.crawlQueue], async () => {
    await ndk.connect();
    subscription = subscribeToRelayLists({ ndk, since, queues })
  })

  closeSignal(queues.crawlQueue, async () => {
    since = now()
    subscription = null
    await ndk.disconnect()
  })
}

const subscribeToRelayLists = async function(options) {
  const { ndk, since, queues } = options
  const { postProcessQueue } = queues

  const sub = ndk.subscribe({ 
    kinds: [ 2, 3, 10002 ],
    since
  });

  sub.on("event", (note) => {
    const relayList = parseRelayList(note)
    postProcessQueue.add('postProcessJob', { relayList });
  });

  return sub
}