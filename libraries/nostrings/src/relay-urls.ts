import Logger from '@nostrwatch/logger';
const logger = new Logger('@nostrwatch/nostrings');

/**
 * Sanitizes a list of relay URLs.
 * 
 * @param {string[]} relays - An array of relay URLs.
 * @returns {string[] | void} - An array of sanitized relay URLs, or void if input is empty.
 */
export const sanitize = (relays: string[]): string[] | void => {
  if (!relays?.length) {
    logger.debug(`!relays?.length ${relays}`);
    return;
  }
  relays = maybeSplitRelayList(relays);
  relays = relays
            .map(sanitizeRelayUrl)
            .filter(qualifyRelayUrl)
            .reduce(normalizeRelayUrlAcc, []);
  relays = dedup(relays)
  return relays
};

export const dedup = (relays: string[]): string[] => {
    return [...new Set(relays)]
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
      .replace(/[\s\t]+/, '') // Consolidate whitespace and tab removal
      .replace(/\/+$/, '') // Remove trailing slashes
      .replace(/\.(?=\/|$)/, '')  // Remove trailing dots, if they are before a slash or end of string
      .replace('(blob_hash)', '')
      .split(',')[0]; // Get the first part before any comma
  } catch (e: any) {
    logger.warn(`Failed to sanitize relay ${relay}: ${e.message}`);
    return '';
  }
};

/**
 * Qualifies a relay URL to determine if it's valid.
 * 
 * @param {string} relay - A relay URL string.
 * @returns {boolean} - Returns true if the relay URL is valid, false otherwise.
 */
export const qualifyRelayUrl = (relay: string): boolean => {
  if (/^(wss:\/\/)(.*)(:\/\/)(.*)$/.test(relay)) {
    // multiple protocols
    return false;
  }

  if (!relay.startsWith('wss://') && !relay.startsWith('ws://')) {
    return false;
  }

  if (relay.match(/localhost|\.local|[\n\r]|\[object object\]/)) {
    return false;
  }

  if (relay.includes('http://') || relay.includes('https://')) {
    return false;
  }

  if (relay.match(/(127\.)\d{0,3}(\.)\d{0,3}(\.)\d{0,3}|(192\.168|10\.)\d{1,3}(\.)\d{1,3}/)) {
    return false;
  }

  if (/(npub)[A-z0-9]{0,60}/.test(relay)) {
    return false;
  }

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
    return url.toString();
  } catch (e: any) {
    logger.warn(`Failed to normalize relay ${relay}: ${e.message}`);
    return '';
  }
};

export default sanitize;
