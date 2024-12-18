import { WebSocketWrapper as WebSocket } from './WebSocketWrapper.js';
import { ISuiteResult, Suite } from "./Suite";
import { Resulter } from './Resulter.js';
import Logger from '#base/Logger.js'
import { INip11 } from '#src/nips/Nip11/interfaces/INip11.js';
import { Emitter } from '#base/Emitter.js';
import { Listener } from './Emitter.js';
import { nipManifest } from '#src/nips/manifest.js';


type SuiteSet = Set<string>;

const defaultAuditorConf: IAuditorConf = {
  nips: new Set<string>(["Nip01"]) as SuiteSet,
  options: {}
};

export interface IAuditorConf {
  nips: SuiteSet;
  options: Record<string, any>;
}

export interface IAuditorResult {
  relay: string; 
  pass: boolean;
  passrate: number;
  reason: string;
  suites: Record<string, ISuiteResult>;
}

export const defaultResult: IAuditorResult = {
  relay: "",
  pass: false,
  passrate: 0,
  reason: "",
  suites: {}
}

export class Auditor {
  private _suites: SuiteSet = new Set();
  private _conf: IAuditorConf = defaultAuditorConf;
  protected ws?: WebSocket;
  protected resulter: Resulter = new Resulter(defaultResult);
  private logger: Logger = new Logger('@nostrwatch/auditor', {
    showTimer: false,
    showNamespace: false
  });

  constructor(conf?: IAuditorConf) {
    if(conf) this._conf = conf;
    if(this._conf.nips.size) {
      this._suites = this._conf.nips;
    }
  }

  get result(): IAuditorResult {
    return this.resulter.result;
  }

  get suites(): SuiteSet {
    return this._suites;
  }

  addSuite(suite: string, options?: any) {
    this.suites.add(suite);
    if(options) this._conf.options[suite] = options;
  }

  removeSuite(suite: string) {
    this.suites.delete(suite);
  }

  async run(relay: string): Promise<IAuditorResult> {
    return this.test(relay);
  }

  async checkNip11(): Promise<ISuiteResult> {
    const Suite = await import(`../nips/Nip11/index.js`);
    const $Suite = new Suite.default(this.ws as WebSocket);
    const result = await $Suite.test()
    return result; 
  }

  async getNip11(): Promise<Record<string, any>> {
    const result = await this.checkNip11();
    return result?.data?.Default || {}
  }

  async detectSupportedNips(relay: string): Promise<void> {
    const result = await this.checkNip11();
    this.resulter.set('suites', 'Nip11', result);
    this.addNipSuites(result?.data?.Default || []);
    return 
  }

  applySupportedNips(supported_nips: number[]): void {
    console.log(`Auditor: applying supported nips:`, supported_nips);
    this.addNipSuites(supported_nips);
  }

  private addNipSuites(nips: number[]) {
    if(!(nips instanceof Array)) return console.warn('Auditor: nips must be an array');
    if(nips.length){
      for(const nip of nips){
        this.addSuite(formatNip(nip));
      }
      this.logger.debug(`Auditor: detected supported nips: ${Array.from(this.suites || new Set()).join(', ')}`);
    }
  }

  async test(relay: string): Promise<IAuditorResult> {
    this.logger.info(`Auditor: ${relay}`);  
    this.ws = new WebSocket(relay);
    const suites = Array.from(this.suites);
    this.logger.debug(`Auditor: testing suites: ${suites.join(', ')}`);  
    const SuiteInstances = [];
    for (const suite of suites) { 
        try {
            const Suite = await nipManifest?.[suite]?.()
            this.logger.info(`Auditor: suite ${suite} loaded.`);
            if(Suite) console.log('suite', Suite)
            if(!Suite) continue;
            const $Suite = new Suite.default(this.ws as WebSocket);
            console.log('$suite', $Suite)
            if (!$Suite.pretest) {
              console.log('no pretest')
              SuiteInstances.push($Suite);
            }
        } catch (error) {
          console.error(error)
        }
    }
    console.log('suite instances', SuiteInstances)
    for (const $Suite of SuiteInstances) {
      Emitter.emit('auditor.suite:start', $Suite.slug);
      const result = await $Suite.test(relay);
      console.log('suite finished', result)
      Emitter.emit('auditor.suite:finish', $Suite.slug, result);
      this.resulter.set('suites', $Suite.slug, result);
      this.logger.info(`Auditor: Suite ${$Suite.slug}: ${result.pass ? 'pass' : 'fail'}`); 
    }
    const passrate = this.calculatePassrate()
    this.resulter.set('relay', relay);
    this.resulter.set('passrate', passrate);
    this.resulter.set('pass', passrate === 1);
    return this.result;
  }

  calculatePassrate(): number {
    const suites = this.resulter.get('suites');
    const totalSuites = Object.keys(suites).length;
    const passedSuites = Object.values(suites).filter(suite => suite.pass === true).length;
    return passedSuites / totalSuites;
  }

  on(event: string, listener: Listener): void {
    Emitter.on(event, listener);
  }

  emit(event: string, ...args: any[]): void {
    Emitter.emit(event, ...args);
  }

  off(event: string, listener: Listener): void {
    Emitter.off(event, listener);
  }

  once(event: string, listener: Listener): void {
    Emitter.once(event, listener);
  }

  removeAllListeners(event: string): void {
    Emitter.removeAllListeners(event);
  }

  listeners(event: string): Function[] {
    return Emitter.listeners(event);
  }

  listenerCount(event: string): number {
    return Emitter.listenerCount(event);
  }

}

export const formatNip =( number: number | string): string  => {
  if (typeof number === 'string') {
      number = parseInt(number);
  }
  if (number > 0 || number <= 9) {
      number = number.toString().padStart(2, '0')
  }
  return `Nip${number}`;
}