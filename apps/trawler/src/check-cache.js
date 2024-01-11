import { Nocap } from '@nostrwatch/nocap'
import { lastCheckedId } from '@nostrwatch/utils'
import Logger from '@nostrwatch/logger'

import rcache from './relaydb.js'
import config from './config.js'

import { retryId } from './utils.js'

const logger = new Logger('check-cache')

export default async () => {
  const relays = rcache.relay.get.all(['url', 'online'])
  const uncheckedRelays = getUncheckedRelays(relays)
  const expiredRelays = await getExpiredRelays(relays)
  
  const relaysToCheck = [...new Set([ ...uncheckedRelays, ...expiredRelays ])]
  let onlineRelays = relays.filter( relay => relay.online )
  const totalRelays = relays.length

  // logger.info(onlineRelays)

  logger.info(`total relays: ${totalRelays}`)
  logger.info(`online relays: ${onlineRelays.length}`)
  logger.info(`expired relays: ${expiredRelays.length}`)
  logger.info(`unchecked relays: ${uncheckedRelays.length}`)
  logger.info(`relays to check: ${relaysToCheck.length}`)
  
  await initRetryCount(relays)

  if(relaysToCheck.length === 0) return

  const doTruncate = config?.trawler?.check?.max

  if(config?.trawler?.check?.max && relaysToCheck.length > config.trawler.check.max && typeof config.trawler.check.max === 'number') 
    relaysToCheck.length = parseInt(config.trawler.check.max)

  logger.info(`checkCache(): Quickly filtering through ${uncheckedRelays.length} unchecked, 
    ${expiredRelays.length} expired and a total of ${totalRelays.length} relays before trawling. 
    ${doTruncate? "Since Max value is set, so only filtering "+relaysToCheck.length+" Relays.": ""} 
    There are currently ${onlineRelays.length} relays online according to the cache.
  `)
  for await ( const relay of relaysToCheck ) {
    const { url } = relay
    let online = false
    const nocap = new Nocap(url, { timeout: { connect: config?.trawler?.check?.timeout || 500 }})
    try {
      await nocap.check('connect').catch()
      online = nocap.results.get('connect').data? true: false
    }
    catch(e) { }
    await setLastChecked(url)
    await setRetries(url, online)
    rcache.relay.patch({ url, online })
  }
  onlineRelays = rcache.relay.get.all(['url', 'online']).filter( relay => relay.online )
  logger.info(`checkCache(): Completed, ${onlineRelays.length} cached relays are online`)
}

const expiry = (retries) => {
  if(typeof retries === 'undefined') return 0
  let map
  if(config?.trawler?.check?.expiry && config.trawler.check.expiry instanceof Array )
    map = config.trawler.check.expiry.map( entry => { return { max: entry.max, delay: parseInt(eval(entry.delay)) } }  )
  else
    map = [
      { max: 3, delay: 1000 * 60 * 60 },
      { max: 6, delay: 1000 * 60 * 60 * 24 },
      { max: 13, delay: 1000 * 60 * 60 * 24 * 7 },
      { max: 17, delay: 1000 * 60 * 60 * 24 * 28 },
      { max: 29, delay: 1000 * 60 * 60 * 24 * 90 }
    ];
  const found = map.find(entry => retries <= entry.max);
  return found ? found.delay : map[map.length - 1].delay;
};

const getUncheckedRelays = (relays=[]) => {
  let unchecked = relays.filter( relay => relay.online == null )
  return unchecked?.length? unchecked: []
}

const setLastChecked = async (url) => {
  await rcache.cachetime.set( lastCheckedId('online',url), Date.now() )
}

const initRetryCount = async (relays) => {
  relays.forEach(async (relay) => {
    const url = relay.url
    // logger.info(retryId(url))
    const retries = rcache.retry.get( retryId(url) )
    if(typeof retries === 'undefined' || typeof retries === null)
      await rcache.retry.set(retryId(url), 0)
  })
}

const getExpiredRelays = async (relays=[]) => {
  const relayStatuses = await Promise.all(relays.map(async relay => {
    const url = relay.url;
    const lastChecked = await rcache.cachetime.get.one( lastCheckedId('online',url) );
    if (!lastChecked) return { relay, isExpired: true };
    const retries = await rcache.retry.get(retryId(url));
    const isExpired = lastChecked < Date.now() - expiry(retries);
    return { relay, isExpired };
  }));
  return relayStatuses.filter(r => r.isExpired).map(r => r.relay);
}

const setRetries = async ( url, online ) => {
  let id 
  if(online) {
    logger.info(`${url} is online`)
    id = await rcache.retry.set(retryId(url), 0)
  } else { 
    // logger.info(url, 'is offline')
    id = await rcache.retry.increment(retryId(url))
  }
}