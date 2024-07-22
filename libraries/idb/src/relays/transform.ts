import { merge as map } from 'object-mapper';
import { NDKKind, NDKTag, NostrEvent, NDKRelayDiscovery, NDKRelayMeta } from '@nostr-dev-kit/ndk';
import { geocodeTransform, hashString } from '../utils'
import { ICheck, IRelay, IEvent, INip11, ISsl } from './tables';
import { RelayDb } from './db';
import { IGeoCode } from 'src/shared/tables';

export type IdbReadyRelayData = { 
  check?: ICheck,
  relay?: IRelay, 
  event?: IEvent,
  nip11?: INip11,
  geocodes?: IGeoCode[],
  ssl?: ISsl
}

export const hashObject = async (obj: Record<string, any>): Promise<string> => {
  const canonicalJson = JSON.stringify(obj, Object.keys(obj).sort());
  const buffer = new TextEncoder().encode(canonicalJson);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

export const relayMetaToICheck = ($event: NDKRelayMeta): ICheck => {
  const { pubkey, created_at } = $event;
  let parsedJson: Record<string, any> = $event.all;
  if(!parsedJson) parsedJson = {}
  
  const hasGeo = parsedJson?.geo?.countryCode || parsedJson?.geo?.countryName

  if(!$event) return {} as ICheck
  
  parsedJson.id = $event.id as string
  parsedJson.created_at = created_at as number;
  parsedJson.pubkey = pubkey as string;
  if($event && hasGeo)
    parsedJson.geocode = $event.tags.filter(tag => tag[1] === 'regionCode' || tag[1] === 'countryCode').map(tag => tag[2])

  const checkMapping = {
    "id": "nid",
    "pubkey": "monitorPubkey",
    "nip11.pubkey": "operatorPubkey",
    "other.network": "network",
    "rtt.open": "open",
    "rtt.read": "read",
    "rtt.write": "write",
    "geo.geohash": "geohash",
    "geocode": "geocode",
    "ssl.valid_to": "validTo",
    "ssl.issuer": "issuer",
    "dns.ipv4": "ipv4",
    "dns.ipv6": "ipv6",
    "dns.isp": "isp",
    "nip11.supported_nips": "supportedNips",
    "nip11.payment_required": "paymentRequired",
    "nip11.auth_required": "authRequired",
    "nip11.software": "software",
    "nip11.version": "version",
    "created_at": "createdAt",
  }

  const relayCheck: ICheck = map(parsedJson, checkMapping) as ICheck;
  
  relayCheck.authRequired = relayCheck.authRequired? 1: 0
  relayCheck.paymentRequired = relayCheck.paymentRequired? 1: 0
  relayCheck.relay = $event.url as string;

  return {...RelayDb.defaults<ICheck>(), ...relayCheck}
}

export const relayMetaToIRelay = ($event: NDKRelayMeta): IRelay => {
  const { pubkey, created_at:lastSeen, url:relay } = $event;
  const irelay: IRelay = {
    relay: relay as string,
    lastSeen: lastSeen as number,
    network: $event.all?.other?.network as string
  }
  return {...RelayDb.defaults<IRelay>(), ...irelay}
}

export const relayMetaToIEvent = ($event: NDKRelayMeta): IEvent => {
  const { pubkey:monitorPubkey, created_at, id:nid, url:relay, kind:maybeKind } = $event;
  const createdAt = created_at as number;
  const event: IEvent = {
    nid,
    kind: maybeKind as number,
    monitorPubkey,
    relay,
    createdAt,
    event: $event.rawEvent()
  }
  return {...RelayDb.defaults<IEvent>(), ...event}
}

const relayMetaToNip11 = async ($event: NDKRelayMeta): Promise<INip11 | undefined> => {
  const { url, pubkey:monitorPubkey, id:nid, created_at:createdAt } = $event;
  if(!createdAt) return
  let json
  try {
    json = JSON.parse($event.content)
  } catch(e){
   return undefined
  }

  if(!json || !(Object.keys(json)?.length > 0)) return undefined
  
  let hash = null; 
  try {
    hash = await hashObject(json);
  } catch (error) {
    console.error('Error hashing object:', error);
  }

  const inip11 = {
    relay: url as string,
    nid,
    monitorPubkey,
    createdAt,
    hash,
    json, 
  }
  return {...RelayDb.defaults<INip11>(), ...inip11}
}

const relayMetaToSsl = async ($event: NDKRelayMeta): Promise<ISsl | undefined> => {
  const { url:relay, pubkey:monitorPubkey, id:nid, created_at:createdAt } = $event;
  const cert = $event.tags.find((tag: NDKTag) => tag[1] === 'pem_encoded')?.[2]
  
  if(!cert || !relay) return undefined
  const hash = await hashString(cert)

  const ssl: ISsl = {
    nid,
    createdAt,
    relay,
    monitorPubkey,
    hash,
    cert,
  }

  return ssl
}

const nip66ToIGeoCodes = ($event: NDKRelayMeta | NDKRelayDiscovery): IGeoCode[] => {
  const codes = geocodeTransform($event)
  // if(codes.length) console.log(`codes:`, codes)
  return codes
}

const relayMetaToIdb = async ($event: NDKRelayMeta): Promise<IdbReadyRelayData> => {  
  const res: IdbReadyRelayData = {}

  const check = relayMetaToICheck($event)
  const relay = relayMetaToIRelay($event)
  const event = relayMetaToIEvent($event)
  const nip11 = await relayMetaToNip11($event)
  const geocodes = nip66ToIGeoCodes($event)
  const ssl = await relayMetaToSsl($event)

  if(check) res.check = check
  if(relay) res.relay = relay
  if(event) res.event = event
  if(nip11) res.nip11 = nip11
  if(geocodes) res.geocodes = geocodes
  if(ssl) res.ssl = ssl

  return res
}

const relayDiscoveryToIdb = async ($event: NDKRelayDiscovery): Promise<IdbReadyRelayData> => {
  const res: IdbReadyRelayData = {}
  const geocodes = nip66ToIGeoCodes($event)

  if(geocodes) res.geocodes = geocodes

  return res
}

export default async ( nostrEvent: NostrEvent ): Promise<IdbReadyRelayData> => {
  const $event: NDKRelayMeta | NDKRelayDiscovery = nostrEvent.kind === NDKKind.RelayMeta? new NDKRelayMeta(undefined, nostrEvent): new NDKRelayDiscovery(undefined, nostrEvent)
  
  let res: IdbReadyRelayData = {}

  if($event.kind === NDKKind.RelayMeta) {
    res = await relayMetaToIdb($event as NDKRelayMeta)
  }
  if($event.kind === NDKKind.RelayDiscovery) {
    res = await relayDiscoveryToIdb($event as NDKRelayDiscovery)
  }

  return res
}