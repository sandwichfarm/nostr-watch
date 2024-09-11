import Logger from '@nostrwatch/logger'

const logger = new Logger('sanitizers')

const BLOCK_HOSTNAMES = [];

export const normalizeRelays = (relays) => {
  if(!relays?.length)
    return console.log('!relays?.length', relays)
  relays = maybeSplitRelayList(relays)
  return relays 
          .map( sanitizeRelayUrl )
          .filter( qualifyRelayUrl )
          .reduce ( normalizeRelayUrlAcc, [] )
}

/********
 * maybeSplitRelayList
 * 
 * @description som
 */
export const maybeSplitRelayList = (relays) => {
  let _relays = []
  relays.forEach(relay => {
    if(relay.includes(',')) {
      const maybeRelays = relay.split(',')
      _relays = [..._relays, ...maybeRelays]
    }
    else
      _relays.push(relay)
  })
  return _relays
}

export const sanitizeRelayUrl = (relay) => {
  try {
    return decodeURI(relay)
          .toLowerCase()
          .trim()
          .replace(/[\s\t]+/, '') // Consolidate whitespace and tab removal
          .replace(/\/+$/, '') // Remove trailing slashes
          .replace('(blob_hash)', '')
          .split(',')[0]; // Get the first part before any comma
  }
  catch(e) {
    logger.warn(`Failed to sanitize relay ${relay}: ${e.message}`)
    return ""
  }
}

export const qualifyRelayUrl = (relay) => {

  if( /^(wss:\/\/)(.*)(:\/\/)(.*)$/.test(relay) ) //multiple protocols
    return false 

  if (!relay.startsWith('wss://') && !relay.startsWith('ws://'))
    return false;

  if( relay.match(/localhost|\.local|[\n\r]|\[object object\]/) )
    return false

  if ( relay.includes('http://') || relay.includes('https://'))
    return false;

  if ( relay.match(/(127\.)\d{0,3}(\.)\d{0,3}(\.)\d{0,3}|(192\.168|10\.)\d{1,3}(\.)\d{1,3}/))
    return false;

  if (/(npub)[A-z0-9]{0,60}/.test(relay))
    return false;

  return true;
}

export const normalizeRelayUrlAcc = (acc, relay) => {
  const normalized = normalizeRelayUrl(relay);
  if (normalized) {
    acc.push(normalized);
  }
  return acc;
}

export const normalizeRelayUrls = (relays) => {
  return relays.map( relay => normalizeRelayUrl(relay))
}

export const normalizeRelayUrl = (relay) => {
  try {
    const url = new URL(relay)  
    url.hash = ''
    url.search = ''
    return url.toString()
  }
  catch(e) {
    logger.warn(`Failed to normalize relay ${relay}: ${e.message}`)
  }
  return ""
}



// export const sanitizeRelayList = (relays) => {

//   const listFilters = [
//     'relaysFilterInvalid',
//     'relaysFilterBlocked',
//     'relaysFilterRobotsTxtDisallowed'
//   ]

//   listFilters.forEach(listFilter => {
//    relays = listFilter(relays) 
//   });

//   return relays
// }

// export const relaysFilterInvalid = (relays) => {
//   let invalids = 0;
//   const re = /^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9\-]*[A-Za-z0-9])$/;
//   const validRelays = relays.filter(relay => {
//     try {
//       const test = URL.parse(relay);
//       if (
//         test && 
//         (test.protocol === 'wss:' || test.protocol === 'ws:') && 
//         re.test(test.hostname) &&
//         !test.hostname.includes('https:') &&
//         !test.hostname.includes('http:') && 
//         test.hostname.includes('.')
//       ) {
//         return true;
//       }
//       invalids++;
//       return false;
//     } catch(e) {
//       invalids++;
//       return false;
//     }
//   });
//   return validRelays;
// }

// export const relaysFilterDuplicates = (relays) => {
//   const hostnameMap = new Map();
//   return relays.filter(url => {
//     try { 
//       const hostname = URL.parse(url).hostname;
//       if (hostname && !hostnameMap.has(hostname)) {
//         hostnameMap.set(hostname, true);
//         return true;
//       }
//       return false;
//     } catch(e) {
//       return false;
//     }
//   });
// }

// export const relaysFilterPortDuplicates = (relays) => {
//   const relaysMap = new Map(relays.map(relay => [URL.parse(relay)?.hostname, relay]));
//   return Array.from(relaysMap.values());
// }

// export const relaysFilterRobotsTxtDisallowed = (relays) => {
//   const disallowed = cache.get('disallowed') || [];
//   return relays.filter(relay => !disallowed.includes(relay));
// }

// export const relaysFilterBlocked = (relays) => {
//   return relays.filter(relay => !BLOCK_HOSTNAMES.some(hostname => relay.includes(hostname)));
// }

export default normalizeRelays