import Dexie from 'dexie';

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
    events: db.table('events'),
    monitors: db.table('monitors'),
    relays: db.table('relays'),
    checks: db.table('checks'),
    nip11s: db.table('nip11s'),
    geocodes: db.table('geocodes'),
    ssls: db.table('ssls')
  };
}
