import chalk from "chalk";

import { SuiteTestResulter } from "#base/Resulter.js";
import { Sampler } from "#base/Sampler.js";
import { Ingestor } from "#base/Ingestor.js";
import Logger from '#base/Logger.js';
import type { ISuite, ISuiteSampleData } from "#base/Suite.js";
import { generateSubId } from "#src/utils/nostr.js";
import type { ImpactLevel, StressLevel } from '#utils/impact.js'
export type { ImpactLevel, StressLevel } from '#utils/impact.js'

import { UniversalWebSocket as WebSocket } from "@nostrwatch/websocket";

import { AssertWrap, Expect, type IExpectErrors, type IExpectResults } from "./Expect.js";

import { Nip01ClientMessageGenerator } from  "#src/nips/Nip01/utils/generators.js";
import type { INip01Filter, Note, RelayEventMessage, RelayNoticeMessage } from "#src/nips/Nip01/interfaces/index.js";

import { SuiteState } from "./SuiteState.js";
import { Emitter } from "./Emitter.js";

export type CompleteOnType = "off" | "maxEvents" | "EOSE";
export type CompleteOnTypeArray = [CompleteOnType, ...CompleteOnType[]];

export interface ISuiteTestResult {
  testKey: string;
  pass: boolean;
  passrate: number;
  passed: IExpectResults;
  failed: IExpectResults;
  skipped: IExpectResults;
  notices: RelayNoticeMessage[];
  filters: INip01Filter[];
  errors: IExpectErrors;
  events: Note[];
}

export const defaultSuiteTestResult: ISuiteTestResult = {
  testKey: "unset",
  pass: false,
  passrate: 0,
  filters: [],
  passed: [],
  failed: [],
  notices: [],
  skipped: [],
  errors: [],
  events: []
}

export interface ISuiteTest {
  slug: string;
  impact: ImpactLevel;
  stress: StressLevel;
  data: any;
  events: Note[];
  resulter: SuiteTestResulter;
  addEvent(event: Note): void;
  run(): any;
  _onMessageEvent(message: RelayEventMessage): boolean;
  test(methods: Expect): void;
  precheck(conditions: AssertWrap): void;  
} 

export abstract class SuiteTest implements ISuiteTest {
  readonly slug: string = 'unset';
  readonly impact: ImpactLevel = 'write';   // TAX-04: most restrictive default
  readonly stress: StressLevel = 'stress';  // TAX-05: most restrictive default

  private logger: Logger = new Logger('@nostrwatch/auditor', {
    showTimer: false,
    showNamespace: false,
    level: 'debug'
  }); 
  private _expect: Expect = new Expect();
  private _events: Note[] = [];
  private timeout: ReturnType<typeof setTimeout> = null;
  private readonly abortHandler = () => this.abort();
  private abortListenerRegistered = false;
  private completion?: Promise<void>;
  private resolveCompletion?: () => void;
  private running = false;
  private concluded = false;

  protected suite: ISuite;
  protected result?: ISuiteTestResult;
  protected sampler?: Sampler;
  protected ingestor: Ingestor;
  protected subId: string = generateSubId();  
  protected notices: RelayNoticeMessage[] = [];
  protected timeoutMs: number = 10000;
  protected requiresSuiteSamples: boolean = false;

  public resulter: SuiteTestResulter = new SuiteTestResulter(defaultSuiteTestResult);
  
  testParams: Record<string, any> = {};
  data: any = {};
  maxEvents: number = 20;
  totalEvents: number = 0;
  completeOn: CompleteOnTypeArray = ['maxEvents', 'EOSE'];

  constructor(suite: ISuite) {
    this.suite = suite;
    this.logger.registerLogger('pass', 'info', chalk.green.bold);
    this.logger.registerLogger('fail', 'info', chalk.redBright.bold);
    this.logger.registerLogger('skipped', 'info', chalk.bgGray.yellow.bold);
  }

  get filters(): INip01Filter[] {
    return [];
  }

  get socket(): WebSocket {
    return this.suite.socket; 
  }

  get state(): SuiteState {
    return this.suite.state;
  }

  get events(): Note[] {
    return this._events;
  }

  addEvent(event: Note) {
    this._events.push(event);
  }

  protected get expect(): Expect {
    return this._expect;
  }

  getSamples<T>(): T | undefined {
    return this.state.get('samples')?.[this.slug];
  }

  digest() {
    this.logger.debug(`${this.slug} digest method was not implemented.`, 1);
  }

  suiteIngest(ingestor: Ingestor[] | Ingestor) {
    this.requiresSuiteSamples = true;
    if(Array.isArray(ingestor)) {
      this.suite.registerIngestors(this.slug, ingestor);
    }
    else {
      this.suite.registerIngestor(this.slug, ingestor);
    }
  }

  suiteTestIngest(ingestor: Ingestor[] | Ingestor) {
    if(Array.isArray(ingestor)) {
      this.registerIngestors(ingestor);
    }
    else {
      this.registerIngestor(ingestor);
    }
  }

  private registerIngestors(ingestors: Ingestor[]) {
    if(ingestors) {
      ingestors.forEach(ingestor => this.registerIngestor(ingestor));
    }
  }

  private registerIngestor(ingestor: Ingestor) {  
    if(!this?.sampler)
      this.initSampler();
    this.sampler.registerIngestor(ingestor);
  }

  initSampler(){
    if(this.suite.socket === undefined) throw new Error('socket of Suite must be set');
    this.sampler = new Sampler(this.suite.socket);
  }

  EVENT(event: Note) {
    if (!this.running || this.concluded) return;
    this.socket.send(Nip01ClientMessageGenerator.EVENT(event));
  }

  REQ(filters: INip01Filter[]) {
    if (!this.running || this.concluded) return;
    this.socket.send(Nip01ClientMessageGenerator.REQ(this.subId, filters));
  }

  CLOSE(){
    if (!this.running || this.concluded) return;
    this.socket.send(Nip01ClientMessageGenerator.CLOSE(this.subId));
  }

  async testable(): Promise<void> {
    await this.completion;
  }

  async prepare() {
    this.REQ(this.filters)
    await this.testable();
  }

  async run() {
    if(this.slug === 'unset') throw new Error('slug of SuiteTest must be set');
    this.logger.info(`BEGIN: ${this.slug}`, 2);
    this.resetResults();
    this.running = true;
    this.concluded = false;
    this.setAbortListener(true);
    this.completion = new Promise<void>(resolve => { this.resolveCompletion = resolve; });
    this.suite.reset();
    this.suite.testKey = this.slug;

    try {
      if(this?.sampler?.samplable) await this.sampler.sample();
      if (this.concluded) return;

      if (this.requiresSuiteSamples) {
        const samples = this.getSamples<unknown>();
        const hasSamples =
          samples !== undefined &&
          samples !== null &&
          (Array.isArray(samples)
            ? samples.length > 0
            : typeof samples === 'object'
              ? Object.keys(samples as Record<string, unknown>).length > 0
              : true);

        if (!hasSamples) {
          this.expect.behavior.skip = true;
          this.expect.behavior.toBeOk(true, 'Skipped: requires samples but none were obtained');
          return;
        }
      }

      const requiresSocket = this.suite.requires.includes('websocket');
      if (requiresSocket) {
        this.suite.setupHandlers();
        this.socket.on('close', () => this.failAndConclude('Connection closed before test completion'));
        this.socket.on('error', () => this.failAndConclude('Connection error before test completion'));
        const connected = await this.socket.connect();
        if (this.concluded) {
          // Transport setup may finish after abort already performed cleanup.
          this.socket.off();
          this.socket.terminate();
          return;
        }
        if (!connected || !this.socket.CONNECTED) throw new Error('Could not connect to relay');
        this.newSubId();
      }

      this.timeoutBegin();
      this.digest();
      this.precheck(this.expect.conditions);
      this.expect.evaluateConditions(true);
      // Custom prepare methods may only send the first message. Completion is
      // signalled by a response handler, abort, or timeout, rather than return.
      await Promise.race([
        this.prepare().then(() => requiresSocket ? this.completion : undefined),
        this.completion,
      ]);
      if (this.expect.results.length === 0 && this.expect.skipped.length === 0) {
        if (this.expect.behavior.skip) {
          this.expect.behavior.toBeOk(true, 'Skipped: test prerequisites unavailable');
        } else {
          this.recordFailure('Test completed without assertions');
        }
      }
    } catch (error) {
      this.recordFailure(`Test failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.conclude();
      this.running = false;
      this.setAbortListener(false);
      this.finish();
      this.resolveCompletion = undefined;
      this.completion = undefined;
    }
  }

  private recordFailure(message: string): void {
    const previousSkip = this.expect.behavior.skip;
    this.expect.behavior.skip = false;
    this.expect.behavior.toBeOk(false, message);
    this.expect.behavior.skip = previousSkip;
  }

  private failAndConclude(message: string): void {
    if (!this.running || this.concluded) return;
    this.recordFailure(message);
    this.conclude();
  }

  protected setAbortListener(enabled: boolean): void {
    if (enabled === this.abortListenerRegistered) return;
    this.abortListenerRegistered = enabled;
    if (enabled) Emitter.on('all:abort', this.abortHandler);
    else Emitter.off('all:abort', this.abortHandler);
  }

  protected resetResults(): void {
    this._expect = new Expect();
    this._events = [];
    this.notices = [];
    this.totalEvents = 0;
    this.data = {};
  }

  protected newSubId() {
    this.subId = generateSubId()
  }

  protected conclude() {
    if (!this.running || this.concluded) return;
    this.concluded = true;
    this.timeoutFinish();
    if (this.suite.requires.includes('websocket')) {
      this.socket.off();
      this.socket.terminate();
    }
    this.resolveCompletion?.();
  }

  timeoutBegin() {
    this.timeout = setTimeout(() => {
      if (!this.running || this.concluded) return;
      this.recordFailure(`Test timed out after ${this.timeoutMs}ms`);
      try {
        this.test(this.expect);
      } catch (error) {
        this.recordFailure(`Test failed: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        this.conclude();
      }
    }, this.timeoutMs);
  }

  timeoutFinish() {
    clearTimeout(this.timeout);
  }

  protected finish(): void {
    this.logger.debug(`testKey: ${this.suite.testKey}`, 2);
    const { passing, passed, failed, skipped, errors } = this.expect;
    const denom = passed.length + failed.length;
    const passrate = denom > 0 ? passed.length / denom : 0;
    const pass = passing && passed.length > 0
    const { filters, notices, events } = this;
    const result = {
      testKey: this.suite.testKey,
      pass,
      passrate,
      passed,
      filters,
      skipped,
      failed,
      errors,
      notices,
      events
    } as ISuiteTestResult;

    if(skipped.length && !failed.length) {
      this.logger.custom('skipped', `${this.slug}`, 2);
    }
    else {
      this.logger.custom(pass? 'pass': 'fail', `${this.slug}`, 2);
    }
    
    this.resulter.set(result as ISuiteTestResult);
  }

  abort() {
    this.failAndConclude('Test aborted');
  }

  onMessageNotice(notice: RelayNoticeMessage) {
    this.notices.push(notice);
  }

  precheck(conditions: AssertWrap){
    this.logger.debug(`${this.slug} precheck method was not implemented.`, 1);
  }

  test(methods: Expect) {
    this.logger.warn(`${this.slug} complete method was not implemented.`, 1);
  }

  _onMessageEvent(message: RelayEventMessage): boolean  {
    this.totalEvents++;
    return true;
  }

  _onMessageEose(): boolean {   
    if(this.completeOn.includes("EOSE")) {
      this.test(this.expect);
      this.conclude()
      return false
    }
    return true;
  }
}
