import { transformCheck } from "@base/transform/TransformCheck";
import { IEvent, NostrEvent, NostrTag } from "./Event";
import { Geocoded } from "./Geocoded";
import { nip19 } from "nostr-tools";
import { Nip11, Nip11Fee, Nip11Fees } from "./Nip11";
import { isPubkey } from "@base/utils/nostr";

export class Nip66Event extends Geocoded implements IEvent {
    _nip11?: Nip11 | false;

    static keys = [
      'id', 
      'relay', 
      'monitorPubkey', 
      'created_at', 
      'networks', 
      'rtt', 
      'operatorPubkey', 
      'operatorPubkeyValid',
      'name',
      'description',
      'supportedNips', 
      'software', 
      'icon',
      // 'hasIcon',
      'banner',
      // 'hasBanner',
      'version', 
      'hasNip11',
      'nip11Hash',
      'paymentRequired', 
      'authRequired', 
      'dd',
      'geohash', 
      'geocode', 
      'isp', 
      'as', 
      'asname', 
      'ipv4', 
      'ipv6', 
      'sslValidTo', 
      'sslIssuer',
      'fees',
      'subscriptionFee',
      'publicationFee',
      'admissionFee'
    ];

    constructor(event: IEvent) {
      super(event);
      this.nip11 = this.content;
    }
    get nip11(): Nip11 | undefined  {
      if(this._nip11 === false) return undefined;
      if(this._nip11 instanceof Nip11) return this._nip11; 
      return undefined;
    }

    set nip11(nip11: string) {
      if(this.content.length > 2) {
        try { 
          this._nip11 = new Nip11( JSON.parse(this.content) );
        }
        catch(e){
          this._nip11 = false;
        }
      }
    }

    get hasNip11(): boolean {
      return this._nip11 instanceof Nip11;
    }

    get nip11Hash(): string | undefined {
      if(this.hasNip11){
        return (this._nip11 as Nip11)?.hash
      }
      return undefined;
    }

    get operatorPubkey(): string | null {
      const fromNip11 = this.nip11?.pubkey;
      return fromNip11? 
        fromNip11: 
        this.tags.find((tag: NostrTag) => tag[0] === 'p')?.[1] || null;
    }

    get operatorPubkeyValid(): boolean | undefined {
      if(!this.operatorPubkey) return undefined;
      return isPubkey(this.operatorPubkey);
    }
  
    get relay(): string | null {
      return this.tags.find((tag: NostrTag) => tag[0] === 'd')?.[1] || null;
    }

    get url(): string | null {
      return this.relay;
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
  
    get supportedNips(): string[] | null {
      const nip11Nips = this.nip11?.supportedNips?.map( n => n.toString() ) || []
      if(nip11Nips) {
        return Array.from(new Set( this.nip11?.supportedNips?.map( n => n.toString() ) || [] ));
      }
      return this.tags.filter((tag: NostrTag) => tag[0] === 'l' && tag[2] === 'nip11.supported_nips').map((tag: NostrTag) => tag[1]) || null;  
    }

    get name(): string | null {
      return this.nip11?.name || null;
    }
  
    get software(): string | null {
      return this.nip11?.software?.toLowerCase() || null;
    }
  
    get version(): string | null {
      return this.nip11?.version || null;
    }
  
    get paymentRequired(): boolean {
      return this.nip11?.paymentRequired || false;
    }
  
    get authRequired(): boolean {
      return this.nip11?.authRequired || false;
    }
  
    get powRequired(): number | boolean {
      return this.nip11?.powRequired || false;
    }

    get description(): string | null {  
      return this.nip11?.description || null;
    }

    get contact(): string | null {
      return this.nip11?.contact || null;
    }

    get maxMessageLength(): number | null {
      return this.nip11?.maxMessageLength || null;
    }

    get maxMessageTags(): number | null {
      return this.nip11?.maxMessageTags || null;
    }

    get paymentsUrl(): string | null {
      return this.nip11?.paymentsUrl || null;
    }

    get fees(): Nip11Fees | null {
      return this.nip11?.fees || null;
    }

    get subscriptionFee(): Nip11Fee[] | null {
      return this.fees?.subscription || null;
    }

    get publicationFee(): Nip11Fee[] | null {
      return this.fees?.publication || null;
    }

    get admissionFee(): Nip11Fee[] | null {
      return this.fees?.admission || null;
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

    get icon(): string | null {
      return this.nip11?.icon || null;
    }

    get hasIcon(): boolean {
      return !!this.icon;
    }

    get banner(): string | null {
      return this.nip11?.banner || null;
    }

    get hasBanner(): boolean {
      return !!this.banner;
    }

    get nrelay(): string | null {
      if(!this.url) return null;
      return nip19.nrelayEncode(this.url)
    }
  }

  