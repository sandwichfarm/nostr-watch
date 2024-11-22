import Logger from '@nostrwatch/logger';
import { normalizeURL } from 'nostr-tools/utils';
import hash from 'object-hash'

const log = new Logger('@nostrwatch/nocapd:hostname')

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

    //the eldest is the root, and the NIP11 data is the same as current segment.
    const case1 = eldestIsRoot && eldestHasHash && isSameAsEldest

    //the eldest is the root, and the NIP11 data is the same as any other relay in the hostname group.
    const case2 = eldestIsRoot && infoHash && isSameAsAnyRelative

    //the eldest is not the root, and the NIP11 data is the same as both an older and younger relative.
    const case3 = !eldestIsRoot && isSameAsOlderRelative && isSameAsYoungerRelative

    const case4 = eldestIsRoot && eldestHasHash && !infoHash

    //set ignore to true, this will prevent the tests from running next time around.
    if( case1 || case2 || case3 || case4 ) {
      log.debug(`${mURL} has been ignored because of: case [1:${case1}] [2:${case2}] [3:${case3}] [4:${case4}]`)
      result.ignore = true
    }
  }
  //if target relay is below 0 something has gone terribly wrong. 
  else {
    log.error(`CRITICAL ERROR! relayHostnameDedup(): ${mURL} not found in orderedFamily ${JSON.strinigify(orderedFamily)}`)
  }
  return result
}