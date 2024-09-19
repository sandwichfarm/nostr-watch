import { NostrEvent } from '@base/models/NostrEvent';
import { getUrlFromEvent, getNetworkFromEvent } from '@base/utils/events';
import { extractGeoCodes } from '@base/utils/geo';

import { type GeoCodesObjectRaw, ISO3166Format, ISO3166Type, RawGeoCode, RawGeoCodes } from '@base/types/TISO13166';

import { IRelay, ICheck, IEvent, INip11, IGeoCode } from '../models/';
import { RelayDb } from '../db';

export type IdbReadyRelayData = { 
  event?: IEvent,
  relay?: IRelay, 
  check?: ICheck,
  nip11?: INip11,
  geocodes?: IGeoCode[],
}

export const transform30166 = async (_event: NostrEvent): Promise<IdbReadyRelayData> => {  
  const res: IdbReadyRelayData = {}

  const event = k30166ToIEvent(_event)

  const relay: string | undefined = getUrlFromEvent(event)
  const network: string | undefined = getNetworkFromEvent(event)

  if(!relay || !network) {
    console.error(`Event did not contain relay or network: ${event.id}, relay: ${relay}, network: ${network}`)
    return res;
  }

  const parsedCheck = k30166ToICheck(relay, network, event)
  const parsedRelay = n66IEventToIRelay(relay, network, event)
  const parsedNip11 = await n66IEventToNip11(relay, event)
  const parsedGeocodes = n66IEventToIGeoCodes(event)

  if(event) res.event = event
  if(parsedCheck) res.check = parsedCheck
  if(parsedRelay) res.relay = parsedRelay
  if(parsedNip11) res.nip11 = parsedNip11
  if(parsedGeocodes) res.geocodes = parsedGeocodes

  return res
}

export const k30166ToIEvent = (_event: NostrEvent): IEvent => {
  const { pubkey, created_at, id, kind, tags, content, signature } = _event;
  const createdAt = created_at as number;
  const event: IEvent = {
    id,
    kind,
    pubkey,
    createdAt,
    tags,
    content,
    signature
  }
  return event
}

export const k30166ToICheck = (relay: string, network: string, event: IEvent): ICheck => {
  const { pubkey:monitorPubkey, createdAt } = event;

  const relayCheck: ICheck = { monitorPubkey, createdAt }

  return {...RelayDb.defaults<ICheck>(), ...relayCheck}
}


export const n66IEventToIRelay = (relay: string, network: string, event: IEvent): IRelay | undefined => {
  const { pubkey, createdAt:lastSeen } = event;

  const irelay: IRelay = {
    relay,
    lastSeen: lastSeen as number,
    network
  }
  return {...RelayDb.defaults<IRelay>(), ...irelay}
}

const n66IEventToNip11 = async (relay: string, event: IEvent): Promise<INip11 | undefined> => {
  const { pubkey:monitorPubkey, id:nid, createdAt } = event;

  if(!createdAt) return
  let json
  try {
    json = JSON.parse(event.content)
  } catch(e){
    console.error('Error parsing json:', e)
    return undefined
  }

  if(!json || !(Object.keys(json)?.length > 0)) return undefined
  
  let hash = null; 
  try {
    hash = await hashObject(json);
  } catch (error) {
    console.error('Error hashing object:', error);
    return undefined
  }

  const inip11 = {
    relay,
    nid,
    monitorPubkey,
    createdAt,
    hash,
    json, 
  }
  return {...RelayDb.defaults<INip11>(), ...inip11}
}

export const geocodeTransform = ( event: NostrEvent ): IGeoCode[] => {
  const codes: GeoCodesObjectRaw = extractGeoCodes(event)
  const cc = parseGeocodes(codes.countryCode, ISO3166Type.CountryCode)
  const rc = parseGeocodes(codes.countryCode, ISO3166Type.RegionCode)
  const res: IGeoCode[] = []
  if(cc) res.push(...cc)
  if(rc) res.push(...rc)
  return res;
}

export const parseGeocodes = (codes: RawGeoCodes, type: ISO3166Type): IGeoCode[] | undefined => {
  const geocodeEntries: IGeoCode[] = [];
  if(!codes) return
  (codes as RawGeoCodes).forEach( (code: RawGeoCode) => { 
    geocodeEntries.push( parseGeocode(type, code) ) 
  })
  return geocodeEntries
}

export const parseGeocode = (type: ISO3166Type, code: RawGeoCode): IGeoCode => {
  const isNumeric = !isNaN(Number(code))
  const ignoreLength = isNumeric || type === ISO3166Type.RegionCode? true: false
  return {
    code, 
    type: type,
    format: isNumeric? ISO3166Format.Numeric: ISO3166Format.Alpha,
    length: ignoreLength? -1: String(code).length
  }
}

// const n66IEventToSsl = async (event: IEvent): Promise<ISsl | undefined> => {
//   const { pubkey:monitorPubkey, id:nid, created_at:createdAt } = event;

//   const relay = getUrlFromEvent(event)

//   if(!relay) {
//     console.error(`Event did not contain relay: ${event.id}, relay: ${relay}`)
//     return
//   }
  
//   if(!cert || !relay) return undefined
//   const hash = await hashString(cert)

//   const ssl: ISsl = {
//     nid,
//     createdAt,
//     relay,
//     monitorPubkey,
//     hash,
//     cert,
//   }

//   return ssl
// }

const n66IEventToIGeoCodes = (event: NostrEvent): IGeoCode[] => {
  const codes = geocodeTransform(event)
  return codes
}


export const hashObject = async (obj: Record<string, any>): Promise<string> => {
  const canonicalJson = JSON.stringify(obj, Object.keys(obj).sort());
  const buffer = new TextEncoder().encode(canonicalJson);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

export default transform30166;