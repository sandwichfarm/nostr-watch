/**
 * sanitizeRelayList
 * @param {array} relays 
 * @returns Filtered and deduped list of relays
 */

import isLocal from "url-local"

import lmdb from './relaydb.js'
import Logger from '@nostrwatch/logger'

const logger = new Logger('sanitizers')

export const normalizeRelays = (relays) => {
  return relays 
          .map( sanitizeRelayUrl )
          .filter( qualifyRelayUrl )
          .reduce ( normalizeRelayUrlAcc, [] )
}

export const sanitizeRelayList = (relays) => {

  const listFilters = [
    'relaysFilterInvalid',
    'relaysFilterBlocked',
    'relaysFilterRobotsTxtDisallowed'
  ]

  listFilters.forEach(listFilter => {
   relays = listFilter(relays) 
  });

  return relays
}

export const relayAlreadyKnown = async (relay) => {
  if(await lmdb.relay.exists(relay))
    return false
}

export const qualifyRelayUrl = (relay) => {
  if(isLocal(relay))
    return false

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

const normalizeRelayUrlAcc = (acc, relay) => {
  const normalized = normalizeRelayUrl(relay);
  if (normalized) {
    acc.push(normalized);
  }
  return acc;
}

const normalizeRelayUrls = (relays) => {
  return relays.map( relay => normalizeRelayUrl(relay))
}

const normalizeRelayUrl = (relay) => {
  try {
    const url = new URL(relay)
    url.hash = ''
    return url.toString()
  }
  catch(e) {
    return 
  }
}

export const sanitizeRelayUrl = (relay) => {
  try {
    return decodeURI(relay)
          .toLowerCase()
          .trim()
          .replace(/[\s\t]+/, '') // Consolidate whitespace and tab removal
          .replace(/\/+$/, '') // Remove trailing slashes
          .split(',')[0]; // Get the first part before any comma
  }
  catch(e) {
    logger.warn(`Failed to sanitize relay ${relay}`)
    return ""
  }
}


export const relaysFilterInvalid = (relays) => {
  let invalids = 0;
  const re = /^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9\-]*[A-Za-z0-9])$/;
  const validRelays = relays.filter(relay => {
    try {
      const test = new URL(relay);
      if (
        (test.protocol === 'wss:' || test.protocol === 'ws:') && 
        re.test(test.hostname) &&
        !test.hostname.includes('https:') &&
        !test.hostname.includes('http:') && 
        test.hostname.includes('.')
      ) {
        return true;
      }
      invalids++;
      return false;
    } catch(e) {
      invalids++;
      return false;
    }
  });
  return validRelays;
}


export const relaysFilterDuplicates = (relays) => {
  const hostnameMap = new Map();
  return relays.filter(url => {
    try { 
      const hostname = new URL(url).hostname;
      if (!hostnameMap.has(hostname)) {
        hostnameMap.set(hostname, true);
        return true;
      }
      return false;
    } catch(e) {
      return false;
    }
  });
}


export const relaysFilterPortDuplicates = (relays) => {
  const relaysMap = new Map(relays.map(relay => [new URL(relay).hostname, relay]));
  return Array.from(relaysMap.values());
}


export const relaysFilterRobotsTxtDisallowed = (relays) => {
  const disallowed = cache.get('disallowed') || [];
  return relays.filter(relay => !disallowed.includes(relay));
}


export const relaysFilterBlocked = (relays) => {
  return relays.filter(relay => !BLOCK_HOSTNAMES.some(hostname => relay.includes(hostname)));
}

