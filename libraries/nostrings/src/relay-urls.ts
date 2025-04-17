import Logger from '@nostrwatch/logger';
const logger = new Logger('@nostrwatch/nostrings');

const blocklist = [
  'wss://echo.websocket.org',
  'ws://echo.websocket.org',
]

interface Discriminator {
  (input: string): boolean;
}

interface Discriminators {
  [key: string]: Discriminator;
}

interface Mutator { 
  (input: string): string;
}

interface Mutators {
  [key: string]: Mutator;
}

type DiscriminatorsArgument = Discriminators | null;
type MutatorsArgument = Mutators | null;

type RuleSet = {
  discriminators?: DiscriminatorsArgument;
  mutators?: MutatorsArgument;
};

/**
 * Sanitizes a list of relay URLs.
 * 
 * @param {string[]} relays - An array of relay URLs.
 * @returns {string[] | void} - An array of sanitized relay URLs, or void if input is empty.
 */
export const sanitize = (relays: string[], rules: RuleSet = {}): string[] | void => {
  if (!relays?.length) {
    logger.debug(`!relays?.length ${relays}`);
    return;
  }
  relays = maybeSplitRelayList(relays);
  relays = relays
            .map(sanitizeRelayUrl)
            .filter(qualifyRelayUrl)
            .filter(relay => applyDiscriminators(relay, rules?.discriminators))
            .map(relay => applyMutators(relay, rules?.mutators))
            .reduce(normalizeRelayUrlAcc, []);
  relays = dedup(relays)
  return relays
};

export const dedup = (relays: string[]): string[] => {
    return [...new Set(relays)]
}

const applyDiscriminators = (relay: string, rules: DiscriminatorsArgument = null): boolean => {
  if(!rules || !Object.keys(rules).length) 
    return true
  for (const [ruleName, rule] of Object.entries(rules)) {
    if (!rule(relay)) {
      logger.debug(`applyDiscriminators(): string ${relay} failed discriminator ${ruleName}`);
      return false;
    }
  }
  return true;
}

const applyMutators = (_relay: string, mutators: MutatorsArgument = null): string => {
  if(!mutators || !Object.keys(mutators).length)
    return _relay
  let relay = _relay
  for (const [mutatorName, mutator] of Object.entries(mutators)) {
    relay = mutator(relay)
    logger.debug(`applyMutators(): ${_relay} mutated to ${relay} by ${mutatorName} `);
  }
  return relay
}

/**
 * Splits relay URLs by commas if they are present.
 * 
 * @param {string[]} relays - An array of relay URLs, some of which may contain commas.
 * @returns {string[]} - An array of relay URLs with no commas.
 */
export const maybeSplitRelayList = (relays: string[]): string[] => {
  let _relays: string[] = [];
  relays.forEach((relay) => {
    if (relay.includes(',')) {
      const maybeRelays = relay.split(',');
      _relays = [..._relays, ...maybeRelays];
    } else {
      _relays.push(relay);
    }
  });
  return _relays;
};


/**
 * Sanitizes a relay URL by removing unwanted characters and normalizing it.
 * 
 * @param {string} relay - A relay URL string.
 * @returns {string} - A sanitized and normalized relay URL string.
 */
export const sanitizeRelayUrl = (relay: string): string => {
  try {
    return decodeURI(relay)
      .toLowerCase()
      .trim()
      .replace('|', '') //remove pipe
      .replace(/[\s\t|]+/, '') // Consolidate whitespace and tab removal
      .replace(/\/+$/, '') // Remove trailing slashes
      .replace(/\.(?=\/|$)/, '')  // Remove trailing dots, if they are before a slash or end of string
      .replace('(blob_hash)', '')
      .split(',')[0]; // Get the first part before any comma
  } catch (e: any) {
    logger.debug(`Failed to sanitize relay ${relay}: ${e.message}`);
    return '';
  }
};

/**
 * qualifyRelayUrl
 * 
 * qualify relay URLs with pessimistic invalidation pattern as opposed to validation pattern
 * 
 * @param {string} relay - Relay URL
 * @returns {boolean} Whether the relay URL qualifies based on various criteria
 */
export const qualifyRelayUrl = (maybeRelay: string): boolean => {

  let url: URL;

  try {
    url = new URL(maybeRelay);
  } catch (e: any) {
    logger.debug(`Failed to qualify relay ${maybeRelay}: ${e.message}`);
    return false;
  }

  const hostname = url.hostname;  
  const pathname = url.pathname;  

  if ( isLocalNet(maybeRelay) ) return false;

  if ( isLocal(maybeRelay) ) return false;

  if( maybeRelay.length === 0 ) return false;
  
  if( hostname.includes("|") || pathname.includes("|") ) return false;

  if( hostname.includes("https/") || hostname.includes("http/") || hostname.includes("wss/") || hostname.includes("ws/") ) return false;

  if( pathname.includes("https/") || pathname.includes("http/") || pathname.includes("wss/") || pathname.includes("ws/") ) return false;

  if( typeof maybeRelay !== "string" ) return false; 

  if ( /^(wss:\/\/)(.*)(:\/\/)(.*)$/.test(maybeRelay) ) return false; // multiple protocols

  if ( !maybeRelay.startsWith('wss://') && !maybeRelay.startsWith('ws://') ) return false;

  if ( maybeRelay.match(/localhost|\.local|[\n\r]|\[object object\]/)) return false;

  if ( maybeRelay.includes('http://') || maybeRelay.includes('https://') ) return false;

  if ( maybeRelay.match(/(127\.)\d{0,3}(\.)\d{0,3}(\.)\d{0,3}|(192\.168|10\.)\d{1,3}(\.)\d{1,3}/) ) return false;

  if ( /(npub)[A-z0-9]{0,60}/.test(maybeRelay) ) return false;

  return true;
};

/**
 * Accumulates normalized relay URLs into an array.
 * 
 * @param {string[]} acc - The accumulator array for relay URLs.
 * @param {string} relay - A relay URL string to be normalized and added.
 * @returns {string[]} - The updated accumulator array with normalized relay URLs.
 */
export const normalizeRelayUrlAcc = (acc: string[], relay: string): string[] => {
  const normalized = normalizeRelayUrl(relay);
  if (normalized) {
    acc.push(normalized);
  }
  return acc;
};

/**
 * Normalizes an array of relay URLs.
 * 
 * @param {string[]} relays - An array of relay URLs.
 * @returns {string[]} - An array of normalized relay URLs.
 */
export const normalizeRelayUrls = (relays: string[]): string[] => {
  return relays.map((relay) => normalizeRelayUrl(relay));
};

/**
 * Normalizes a single relay URL by stripping out hash and search parameters.
 * 
 * @param {string} relay - A relay URL string.
 * @returns {string} - A normalized relay URL string or an empty string if invalid.
 */
export const normalizeRelayUrl = (relay: string): string => {
  try {
    const url = new URL(relay);
    url.hash = '';
    url.search = '';
    url.username = '';
    return url.toString();
  } catch (e: any) {
    logger.warn(`Failed to normalize relay "${relay}": ${e.message}`);
    return '';
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
export const isLocal = (_url: string): boolean => {
  try {
    const url: URL = new URL(_url);
    // Check if the URL protocol is file
    return url.protocol === "file:";
  } catch (err) {
    // If URL parsing fails, check if it's a local network path
    if (/^[a-zA-Z]:\\/.test(_url) || /^\\\\/.test(_url)) {
      return true;
    }
  }
  return false
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


export default sanitize;
