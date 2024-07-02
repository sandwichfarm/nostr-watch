import { NDKEventGeoCoded, NostrEvent, NDKEvent, NDKTag, NDKKind, NDKRelayMeta, NDKRelayDiscovery } from '@nostr-dev-kit/ndk';
import { ISO3166Type, ISO3166Format, GeoCodesRaw } from './types';
import { IGeoCode } from './shared/tables';
import { Table } from 'dexie';

export const nHoursAgo = (hrs: number): number => Math.floor((Date.now() - hrs * 60 * 60 * 1000) / 1000);

export const normalizeUrl = (url: string) => {
  const parsedUrl = new URL(url);
  parsedUrl.search = '';
  parsedUrl.hash = '';
  return parsedUrl.toString();
};

export const extractGeoCodesFromRelayMeta = ( event: NDKRelayMeta, type: ISO3166Type): (string | number| undefined)[] => {
  return event.tags
          .filter((tag: NDKTag) => tag[0] === 'geo' && tag[1] === type)
          .map((tag: NDKTag) => tag[2])
}

export const extractGeoCodesFromRelayDiscovery = ( event: NDKRelayDiscovery, type: ISO3166Type ): (string | number | undefined)[] => {
  return event.tags
          .filter((tag: NDKTag) => tag[0] === 'G' && tag[2] === type)
          .map((tag: NDKTag) => tag[1])
}

export const extractGeoCodes = ( event: NDKRelayMeta | NDKRelayDiscovery ): GeoCodesRaw => {
  let countryCode: (string | number | undefined)[] = [];
  let regionCode: (string | number | undefined)[] = [];
  if(event.kind === NDKKind.RelayMeta) {
    countryCode = extractGeoCodesFromRelayMeta(event as NDKRelayMeta, ISO3166Type.CountryCode)
    regionCode = extractGeoCodesFromRelayMeta(event as NDKRelayMeta, ISO3166Type.RegionCode)
  }
  if(event.kind === NDKKind.RelayDiscovery) {
    countryCode = extractGeoCodesFromRelayDiscovery(event as NDKRelayDiscovery, ISO3166Type.CountryCode)
    regionCode = extractGeoCodesFromRelayDiscovery(event as NDKRelayDiscovery, ISO3166Type.RegionCode)
  }

  return { countryCode, regionCode } as GeoCodesRaw
}

export const parseGeocode = (type: ISO3166Type, code: string): IGeoCode => {
  const isNumeric = !isNaN(Number(code))
  const ignoreLength = type === ISO3166Type.RegionCode? true: false || isNumeric
  return {
    code, 
    type: type,
    format: isNumeric? ISO3166Format.Numeric: ISO3166Format.Alpha,
    length: ignoreLength? -1: code.length
  }
}

export const parseGeocodes = (codes: string | string[] | undefined, type: ISO3166Type): IGeoCode[] | undefined => {
  const geocodeEntries: IGeoCode[] = [];
  if(codes === 'string') codes = [codes];
  if(!codes) return
  (codes as string[]).forEach( (code: string) => { 
    geocodeEntries.push( parseGeocode(type, code) ) 
  })
  return geocodeEntries
}

export const geocodeTransform = ( event: NDKRelayMeta | NDKRelayDiscovery ): IGeoCode[] => {
  const codes: GeoCodesRaw = extractGeoCodes(event)
  const cc = parseGeocodes(codes.countryCode, ISO3166Type.CountryCode)
  const rc = parseGeocodes(codes.regionCode, ISO3166Type.RegionCode)
  const res: IGeoCode[] = []
  if(cc) res.push(...cc)
  if(rc) res.push(...rc)
  return res;
}

export const allOf = <T>(table: Table<T, any>, multiValueProp: keyof T & string, keys: (T[keyof T & string])[]): Promise<T[]> => {
  if (keys.length === 0) return Promise.resolve([]);

  const [dbKey, ...filteredKeys] = keys;
  return table.where(multiValueProp).equals(dbKey as any).toArray().then((dbResult: T[]) =>
    filteredKeys.reduce((result: T[], key: T[keyof T & string]) =>
      result.filter((doc: T) => Array.isArray(doc[multiValueProp]) && (doc[multiValueProp] as any[]).includes(key)),
      dbResult
    )
  );
};

export const hashString = async (input: string) => {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      // Browser environment
      const encoder = new TextEncoder();
      const data = encoder.encode(input);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
      return hashHex;
  } else if (typeof require === 'function') {
      // Node.js environment
      const crypto = require('crypto');
      return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
  } else {
      throw new Error('Environment not supported');
  }
}