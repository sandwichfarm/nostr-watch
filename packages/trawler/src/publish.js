import Publish from '@nostrwatch/publisher'
import rcache from "./relaydb.js"
import config from "./config.js"
import { lastPublishedId } from "./utils.js"

const p30066 = new Publish.Kind30066()

const filterRelayProperties = (relay) => {
  const relay_ = {}
  const relayProps = config?.trawler?.sync?.relays?.out?.events?.properties
  if(!(relayProps instanceof Array)) return relay
  Object.entries( relay ).forEach( entry => {
    if( relayProps.includes(entry[0]) )
      relay_[entry[0]] = entry[1]
  })
  return relay_
}

const filterRelaysProperties = (relays) => {  
  return relays.map( filterRelayProperties )
}

const relayIsExpired = (relay) => {
  const lastPublished = rcache.cachetime.get.one( lastPublishedId(relay.url) );
  const expiry = eval(config?.trawler?.publish?.expiry) || 4 * 60 * 60 * 10000;
  if (!lastPublished) return true;
  if (lastPublished < new Date() - expiry) return true;
  return false;
}

const updatePublishTimes = async (relays=[]) => {
  for await ( const relay of relays ) {
    await rcache.cachetime.set( lastPublishedId(relay.url), Date.now() )
  }
}

export const publishOne = async (relay) => {
  relay = filterRelayProperties(relay)
  if(!relay) throw new Error('publishOne(): relay must be defined')
  await p30066.one(relay)
}

export const publishMany = async (relays = []) => {
  relays = filterRelaysProperties(relays)
  // console.log('before filter', relays.length)
  const filteredRelays = relays.filter(relayIsExpired);
  // console.log('after filter', filteredRelays.length)
  if (!filteredRelays.length) return;
  await p30066.many(filteredRelays);
  await updatePublishTimes(filteredRelays);
}

export const publishAll = async () => {
  const relays = rcache.relay.get.all()
  await publishMany(relays)
}

export default {
  many: publishMany,
  one: publishOne,
  all: publishAll
}