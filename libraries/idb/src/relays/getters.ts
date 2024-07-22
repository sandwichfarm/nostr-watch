import db from './db'
import geohash from 'ngeohash';
import { normalizeUrl } from '../utils';
import { NDKRelayMeta } from '@nostr-dev-kit/ndk';
import { allOf } from '../utils';
import { ICheck, IRelay } from './tables';

export const allRelays = async () => {
  return db.relays.toArray();
};

export const getRelaysOnly = async () => {
  return (await db.relays.toArray())?.map( (relay: IRelay) => relay.relay);
};

export const supportsNips = async (nips: number[]) => {
  const promises = [];
  (await allOf(db.checks, 'supportedNips', nips)).forEach( (c: ICheck) => {
    promises.push(async () => {
      const event = await db.events.get(c.nid)
      return new NDKRelayMeta(undefined, event?.event)
    })
  })
};

export const nip11 = async (relayUrl: string) => {
  relayUrl = normalizeUrl(relayUrl)
  try {
    return (await db.nip11s.get({ relay: relayUrl }))?.json
  } catch(e){
    console.error(e)
    return new Object()
  }
};

export const getRelayMeta = async (relay: string): Promise<NDKRelayMeta> => {
  relay = normalizeUrl(relay);
  const nostrEvent = (await db.events.get({ relay }))?.event
  return new NDKRelayMeta(undefined, nostrEvent)
};

export const getPaymentRequired = async () => {
  return db.checks.where('paymentRequired').equals(1).toArray();
};

export const getAuthRequired = async () => {
  return db.checks.where('authRequired').equals(1).toArray();
};

export const getNoPaymentRequired = async () => {
  return db.checks.where('paymentRequired').equals(0).toArray();
};

export const getNoAuthRequired = async () => {
  return db.checks.where('authRequired').equals(0).toArray();
};

export const getUsesSoftware = async (software: string) => {
  return db.checks.where('software').equalsIgnoreCase(software).toArray();
};  

export const getUsesSoftwareVersion = async (software: string, version: string) => {
  return db.checks.where({software, version}).toArray();
};

export const getOpenRttBetween = async (min: number, max: number) => {
  return db.checks.where('open').between(min, max).toArray();
};

export const getReadRttBetween = async (min: number, max: number) => {
  return db.checks.where('read').between(min, max).toArray();
};

export const getWriteRttBetween = async (min: number, max: number) => {
  return db.checks.where('write').between(min, max).toArray();
};

export const getOpenRttLowerThan = async (maxOpen: number) => {
  return db.checks.where('open').below(maxOpen).toArray();
};

export const getReadRttLowerThan = async (maxRead: number) => {
  return db.checks.where('read').below(maxRead).toArray();
};

export const getWriteRttLowerThan = async (maxWrite: number) => {
  return db.checks.where('write').below(maxWrite).toArray();
};

export const getOpenRttGreaterThan = async (minOpen: number) => {
  return db.checks.where('open').above(minOpen).toArray();
};

export const getReadRttGreaterThan = async (minRead: number) => {
  return db.checks.where('read').above(minRead).toArray();
};

export const getWriteRttGreaterThan = async (minWrite: number) => {
  return db.checks.where('write').above(minWrite).toArray();
};

export const sslIsValid = async () => {
  const now = Date.now();
  return db.checks.where('valid_to').above(now).toArray();
};

export const sslIsInvalid = async () => {
  const now = Date.now();
  return db.checks.where('valid_to').below(now).toArray();
};

export const noSsl = async () => {
  return db.checks.where('valid_to').equals(0).toArray();
};

export const getRelayIpIs = async (ipAddress: string) => {
  return (await db.checks.where('ipv4').equals(ipAddress).or('ipv6').equals(ipAddress).toArray());
};

export const getRelayGeohashIs = async (geohash: string) => {
  return db.checks.where('geohash').equals(geohash).toArray();
};

export const getRelayCountryCodeIs = async (countryCode: string) => {
  return db.checks.where('geocode').equals(countryCode).toArray();
};

export const getRelayIsWithin = async (gh: string, distance: number, precision = 9, unit = 'km') => {
  if(unit === 'miles') distance = distance * 1.60934;
  const { latitude, longitude } = geohash.decode(gh);
  const earthRadiusKm = 6371;
  const distanceLatKm = distance / earthRadiusKm;
  const distanceLonKm = distance / (earthRadiusKm * Math.cos(Math.PI * latitude / 180));

  // Calculate bounds
  const minLat = latitude - distanceLatKm * (180 / Math.PI);
  const maxLat = latitude + distanceLatKm * (180 / Math.PI);
  const minLon = longitude - distanceLonKm * (180 / Math.PI);
  const maxLon = longitude + distanceLonKm * (180 / Math.PI);

  const boundingBoxGeohashes = geohash.bboxes(minLat, minLon, maxLat, maxLon, precision);

  return db.checks.where('geohash').anyOf(boundingBoxGeohashes).toArray();
};