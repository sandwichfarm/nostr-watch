import { verifyEvent, finalizeEvent, SimplePool, Event } from "nostr-tools";
import ngeotags from "nostr-geotags";
import { Kind10166, Kind0, Kind10002 } from "@nostrwatch/publisher";

const NIP66_MONITOR_REGISTER = 10166;

interface GeoTagOption {
  // Define properties of GeoTagOption if needed
}

// interface AnnounceMonitorOptions {
//   geo?: object;
//   kinds?: number[];
//   timeouts?: number[];
//   counts?: number[];
//   owner?: string;
//   frequency?: string;
// }


interface AnnounceMonitorOptions {
  geo?: object;
  kinds?: number[];
  timeouts?: object;
  counts?: number[];
  owner?: string;
  frequency?: string;
  relays?: string[];
  profile?: object;
}

export class AnnounceMonitor {
  public events?: any = {};
  public monReg?: any;
  public monRelays: string[] = [];
  public monProfile: any;
  // private geo?: object;
  // private kinds: number[];
  // private timeouts: object;
  // private counts: number[];
  // private owner: string;
  // private frequency: string;

  constructor(options: AnnounceMonitorOptions) {
    this.setup(options);
  }

  setup(options: AnnounceMonitorOptions): void {
    // Destructuring options with default values
    const {
      geo = {},
      kinds = [],
      timeouts = {},
      counts = [],
      owner = '',
      frequency = '',
      profile = {},
      relays = [],
    } = options;

    this.monReg = {}

    if (!(geo instanceof Object)) throw new Error("geo must be object");
    if (!(timeouts instanceof Object)) throw new Error("timeouts must be object");
    if (!(kinds instanceof Array)) throw new Error("kinds must be array");
    if (!(counts instanceof Array)) throw new Error("counts must be array");
    if (typeof owner !== "string") throw new Error("owner must be string");
    if (typeof frequency !== "string") throw new Error("frequency must be string");

    if( !(relays instanceof Array) ) throw new Error("relays must be an array");
    if( !(profile instanceof Object) ) throw new Error("profile must be an object");

    // Assigning the validated options to class properties
    this.monReg.geo = geo;
    this.monReg.kinds = kinds;
    this.monReg.timeouts = timeouts;
    this.monReg.counts = counts;
    this.monReg.owner = owner;
    this.monReg.frequency = frequency;

    this.monRelays = relays;
    this.monProfile = profile;
  }

  generate(): any {
    const $monReg = new Kind10166()
    this.events["10166"] = $monReg.generateEvent({...this.monReg})

    const $monRelays = new Kind10002()
    if(this.monRelays.length)
      this.events["10002"] = $monRelays.generateEvent([...this.monRelays])
    
    const $monProfile = new Kind0() 
    if(Object.keys(this.monProfile).length)
      this.events["0"] = $monProfile.generateEvent({...this.monProfile})
    return this.events
  }

  sign(sk: Uint8Array): any {
    if(!this.events) throw new Error("Event has not yet been generated (run generate() first)") 
    const signed: Event[] = []
    Object.keys(this.events).forEach( kind => {  
      // console.log(`event kind: ${kind}`, this.events[kind])
      this.events[kind] = finalizeEvent(this.events[kind], sk)
    })
    return signed
  }

  async publish( relays: string[] ): Promise<string[]> {
    if(!this.events) throw new Error("Event has not yet been generated") 
    const pubbedIds: string[] = []
    const $pool = new SimplePool()
    const kinds = Object.keys(this.events)
    for(let i = 0; i < kinds.length; i++) {
      const kind = kinds[i]    
      const promises = $pool.publish(relays, this.events[kind])
      await Promise.all(promises)
      console.log(this.events[kind].id, 'published to', relays.join(', '))
      pubbedIds.push(this.events[kind].id)
    }
    return pubbedIds
  }

  static verify(ev: any): boolean {
    return verifyEvent(ev);
  }


}
