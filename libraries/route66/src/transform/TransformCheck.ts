import { NostrTag } from "@base/models/Event";

export const transformCheck = (event: any) => {
    const nid = event.id;
    
    const dTag = event.tags.find((tag: NostrTag) => tag[0] === 'd');
    const relay = dTag ? new URL(dTag[1]).toString() : null;
  
    const monitorPubkey = event.pubkey;
    const created_at = event.created_at;
  
    const networks = event.tags.find((tag: NostrTag) => tag[0] === 'n')?.[1] || null;
    const rttOpen = parseInt(event.tags.find((tag: NostrTag) => tag[0] === 'rtt-open')?.[1]) || null;
    const rttWrite = parseInt(event.tags.find((tag: NostrTag) => tag[0] === 'rtt-write')?.[1]) || null;
    const rtt = rttOpen || rttWrite || null;
  
    const operatorPubkey = event.tags.find((tag: NostrTag) => tag[0] === 'p')?.[1] || null;
  
    const supportedNips = event.tags
      .filter((tag: NostrTag) => tag[0] === 'N')
      .map((tag: NostrTag) => parseInt(tag[1])) || null;
  
    const software = event.tags.find((tag: NostrTag) => tag[0] === 's')?.[1] || null;
    const version = event.tags.find((tag: NostrTag) => tag[0] === 'l' && tag[2] === 'nip11.version')?.[1] || null;
  
    const paymentRequired = event.tags.some((tag: NostrTag) => tag[0] === 'R' && tag[1] === 'payment') ? true : false;
    const authRequired = event.tags.some((tag: NostrTag) => tag[0] === 'R' && tag[1] === 'auth') ? true : false;
    const powRequired = event.tags.some((tag: NostrTag) => tag[0] === 'R' && tag[1] === 'auth') ? true : false;
  
    const geohash = event.tags.filter((tag: NostrTag) => tag[0] === 'g').map((tag: NostrTag) => tag[1]) || null;
    const geocode = event.tags.find((tag: NostrTag) => tag[0] === 'l' && tag[2] === 'countryCode' && tag[1].length === 2)?.[1] || null;
  
    const isp = event.tags.find((tag: NostrTag) => tag[0] === 'l' && tag[2].includes('isp'))?.[1] || null;
    const as = event.tags.find((tag: NostrTag) => tag[0] === 'l' && tag[2] === 'host.as')?.[1] || null;
    const asname = event.tags.find((tag: NostrTag) => tag[0] === 'l' && tag[2] === 'host.asn')?.[1] || null;
  
    const ipv4 = event.tags.filter((tag: NostrTag) => tag[0] === 'l' && tag[2].includes('ipv4')).map((tag: NostrTag) => tag[1]) || null;
  
    return {
      nid,
      relay,
      monitorPubkey,
      created_at,
      networks,
      rtt,
      operatorPubkey,
      supportedNips,
      software,
      version,
      paymentRequired,
      authRequired,
      geohash,
      geocode,
      isp,
      as,
      asname,
      ipv4,
      ipv6: null,
      sslValidTo: null,
      sslIssuer: null,
    };
  }