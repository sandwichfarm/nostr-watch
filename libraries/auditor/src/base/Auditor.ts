import { WebSocketWrapper as WebSocket } from './WebSocketWrapper.js';
import { ISuiteResult, Suite } from "./Suite";
import { Resulter } from './Resulter.js';
import Logger from '#base/Logger.js'

type SuiteSet = Set<string>;

const defaultAuditorConf: IAuditorConf = {
  nips: new Set<string>(["Nip01"]) as SuiteSet,
  options: {}
};

export interface IAuditorConf {
  nips: SuiteSet;
  options: Record<string, any>;
}

export interface IResult {
  relay: string; 
  pass: boolean;
  passrate: number;
  reason: string;
  suites: Record<string, ISuiteResult>;
}

export const defaultResult: IResult = {
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

  addSuite(suite: string, options?: any) {
    this._suites.add(suite);
    if(options) this._conf.options[suite] = options;
  }

  removeSuite(suite: string) {
    this._suites.delete(suite);
  }

  async run(relay: string): Promise<IResult> {
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
    if(result.data?.Default?.length){
      for(const nip of result.data.Default){
        this.addSuite(`Nip${nip}`);
      }
      this.logger.debug(`Auditor: detected supported nips: ${Array.from(this._suites).join(', ')}`);
    }
    return 
  }

  async test(relay: string): Promise<IResult> {
    this.logger.info(`Auditor: ${relay}`);  
    this.ws = new WebSocket(relay);
    const suites = Array.from(this._suites);
    this.logger.debug(`Auditor: testing suites: ${suites.join(', ')}`);  
    const SuiteInstances = [];
    for (const suite of suites) { 
      const Suite = await import(`../nips/${suite}/index.js`).catch(() => {
        this.logger.debug(`Auditor: suite ${suite} not yet implemented.`);
      })
      if(!Suite) continue;
      const $Suite = new Suite.default(this.ws as WebSocket);
      if (!$Suite.pretest) {
        SuiteInstances.push($Suite);
      }
    }
    
    for (const $Suite of SuiteInstances) {
      
      const result = await $Suite.test(relay);
      this.resulter.set('suites', $Suite.slug, result);
      this.logger.info(`Auditor: Suite ${$Suite.slug}: ${result.pass ? 'pass' : 'fail'}`); 
    }
    const passrate = this.calculatePassrate()
    this.resulter.set('relay', relay);
    this.resulter.set('passrate', passrate);
    this.resulter.set('pass', passrate === 1);
    return this.resulter.result;
  }

  calculatePassrate(): number {
    const suites = this.resulter.get('suites');
    const totalSuites = Object.keys(suites).length;
    const passedSuites = Object.values(suites).filter(suite => suite.pass === true).length;
    return passedSuites / totalSuites;
  }
}