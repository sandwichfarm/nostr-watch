import Dexie from 'dexie';
import { IEvent, IMonitor, IRelay, ICheck, INip11, IGeocode } from './models/index'

export const defaults = <T>(): { [K in keyof T]: T[K] | null } => {
  const defaultObject = {} as { [K in keyof T]: T[K] | null };
  Object.keys(defaultObject).forEach(key => {
    defaultObject[key as keyof T] = null as any;
  });
  return defaultObject;
}

export default ( dbName: string = 'relays', version: number = 1 ) => {
  const db = new Dexie(dbName);
  
  db.version(version).stores({
    events: `id, pubkey, tags, kind, createdAt`,
    monitors: '&id, eventId, frequency, lastActive, geohash',
    relays: '&relay, last_seen',
    checks: `[relay+monitorPubkey], [software+version], 
      nid,
      relay, monitorPubkey, operatorPubkey,
      network, 
      relayType,
      open, 
      paymentRequired, authRequired,
      validTo,
      ipv4, isp,
      *geohash,
      *geocode, 
      *supportedNips,
      createdAt`,
    nip11s: `[relay+monitorPubkey], monitorPubkey, hash`,
    geocodes: `&code, [type+format+length], [type+format+type],[type+format], type, format, length`,
    ssls: `&relay, monitorPubkey, hash, nid`
  });

  return {
    db,
    events: db.table('events') as Dexie.Table<IEvent, string>,
    monitors: db.table('monitors') as Dexie.Table<IMonitor, string>,
    relays: db.table('relays') as Dexie.Table<IRelay, string>,
    checks: db.table('checks') as Dexie.Table<ICheck, string>,
    nip11s: db.table('nip11s') as Dexie.Table<INip11, string>,
    geocodes: db.table('geocodes') as Dexie.Table<IGeocode, string>
  };
}
