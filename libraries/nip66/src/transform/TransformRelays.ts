import { IRelay, ICheck, IEvent, INip11, IGeocode, modelDefaults } from '@models/index';

import { 
  GeoCodesObjectRaw, 
  ISO3166Format, 
  ISO3166Type, 
  RawGeoCode, 
  RawGeoCodes 
} from '@interfaces/index';

import { 
  getUrlFromEvent, 
  getNetworkFromEvent, 
  extractGeoCodes 
} from '@utils/index';

export type IdbReadyRelayData = { 
  event?: IEvent,
  relay?: IRelay, 
  check?: ICheck,
  nip11?: INip11,
  geocodes?: IGeocode[]
}

export const transform30166 = async (_event: IEvent): Promise<IdbReadyRelayData> => {  
  const res: IdbReadyRelayData = {}

  const eventRecord = k30166ToIEvent(_event)

  const relay: string | undefined = getUrlFromEvent(eventRecord as IEvent)
  const network: string | undefined = getNetworkFromEvent(eventRecord as IEvent) ?? 'unknown'

  // if(!relay || !network) {
  //   console.error(`Event did not contain relay or network: ${eventRecord.id}, relay: ${relay}, network: ${network}`)
  //   return res;
  // }

  if(!relay) {
    console.error(`Event did not contain relay or network: ${eventRecord.id}, relay: ${relay}`)
    return res;
  }
  
  const parsedRelay = n66IEventToIRelay(relay, network, eventRecord)
  const parsedNip11 = await n66IEventToNip11(relay, eventRecord)
  const parsedGeocodes = n66IEventToIGeocodes(eventRecord)
  const parsedCheck = k30166ToICheck(eventRecord, parsedNip11, parsedGeocodes)

  if(eventRecord) res.event = eventRecord
  if(parsedCheck) res.check = parsedCheck
  if(parsedRelay) res.relay = parsedRelay
  if(parsedNip11) res.nip11 = parsedNip11
  if(parsedGeocodes) res.geocodes = parsedGeocodes

  return res
}

export const k30166ToIEvent = (_event: IEvent): IEvent => {
  const { pubkey, created_at, id, kind, tags, content, signature } = _event;
  const event: IEvent = {
    id,
    kind,
    pubkey,
    created_at,
    tags,
    content,
    signature
  }
  return event
}

export const k30166ToICheck = (event: IEvent, nip11?: INip11, geocode_: IGeocode[] = []): ICheck => {
  const { pubkey:monitorPubkey, created_at:created_at_ } = event;

  const nid = event.id;

  const created_at = created_at_ as number 

  const relay = getUrlFromEvent(event);
  const network = getNetworkFromEvent(event);
  const rtt = getRtt(event);
  
  const { ipv4, ipv6 } = getIps(event);
  const { isp, as, asname } = getIsp(event);
  const geohash = getGeohash(event);

  const geocode = iGeocodeToArray(geocode_)
  
  let operatorPubkey = null,
      supportedNips = null, 
      software = null,
      version = null,
      paymentRequired = null,
      authRequired = null;
  
  if(nip11){
    operatorPubkey = nip11.json?.pubkey ?? null;
    supportedNips = nip11.json?.supported_nips ?? null;
    software = nip11.json?.software ?? null;
    version = nip11.json?.version ?? null;
    paymentRequired = nip11.json?.limitation?.payment_required? 1: 0;
    authRequired = nip11.json?.limitation?.authRequired? 1: 0;
  }

  const relayCheck = { 
    nid, 
    relay,
    monitorPubkey, 

    created_at,

    network,
    rtt, 

    geohash,
    geocode, 

    operatorPubkey,
    supportedNips,
    software,
    version,

    paymentRequired,
    authRequired,

    isp,
    as,
    asname,

    ipv4,
    ipv6,
  }
  return {...modelDefaults<ICheck>(), ...relayCheck} as ICheck
}

export const iGeocodeToArray = (geocode_: IGeocode[]): string[] => {
  return geocode_.reduce((acc: string[], geocode: IGeocode) => {
    acc.push(geocode.code);
    return acc;
  }, [] as string[]);
}

const getGeohash = (event: IEvent): string | null => {
  return event.tags.reduce((longest, t) => {
    const key = t[0];
    const value = t[1];
    const isGeohash = key === 'g';

    if (isGeohash && value.length > (longest?.length || 0)) {
      return value;
    }

    return longest;
  }, null as string | null);
};

const getRtt = (event: IEvent): number | null => {
  let rtt = event.tags
    .find((t) => {
      const key = t[0];
      if (key === 'rtt-open') {
        return true
      }
    })?.[1]
  if(!rtt) return null
  let rttN
  try{
    rttN = parseInt(rtt)
  }
  catch(e){
    console.warn(`rtt did not validate for monitor: ${event.pubkey}`)
  }
  return rttN ?? null
}

const getIps = (event: IEvent): Record<string, string[]> => {
  return event.tags.reduce((acc, t) => {
    const key = t[0];
    const value = t[1];
    const label = t[2];
    const isLabel = key === 'l';
  
    if (isLabel && label.includes('ipv4')) {
      acc.ipv4.push(value);
    }
    if (isLabel && label.includes('ipv6')) {
      acc.ipv6.push(value);
    }

    return acc;
  }, { ipv4: [], ipv6: [] } as Record<string, string[]>);
}

const getIsp = (event: IEvent): Record<string, string | null> => {
  return event.tags.reduce((acc, t) => {
    const key = t[0];
    const value = t[1];
    const label = t[2];
    const isLabel = key === 'l';
  
    if (isLabel && label.includes('isp')) {
      acc.isp = value;
    }
    else if (isLabel && label.includes('asname')) {
      acc.asname = value;
    }
    else if (isLabel && label.includes('as')) {
      acc.as = value;
    }
    return acc;
  }, { isp: null, as: null, asname: null } as Record<string, string | null>);
}

export const n66IEventToIRelay = (relay: string, network: string, event: IEvent): IRelay | undefined => {
  const { pubkey, created_at:lastSeen } = event;

  const _relay = {
    relay,
    lastSeen: lastSeen as number,
    network
  }
  return {...modelDefaults<IRelay>(), ..._relay} as IRelay
}

const n66IEventToNip11 = async (relay: string, event: IEvent): Promise<INip11 | undefined> => {
  const { pubkey:monitorPubkey, id:nid, created_at } = event;

  if(!created_at) return
  let json
  try {
    json = JSON.parse(event.content)
  } catch(e){
    console.warn(`could not parse nip-11 for ${relay}`)
    return 
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
    created_at,
    hash,
    json, 
  }
  return {...modelDefaults<INip11>(), ...inip11}
}

export const geocodeTransform = ( event: IEvent ): IGeocode[] => {
  const codes: GeoCodesObjectRaw = extractGeoCodes(event as IEvent)
  const cc = parseGeocodes(codes.countryCode, ISO3166Type.CountryCode)
  const rc = parseGeocodes(codes.regionCode, ISO3166Type.RegionCode)
  const res: IGeocode[] = []
  if(cc) res.push(...cc)
  if(rc) res.push(...rc)
  return res;
}

export const parseGeocodes = (codes: RawGeoCodes, type: ISO3166Type): IGeocode[] | undefined => {
  const geocodeEntries: IGeocode[] = [];
  if(!codes) return
  (codes as RawGeoCodes).forEach( (code: RawGeoCode) => { 
    geocodeEntries.push( parseGeocode(type, code) ) 
  })
  return geocodeEntries
}

export const parseGeocode = (type: ISO3166Type, code: RawGeoCode): IGeocode => {
  const isNumeric = !isNaN(Number(code))
  const ignoreLength = isNumeric || type === ISO3166Type.RegionCode? true: false
  if(typeof code !== 'string') code = String(code)
  return {
    code, 
    type: type,
    format: isNumeric? ISO3166Format.Numeric: ISO3166Format.Alpha,
    length: ignoreLength? -1: String(code).length
  }
}

// const n66IEventToSsl = async (event: IEvent): Promise<ISsl | undefined> => {
//   const { pubkey:monitorPubkey, id:nid, created_at:created_at } = event;

//   const relay = getUrlFromEvent(event)

//   if(!relay) {
//     console.error(`Event did not contain relay: ${event.id}, relay: ${relay}`)
//     return
//   }
  
//   if(!cert || !relay) return undefined
//   const hash = await hashString(cert)

//   const ssl: ISsl = {
//     nid,
//     created_at,
//     relay,
//     monitorPubkey,
//     hash,
//     cert,
//   }

//   return ssl
// }

const n66IEventToIGeocodes = (event: IEvent): IGeocode[] => {
  return geocodeTransform(event)
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