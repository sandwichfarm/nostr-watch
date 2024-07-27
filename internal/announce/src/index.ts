import chalk from 'chalk'

import { verifyEvent, finalizeEvent, SimplePool, Event } from "nostr-tools";
import { Kind10166, Kind0, Kind10002 } from "@nostrwatch/publisher";
// import Logger from "@nostrwatch/logger";

// const log = new Logger('@nostrwatch/announce')

const NIP66_MONITOR_REGISTER = 10166;

interface GeoTagOption {
  // Define properties of GeoTagOption if needed
}

interface AnnounceMonitorOptions {
  geo?: object;
  kinds?: number[];
  timeouts?: object;
  counts?: number[];
  checks?: string[];
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
      checks = [],
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
    if (!(checks instanceof Array)) throw new Error("checks must be array");
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
    this.monReg.checks = AnnounceMonitor.formatChecks(checks)

    this.monRelays = relays;
    this.monProfile = profile;
  }

  static formatChecks(checks: Array<string>): Array<string> {
    if(checks.includes('all'))
      return ['open', 'read', 'write', 'info', 'dns', 'geo', 'ssl']
    return checks
  }

  generate(): any {
    const $monReg = new Kind10166()
    $monReg.generateEvent({...this.monReg})
    this.events["10166"] = $monReg

    const $monRelays = new Kind10002()
    if(this.monRelays.length) {
      $monRelays.generateEvent([...this.monRelays])
      this.events["10002"] = $monRelays
    }
    
    const $monProfile = new Kind0() 
    if(Object.keys(this.monProfile).length) {
      $monProfile.generateEvent({...this.monProfile})
      this.events["0"] = $monProfile
    }
    return this.events
  }

  sign(sk: Uint8Array): any {
    if(!this.events) throw new Error("Event has not yet been generated (run generate() first)") 
    Object.values(this.events).forEach( (publisher: any) => {  
      console.log(publisher.signEvent())
      this.events[publisher.kind] = publisher.signEvent()
    })
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
      console.log(`${chalk.yellow.bold(kind)} ${chalk.gray.italic('published to')} ${chalk.white.bold(relays.join(','))}`)
      pubbedIds.push(this.events[kind].id)
    }
    return pubbedIds
  }

  static verify(ev: any): boolean {
    return verifyEvent(ev);
  }
}
