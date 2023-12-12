import { Nocap } from '@nostrwatch/nocap'
import rcache from './relaydb.js'
import { lastCheckedId, retriesId } from './utils.js'

export default async () => {
  const relays = rcache.relay.get.all(['url', 'online'])
  const uncheckedRelays = getUncheckedRelays(relays)
  const expiredRelays = await getExpiredRelays(relays)
  const relaysToCheck = [ ...uncheckedRelays, ...expiredRelays ]

  console.log(`expired relays: ${expiredRelays.length}`)
  console.log(`unchecked relays: ${uncheckedRelays.length}`)
  console.log(`relays to check: ${relaysToCheck.length}`)

  await initRetryCount(relays)

  if(relaysToCheck.length === 0) return

  let onlineRelays = relays.filter( relay => relay.online )
  console.log(`checkCache(): Quickly filtering through ${relaysToCheck.length} unchecked relays before trawling, ${onlineRelays.length} cached relays are online`)
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
  onlineRelays = relays.filter( relay => relay.online )
  console.log(`checkCache(): Completed, ${onlineRelays.length} cached relays are online`)
}

const retryPenalty = (retries) => {
  const map = [
    { threshold: 3, delay: 1000 * 60 * 1 },
    { threshold: 6, delay: 1000 * 60 * 60 * 24 },
    { threshold: 13, delay: 1000 * 60 * 60 * 24 * 7 },
    { threshold: 17, delay: 1000 * 60 * 60 * 24 * 28 },
    { threshold: 29, delay: 1000 * 60 * 60 * 24 * 90 }
  ];
  const found = map.find(entry => retries < entry.threshold);
  return found ? found.delay : map[map.length - 1].delay;
};

const initRetryCount = async (relays) => {
  relays.forEach(async (relay) => {
    const url = relay.url
    const retries = await rcache.cachetime.get( retriesId(url) )
    if(typeof retries === 'undefined')
      console.log(await rcache.cachetime.set(retriesId(url), 0))
  })
}

const getExpiredRelays = async (relays=[]) => {
  return relays.filter( async relay => { 
    const lastChecked = await rcache.cachetime.get( lastCheckedId(relay.url) )
    const retries = await rcache.cachetime.get( retriesId(relay.url) )
    if(!lastChecked) return false
    const expiration = lastChecked + retryPenalty(retries)
    return expiration < Date.now() 
  })
}

const getUncheckedRelays = (relays=[]) => {
  let unchecked = relays.filter( relay => relay.online == null )
  return unchecked?.length? unchecked: []
}

const setRetries = async ( url, online ) => {
  if(online) {
    console.log(url, 'is online')
    await rcache.cachetime.set(retriesId(url), 0)
  } else { 
    await rcache.cachetime.increment(retriesId(url))
  }
}

const setLastChecked = async (url) => {
  await rcache.cachetime.set( lastCheckedId(url), Date.now() )
}

