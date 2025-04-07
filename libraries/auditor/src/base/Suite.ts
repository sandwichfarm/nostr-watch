import { EventEmitter } from "tseep";

import type { UniversalWebSocket as WebSocket } from '@nostrwatch/websocket';
import { SchemaValidator } from "./SchemaValidator.js";
import { SuiteResulter } from "./Resulter.js";
import type { ISuiteTest, ISuiteTestResult } from "./SuiteTest.js";

import { capitalize, truncate } from '#utils/string.js';
import { Expect } from './Expect.js';
import type { INip01RelayMessage } from '#src/nips/Nip01/interfaces/INip01RelayMessage.js';

import Logger from './Logger.js';
import { SuiteState } from './SuiteState.js';
import { Ingestor } from './Ingestor.js';
import { Sampler } from './Sampler.js';
import chalk from 'chalk';
import { messageKey } from '#src/utils/nostr.js';

import { Emitter } from '#base/Emitter.js';

import { suiteTests } from '#src/nips/suite-test-manifest.js';

export type ISuiteSampleData = Record<string, any>;

export type INipTesterCodes = Record<string, boolean | null>

export type GenericJson = Record<string, any>

export type DynamicallyImportedNipTests = Record<string, new (suite: Suite) => ISuiteTest >

export type QualifyingMessageHandler<T> = (msg: T) => boolean;
export type MessageHandler<T> = (msg: T) => void;

export interface ISuiteResult {
  pass: boolean;
  reason: string;
  tests: Record<string, ISuiteTestResult>;
  data: Record<string, any> | null; 
  messages: MessagesMapType;
  skipped?: boolean;
  skipReason?: string;
}

export const defaultSuiteResult: ISuiteResult = {
  pass: false,
  reason: "",
  tests: {},
  data: null,
  messages: new Map()
}

type MessagesMapType = Map<string, INip01RelayMessage[]>

export type ISuiteCodeTypes = 'behavior' | 'json' | 'message';

export interface ISuite {
  readonly slug: string;
  readonly messageValidators: Record<string, SchemaValidator<any>>;
  readonly jsonValidators: Record<string, SchemaValidator<any>>;
  readonly requires: string[];
  readonly doNotStoreMessageTypes: string[];
  readonly socket: WebSocket;
  readonly sampler: Sampler | undefined;

  pretest: boolean;
  testKey: string;  
  data: any;
  state: SuiteState;

  setup(): Promise<void>;
  ready(): Promise<void>;
  reset(): void;  
  test(): Promise<ISuiteResult>;

  registerIngestors(testSlug: string, ingestors: Ingestor[]): void;
  registerIngestor(testSlug: string, ingestor: Ingestor): void;
  setupHandlers(): void;
  validateJson(key: string, json: GenericJson): void;
}

export abstract class Suite implements ISuite {
  protected testsDirectory: string;
  public abstract get slug(): string;

  readonly doNotStoreMessageTypes: string[] = ['EVENT'];
  private expect: Expect;
  private _state: SuiteState = new SuiteState();
  private logger: Logger = new Logger('@nostrwatch/auditor:Suite', {
    showTimer: false,
    showNamespace: false,
    level: 'debug'
  });
  private _sampler: Sampler;
  
  protected _socket: WebSocket;
  protected signal: EventEmitter = new EventEmitter();
  protected result: ISuiteResult = structuredClone(defaultSuiteResult);
  protected resulter: SuiteResulter = new SuiteResulter(defaultSuiteResult);

  readonly messageValidators: Record<string, SchemaValidator<any>> = {};
  readonly jsonValidators: Record<string, SchemaValidator<any>> = {};
  
  protected tests: string[] = [];
  protected testers: Record<string, ISuiteTest> = {};
  protected _ready: boolean = false;
  protected totalEvents: number = 0;
  readonly requires: string[] = ['websocket'];

  protected _messages: MessagesMapType = new Map();
  testKey: string = "unset";
  pretest: boolean = false;
  data: any = {};


  constructor(socket: WebSocket, metaUrl: string) {
    this._socket = socket;
    this.logger.registerLogger('notice', 'info', chalk.gray.italic);
    this.signal.once("SUITE:READY", () => { this._ready = true });
    this.setup()
  }

  set socket(socket: WebSocket) {
    this._socket = socket;
  }

  get socket(): WebSocket {
    return this._socket;
  }

  get messages(): MessagesMapType {  
    return this._messages;
  }

  set messages(messages: MessagesMapType) {
    this._messages = messages;
  }

  get state(): SuiteState {
    return this._state;
  }

  get sampler(): Sampler {
    return this._sampler;
  }

  private set sampler(sampler: Sampler) {
    this._sampler = sampler;
  }

  get ingestors(): Ingestor[] {
    return this.sampler.ingestors
  }

  async setup(){
    this.expect = new Expect();
    const importFn = suiteTests?.[this.slug];
    if(importFn) {
      const tests: DynamicallyImportedNipTests = await importFn()
      for (const [key, cl] of Object.entries(tests)) {
        this.testers[key] = new cl(this);
      }
    }
    this.signal.emit('SUITE:READY');
  }

  public async ready() {
    while(!this._ready) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  reset(){
    this.resetKey();
    // this.resetCodes();
  }

  private resetKey(){
    this.testKey = "unset";
  }

  registerIngestors(testSlug: string, ingestors: Ingestor[]) {
    if(ingestors) {
      ingestors.forEach(ingestor => {
        this.registerIngestor(testSlug, ingestor)
      });
    }
  }

  registerIngestor(testSlug: string, ingestor: Ingestor) {  
    if(!this?.sampler)
      this.initSampler();
    ingestor.belongsTo = testSlug;
    this.sampler.registerIngestor(ingestor);
  }

  private initSampler(){
    if(this.socket === undefined) throw new Error('socket of Suite must be set');
    this.sampler = new Sampler(this.socket);
  }

  private toilet(){
    const poops: ISuiteSampleData = {};
    for(const ingestor of this.ingestors) {
      const testKey = ingestor.parent;
      poops[testKey] = ingestor.poop();
    }
    this.state.set<ISuiteSampleData>('samples', poops); 
    Emitter.emit('auditor.suite:samples', this.slug, poops);
  }

  public async test(): Promise<ISuiteResult> {
    this.logger.info(`BEGIN: ${this.slug} Suite`, 1);
    
    await this.ready();
    
    // Check if sampling is needed and get samples
    let samplingSuccess = true;
    if(this?.sampler?.samplable) {
      samplingSuccess = await this.sampler.sample();
      
      if (samplingSuccess) {
        // Only collect samples if sampling succeeded
        this.toilet();
      } else {
        this.logger.warn(`Sampling failed for ${this.slug}, skipping tests that require samples`, 1);
      }
    }
    
    // Only run tests if sampling succeeded or wasn't needed
    if (samplingSuccess) {
      for(const test of Object.entries(this.testers)) {
        const [testName, suiteTest] = test;
        Emitter.emit('auditor.suite.test:start', this.slug, testName);
        await suiteTest.run();
        const testResult = suiteTest.resulter.get();
        Emitter.emit('auditor.suite.test:finish', this.slug, testResult);
        this.resulter.set('tests', testName, testResult);
        if(suiteTest?.data !== null) {
          this.resulter.set('data', { [testName]: suiteTest.data });
        }
      }
      
      this.resulter.set('pass', this.evaluate());
      this.resulter.set('messages', this.messages);
      this.beforeResults();
      return this.resulter.result;
    } else {
      // Mark suite as skipped due to sampling failure
      this.resulter.set('pass', false);
      
      // Create a detailed reason based on the circumstances
      const samplersCount = this.sampler?.ingestors?.length || 0;
      let reason = `Could not obtain required samples from relay`;
      if (samplersCount > 0) {
        reason += ` (${samplersCount} samplers failed)`;
      }
      
      this.resulter.set('reason', reason);
      this.resulter.set('skipped', true);
      this.resulter.set('data', {});
      this.resulter.set('messages', new Map<string, INip01RelayMessage[]>());
      
      // Instead of setting tests to an empty object, create skipped entries for all tests
      const skippedTests: Record<string, ISuiteTestResult> = {};
      for (const [testName, suiteTest] of Object.entries(this.testers)) {
        // Create a skipped result for this test
        // Emit test start event
        Emitter.emit('auditor.suite.test:start', this.slug, testName);
        
        const skippedResult: ISuiteTestResult = {
          testKey: testName,
          pass: false,
          passrate: 0,
          passed: [],
          failed: [],
          skipped: [{
            type: 'behavior',
            code: 'SKIPPED_DUE_TO_SAMPLING',
            message: `${testName}: Skipped because sampling failed - Test cannot run without required data`,
            pass: false,
            skipped: true
          }],
          notices: [],
          events: [],
          filters: [],
          errors: []
        };
        
        // Emit test finish event with skipped result
        Emitter.emit('auditor.suite.test:finish', this.slug, skippedResult);
        skippedTests[testName] = skippedResult;
      }
      
      this.resulter.set('tests', skippedTests);
      this.beforeResults();
      return this.resulter.result;
    }
  }

  protected beforeResults() {}

  evaluate() {
    const tests = this.resulter.get('tests');
    const failed = Object.values(tests).filter( test => test.pass === false );
    return failed.length === 0;
  }

  setupHandlers(): void {
    this.socket.off()
    this.socket.on('message', this.handleMessage.bind(this));
  }

  protected validateMessage(message: INip01RelayMessage): void {
    const key = message?.[0] ?? "unset"
    const isValid = this?.messageValidators?.[key]?.validate(message)
    this.expect.message.toBeOk(isValid, `message ${key} is valid: ${truncate(JSON.stringify(message))}`);
  }

  validateJson(key: string, json: GenericJson) {
    key = key.toUpperCase();
    this.expect.json.toBeOk(this?.jsonValidators?.[key]?.validate, `json ${key} is valid`);
  }

  protected handleMessage({ data }): void {
    const message: INip01RelayMessage = JSON.parse(data);
    const key = message[0];

    const testInstance = this?.testers?.[this.testKey] as ISuiteTest;

    this.validateMessage(message);

    const messageArr = this.messages.get(key) ?? [];
    this.messages.set(key, [...messageArr, message]);

    console.log('wtf', key, message)

    if(key == 'NOTICE') {
      this.logger.custom('notice', message[1], 3);
    }

    if(key == 'EVENT'){
      this.logger.custom('notice', `pushing event ${message[2].id}`);
      testInstance.addEvent(message[2]);
    }

    let suiteHandler = (this[`onMessage${capitalize(key)}` as keyof typeof this] as unknown as MessageHandler<any>)
    if (suiteHandler) {
      suiteHandler = suiteHandler.bind(this);
      suiteHandler(message as any);
    }
    
    let qualifiedTestHandler = (testInstance?.[`_onMessage${capitalize(key)}` as keyof typeof testInstance] as QualifyingMessageHandler<any>)
    let resume: boolean = true;
    if (qualifiedTestHandler) {
      qualifiedTestHandler = qualifiedTestHandler.bind(testInstance);
      resume = qualifiedTestHandler(message as any);
    }

    if(resume) {
      if(this.testKey === 'unset') return 
      const testHandler = (testInstance?.[`onMessage${capitalize(key)}` as keyof typeof testInstance] as MessageHandler<any>)?.bind(testInstance);
      if (testHandler) {
        testHandler(message as any);
      }
    }
  }

  protected _calculateFilePath(metaUrl: string): string {
    return new URL(`./nips/${this.slug}/tests/index.js`, metaUrl).href;
  }
}