import { transformCheck } from "@base/transform/TransformCheck";
import { IEvent, NostrEvent, NostrTag } from "./Event";
import { IGeocode } from "./Geocode";
import { Geocoded } from "./Geocoded";

export class Nip66Event extends Geocoded implements IEvent {
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
  
    // get geohash(): string[] | null {
    //   return this.tags.filter((tag: NostrTag) => tag[0] === 'g').map((tag: NostrTag) => tag[1]) || null;
    // }
  
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

  