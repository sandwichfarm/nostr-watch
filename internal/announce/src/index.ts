import chalk from 'chalk'

import { verifyEvent } from "nostr-tools";
import { Publisher, Kind10166, Kind0, Kind10002 } from "@nostrwatch/publisher";
import type { PublisherFactory } from '../../publisher/src/transport.js';
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
  clientTag?: string;

  relays?: string[];
  userDataRelays?: string[];
  publisherFactory?: PublisherFactory;
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
  private clientTag?: string;
  private acknowledgedEventIds = new Set<string>();

  constructor(pubkey: string, options: AnnounceMonitorOptions) {
    log.debug(`announce::constructor(): ${pubkey}`)
    this.setup(options);
    this.pubkey = pubkey
    const createPublisher = options.publisherFactory ?? ((key, relays) => new Publisher(key, relays));
    this.nip66Publisher = createPublisher(pubkey, this.monRelays)
    this.userMetaPublisher = createPublisher(pubkey, this.userDataRelays)
  }

  async close(): Promise<void> {
    await Promise.all([this.nip66Publisher.close(), this.userMetaPublisher.close()]);
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
      clientTag,
    } = options;

    this.clientTag = clientTag;

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
    this.events = {};
    this.acknowledgedEventIds.clear();

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

    if (this.clientTag) {
      for (const ev of Object.values(this.events)) {
        const generated = (ev as any)?.event ?? ev
        if (generated?.tags && Array.isArray(generated.tags)) {
          generated.tags.push(['client', this.clientTag])
        }
      }
    }

    return this.events
  }

  async sign(sk: string): Promise<any> {
    if(!this.events) throw new Error("Event has not yet been generated (run generate() first)") 
    Object.values(this.events).forEach( async (event: any) => {  
      this.events[event.kind] = await event.signEvent(sk)
    })
  }

  async publish(): Promise<string[]> {
    if(!this.events) throw new Error("Event has not yet been generated") 
    console.log(this.events)
    const pubbedIds: string[] = []
    const failures: unknown[] = [];
    const kinds = Object.keys(this.events)
    for(let i = 0; i < kinds.length; i++) {
      const kind = kinds[i]    
      const kindNum = Number(kind)
      const metadata = kindNum === 0 || kindNum === 10002;
      const activeRelays = metadata ? this.userDataRelays : this.monRelays;
      if ((!metadata && kindNum !== 10166) || activeRelays.length === 0) continue;
      const event = this.events[kind];
      if (this.acknowledgedEventIds.has(event.id)) {
        pubbedIds.push(event.id);
        continue;
      }
      try {
        if (typeof event.id !== 'string' || !event.id) throw new Error(`Announcement ${kind} is not signed`);
        log.info(`publishing ${kind} to ${activeRelays.join(',')}`)
        await (metadata ? this.userMetaPublisher : this.nip66Publisher).publishEvent(event);
        this.acknowledgedEventIds.add(event.id);
        pubbedIds.push(event.id);
        log.info(`${chalk.green.bold(kind)} ${chalk.gray.italic('published to')} ${chalk.white.bold(activeRelays.join(','))}`)  
      }
      catch(e){
        failures.push(e);
        console.log(e)
        log.error(`${chalk.red.bold(kind)} ${chalk.gray.italic('failed to publish to')} ${chalk.white.bold(activeRelays.join(','))}`)
      }   
    }    
    if (failures.length) throw new AggregateError(failures, 'Monitor announcement publication failed');
    return pubbedIds
  }

  static verify(ev: any): boolean {
    return verifyEvent(ev);
  }
}
