import { IGeocode } from "./Geocode";

export type IEvent = {
  id: string;
  pubkey: string;
  kind: number;
  tags: string[][];
  content: string;
  signature: string;
  created_at: number | null;
}

export class NostEvent {
  protected _json: IEvent;

  constructor(event: IEvent) {
    this._json = event;
  }

  get id(): string {
    return this.json.id;
  }

  get pubkey(): string {
    return this.json.pubkey;
  }

  get kind(): number {
    return this.json.kind;
  }

  get tags(): string[][] {
    return this.json.tags;
  }

  get content(): string {
    return this.json.content;
  }

  get signature(): string {
    return this.json.signature;
  }

  get created_at(): number | null {
    return this.json.created_at;
  }

  get json(): IEvent {
    return this._json;
  }
}

type NostrTag = string[];

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

export class Nip66Event extends NostEvent {
  get keys(): string[] {
    return [
      'nid', 
      'relay', 
      'monitorPubkey', 
      'created_at', 
      'networks', 
      'rtt', 
      'operatorPubkey', 
      'supportedNips', 
      'software', 
      'version', 
      'paymentRequired', 
      'authRequired', 
      'geohash', 
      'geocode', 
      'isp', 
      'as', 
      'asname', 
      'ipv4', 
      'ipv6', 
      'sslValidTo', 
      'sslIssuer'
    ];
  }

  get relay(): string | null {
    return this.tags.find((tag: NostrTag) => tag[0] === 'd')?.[1] || null;
  }

  get monitorPubkey(): string {
    return this.pubkey;
  }

  get created_at(): number | null {
    return this.json.created_at;
  }

  get networks(): string[] | null {
    return this.tags.filter((tag: NostrTag) => tag[0] === 'n').map((tag: NostrTag) => tag[1]) || null;
  }

  get rtt(): number | null {
    const rtt = this.tags.find((tag: NostrTag) => tag[0] === 'rtt-open')?.[1]
    return rtt? parseInt(rtt): null;
  }

  get operatorPubkey(): string | null {
    return this.tags.find((tag: NostrTag) => tag[0] === 'p')?.[1] || null;
  }

  get supportedNips(): string[] | null {
    const nips = 
      this.tags
        .filter((tag: NostrTag) => tag[0] === 'N')
        .map((tag: NostrTag) => tag[1]) || null;
    return Array.from(new Set(nips));
  }

  get software(): string | null {
    return this.tags.find((tag: NostrTag) => tag[0] === 's')?.[1]?.toLowerCase() || null;
  }

  get version(): string | null {
    return this.tags.find((tag: NostrTag) => tag[0] === 'l' && tag[2] === 'nip11.version')?.[1] || null;
  }

  get paymentRequired(): boolean {
    return this.tags.some((tag: NostrTag) => tag[0] === 'R' && tag[1] === 'payment') ? true : false;
  }

  get authRequired(): boolean {
    return this.tags.some((tag: NostrTag) => tag[0] === 'R' && tag[1] === 'auth') ? true : false;
  }

  get powRequired(): boolean {
    return this.tags.some((tag: NostrTag) => tag[0] === 'R' && tag[1] === 'pow') ? true : false;
  }

  get geohash(): string[] | null {
    return this.tags.filter((tag: NostrTag) => tag[0] === 'g').map((tag: NostrTag) => tag[1]) || null;
  }

  get geocode(): string | null {
    return this.geocodes.find( (code: IGeocode) => code.format === 'alpha' && code.length === 2)?.code || null;
  }

  get geocodeAlpha2(): string | null {
    return this.geocode;
  }

  get geocodeAlpha3(): string | null {
    return this.geocodes.find( (code: IGeocode) => code.format === 'alpha' && code.length === 3)?.code || null;
  }

  get geocodeNumeric(): string | null {
    return this.geocodes.find( (code: IGeocode) => code.format === 'numeric')?.code || null;
  }

  get geocodes(): IGeocode[] {
    const codes = 
      this.tags
        .filter((tag: NostrTag) => { 
          return tag[0] === 'l' && tag[2] === 'countryCode'
        })
        .map((tag: NostrTag) => tag[1]);
    if(!codes.length) return [];
    return formatGeocodes(codes)
  }

  get isp(): string | null {
    return this.tags.find((tag: NostrTag) => tag[0] === 'l' && tag[2].includes('isp'))?.[1] || null;
  }

  get as(): string | null {
    return this.tags.find((tag: NostrTag) => tag[0] === 'l' && tag[2] === 'host.as')?.[1] || null;
  }

  get asname(): string | null {
    return this.tags.find((tag: NostrTag) => tag[0] === 'l' && tag[2] === 'host.asn')?.[1] || null;
  }

  get ipv4(): string[] | null {
    return this.tags.filter((tag: NostrTag) => tag[0] === 'l' && tag[2].includes('ipv4')).map((tag: NostrTag) => tag[1]) || null;
  }

  get ipv6(): string[] | null {
    return this.tags.filter((tag: NostrTag) => tag[0] === 'l' && tag[2].includes('ipv6')).map((tag: NostrTag) => tag[1]) || null;
  }

  get sslValidTo(): string | null {
    return this.tags.find((tag: NostrTag) => tag[0] === 'l' && tag[2] === 'ssl.validTo')?.[1] || null;
  }

  get sslIssuer(): string | null {
    return this.tags.find((tag: NostrTag) => tag[0] === 'l' && tag[2] === 'ssl.issuer')?.[1] || null;
  }

  get check(): any {
    return transformCheck(this.json);
  }
}

const formatGeocodes = (codes: string[]): IGeocode[] => {
  const results: IGeocode[] = []
  for(let code of codes) {
    const isNumber = !isNaN(Number(code)) && code !== ''
    results.push({
        code,
        type: 'ISO-3166-1',
        format: isNumber? 'numeric' : 'alpha',
        length: isNumber? undefined: (code as unknown as string).length
    })
  }
  return results;
}