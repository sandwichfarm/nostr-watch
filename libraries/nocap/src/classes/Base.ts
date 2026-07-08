import WebSocket from 'ws';

import Logger from "@nostrwatch/logger";
import { capitalize, parseRelayNetwork } from "@nostrwatch/utils";

import { ConfigValidator, ConfigValidatorInterface, IConfig } from "../validators/ConfigValidator";
import { IResult, ResultValidator, type IResultData } from "../validators/ResultValidator";

import { SessionHelper } from "./SessionHelper";
import { TimeoutHelper } from "./TimeoutHelper";
import { LatencyHelper } from "./LatencyHelper";
import { DeferredWrapper } from "./DeferredWrapper";
import { Counter } from "./Counter";
import { Auditor } from "./Auditor";

import { IAdapterConstructor } from '../interfaces/IAdapterConstructor';
import { AdapterKeys, IAdapter, IAdapterMethods } from '../interfaces/IAdapter';
import { IEveryAdapterDefault } from '../interfaces/IEveryAdapterDefault'; // Define this as needed
import { CheckKey, CheckMethodKey, PreCheckKey, StrictCheckKey } from '../types/CheckTypes';

import SAMPLE_EVENT from "../data/sample_event";
import { isBrowser } from '@nostrwatch/utils';
import { AbstractAdapter } from './AbstractAdapter';
import { UniversalWebSocket } from '@nostrwatch/websocket';

type WebSocketType = WebSocket | import('ws').WebSocket;

export default class Base {
  ws: UniversalWebSocket | null = null;
  network?: string;
  auditor = new Auditor();
  cb: Record<string, Function> = {};
  current: string | null = null;
  previous: string | null = null;
  hard_fail = false;
  SAMPLE_EVENT = SAMPLE_EVENT;
  checks = Base.checksSupported();
  enableCheckLog: boolean = false;
  logdata: Record<string, any> = {};
  checksRequested: CheckKey[] = [];
  checksIgnoreOutput: string[] = [];
  checksCustom: Record<string, any> = {};
  
  adapters: Record<string, IAdapter> = {};
  adaptersInitialized = false;
  adaptersValid = ['websocket', 'info', 'geo', 'dns', 'ssl'];

  config: ConfigValidatorInterface;
  limits: Record<string, any> = {};
  logger: Logger;
  session: SessionHelper;
  timeouts: TimeoutHelper;
  latency: LatencyHelper;
  promises: DeferredWrapper;
  count: Counter;
  results: ResultValidator;
  _url: URL;
  url: string;
  
  keys: string | string[] = [];

  constructor(url: string, config: object = {}) {
    this._url = new URL(url);

    this.url = this._url.toString();
    this.network = parseRelayNetwork(this.url);

    /*instances*/
    this.config = new ConfigValidator(config);
    this.results = new ResultValidator();
    this.session = new SessionHelper(this.url);
    this.timeouts = new TimeoutHelper(this.session);
    this.latency = new LatencyHelper(this.session);
    this.promises = new DeferredWrapper(this.session, this.timeouts);
    this.logger = new Logger(`@nostrwatch/nocap: ${this.url}`, this?.config?.logLevel);
    this.count = new Counter(this.session, [...this.checks]);
    /*results*/
    this?.results?.set('url', this.url);
    this?.results?.set('network', this.network);
    this?.results?.set('hostname', this._url.hostname);
    this?.results?.set('protocol', this._url.protocol);
    this?.results?.set('parent', null);
    /*checks*/  
    if (this?.config?.get('removeFromResult')) {
      this.checksIgnoreOutput = [...this.checksIgnoreOutput, ...this?.config?.get('removeFromResult')];
    }

    this.logger.debug(`constructor(${url}, ${JSON.stringify(this.config)})`);
  }

  evaluate_requested_checks(): void {
    this.ensure_check_dependencies();
    this.order_requested_checks();
  }

  ensure_check_dependencies(): void {
    if (!this.checksRequested.includes('open')) {
      this.checksRequested.unshift('open');
      if (!this.checksIgnoreOutput.includes('open') && this?.config?.is('autoDepsIgnoredInResult', true)) {
        this.checksIgnoreOutput.push('open');
      }
    }
    if (this.checksRequested.includes('geo') && !this.checksRequested.includes('dns')) {
      this.checksRequested.unshift('dns');
      if (!this.checksIgnoreOutput.includes('dns') && this?.config?.is('autoDepsIgnoredInResult', true)) {
        this.checksIgnoreOutput.push('dns');
      }
    }
  }

  order_requested_checks(): void {
    const idealOrder = Base.checksSupported();
    this.checksRequested.sort((a: CheckKey, b: CheckKey) => {
      let indexA = idealOrder.indexOf(a as CheckKey);
      let indexB = idealOrder.indexOf(b as CheckKey);

      if (indexA === -1) indexA = Infinity;
      if (indexB === -1) indexB = Infinity;

      return indexA - indexB;
    });
  }

  /**
   * check
   * Public method for dataprep and routing a check request
   * 
   * @public
   * @async
   * @param keys - The keys to check
   * @param headers - Whether to include headers in result (default: true)
   * @returns {Promise<*>} - The result of the checks
   */
  async check(keys: CheckKey | CheckKey[], headers = true): Promise<any> {
    this.keys = keys;
    let result: IResult | Record<string, any> | undefined;
    if (!this?.session?.initial) {
      this.hard_fail = false;
      this?.results?.reset({ url: this.url, network: this.network });
      this?.session?.create();
    }

    if (keys == "all") return this.check(this.checks);

    if (typeof keys === 'string' && this.checks.includes(keys)) return this.check([keys]);

    if (!(keys instanceof Array) || !keys.length) {
      return this.throw(new Error(`check(${keys}) failed. keys must be one (string) or several (array of strings).`));
    }

    this.checksRequested = keys;
    this.evaluate_requested_checks();
    for await (const key of this.checksRequested) {
      if(key === null){
        this.logger.debug(`${this.url}: check(${keys}): key is null [${JSON.stringify(this.checksRequested)}]`);
      }
      if (this.hard_fail === true) continue;
      this.logger.debug(`${key}: check(${keys}): setting current and running this._check()`);
      this.current = key;
      await this._check(key as StrictCheckKey)
      this.logger.debug(`${key}: check(${keys}): this._check() resolved`);
    }

    this.terminate();
    this.logger.debug(`${this.previous}: websocket terminated, returning result`);

    result = this?.results?.raw(this.checksRequested, this.checksIgnoreOutput);
    return headers ? result : this?.results?.cleanResult(keys, result);
  }

  /**
   * checkAll
   * Asynchronously initiates a check for all items
   *
   * This method is a convenience wrapper that asynchronously triggers a check for 'all' items.
   * It delegates the actual checking process to the 'check' method with 'all' as the argument.
   *
   * @async
   * @returns {Promise<*>} - The result of the check for all items
   */
  async checkAll(): Promise<any> {
    return this.check('all');
  }

  /**
   * _check
   * Internal method to perform a check for a given key
   * 
   * @private
   * @async
   * @param {string} key - The key to perform the check on
   * @returns {Promise<*>} - The result of the check
   */
  async _check(key: StrictCheckKey): Promise<any> {
    if (!this.can_check(key)) return;
    this.logger.debug(`${key}: check()`);
    await this.start(key).catch((err) => this.logger.debug(err));
    const resolved = (await this?.promises?.get(key).promise) as IResult
    let result: IResult = this.results?.cleanResult(key, resolved) as IResult;
    if(resolved){
      result = resolved
      this.logger.debug(`${key}: check(): resolved`);
      if (result?.[key]?.status === "error") {
        this.on_check_error(key, result);
      }
    }
    return result;
  }

  /**
   * can_check
   * Determines if a check can be performed for a given key
   *
   * This method checks whether the current environment is a browser and the key is 'ssl'.
   * If so, it logs an error indicating SSL checks cannot be performed from the browser.
   * Otherwise, it returns true, allowing the check to proceed.
   *
   * @param {string} key - The key to verify if a check can be performed on
   * @returns {boolean} - True if the check can be performed, otherwise false
   */
  can_check(key: string): boolean {
    if (isBrowser() && key === 'ssl') {
      this.logger.warn('Cannot check SSL from browser');
      return false;
    }
    return true;
  }

  /**
   * isActive
   * Checks if this instance is presently active.
   *
   * This method evaluates the 'current' property of the instance.
   * If 'current' is null, the method returns false, indicating the object is not active.
   * Otherwise, it returns true, indicating the object is active.
   *
   * @returns {boolean} - True if the current object is active, otherwise false
   */
  isActive(): boolean {
    return this.current === null ? false : true;
  }

  /**
   * maybe_timeout
   * Creates a resolve function for a timeout scenario
   * 
   * @private
   * @param {string} key - The key associated with the timeout
   * @returns {Function} - The reject function
   */
  maybe_timeout(key: keyof IConfig["timeout"]): any {
    return (resolve: Function, reject: Function) => {
      const message = `${key}: check timed out (after ${this?.config?.timeout?.[key as keyof IConfig["timeout"]]}ms}`;
      this.logger.debug(message);
      const data = this.isWebsocketKey(key) ? false : {};
      if (key === 'open' && this?.config?.rejectOnConnectFailure) {
        return reject({ data, duration: -1, status: "error", message });
      } else {
        return this.finish(key, { data, duration: -1, status: "error", message });
      }
    };
  }

  checkKey(key: CheckKey): CheckMethodKey{
    return `check_${key}`
  }

  precheckKey(key: CheckKey): PreCheckKey {
    return `precheck_${key}`
  }

  /**
   * start
   * Creates deferred promise for check (key), validates check (key), validates adapter for given check (key), performs a precheck, handles pre-check results, calls check in the corresponding adapter and returns the deferred's promise. 
   * 
   * @private
   * @async
   * @param {string} key - The key to start the check for
   * @returns {Promise<*>} - The promise for the started check
   */
  async start(key: CheckKey): Promise<any> {
    if (typeof key !== 'string') throw new Error('Key must be string');
    if (!this.isWebsocketKey(key)) this.terminate();

    this.logger.debug(`${key}: start()`);
 
    const checkDeferred = await this.addDeferred(key as keyof IConfig["timeout"], this.maybe_timeout(key as keyof IConfig["timeout"]));
    const adapterKey = this.routeAdapter(key);
    const adapter = this?.adapters?.[adapterKey]
    
    const adapterMethodName: AdapterKeys = this.checkKey(key)
    
    if (!adapter?.[adapterMethodName]) {
      return this.throw(new Error(`start(${key}): ${adapterMethodName} not found in ${adapterKey} Adapter`));
    }
    this.logger.debug(`method exists: ${adapterMethodName}`)

    if(typeof adapter?.[adapterMethodName] !== 'function'){
      return this.throw(new Error(`start(${key}): ${adapterMethodName} is not a function`));
    }
    this.precheck(key)
      .then(async () => {
        this.logger.debug(`${key}: precheck resolved`);
        this.latency.start(key);
        this.logger.debug(`${key}:  this.adapters[${adapter}][${this.checkKey(key)}]()`);
        await adapter?.[adapterMethodName]?.call(adapter)
      })
      .catch((precheck) => {
        let reason: string;
        if (key === 'open' && precheck.status == "error" && precheck?.result) {
          reason = `${key}: Precheck found that open check was already fulfilled, returning cached result`;
          checkDeferred.resolve(precheck.result);
        } else if (precheck.status == "error") {
          reason = `${key} precheck failed: ${precheck.message}`;
          checkDeferred.resolve({ [key]: false, [`${key}Duration`]: -1, ...precheck });
        } else {
          reason = `start(): precheck rejection for ${key} should not ever get here: ${JSON.stringify(precheck)}`;
        }
        console.log(precheck)
        this.logger.debug(`reason: ${reason}`);
      });
    return checkDeferred.promise;
  }

  /**
   * finish
   * Set's resets values, produces result, checks the result, resolves the promise for a given check (key) and triggers on_change
   * 
   * @private
   * @async
   * @param {string} key - The key to finish the check for
   * @param {Object} data - The data associated with the check
   */
  async finish(key: string, data: any): Promise<number | void> {
    this.logger.debug(`${key}: finish()`);
    this.latency.finish(key);
    const result = this.produce_result(key, data);
    if (this.ignore_result(key)) 
      return this.logger.debug(`ignoring result ${key}`);
    this?.results?.setMany(result);
    await this?.promises?.resolve(key, result);
    this.on_change();
    return this.latency.duration(key);
  }

  /**
   * ignore_result
   * Determines if the result for a given key should be ignored
   * 
   * @private
   * @param {string} key - The key to check for ignoring
   * @returns {boolean} - True if the result should be ignored, false otherwise
   */
  ignore_result(key: string): boolean {
    let ignore = false;
    let reason: string = "";
    let reflect: any = this?.promises?.reflect(key)
    if (reflect.state.isRejected) {
      ignore = true;
      reason = 'rejected';
    }
    if (reflect.state.isFulfilled) {
      ignore = true;
      reason = 'already fulfilled';
    }
    if (!ignore) return false;
    this.logger.warn(`Ignoring ${key} check because the promise was ${reason} when finish() was called`);
    return true;
  }


  /**
   * produce_result
   * Produces the result for a given key
   * 
   * @private
   * @param {string} key - The key to produce the result for
   * @param {Object} data - The data to include in the result
   * @returns {Object} - The produced result
   */
  produce_result(key: string, data: IResultData): Record<string, any> {
    const result: Record<string, any> = {};
    const adapter_key = this.routeAdapter(key);
    const adapter_name = this.adapters[adapter_key].slug;
    result.url = this?.results?.get('url');
    result.network = this?.results?.get('network');
    result.hostname = this?.results?.get('hostname');
    result.protocol = this?.results?.get('protocol');
    result.parent = this?.results?.get('parent');
    result.adapters = [...new Set(this?.results?.get('adapters').concat([adapter_name]))];
    result.checked_at = Date.now();
    result.checked_by = this?.config?.checked_by;
    if (!data?.duration) data.duration = this.latency.duration(key) as number;
    result[key] = { ...data };
    return result;
  }

  /**
   * isWebsocketKey
   * Checks if a given key is associated with websocket operations
   * 
   * @private
   * @param {string} key - The key to check
   * @returns {boolean} - True if it's a websocket key, false otherwise
   */
  isWebsocketKey(key: string): boolean {
    return ['open', 'read', 'write'].includes(key);
  }

  /**
   * precheck
   * Checks whether a given check can actually be executed given the state and parameters of the current instance. 
   * 
   * @private
   * @async
   * @param {string} key - The key to precheck
   * @returns {Promise<*>} - The promise of the precheck
   */
  async precheck(key: CheckKey): Promise<any> {    
    const precheckDeferred = await this.addDeferred(this.precheckKey(key));
    const needsWebsocket = this.isWebsocketKey(key)
    const keyIsOpen = key === 'open'
    const resolvePrecheck = precheckDeferred.resolve
    const rejectPrecheck = precheckDeferred.reject
    const reflection = this?.promises?.reflect('open')
    const connectAttempted = this?.promises?.exists('open') && reflection && reflection.state.isPending

    const waitForConnection = async (): Promise<void> => {
      this.logger.debug(`${key}: waitForConnection()`)
      if(this.isConnected())
        return resolvePrecheck()
      if(this.isConnecting())
        setTimeout(waitForConnection, 100)
      if(this.isClosed())
        return rejectPrecheck({ status: "error", message: new Error(`Cannot check ${key}, websocket connection to relay is closed`) })
    }

    const prechecker = async (): Promise<void> => {
      this.logger.debug(`${key}: prechecker(): needs websocket: ${needsWebsocket}, key is open: ${keyIsOpen}, connectAttempted: ${connectAttempted}`)

      //Doesn't need websocket. Resolve precheck immediately.
      if( !needsWebsocket ){  
        this.logger.debug(`${key}: prechecker(): doesn't need websocket. Continue to ${key} check`)
        return resolvePrecheck()
      }

      //Websocket is open, and key is not open, resolve precheck
      if( keyIsOpen && !this.isConnected() ) {  
        this.logger.debug(`${key}: prechecker(): websocket is not open, and key is open. Continue to check.`)
        return resolvePrecheck()
      }

      //Websocket is open, and key is not open, resolve precheck
      if( !keyIsOpen && this.isConnected() ) {  
        this.logger.debug(`${key}: prechecker(): websocket is open, key is not open. Continue to check.`)
        return resolvePrecheck()
      }

      //Websocket is connecting
      if( this.isConnecting() ) {
        this.logger.debug(`${key}: prechecker(): websocket is connecting`)
        await waitForConnection()
        if( this.isConnected() ) 
          return resolvePrecheck()
        else
          return rejectPrecheck({ status: "error", message: `Cannot check ${key}, websocket connection could not be established` })
      }

      //Websocket is open, key is open, reject precheck and directly resolve check deferred promise with cached result to bypass starting the open check.
      if(keyIsOpen && this.isConnected()) {
        this.logger.debug(`${key}: prechecker(): websocket is open, key is open`)
        // this.logger.debug(`precheck(${key}):prechecker():websocket is open, key is open`)
        rejectPrecheck({ status: "error", message: 'Cannot check open because websocket is already connected, returning cached result'})
      }
      //Websocket is not connected, key is not open
      if( !keyIsOpen && !this.isConnected()) {
        this.logger.debug(`${key}: prechecker(): websocket is not connected, key is not open`)
        return rejectPrecheck({ status: "error", message: `Cannot check ${key}, no active websocket connection to relay` })
      } 

      this.logger.debug(`${key}: Made it here without resolving or rejecting precheck. You missed something.`)
    }
    await prechecker()
    return precheckDeferred.promise
  }

  /**
   * subid
   * Generates a subscription ID from child session instance for a given key
   * 
   * @private
   * @param {string} key - The key to generate the subscription ID for
   * @returns {string} - The generated subscription ID
   */
  subid(key: string): string {
    return `${this?.session?.get()}${this?.session?.get(key)}`;
  }

  /**
   * keyFromSubid
   * Retrieves the key from a given subscription ID
   * 
   * @private
   * @param {string} subid - The subscription ID
   * @returns {string} - The key associated with the subscription ID
   */
  keyFromSubid(subid: string): string | undefined {
    if(!this?.session?.id) return undefined
    return Object.keys(this.session.id).find((key: string) => {
      const needle = this?.session?.get(key)
      if(!needle) return undefined
      return subid.startsWith(String(needle))
    });
  }

  /**
   * unsubscribe
   * Invokes websocket adapter's unsubscribe method if it exists, otherwise attempts to unsubscribe via adapter provided ws instance
   * 
   * @private
   * @param {string} subid - The subscription ID to unsubscribe from
   */
  unsubscribe(subid: string): void {
    if(!this.isConnected())
      return 
    this.maybeExecuteAdapterMethod(
      'websocket', 
      'unsubscribe', 
      () => this.ws?.send(JSON.stringify(['CLOSE', subid])), 
      subid
    )
  }

  /**
   * close
   * Invokes websocket adapter's close method if it exists, otherwise tries to close the websocket connection via adapter provided ws instance
   * If a hard failure has been previously invoked, will also terminate
   * 
   * @public
   * @param {string} key - The name of the check that invoked the closure
   */
  close(key = ""): void {
    this.logger.debug(`${key}: close()`)
    if( !this.isConnected() || this.isClosing() || this.isClosed()) return
    this.logger.debug(`${key}: close(): closing`)
    this.maybeExecuteAdapterMethod(
      'websocket', 
      'close',
      () => this.ws?.close()
    )
    this.terminate(key)
  }

  /**
   * terminate
   * Invokes websocket adapter's terminate method if it exists, otherwise tries to terminate the websocket connection via adapter provided ws instance
   * 
   * @public
   * @param {string} key - The name of the check that invoked the termination
   */
  terminate(key = ""): void {
    this.logger.debug(`${key}: terminate()`)
    if(!this.isConnected() && !this.isClosing()) return 
    this.logger.debug(`${key}: terminate(): terminating!`)
    this.maybeExecuteAdapterMethod(
      'websocket', 
      'terminate',
      () => (this.ws as any)?.terminate()
    )
  }

  /**
   * on
   * Adds a callback function to the Check
   * 
   * @public
   * @param {string} method - The name of the callback
   * @param {function} fn - The callback function
   * @returns {class} - The mixed class
   */
  on(method: string, fn: Function): Base {
    this.cb[method] = fn;
    return this;
  }

  /**
   * cbcall
   * Calls a user-defined callback if it exists
   * 
   * @private
   * @returns null
   */
  cbcall(method: string, ...args: any[]): void {
    args.shift();
    if (typeof this.cb[method] === 'function') {
      this.cb[method](...args); 
    }
  }

  /**
   * on_open 
   * Standard WebSocket event triggered by Adapter 
   * 
   * @private
   * @returns null
   */
  on_open(): void {
    this.cbcall('open');
    this.track('relay', 'open');
    this.handle_connect_check(true);
  }

  /**
   * on_error
   * Standard WebSocket event triggered by Adapter 
   * 
   * @private
   * @returns null
   */
  on_error(err: Event): void {
    this.cbcall('error');
    this.track('relay', 'error', err);
    this.handle_error(err);
  } 

    /**
   * handle_error
   * Standard Websocket handler triggered by ws.on_error
   * @private
   * @returns null
   */
  handle_error(err: Event): void {
    if (this.hard_fail) return;
    this.logger.debug(`handle_error(): ${err}`);
    this.websocket_hard_fail(err);
  }
  

  /**
   * on_close
   * Standard WebSocket event triggered by Adapter 
   * 
   * @private
   * @returns null
   */ 
  on_closed(subId: string, message?: string): void {
    this.cbcall('closed');
    this.track('relay', 'closed', { subId, message });
    this.handle_close();
  }   

  /**
   * on_event
   * Special Nostr event triggered by Adapter
   * 
   * @private
   * @returns null
   */
  on_event(subid: string, ev: any): void {
    this.track('relay', 'event', ev.id);

    // Cast `this.adapters.websocket` as IAdapter to ensure TypeScript knows it's an instance
    const handler = (this.adapters?.websocket as IAdapter)?.handle_event;

    if (!handler) return;

    handler(subid, ev);
  }


  /**
   * on_close
   * Standard WebSocket event triggered by Adapter 
   * 
   * @private
   * @returns null
   */ 
  on_close(): void {
    this.cbcall('close');
    this.track('relay', 'close', undefined);
    this.handle_close();
  }


  /**
   * on_limits
   * Special Nostr event triggered by Adapter (NIP-22)
   * 
   * @private
   * @returns null
   */
  on_limits(limits: string | object): void {
    if (typeof limits === 'string') {
      try {
        limits = JSON.parse(limits) as object;
      } catch (e) {
        this.logger.error(`on_limits(): ${e}`);
        return;
      }
    }
    this.limits = limits as object;
  }

  /**
   * on_notice
   * Special Nostr event triggered by Adapter 
   * 
   * @private
   * @returns null
   */
  on_notice(notice: any): void {
    this.logger.debug(notice);
    this.track('relay', 'notice', notice);
    this.cbcall('notice');
  }

  /**
   * on_eose
   * Special Nostr event triggered by Adapter
   * 
   * @private
   * @returns null
   */
  on_eose(eose: any): void {
    this.cbcall('eose');
    this.track('relay', 'eose', eose);
    const reflect = this?.promises?.reflect('read')
    if (reflect && reflect.state.isPending) this.handle_eose();
  }

  /**
   * on_ok
   * Special Nostr event triggered by Adapter
   * 
   * @private
   * @returns null
   */  
  on_ok(ok: any): void {
    this.cbcall('ok');
    this.handle_ok(ok);
  }

  /**
   * on_auth
   * Special Nostr event triggered by Adapter
   * 
   * @private
   * @returns null
   */
  on_auth(challenge: any): void {
    this.cbcall('auth', challenge);
    this.track('relay', 'auth', challenge);
    this.handle_auth(challenge);
  }

  forced_finish(key: string, data: IResultData): void {
    this.finish(this.current as string, data);
  }
  /**
   * on_check_error
   * nocap specific Event triggered by Check.finish
   * 
   * @private
   * @returns null
   */
  on_check_error(key: string, err: any): void {
    this.logger.debug(`${key}: on_check_error(): ${err}`)
    this.cbcall('error', key, err)
    this.track(key, 'error', err)
    if(key === 'open' && this?.config?.failAllChecksOnConnectFailure)
      this.websocket_hard_fail(err)
  }

  /**
   * on_change
   * nocap specific Event triggered by Check.finish
   * 
   * @private
   * @returns null
   */
  on_change(): void {
    this.cbcall('change', this?.results);
  }

  /**
   * handle_connect
   * nocap specific handler triggered by Hooks proxy-handler
   * @private
   * @returns null
   */ 
  handle_connect_check(data: any): void {
    const duration = this.finish('open', { data });
    if (this.limits) {
      const { limits } = this;
      this?.results?.set('limits', { duration, limits });
    }
  }

  /**
   * handle_read 
   * nocap specific handler triggered by Hooks proxy-handler
   * @private
   * @returns null
   */ 
  handle_read_check(data: any): void {
    const eventCount = this.adapters?.websocket?.count?.event
    if (eventCount === 1) {
      this.auditor.pass("SUBSCRIBE_LIMIT");
    }
    this.unsubscribe(this.subid('read'));
    this.finish('read', { data });
  }

  /**
   * handle_write 
   * nocap specific handler triggered by Hooks proxy-handler
   * @private
   * @returns null
   */
  handle_write_check(data: any): void {
    this.logger.debug('handle_write_checked()');
    this.finish('write', { data });
  }

  /**
   * handle_auth
   * Nostr handler triggered by Hooks proxy-handler
   * @private
   * @returns null
  */
  handle_auth(challenge: any): void {
    challenge;
  }

  /**
   * handle_on
   * Nostr handler called by Base proxy-handler
   * @private
   * @returns null
   */
  handle_ok(ok: any): void {
    this.logger.debug(`handle_ok(): ${ok}`);
    this.handle_write_check(true);
  }

  /**
   * handle_eose
   * Nostr handler called by Base proxy-handler
   * @private
   * @returns null
   */
  handle_eose(): void {
    this.handle_read_check(true);
  }

  /**
   * handle_close 
   * Handler called by Hook proxy-handler from Standard WebSocket event
   * @private
   * @returns null
   */ 
  handle_close(): void {}


  /**
   * websocket_hard_fail
   * Handles the hard failure of a websocket connection
   * 
   * @private
   */
  websocket_hard_fail(err: any | Record<string, any>): void {
    // if(this.hard_fail || this.current === null) return
    this.logger.debug(`${this.current}: websocket_hard_fail(): ${this.url}`)
    const wschecks = ['open', 'read', 'write']
    this.checksRequested.forEach(key => { 
      let message: string;
      if(wschecks.includes(key))
        if(err?.code)
          message = `${err.syscall} ${err.code}`
        else if(err?.open?.message)
          message = err.open.message
        else if(typeof err ==='string')
          message = err
        else if(typeof err === 'object' && !Array.isArray(err))
          message = Object.entries(err)
            .map(([key, value]) => `${capitalize(key)} is ${value}`)
            .join(', ') + '.';
        else {
          message = "unknown error"
        }
      else
        message = "Check skipped because no connection could be made to relay's websocket."
      // Don't overwrite checks that already completed successfully
      // (e.g. open check passed before the websocket dropped during read)
      const existing = this?.results?.get(key as keyof IResult);
      if (existing?.data === true) return;
      this?.results?.set(key as keyof IResult, { data: false, duration: -1, status: "error", message }) 
    })
    const promise = this?.promises?.get(this?.current ?? "")
    if(!promise) 
      return this.logger.warn(`${this.current}: websocket_hard_fail(): No promise found for ${this.current} check on ${this.url}`)
    this.hard_fail = true
    promise.resolve(promise)
    this.previous = this.current
    this.current = null
  }
  
  /**
   * track
   * Tracks an event for a given adapter and key
   * 
   * @private
   * @param {string} adapter - The adapter associated with the event
   * @param {string} key - The key associated with the event
   * @param {*} data - The data to track
   */
  track(adapter: string, key: string, data?: any): void {
    if(!this?.enableCheckLog)
      return

    if(!this?.logdata)
      this.logdata = {}

    const session = this?.session?.get()

    if(!session)
      return 

    this.logdata[session].push({
      adapter,
      key,
      data
    })
  }

  /**
   * getTrack
   * Retrieves tracked data for a given key
   * 
   * @private
   * @param {string} key - The key to retrieve tracked data for
   * @returns {*} - The tracked data
   */
  getTrack(key: string): any {
    return this.logdata?.[key] || false
  }

  /**
   * clearTrack
   * Clears tracked data for a given session or all sessions
   * 
   * @private
   * @param {string} [session] - The session to clear tracked data for
   */
  clearTrack(session?: string): void {
    if(session)
      delete this.logdata[session]
    else
      this.logdata = {}
  }

    /**
     * maybeExecuteAdapterMethod
     * If adapter method exists, call it and return it's result, otherwise returnn provided altFn result 
     * 
     * @private
     * @param {string} [session] - The session to clear tracked data for
     */
    maybeExecuteAdapterMethod(adapter: string, methodname: string, altFn = (...args: any) => {}, ...args: any[]): any {
      const a = this.adapters[adapter]
      if (a?.[methodname as keyof IAdapterMethods]) {
        // @ts-ignore: Ignore the tuple type error for dynamic methods.
        return a?.[methodname as keyof IAdapterMethods](...args);
      } else {
        try {
          return altFn(...args);
        } catch (err) {
          throw new Error(`${adapter} adapter: Provided alternative function: Threw error using default method: ${err}, the respective adapter should probably define this method instead`);
        }
      }
    }

  /**
   * maybeExecuteAdapterMethod
   * If adapter method exists, call it and return it's result, otherwise returnn provided altFn result 
   * 
   * @private
   * @param {string} [session] - The session to clear tracked data for
   */
  attemptBaseCall(call: Function, ...args: any[]): any {
    try {
      if(typeof call === 'function')
        return call()
      else 
        return call
    }
    catch(err) {
      throw new Error(`close(): Threw error using default method via ws instance: ${err}, the respective adapter should probably provide this method instead` )
    }
  }

  /**
   * isConnecting
   * Checks if the connection is currently in the process of connecting
   * 
   * @private
   * @returns {boolean} - True if connecting, false otherwise
   */
  isConnecting(): boolean {
    if(this.isConnected())
      return false
    return this.maybeExecuteAdapterMethod(
      'websocket', 
      'isConnecting', 
      () => this.ws?.readyState && (this.ws?.readyState as number) === 0 ? true : false
    )
  }

  /**
   * isConnected
   * Checks if the connection is currently established
   * 
   * @private
   * @returns {boolean} - True if connected, false otherwise
   */
  isConnected(): boolean {
    return this.maybeExecuteAdapterMethod(
      'websocket', 
      'isConnected', 
      () => {
        return this.ws?.readyState && this.ws.readyState === 1 ? true : false
      }
    )
  }

  /**
   * isClosing
   * Checks if the connection is currently in the process of closing
   * 
   * @private
   * @returns {boolean} - True if closing, false otherwise
   */
  isClosing(): boolean {
    if(this.isClosed())
      return false
    return this.maybeExecuteAdapterMethod(
      'websocket', 
      'isClosing', 
      () => this.ws?.readyState && this.ws.readyState === 2 ? true : false
    )
  }

  /**
   * isClosed
   * Checks if the connection is currently closed
   * 
   * @private
   * @returns {boolean} - True if closed, false otherwise
   */
  isClosed(): boolean {
    return this.maybeExecuteAdapterMethod(
      'websocket', 
      'isClosed', 
      () => this.ws?.readyState && this.ws.readyState === 3 ? true : false
    )
  }

  /**
   * isBusy
   * Checks if the websocket is busy (connecting or closing)
   * 
   * @private
   * @returns {boolean} - True if closed, false otherwise
   */
  isBusy(): boolean {
    return this.maybeExecuteAdapterMethod(
      'websocket', 
      'isBusy', 
      () => this.isConnecting() || this.isClosing()
    )
  }

  /**
   * addDeferred
   * Helper for adding a deferred object via child promises instance for a given key
   * 
   * @private
   * @async
   * @param key - The key to add the deferred for
   * @param [cb=()=>{}] - The callback function for the deferred
   * @returns The promise of the deferred
   */
  async addDeferred(key: string, cb = () => {}): Promise<any> {
    this.logger.debug(`addDeferred('${key}')`)
    const existingDeferred = this?.promises?.exists(key)
    if(existingDeferred) 
      return this?.promises?.get(key).promise
    const timeoutMs: number = (this.config as IConfig).timeout[key as keyof IConfig["timeout"]]
    return this?.promises?.add(key, timeoutMs, cb)  
  }

  /**
   * routeAdapter
   * Determines the appropriate adapter for a given key
   * 
   * @private
   * @param {string} key - The key to route the adapter for
   * @returns {string} - The routed adapter
   */
  routeAdapter(key: string): string {
    switch(key){
      case 'open':
      case 'read':
      case 'write':
        return 'websocket'
      case 'info':
      case 'geo':
      case 'dns':
      case 'ssl':
        return key
      default:
        throw new Error(`Cannot route ${key}, key invalid`) 
    }
  }

/**
   * useAdapter
   * Initializes and uses a given Adapter
   * 
   * @public
   * @async
   * @param Adapter - The Adapter class to use
   */
  async useAdapter(Adapter: IAdapterConstructor): Promise<void> {
    const { type } = Adapter;
    if (this.adapters?.[type]) {
      throw new Error(`${type.charAt(0).toUpperCase() + type.slice(1)} Adapter has already been initialized with ${this.getAdapterName(this.adapters?.[type])}`);
    }
    this.adapters[type] = new Adapter(this as Base); 
  }


  getAdapterName(adapterClass: IAdapter): string {
    return adapterClass.constructor.name
  }
  
  /**
   * Initializes and uses provided adapters
   * 
   * @public
   * @async
   * @param Adapters - An array of Adapter classes to initialize
   */
  async useAdapters(Adapters: IAdapterConstructor[] | Record<string, IAdapterConstructor>): Promise<void> {
    let adapterArray: IAdapterConstructor[]; // Define a separate variable for the array
    
    if (!(Adapters instanceof Array)) {
      try {
        adapterArray = Object.values(Adapters);
      } catch (err) {
        throw new Error(`useAdapters(): ${err}`);
      }
    } else {
      adapterArray = Adapters;
    }
  
    for (const Adapter of adapterArray) {
      const { type } = Adapter;
      if (this.adapters[type]) {
        throw new Error(
          `${type.charAt(0).toUpperCase() + type.slice(1)} Adapter has already been initialized with ${this.adapters[type].constructor.name}`
        );
      }
      this.adapters[type] = new Adapter(this);
    }
  }

  /**
   * throw
   * returns a rejected promise with a provided error as the reason. 
   * 
   * @private
   * @param {Error} error - The error to throw
   * @returns {Promise<*>} - A promise that rejects with the provided error
   */
  throw(error: Error): Promise<never> {
    return Promise.reject(error);
  }

  /**
   * checksSupported
   * Returns true if in a browser environment
   * 
   * @public
   * @static
   * @returns {string[]}
   */
  static checksSupported(): CheckKey[] {
    return ['open', 'read', 'write', 'ssl', 'dns', 'geo', 'info'];
  }

  /**
   * translateCheckKeys
   * Translates check key shortcuts and synonyms to internal keys. 
   * 
   * @public
   * @static
   * @param {string[]} checks - The array of checks to translate
   */
  static translateCheckKeys(checks: string[]): string[] {
    const translation: Record<string, string[]> = {
      ws: ['open', 'read', 'write'],
      websocket: ['open', 'read', 'write'],
      rtt: ['open', 'read', 'write'],
      nip11: ['info'],
      tls: ['ssl']
    };
    const translated: string[] = [];
    checks.forEach(check => {
      if (translation?.[check]) return translated.push(...translation[check]);
      translated.push(check);
    });
    return Array.from(new Set(translated));
  }
}