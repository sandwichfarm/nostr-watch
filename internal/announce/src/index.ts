import chalk from 'chalk'

import { verifyEvent, finalizeEvent, SimplePool, Event } from "nostr-tools";
import { Publisher, Kind10166, Kind0, Kind10002 } from "@nostrwatch/publisher";
import Logger from "@nostrwatch/logger";
const log = new Logger('@nostrwatch/announce')

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
  networks?: string[];
}

export class AnnounceMonitor {
  public events?: any = {};
  public monReg?: any;
  public metaRelays: string[] = [ 'wss://user.kindpag.es', 'wss://purplepag.es' ];
  public monRelays: string[] = [ ];
  public monProfile: any;
  private publisher: Publisher;
  private pubkey: string | null = null;

  constructor(options: AnnounceMonitorOptions, pubkey: string) {
    log.debug(`announce::constructor(): ${pubkey}`)
    this.setup(options);
    this.pubkey = pubkey
    this.publisher = new Publisher(pubkey, this.monRelays)
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
      frequency = '86400',
      profile = {},
      relays = [],
      networks = []
    } = options;

    console.log('frequency', options.frequency)

    this.monReg = {}

    if (!(geo instanceof Object)) throw new Error("geo must be object");
    if (!(timeouts instanceof Object)) throw new Error("timeouts must be object");
    if (!(kinds instanceof Array)) throw new Error("kinds must be array");
    if (!(counts instanceof Array)) throw new Error("counts must be array");
    if (!(checks instanceof Array)) throw new Error("checks must be array");
    if (typeof owner !== "string") throw new Error("owner must be string");
    if (typeof frequency !== "string") throw new Error("frequency must be string");

    if( !(networks instanceof Array) ) throw new Error("networks must be an array");
    if( !(relays instanceof Array) ) throw new Error("relays must be an array");
    if( !(profile instanceof Object) ) throw new Error("profile must be an object");

    // Assigning the validated options to class properties
    this.monReg.geo = geo;
    this.monReg.kinds = kinds;
    this.monReg.timeouts = timeouts;
    this.monReg.counts = counts;
    this.monReg.owner = owner;
    this.monReg.frequency = frequency;
    this.monReg.networks = networks; 
    this.monReg.checks = AnnounceMonitor.formatChecks(checks)

    this.monRelays = [...this.monRelays, ...relays];
    this.monProfile = profile;
  }

  static formatChecks(checks: Array<string>): Array<string> {
    if(checks.includes('all'))
      return ['open', 'read', 'write', 'info', 'dns', 'geo', 'ssl']
    return checks
  }

  generate(): any {
    log.debug(`announce::generate(): ${this.pubkey}`)

    const $monReg = new Kind10166(this.pubkey)

    $monReg.generateEvent({...this.monReg})
    console.log('10166')
    console.dir($monReg.event)
    this.events["10166"] = $monReg

    const $monRelays = new Kind10002(this.pubkey)
    if(this.monRelays.length) {
      $monRelays.generateEvent([...this.monRelays])
      this.events["10002"] = $monRelays
    }
    
    const $monProfile = new Kind0(this.pubkey) 
    if(Object.keys(this.monProfile).length) {
      $monProfile.generateEvent({...this.monProfile})
      this.events["0"] = $monProfile
    }

    return this.events
  }

  sign(sk: Uint8Array): any {
    if(!this.events) throw new Error("Event has not yet been generated (run generate() first)") 
    Object.values(this.events).forEach( (event: any) => {  
      this.events[event.kind] = event.signEvent()
    })
  }

  async publish(): Promise<string[]> {
    if(!this.events) throw new Error("Event has not yet been generated") 
    const pubbedIds: string[] = []
    const kinds = Object.keys(this.events)
    for(let i = 0; i < kinds.length; i++) {
      const kind = kinds[i]
      let relays: string[] = [];
      if(kind === '10166'){
        relays = this.monRelays
      }
      if(kind === '0' || kind === '10002'){
        relays = this.metaRelays
      }
      try {
        const publisher = new Publisher(this.pubkey, relays)
        const promises = publisher.publishEvent( this.events[kind] )
        console.log('promises', typeof promises)
        console.dir(promises)
        await promises
      }
      catch(e){
        log.error(`${chalk.red.bold(kind)} ${chalk.gray.italic('failed to publish to')} ${chalk.white.bold(this.monRelays.join(','))}`)
        console.error(e)
      }   
      log.info(`${chalk.yellow.bold(kind)} ${chalk.gray.italic('published to')} ${chalk.white.bold(this.monRelays.join(','))}`)  
      pubbedIds.push(this.events[kind].id)
    }    
    return pubbedIds
  }

  static verify(ev: any): boolean {
    return verifyEvent(ev);
  }
}
