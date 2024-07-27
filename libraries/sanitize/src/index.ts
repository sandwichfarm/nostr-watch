import Logger from '@nostrwatch/logger'

const logger = new Logger('sanitizers')

const BLOCK_HOSTNAMES: string[] = [];

/**
 * normalizeRelays
 * @param {string[]} relays - Array of relay URLs
 * @returns {string[]} Filtered and normalized list of relay URLs
 */
export const normalizeRelays = (relays: string[]): string[] => {
  const clean = relays
    .map(sanitizeRelayUrl)
    .filter(qualifyRelayUrl)
    .reduce(normalizeRelayUrlAcc, []);
  return Array.from(new Set(clean))
};

/**
 * fuzzyRelays
 * @param {string[]} relays - Array of relay URLs
 * @returns anaysis including decision path of active sanitization, qualification and normalization.
 */
export const fuzzyRelays = (relays: string[]): { originals: string[], good: string[], bad: string[], decisionPath: Map<number, any> } => {
  const good = [];
  const bad = []
  const decisionPath: Map<number, any> = new Map()
  for (let [index, relay] of relays.entries()) {
    const path = [relay]
    try {
      relay = sanitizeRelayUrl(relay)
      path.push(relay)
      if(!qualifyRelayUrl(relay)) {
        bad.push(relays[index])
        path.push('bad')
        continue
      }
      relay = normalizeRelayUrl(relay)
      path.push(relay)
      path.push('good')
      good.push(relay)
    } catch (e: any) {
      bad.push(relays[index])
      path.push(e?.message)
      path.push('bad')
    }
    decisionPath.set(index, path)
  }
  return { 
    good: Array.from(new Set(good)), 
    bad: Array.from(new Set(bad)),
    originals: relays,
    decisionPath: decisionPath
  }
}


/**
 * qualifyRelayUrl
 * @param {string} relay - Relay URL
 * @returns {boolean} Whether the relay URL qualifies based on various criteria
 */
export const qualifyRelayUrl = (relay: string): boolean => {
  if( relay.length === 0 ) return false;

  if (isLocalNet(relay)) return false;

  if (isLocal(relay)) return false;

  if (/^(wss:\/\/)(.*)(:\/\/)(.*)$/.test(relay)) return false; // multiple protocols

  if (!relay.startsWith('wss://') && !relay.startsWith('ws://')) return false;

  if (relay.match(/localhost|\.local|[\n\r]|\[object object\]/)) return false;

  if (relay.includes('http://') || relay.includes('https://')) return false;

  if (relay.match(/(127\.)\d{0,3}(\.)\d{0,3}(\.)\d{0,3}|(192\.168|10\.)\d{1,3}(\.)\d{1,3}/)) return false;

  if (/(npub)[A-z0-9]{0,60}/.test(relay)) return false;

  return true;
};

/**
 * normalizeRelayUrlAcc
 * @param {string[]} acc - Accumulated array of normalized relay URLs
 * @param {string} relay - Relay URL to be normalized
 * @returns {string[]} Updated accumulated array with the normalized relay URL
 */
const normalizeRelayUrlAcc = (acc: string[], relay: string): string[] => {
  const normalized = normalizeRelayUrl(relay);
  if (normalized) {
    acc.push(normalized);
  }
  return acc;
};

/**
 * normalizeRelayUrls
 * @param {string[]} relays - Array of relay URLs
 * @returns {string[]} Array of normalized relay URLs
 */
const normalizeRelayUrls = (relays: string[]): string[] => {
  return relays.map(relay => normalizeRelayUrl(relay));
};

/**
 * normalizeRelayUrl
 * @param {string} relay - Relay URL to be normalized
 * @returns {string} Normalized relay URL or empty string if normalization fails
 */
const normalizeRelayUrl = (relay: string): string => {
  try {
    const url = new URL(relay);
    url.hash = '';
    url.search = '';
    return url.toString();
  } catch (e) {
    logger.warn(`Failed to normalize relay ${relay}`);
    return "";
  }
};

/**
 * sanitizeRelayUrl
 * @param {string} relay - Relay URL to be sanitized
 * @returns {string} Sanitized relay URL or empty string if sanitization fails
 */
export const sanitizeRelayUrl = (relay: string): string => {
  try {
    let url = decodeURI(relay)
      .toLowerCase()
      .trim()
      .replace(/[\s\t]+/, '') // Consolidate whitespace and tab removal
      .replace(/\/+$/, '') // Remove trailing slashes
      .split(',')[0]; // Get the first part before any comma
    url = new URL(url);
    return url.toString();
  } catch (e) {
    logger.warn(`Failed to sanitize relay ${relay}`);
    return "";
  }
};

/**
 * isLocal
 * @description Checks if a given URL is a local file URL or a local network path.
 * 
 * @param {string} _url - The URL string to be checked.
 * @returns {boolean | null} - Returns true if the URL is a local file or network path, false otherwise. 
 *                             Returns null if the input is not a string.
 */
export const isLocal = (_url: string): boolean | null => {
  if (typeof _url !== "string") {
    return null;
  }
  try {
    const url: URL = new URL(_url);

    // Check if the URL protocol is file
    return url.protocol === "file:";
  } catch (err) {
    // If URL parsing fails, check if it's a local network path
    if (/^[a-zA-Z]:\\/.test(_url) || /^\\\\/.test(_url)) {
      return true;
    }
    // Assume invalid URLs are local-like paths for simplicity
    return true;
  }
};

/**
 * isLocalNet
 * @param {string} urlString - The URL string to be checked.
 * @returns {boolean} - Returns true if the URL is in an IP range reserved for local networks, otherwise false.
 */
export const isLocalNet = (urlString: string): boolean => {
  // Regular expressions for matching local network IP ranges
  const localIpRanges = [
    /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,    // 127.0.0.0/8 - Loopback addresses
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,     // 10.0.0.0/8 - Private network
    /^192\.168\.\d{1,3}\.\d{1,3}$/,        // 192.168.0.0/16 - Private network
    /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/ // 172.16.0.0/12 - Private network
  ];

  try {
    const url = new URL(urlString);

    // Extract the hostname from the URL
    const hostname = url.hostname;

    // Check if the hostname matches any of the local IP ranges
    return localIpRanges.some(range => range.test(hostname));
  } catch (e) {
    // If URL parsing fails, log the error and return false
    console.error(`Invalid URL: ${urlString}`, e);
    return false;
  }
};


// /**
//  * sanitizeRelayList
//  * @param {string[]} relays - Array of relay URLs
//  * @returns {string[]} Sanitized list of relay URLs
//  */
// export const sanitizeRelayList = (relays: string[]): string[] => {
//   const listFilters: ((relays: string[]) => string[])[] = [
//     relaysFilterInvalid,
//     relaysFilterBlocked
//   ];
//   listFilters.forEach(listFilter => {
//     relays = listFilter(relays);
//   });

//   return relays;
// };



// /**
//  * relaysFilterInvalid
//  * @param {string[]} relays - Array of relay URLs
//  * @returns {string[]} Array of valid relay URLs
//  */
// export const relaysFilterInvalid = (relays: string[]): string[] => {
//   let invalids = 0;
//   const re = /^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9\-]*[A-Za-z0-9])$/;
//   const validRelays = relays.filter(relay => {
//     try {
//       const test = new URL(relay);
//       if (
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
//     } catch (e) {
//       invalids++;
//       return false;
//     }
//   });
//   return validRelays;
// };

// /**
//  * relaysFilterDuplicates
//  * @param {string[]} relays - Array of relay URLs
//  * @returns {string[]} Array of relay URLs with duplicates removed
//  */
// export const relaysFilterDuplicates = (relays: string[]): string[] => {
//   const hostnameMap = new Map<string, boolean>();
//   return relays.filter(url => {
//     try {
//       const hostname = new URL(url).hostname;
//       if (!hostnameMap.has(hostname)) {
//         hostnameMap.set(hostname, true);
//         return true;
//       }
//       return false;
//     } catch (e) {
//       return false;
//     }
//   });
// };

// /**
//  * relaysFilterPortDuplicates
//  * @param {string[]} relays - Array of relay URLs
//  * @returns {string[]} Array of relay URLs with port duplicates removed
//  */
// export const relaysFilterPortDuplicates = (relays: string[]): string[] => {
//   const relaysMap = new Map<string, string>(relays.map(relay => [new URL(relay).hostname, relay]));
//   return Array.from(relaysMap.values());
// };

// /**
//  * relaysFilterBlocked
//  * @param {string[]} relays - Array of relay URLs
//  * @returns {string[]} Array of relay URLs that are not blocked
//  */
// export const relaysFilterBlocked = (relays: string[]): string[] => {
//   return relays.filter(relay => !BLOCK_HOSTNAMES.some(hostname => relay.includes(hostname)));
// };
