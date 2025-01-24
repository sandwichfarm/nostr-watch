import chalk from "chalk";

import { SuiteTestResulter } from "#base/Resulter.js";
import { Sampler } from "#base/Sampler.js";
import { Ingestor } from "#base/Ingestor.js";
import Logger from '#base/Logger.js';
import type { ISuite, ISuiteSampleData } from "#base/Suite.js";
import { generateSubId } from "#src/utils/nostr.js";

import { WebSocketWrapper as WebSocket } from "@nostrwatch/websocket";

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
  
  private logger: Logger = new Logger('@nostrwatch/auditor', {
    showTimer: false,
    showNamespace: false,
    level: 'debug'
  }); 
  private _expect: Expect = new Expect();
  private _events: Note[] = [];
  private timeout: ReturnType<typeof setTimeout> = null;

  protected suite: ISuite;
  protected result?: ISuiteTestResult;
  protected sampler?: Sampler;
  protected ingestor: Ingestor;
  protected subId: string = generateSubId();  
  protected notices: RelayNoticeMessage[] = [];
  protected timeoutMs: number = 10000;

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
    Emitter.on('all:abort', this.abort.bind(this))
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
    this.socket.send(Nip01ClientMessageGenerator.EVENT(event));
  }

  REQ(filters: INip01Filter[]) {
    this.socket.send(Nip01ClientMessageGenerator.REQ(this.subId, filters));
  }

  CLOSE(){
    this.socket.send(Nip01ClientMessageGenerator.CLOSE(this.subId));
  }

  async testable(){
    while(this.socket.CONNECTED){
      await new Promise(resolve => setTimeout(resolve, 100));
    };
  }

  async prepare() {
    this.REQ(this.filters)
    await this.testable();
  }

  async run() {
    if(this.slug === 'unset') throw new Error('slug of SuiteTest must be set');
  
    this.logger.info(`BEGIN: ${this.slug}`, 2);
  
    if(this?.sampler?.samplable) {
      await this.sampler.sample();
    }

    this.suite.reset()
    this.suite.testKey = this.slug

    if(this.suite.requires.includes('websocket')) {
      await this.socket.connect();
      this.suite.setupHandlers();
      this.newSubId();
    }
    
    this.timeoutBegin();
    this.digest();
    this.precheck(this.expect.conditions);
    this.expect.evaluateConditions(true);
    await this.prepare();
    this.finish();
  }

  protected newSubId() {
    this.subId = generateSubId()
  }

  protected conclude() {
    this.timeoutFinish();
    this.socket.off();
    this.socket.terminate();
  }

  timeoutBegin() {  
    this.timeout = setTimeout(() => {
      this.abort();
      this.test(this.expect);
    }, this.timeoutMs);
  }

  timeoutFinish() {
    this.logger.debug(`${this.slug} timed out`, 2);
    clearTimeout(this.timeout);
  }

  private finish(): void {
    this.logger.debug(`testKey: ${this.suite.testKey}`, 2);
    const { passing, passed, failed, skipped, errors } = this.expect;
    const passrate = passed.length / (passed.length + failed.length);
    const pass = passing
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

    if(skipped.length) {
      this.logger.custom('skipped', `${this.slug}`, 2);
    }
    else {
      this.logger.custom(passed? 'pass': 'fail', `${this.slug}`, 2);
    }
    
    this.resulter.set(result as ISuiteTestResult);
  }

  abort() {
    this.socket.terminate();
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