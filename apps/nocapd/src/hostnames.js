import Logger from '@nostrwatch/logger';
import { normalizeURL } from 'nostr-tools/utils';
import hash from 'object-hash'

const log = new Logger('@nostrwatch/nocapd:hostname')

const isPubkey = (str) => /^[0-9a-fA-F]{64}$/.test(str)
const containsPubkey = (str) => /[0-9a-fA-F]{64}/.test(str)

export const relayArrToHostnameProtocolKeyedMap = (urls) => {
  const urlMap = new Map();
  const ordered = new Map();

  urls.forEach((url) => {
    try {
      const parsedUrl = new URL(url);
      const protocolAndHostname = `${parsedUrl.protocol}//${parsedUrl.hostname}`;

      if (!urlMap.has(protocolAndHostname)) {
           urlMap.set(protocolAndHostname, []);
      }

      urlMap.get(protocolAndHostname).push(url);
    } catch (error) {
      log.error(`Invalid URL: ${url}`);
    }
  });

  urlMap.forEach((urls, protocolAndHostname) => {
    urls.sort((a, b) => {
      const pathDepthA = new URL(a).pathname.split('/').filter(Boolean).length;
      const pathDepthB = new URL(b).pathname.split('/').filter(Boolean).length;
      if (pathDepthA === pathDepthB) {
        return a.length - b.length;
      }
      return pathDepthA - pathDepthB;
    });
    ordered.set(protocolAndHostname, urls);
  });

  return ordered
}

export const relayListHostnameDedup = (relays, cache, ignoreListSync = null) => {
  const maybeModifiedRelays = []
  for(let relay of relays) {
    maybeModifiedRelays.push( relayHostnameDedup( relay, cache, ignoreListSync ) )
  }
  return maybeModifiedRelays
}

function isRootUrl(url) {
  try {
      const parsedUrl = new URL(url);
      // Returns true if the path is empty or just "/"
      return parsedUrl.pathname === '/' || parsedUrl.pathname === '';
  } catch (e) {
      // If the URL is invalid, return false
      return false;
  }
}

/**
 * Deduplication logic that works with cached relay objects (that only have info hashes, not data)
 * @param {Object} relay - Cached relay object from LMDB
 * @param {Object} cache - The relay cache
 * @param {Object} ignoreListSync - The ignore list sync instance
 * @returns {Promise<Object>} Updated relay object with ignore/parent status
 */
const relayHostnameDedupFromCache = async (relay, cache, ignoreListSync = null) => {
  const log = new Logger('@nostrwatch/nocapd:hostname')
  const { url: mURL, hostname: HOSTNAME, protocol: PROTOCOL, info: infoHash } = relay
  const result = { url: mURL, ignore: relay.ignore, parent: relay.parent }

  try {
    if (!mURL || !HOSTNAME || !PROTOCOL) {
      throw new Error(`Invalid relay object: ${JSON.stringify(relay)}`)
    }

    // Check if this relay is in the synced ignore list from other monitors
    if (ignoreListSync && ignoreListSync.isIgnored(mURL)) {
      log.warn(`${mURL} is in synced ignore list from other monitors`)
      result.ignore = true
      result.parent = ''
      return result
    }

    // Get ALL relays and filter to hostname family
    const allRelays = await cache.relay.get.all()
    const hostnameFamily = allRelays.filter(r => r.hostname === HOSTNAME && r.protocol === PROTOCOL && r.url !== mURL && r.online === true)

    if (!hostnameFamily?.length) return result

    // Build map of relative info hashes (they're already hashes in the cache)
    const relativeInfoHashes = new Map()
    for (let relayRelative of hostnameFamily) {
      if (relayRelative.info === null) continue
      relativeInfoHashes.set(relayRelative.url, relayRelative.info)
    }

    const relativeInfoHashesArray = Array.from(relativeInfoHashes.values())

    // Order relays by path segment length
    const urlSegmentOrderedMap = relayArrToHostnameProtocolKeyedMap([...hostnameFamily.map(r => r.url), mURL])
    const orderedFamily = (urlSegmentOrderedMap.get(`${PROTOCOL}//${HOSTNAME}`)).map(r => normalizeURL(r))
    const normalizedURL = normalizeURL(mURL)
    let orderedRelatives = orderedFamily.filter(r => r !== normalizedURL)

    if (!orderedRelatives) {
      log.error(`Ordered relatives not found for ${PROTOCOL}//${HOSTNAME}`)
      return result
    }

    const index = orderedFamily.indexOf(normalizedURL)

    if (index === 0) {
      result.ignore = false
      result.parent = ''
    } else if (index > 0) {
      result.parent = orderedRelatives[0]
      const eldestHasHash = relativeInfoHashes.get(orderedRelatives[0]) ? true : false
      const eldestIsRoot = isRootUrl(orderedRelatives[0])
      const isSameAsEldest = infoHash === relativeInfoHashes.get(orderedRelatives[0])
      const isSameAsAnyRelative = relativeInfoHashesArray.includes(infoHash)

      // Check if any older relative has the same hash
      let isSameAsOlderRelative = false
      let isSameAsYoungerRelative = false
      for (let i = 0; i < orderedFamily.length; i++) {
        const relativeUrl = orderedFamily[i]
        const relativeHash = relativeInfoHashes.get(relativeUrl)
        if (relativeHash === infoHash) {
          if (i < index) isSameAsOlderRelative = true
          if (i > index) isSameAsYoungerRelative = true
        }
      }

      const pathnameIsPubkey = new URL(mURL).pathname.split('/').some(p => isPubkey(p))
      const pathnameContainsPubkey = containsPubkey(new URL(mURL).pathname)
      const pathnameContainsHostname = new URL(mURL).pathname.includes(HOSTNAME)

      const case1 = eldestIsRoot && eldestHasHash && isSameAsEldest
      const case2 = eldestIsRoot && infoHash && (isSameAsAnyRelative || isSameAsEldest)
      const case3 = !eldestIsRoot && isSameAsOlderRelative && isSameAsYoungerRelative
      const case4 = eldestIsRoot && eldestHasHash && !infoHash
      const case5 = !eldestIsRoot && !eldestHasHash && !infoHash
      const case6 = pathnameIsPubkey || pathnameContainsPubkey
      const case7 = pathnameContainsHostname

      if (case1 || case2 || case3 || case4 || case5 || case6 || case7) {
        result.ignore = true
      } else {
        result.ignore = false
      }
    } else {
      log.error(`CRITICAL ERROR! relayHostnameDedupFromCache(): ${mURL} not found in hostnameGroup`)
    }
  } catch (error) {
    log.error(`Error in relayHostnameDedupFromCache: ${error}`)
  }

  return result
}

/**
 * Re-evaluate deduplication for all online relays in the cache
 * This should be run periodically to catch relays that were checked before their relatives
 * Fetches fresh NIP-11 data to ensure accuracy
 * @param {Object} cache - The relay cache
 * @param {Object} ignoreListSync - The ignore list sync instance
 * @returns {Promise<Array>} Array of relays that had their ignore status changed
 */
export const reevaluateAllDeduplication = async (cache, ignoreListSync = null) => {
  const log = new Logger('@nostrwatch/nocapd:hostname')
  log.info('Starting periodic deduplication re-evaluation for all relays...')

  const allRelays = await cache.relay.get.all()
  const onlineRelays = allRelays.filter(r => r.online === true)

  log.info(`Re-evaluating ${onlineRelays.length} online relays - fetching fresh NIP-11 data...`)

  // Import nocap dynamically
  const { default: Nocap } = await import('@nostrwatch/nocap')
  const nocapAdapters = await import('@nostrwatch/nocap/adapters')

  const changedRelays = []

  for (const relay of onlineRelays) {
    const previousIgnoreStatus = relay.ignore

    try {
      // Fetch fresh NIP-11 data
      const nocap = new Nocap(relay.url, { timeout: 10000, logLevel: 'error' })
      await nocap.useAdapters([nocapAdapters.info])
      const checkResult = await nocap.check(['info']).catch(err => {
        log.debug(`Failed to fetch NIP-11 for ${relay.url}: ${err.message}`)
        return null
      })

      if (!checkResult) {
        log.debug(`Skipping ${relay.url} - could not fetch NIP-11`)
        continue
      }

      // Build result object with fresh NIP-11 data
      const result = {
        url: relay.url,
        hostname: relay.hostname,
        protocol: relay.protocol,
        info: checkResult.info,
        ignore: relay.ignore,
        parent: relay.parent
      }

      // Run deduplication with fresh data
      const updatedResult = await relayHostnameDedup(result, cache, ignoreListSync).catch(err => {
        log.error(`Error re-evaluating ${relay.url}: ${err.message}`)
        return { url: relay.url, ignore: relay.ignore, parent: relay.parent }
      })

      // If ignore status changed, update the cache and track it
      if (updatedResult.ignore !== previousIgnoreStatus) {
        log.info(`${relay.url}: ignore status changed from ${previousIgnoreStatus} to ${updatedResult.ignore}`)

        await cache.relay.patch({
          url: relay.url,
          ignore: updatedResult.ignore,
          parent: updatedResult.parent || null
        }).catch(err => {
          log.error(`Failed to update ${relay.url}: ${err.message}`)
        })

        changedRelays.push({
          url: relay.url,
          previousIgnore: previousIgnoreStatus,
          newIgnore: updatedResult.ignore,
          parent: updatedResult.parent
        })

        // If newly ignored and has a parent, add to ignore list
        if (updatedResult.ignore && !previousIgnoreStatus && ignoreListSync && updatedResult.parent) {
          ignoreListSync.addToIgnoreList(relay.url)
        }
      }
    } catch (err) {
      log.error(`Error processing ${relay.url}: ${err.message}`)
    }
  }

  log.info(`Deduplication re-evaluation complete. ${changedRelays.length} relays changed status.`)
  return changedRelays
}

export const relayHostnameDedup = async ( result, cache, ignoreListSync = null ) => {
    const { url:mURL, hostname:HOSTNAME, protocol:PROTOCOL } = result
    try {
      if (!mURL || !HOSTNAME || !PROTOCOL) {
        throw new Error(`Invalid result object: ${JSON.stringify(result)}`);
      }

      // Check if this relay is in the synced ignore list from other monitors
      if (ignoreListSync && ignoreListSync.isIgnored(mURL)) {
        log.warn(`${mURL} is in synced ignore list from other monitors`)
        result.ignore = true
        result.parent = '' // We don't know the parent from synced lists
        return result
      }

      // Get ALL relays (including ignored ones) and filter them down to ones that share a hostname with target relay (result)
      // ...and is not the target relay (result)
      // We need to check ALL relays, not just online ones, to ensure consistent deduplication across all monitors
      const allRelays = await cache.relay.get.all()
      const hostnameFamily = allRelays.filter( r => r.hostname === HOSTNAME && r.protocol === PROTOCOL && r.url !== mURL && r.online === true)
      const hostnameRelatives = [...hostnameFamily]

      //It has no relatives, exit now.
      if( !hostnameRelatives?.length ) return result

      // Get nip11 for each relative.
      const hasInfo = Object.keys(result?.info?.data ?? {}).length? true: false
      const infoHash = hasInfo? `RelayCheckInfo@${hash(result.info.data)}` : null
      const relativeInfoHashes = new Map()
      log.debug (`target: ${mURL} w/ info id ${infoHash}`)
      for(let relayRelative of hostnameRelatives) {
        if(relayRelative.info === null) continue
        const { url, info:id } = relayRelative
        log.debug (`relative: ${url} w/ info id ${id}`)
        relativeInfoHashes.set(relayRelative.url, id)
      }

      const relativeInfoHashesArray = Array.from(relativeInfoHashes.values())

      //Order each relay in the hostname map by segment length.
      const urlSegmentOrderedMap = relayArrToHostnameProtocolKeyedMap([...hostnameRelatives.map(r => r.url), mURL])

      //Check if the target relay is the parent or child of any other relay in the hostname group.
      const orderedFamily = (urlSegmentOrderedMap.get(`${PROTOCOL}//${HOSTNAME}`)).map( r => normalizeURL(r) )
      const normalizedURL = normalizeURL(mURL)
      let orderedRelatives = orderedFamily.filter( r => r !== normalizedURL )

      if (!orderedRelatives) {
        log.error(`Ordered relatives not found for ${PROTOCOL}//${HOSTNAME}`);
        return result
      }

      const index = orderedFamily.indexOf( normalizedURL )

      //if target relay index is 0, we can call it the parent for now.
      if(index === 0) {
        log.debug(`${mURL} has not been ignored and parent cleared, index: ${index}`)
        result.ignore = false
        result.parent = ''
      }
      //if target relay index is above 0, we can link it to the parent
      else if(index > 0) {
        result.parent = orderedRelatives[0]
        log.debug(`${mURL} is a child of ${orderedRelatives[0]}`)
        const eldestHasHash = relativeInfoHashes.get(orderedRelatives[0])? true: false
        // const hasAnyRelativeHash = relativeInfoHashes.some( r => r? true: false )?.length > 0? true: false

        const eldestIsRoot = isRootUrl(orderedRelatives[0])

        const isSameAsEldest = infoHash === relativeInfoHashes.get(orderedRelatives[0])
        const isSameAsAnyRelative = relativeInfoHashesArray.includes(infoHash)

        // Check if any older relative (lower index) has the same hash
        let isSameAsOlderRelative = false
        let isSameAsYoungerRelative = false
        for(let i = 0; i < orderedFamily.length; i++) {
          const relativeUrl = orderedFamily[i]
          const relativeHash = relativeInfoHashes.get(relativeUrl)
          if(relativeHash === infoHash) {
            if(i < index) isSameAsOlderRelative = true
            if(i > index) isSameAsYoungerRelative = true
          }
        }
        // const pathnameIsPubkey = isPubkey(new URL(mURL).pathname.split('/')?.[0] || '')
        const pathnameIsPubkey = new URL(mURL).pathname.split('/')?.some( p => isPubkey(p) )
        const pathnameContainsPubkey = containsPubkey(new URL(mURL).pathname)
        const pathnameContainsHostname = new URL(mURL).pathname.includes(HOSTNAME)

        //the eldest is the root, and the NIP11 data is the same as current segment.
        const reason1 = `Eldest is root AND eldest has NIP11 data AND current segment NIP11 data is same as eldest relative`
        const case1 = eldestIsRoot && eldestHasHash && isSameAsEldest

        //the eldest is the root, and the NIP11 data is the same as any other relay in the hostname group.
        const reason2 = `Eldest is root, current segment has NIP11 data AND NIP11 data is the same as any other relay in the hostname group`
        const case2 = eldestIsRoot && infoHash && (isSameAsAnyRelative || isSameAsEldest)

        //the eldest is not the root, and the NIP11 data is the same as both an older and younger relative.
        const reason3 = `Eldest is not root AND eldest NIP11 is same as an older AND younger relative`
        const case3 = !eldestIsRoot && isSameAsOlderRelative && isSameAsYoungerRelative

        //the eldest is the root, and the NIP11 data is the same as the current segment, but the current segment has no NIP11 data.
        const reason4 = `Eldest is root AND eldest has NIP11 data AND current segment has no NIP11 data`
        const case4 = eldestIsRoot && eldestHasHash && !infoHash

        //the eldest is not the root, and the eldest does not have NIP11 data and the current segment has no NIP11 data either.
        const reason5 = `Eldest is not root AND eldest does not have NIP11 data AND current segment has no NIP11 data`
        const case5 = !eldestIsRoot && !eldestHasHash && !infoHash

        //ignore pubkeys in pathnames (stopgap!)
        const reason6 = `Pubkey is in pathname`
        const case6 = pathnameIsPubkey || pathnameContainsPubkey

        //ignore when pathname includes the hostname (stopgap!)
        const reason7 = `path includes hostname`
        const case7 = pathnameContainsHostname

        log.debug(`[${mURL}] eldestIsRoot: ${eldestIsRoot}, eldestHasHash: ${eldestHasHash}, isSameAsEldest: ${isSameAsEldest}`)
        log.debug(`[${mURL}] isSameAsAnyRelative: ${isSameAsAnyRelative}, isSameAsOlderRelative: ${isSameAsOlderRelative}, isSameAsYoungerRelative: ${isSameAsYoungerRelative}`)
        log.debug(`[${mURL}] case1: ${case1}, case2: ${case2}, case3: ${case3}, case4: ${case4}, case5: ${case5}, case6: ${case6}, case7: ${case7}`)

        //set ignore to true, this will prevent the tests from running next time around.
        if( case1 || case2 || case3 || case4 || case5 || case6 || case7 ) {
          if(case1) log.warn(`Ignored because: ${reason1}`)
          if(case2) log.warn(`Ignored because: ${reason2}`)
          if(case3) log.warn(`Ignored because: ${reason3}`)
          if(case4) log.warn(`Ignored because: ${reason4}`)
          if(case5) log.warn(`Ignored because: ${reason5}`)
          if(case6) log.warn(`Ignored because: ${reason6}`)
          if(case7) log.warn(`Ignored because: ${reason7}`)
          log.debug(`${mURL} has been ignored because of: case [1:${case1}] [2:${case2}] [3:${case3}] [4:${case4}] [5:${case5}] [6:${case6}] [6:${case7}]`)
          result.ignore = true
        } else {
          result.ignore = false
        }
      }
      //if target relay is below 0 something has gone terribly wrong. 
      else {
        log.error(`CRITICAL ERROR! relayHostnameDedup(): ${mURL} not found in hostnameGroup`)
      }
    }
    catch (error) {
      log.error(`Error in relayHostnameDedup: ${error}`);
    }
  return result
}