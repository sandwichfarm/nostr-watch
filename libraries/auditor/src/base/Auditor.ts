import { UniversalWebSocket as WebSocket } from '@nostrwatch/websocket';
import { ISuiteResult, Suite } from "./Suite";
import { Resulter } from './Resulter.js';
import Logger from '#base/Logger.js'
import { INip11 } from '#src/nips/Nip11/interfaces/INip11.js';
import { Emitter } from '#base/Emitter.js';
import { Listener } from './Emitter.js';
import { nipManifest } from '#src/nips/manifest.js';
import { suiteTests } from '#src/nips/suite-test-manifest.js';

type SuiteSet = Set<string>;
type SuiteConstructor = new (socket: WebSocket) => Suite;

const isRunnableSuiteKey = (suiteKey: string): boolean =>
  Boolean((nipManifest as any)?.[suiteKey]) && Boolean((suiteTests as any)?.[suiteKey]);

const resolveSuiteConstructor = (mod: unknown, suiteSlug: string): SuiteConstructor => {
  const candidates: unknown[] = [
    (mod as any)?.default?.default,
    (mod as any)?.default,
    mod,
    ...Object.values((mod as any) ?? {}),
  ].filter(Boolean);

  const looksLikeSuite = (value: unknown): value is SuiteConstructor =>
    typeof value === 'function' && typeof (value as any)?.prototype?.test === 'function';

  const suiteCtor = candidates.find(looksLikeSuite);
  if (suiteCtor) return suiteCtor;

  const fallbackCtor = candidates.find((value) => typeof value === 'function');
  if (fallbackCtor) return fallbackCtor as SuiteConstructor;

  throw new TypeError(`Auditor: suite ${suiteSlug} did not export a constructor`);
};

const skippedSuiteResult = (reason: string): ISuiteResult => ({
  pass: false,
  reason,
  tests: {},
  data: null,
  messages: new Map() as any,
  skipped: true,
});

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
  protected socket?: WebSocket;
  protected resulter: Resulter = new Resulter(defaultResult);
  private logger: Logger = new Logger('@nostrwatch/auditor', {
    showTimer: false,
    showNamespace: false,
    level: 'debug'
  });

  constructor(conf?: IAuditorConf) {
    if(conf) this._conf = conf;
    if(this._conf.nips.size) {
      const filtered = new Set<string>();
      for (const suiteKey of this._conf.nips) {
        if (isRunnableSuiteKey(suiteKey)) {
          filtered.add(suiteKey);
        }
      }
      this._suites = filtered;
    }
  }

  get result(): IAuditorResult {
    return this.resulter.result;
  }

  get suites(): SuiteSet {
    return this._suites;
  }

  abort(): void {
    Emitter.emit('all:abort');
  }

  addSuite(suite: string, options?: any) {
    if (!isRunnableSuiteKey(suite)) return;
    this.suites.add(suite);
    if(options) this._conf.options[suite] = options;
  }

  removeSuite(suite: string) {
    this.suites.delete(suite);
  }

  async run(relay: string): Promise<IAuditorResult> {
    return this.test(relay);
  }

  private extractFirstDataValue<T = unknown>(result: ISuiteResult): T | undefined {
    if (!result?.data) return undefined;
    const values = Object.values(result.data);
    return values[0] as T | undefined;
  }

  async checkNip11(relay?: string): Promise<ISuiteResult> {
    const mod = await import(`../nips/Nip11/index.js`);
    const SuiteCtor = resolveSuiteConstructor(mod, 'Nip11');
    const socket =
      this.socket ??
      (relay ? new WebSocket(relay, undefined, { autoConnect: false }) : undefined);
    if (!socket) {
      throw new Error('Auditor.checkNip11: relay required when auditor socket is not initialized');
    }
    const $Suite = new SuiteCtor(socket as WebSocket);
    const result = await $Suite.test()
    return result; 
  }

  async getNip11(relay?: string): Promise<Record<string, any> | unknown> {
    const result = await this.checkNip11(relay);
    return this.extractFirstDataValue(result) || {}
  }

  async detectSupportedNips(relay: string): Promise<void> {
    const result = await this.checkNip11(relay);
    this.resulter.set('suites', 'Nip11', result);
    const supported = this.extractFirstDataValue<unknown>(result);
    this.addNipSuites(Array.isArray(supported) ? supported : []);
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
        const suiteKey = formatNip(nip);
        if (!suiteTests?.[suiteKey]) continue;
        this.addSuite(suiteKey);
      }
      this.logger.debug(`Auditor: detected supported nips: ${Array.from(this.suites || new Set()).join(', ')}`);
    }
  }

  async test(relay: string): Promise<IAuditorResult> {
    this.logger.info(`Auditor: ${relay}`);  
    this.socket = new WebSocket(relay);
    const suites = Array.from(this.suites);
    this.logger.debug(`Auditor: testing suites: ${suites.join(', ')}`);  

    for (const suiteKey of suites) { 
      let $Suite: any;
      try {
        const mod = await nipManifest?.[suiteKey]?.();
        if(!mod) continue;
        this.logger.info(`Auditor: suite ${suiteKey} loaded.`);
        const SuiteCtor = resolveSuiteConstructor(mod, suiteKey);
        $Suite = new SuiteCtor(this.socket as WebSocket);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const result = skippedSuiteResult(`Skipped: ${message}`);
        Emitter.emit('auditor.suite:start', suiteKey);
        Emitter.emit('auditor.suite:finish', suiteKey, result);
        this.resulter.set('suites', suiteKey, result);
        continue;
      }

      const slug = typeof $Suite?.slug === 'string' ? $Suite.slug : suiteKey;

      if (typeof $Suite?.test !== 'function') {
        const result = skippedSuiteResult(`Skipped: suite ${slug} is not runnable (missing test())`);
        Emitter.emit('auditor.suite:start', slug);
        Emitter.emit('auditor.suite:finish', slug, result);
        this.resulter.set('suites', slug, result);
        continue;
      }

      Emitter.emit('auditor.suite:start', slug);
      let result: ISuiteResult;
      try {
        result = await $Suite.test(relay);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result = {
          ...skippedSuiteResult(`Error: ${message}`),
          skipped: false,
        };
      }
      Emitter.emit('auditor.suite:finish', slug, result);
      this.resulter.set('suites', slug, result);
      this.logger.info(`Auditor: Suite ${slug}: ${result.skipped ? 'skip' : result.pass ? 'pass' : 'fail'}`); 
    }

    const passrate = this.calculatePassrate()
    this.resulter.set('relay', relay);
    this.resulter.set('passrate', passrate);
    this.resulter.set('pass', passrate === 1);
    return this.result;
  }

  calculatePassrate(): number {
    const suites = this.resulter.get('suites');
    const scoredSuites = Object.values(suites).filter((suite) => !suite?.skipped);
    const totalSuites = scoredSuites.length;
    if (totalSuites === 0) return 0;
    const passedSuites = scoredSuites.filter((suite) => suite.pass === true).length;
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
