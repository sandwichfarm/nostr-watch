import { Nocap } from '@nostrwatch/nocap'
import rcache from './relaydb.js'
import { lastCheckedId, retryId } from './utils.js'

export default async () => {
  const relays = rcache.relay.get.all(['url', 'online'])
  const uncheckedRelays = getUncheckedRelays(relays)
  const expiredRelays = await getExpiredRelays(relays)
  
  const relaysToCheck = [ ...uncheckedRelays, ...expiredRelays ]
  let onlineRelays = relays.filter( relay => relay.online )

  // console.log(onlineRelays)

  console.log(`online relays: ${onlineRelays.length}`)
  console.log(`expired relays: ${expiredRelays.length}`)
  console.log(`unchecked relays: ${uncheckedRelays.length}`)
  console.log(`relays to check: ${relaysToCheck.length}`)
  
  await initRetryCount(relays)

  if(relaysToCheck.length === 0) return

  console.log(`checkCache(): Quickly filtering through ${uncheckedRelays.length} unchecked, ${expiredRelays.length} expired and a total of ${relaysToCheck.length} relays before trawling. There are currently ${onlineRelays.length} relays online according to the cache.`)
  for ( const relay of relaysToCheck ) {
    const { url } = relay
    let online = false
    const nocap = new Nocap(url, { timeout: { connect: 1000 }})
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
  console.log(`checkCache(): Completed, ${onlineRelays.length} cached relays are online`)
}

const retryPenalty = (retries) => {
  if(typeof retries === 'undefined') return 0
  const map = [
    { max: 3, delay: 1000 * 60 * 4 },
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
  await rcache.cachetime.set( lastCheckedId(url), Date.now() )
}

const initRetryCount = async (relays) => {
  relays.forEach(async (relay) => {
    const url = relay.url
    // console.log(retryId(url))
    const retries = rcache.retry.get( retryId(url) )
    if(typeof retries === 'undefined')
      await rcache.retry.set(retryId(url), 0)
  })
}

const getExpiredRelays = async (relays=[]) => {
  const relayStatuses = await Promise.all(relays.map(async relay => {
    const url = relay.url;
    const lastChecked = await rcache.cachetime.get(lastCheckedId(url))?.v;
    if (!lastChecked) return { relay, isExpired: true };
    const retries = await rcache.retry.get(retryId(url));
    const interval = retryPenalty(retries)
    const isExpired = lastChecked + interval < Date.now();
    return { relay, isExpired };
  }));
  return relayStatuses.filter(r => r.isExpired).map(r => r.relay);
}

const setRetries = async ( url, online ) => {
  let id 
  if(online) {
    console.log(url, 'is online')
    id = await rcache.retry.set(retryId(url), 0)
  } else { 
    // console.log(url, 'is offline')
    id = await rcache.retry.increment(retryId(url))
  }
}