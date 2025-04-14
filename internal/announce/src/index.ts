import chalk from 'chalk'

import { verifyEvent } from "nostr-tools";
import { Publisher, Kind10166, Kind0, Kind10002 } from "@nostrwatch/publisher";
import Logger from "@nostrwatch/logger";
const log = new Logger('@nostrwatch/announce')

interface GeoTagOption {
  // Define properties of GeoTagOption if needed
}

interface AnnounceMonitorOptions {
  geo?: object;
  kinds?: number[];
  timeouts?: object;
  networks?: string[];
  checks?: string[];
  owner?: string;
  frequency?: string;
  profile?: object;

  relays?: string[];
  userDataRelays?: string[];
}

export class AnnounceMonitor {
  public events?: any = {};
  public monReg?: any;
  public monRelays: string[] = [];
  public userDataRelays: string[] = [];
  public monProfile: any;   
  private nip66Publisher: Publisher;
  private userMetaPublisher: Publisher;
  private pubkey: string | null = null;

  constructor(pubkey: string, options: AnnounceMonitorOptions) {
    log.debug(`announce::constructor(): ${pubkey}`)
    this.setup(options);
    this.pubkey = pubkey
    this.nip66Publisher = new Publisher(pubkey, this.monRelays)
    this.userMetaPublisher = new Publisher(pubkey, this.userDataRelays)
  }

  setup(options: AnnounceMonitorOptions): void {
    const {
      geo = {},
      timeouts = {},
      networks = {},
      checks = [],
      owner = '',
      frequency = '',
      profile = {},
      relays = [],
    } = options;

    this.userDataRelays = options.userDataRelays ||  [ 'wss://purplepag.es', 'wss://user.kindpag.es' ]

    this.monReg = {}

    if (typeof frequency !== "string") throw new Error("frequency must be string");
    if( !(this.userDataRelays instanceof Array) ) throw new Error("userDataRelays must be an array");
    if( !(relays instanceof Array) ) throw new Error("relays must be an array");
    if( !relays.length ) throw new Error("monitor publish relays must not be empty");

    if (geo && !(geo instanceof Object)) throw new Error("geo must be object");
    if (timeouts && !(timeouts instanceof Object)) throw new Error("timeouts must be object");
    if (checks && !(checks instanceof Array)) throw new Error("checks must be array");
    if (networks && !(networks instanceof Array)) throw new Error("networks must be array");
    if (owner && typeof owner !== "string") throw new Error("owner must be string");
  
    
    if( !(profile instanceof Object) ) throw new Error("profile must be an object");
    
    this.monReg.geo = geo;
    this.monReg.timeouts = timeouts;
    this.monReg.owner = owner;
    this.monReg.frequency = frequency;
    this.monReg.networks = networks;
    this.monReg.checks = AnnounceMonitor.formatChecks(checks)

    console.log(this.monReg)

    this.monRelays = relays;
    this.monProfile = profile;
  }

  static formatChecks(checks: Array<string>): Array<string> {
    if(checks.includes('all'))
      return ['websocket', 'ws', 'info', 'dns', 'geo', 'ssl']
    return checks
  }

  generate(): any {
    log.debug(`announce::generate(): ${this.pubkey}`)

    const $monReg = new Kind10166(this.pubkey)
    $monReg.generateEvent({...this.monReg})
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

  async sign(sk: string): any {
    if(!this.events) throw new Error("Event has not yet been generated (run generate() first)") 
    Object.values(this.events).forEach( async (event: any) => {  
      this.events[event.kind] = await event.signEvent(sk)
    })
  }

  async publish(): Promise<string[]> {
    if(!this.events) throw new Error("Event has not yet been generated") 
    console.log(this.events)
    const pubbedIds: string[] = []
    const kinds = Object.keys(this.events)
    for(let i = 0; i < kinds.length; i++) {
      const kind = kinds[i]    
      const kindNum = Number(kind)
      try {
        let activeRelays: string[] = []
        if(kindNum === 0 || kindNum === 10002) {
          log.info(`publishing ${kind} to ${this.userDataRelays.join(',')}`)
          activeRelays = this.userDataRelays
          await this.userMetaPublisher.publishEvent(this.events[kind])
        }
        else if (kindNum === 10166) {
          log.info(`publishing ${kind} to ${this.monRelays.join(',')}`)
          activeRelays = this.monRelays
          // console.log(this.events[kind])
          await this.nip66Publisher.publishEvent(this.events[kind])
        }
        log.info(`${chalk.green.bold(kind)} ${chalk.gray.italic('published to')} ${chalk.white.bold(activeRelays.join(','))}`)  
      }
      catch(e){
        console.log(e)
        log.error(`${chalk.red.bold(kind)} ${chalk.gray.italic('failed to publish to')} ${chalk.white.bold(this.monRelays.join(','))}`)
      }   
      
      pubbedIds.push(this.events[kind].id)
    }    
    return pubbedIds
  }

  static verify(ev: any): boolean {
    return verifyEvent(ev);
  }
}
