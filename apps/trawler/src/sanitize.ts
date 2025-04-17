/// <reference lib="deno.ns" />

import Logger from '@nostrwatch/logger';

const logger = new Logger('sanitizers');

const BLOCK_HOSTNAMES: string[] = [];

export const normalizeRelays = (relays: string[]): string[] => {
  if (!relays?.length) {
    console.log('!relays?.length', relays);
    return [];
  }
  const splitRelays = maybeSplitRelayList(relays);
  return splitRelays
    .map(sanitizeRelayUrl)
    .filter(qualifyRelayUrl)
    .reduce(normalizeRelayUrlAcc, [] as string[]);
};

export const maybeSplitRelayList = (relays: string[]): string[] => {
  const _relays: string[] = [];
  relays.forEach(relay => {
    if (relay.includes(',')) {
      const maybeRelays = relay.split(',');
      _relays.push(...maybeRelays);
    } else {
      _relays.push(relay);
    }
  });
  return _relays;
};

export const sanitizeRelayUrl = (relay: string): string => {
  try {
    return decodeURI(relay)
      .toLowerCase()
      .trim()
      .replace(/[\s\t]+/, '') // Consolidate whitespace and tab removal
      .replace(/\/+$/, '') // Remove trailing slashes
      .replace(/\.+$/, '') // Remove trailing dots
      .replace('(blob_hash)', '')
      .split(',')[0]; // Get the first part before any comma
  } catch (e) {
    logger.warn(`Failed to sanitize relay ${relay}: ${e instanceof Error ? e.message : String(e)}`);
    return "";
  }
};

export const qualifyRelayUrl = (relay: string): boolean => {
  if (/^(wss:\/\/)(.*)(:\/\/)(.*)$/.test(relay)) //multiple protocols
    return false;

  if (!relay.startsWith('wss://') && !relay.startsWith('ws://'))
    return false;

  if (relay.match(/localhost|\.local|[\n\r]|\[object object\]/))
    return false;

  if (relay.includes('http://') || relay.includes('https://'))
    return false;

  if (relay.match(/(127\.)\d{0,3}(\.)\d{0,3}(\.)\d{0,3}|(192\.168|10\.)\d{1,3}(\.)\d{1,3}/))
    return false;

  if (/(npub)[A-z0-9]{0,60}/.test(relay))
    return false;

  return true;
};

export const normalizeRelayUrlAcc = (acc: string[], relay: string): string[] => {
  const normalized = normalizeRelayUrl(relay);
  if (normalized) {
    acc.push(normalized);
  }
  return acc;
};

export const normalizeRelayUrls = (relays: string[]): string[] => {
  return relays.map(relay => normalizeRelayUrl(relay));
};

export const normalizeRelayUrl = (relay: string): string => {
  try {
    const url = new URL(relay);
    url.hash = '';
    url.search = '';
    return url.toString();
  } catch (e) {
    logger.warn(`Failed to normalize relay ${relay}: ${e instanceof Error ? e.message : String(e)}`);
  }
  return "";
};

export default normalizeRelays; 