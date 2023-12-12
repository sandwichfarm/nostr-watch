import Logger from "@nostrwatch/logger";
import { parseRelayList } from "./parsers.js";
import NDK from "@nostr-dev-kit/ndk";
import lmdb from "./lmdb.js";
import { now } from "@nostrwatch/utils";
import config from "./config.js"

import { parseRelayNetwork } from "../../utils/index.js"

const logger = new Logger('watcher')

export const relayListWatcher = async function(options) {
  const { openSignal, closeSignal, queues } = options

  let since = lmdb.cachetime.get('watcherLastUpdate') || 0;
  const relayListProviders = config?.relay_list_providers || [];

  if(!relayListProviders.length) 
    return logger.warn('relay_list_providers not set in config')
  
  if(!relayListProviders?.length)
    return logger.warn('RELAY_LIST_PROVIDERS not set in .env')
  
  const ndk = new NDK({
    explicitRelayUrls: relayListProviders,
  });

  let subscription
  let connected = false

  openSignal([queues.batchQueue, queues.trawlQueue], async () => {
    if(!connected) {
      connected = true
      console.log('open!')
      await ndk.connect().catch( () => connected = false);
      subscription = subscribeToRelayLists({ ndk, since })
    }
  })

  closeSignal([queues.batchQueue, queues.trawlQueue], async () => {
    if(connected) {
      connected = false
      console.log('close!')
      since = now()
      lmdb.cachetime.set('watcherLastUpdate', since)
      subscription = null
      await ndk.disconnect()
    }
  })
}

const subscribeToRelayLists = async function(options) {
  const { ndk, since } = options

  console.log('subscribing!')

  const sub = ndk.subscribe({ 
    kinds: [ 2, 3, 10002 ],
    since
  });

  sub.on("event", (note) => {
    console.log('note!')
    let relayList = parseRelayList(note)
    if(!(relayList instanceof Array)) 
      return
    relayList.map( relay => {
      const result = new ResultInterface()
      result.set('url', relay)
      result.set('network', parseRelayNetwork(relay))
      return result.dump()
    })
    logger.info(`new relays found: ${relayList.length}`)
    lmdb.relay.batch.insertIfNotExists(relayList)
  });

  return sub
}