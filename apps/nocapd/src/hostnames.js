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

export const relayListHostnameDedup = (relays, cache) => {
  const maybeModifiedRelays = []
  for(let relay of relays) {
    maybeModifiedRelays.push( relayHostnameDedup( relay, cache ) )
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

export const relayHostnameDedup = async ( result, cache ) => {
    const { url:mURL, hostname:HOSTNAME, protocol:PROTOCOL } = result
    try {
      if (!mURL || !HOSTNAME || !PROTOCOL) {
        throw new Error(`Invalid result object: ${JSON.stringify(result)}`);
      }

      // Get online relays and filter them down to ones that share a hostname with target relay (result)
      // ...and is not the target relay (result)
      const online = cache.relay.get.online()    
      const hostnameFamily = online.filter( r => r.hostname === HOSTNAME && r.protocol === PROTOCOL && r.url !== mURL ) 
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
      let orderedRelatives = orderedFamily.filter( r => r !== mURL )

      if (!orderedRelatives) {
        log.error(`Ordered relatives not found for ${PROTOCOL}//${HOSTNAME}`);
        return result
      }

      orderedRelatives = orderedRelatives
      const index = orderedFamily.indexOf( mURL )

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
        const foundAtIndex = relativeInfoHashesArray.indexOf( infoHash )
        const eldestHasHash = relativeInfoHashes.get(orderedRelatives[0])? true: false
        // const hasAnyRelativeHash = relativeInfoHashes.some( r => r? true: false )?.length > 0? true: false

        const eldestIsRoot = isRootUrl(orderedRelatives[0])

        const isSameAsEldest = infoHash === relativeInfoHashes.get(orderedRelatives[0])
        const isSameAsAnyRelative = relativeInfoHashesArray.includes(infoHash)
        const isSameAsOlderRelative = foundAtIndex < index
        const isSameAsYoungerRelative = foundAtIndex > index
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