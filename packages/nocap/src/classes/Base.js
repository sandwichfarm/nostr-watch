import WebSocket from 'ws'

import Logger from "@nostrwatch/logger"
import { parseRelayNetwork } from "@nostrwatch/utils"

import { ConfigInterface } from "../interfaces/ConfigInterface.js";
import { ResultInterface } from "../interfaces/ResultInterface.js";

import { SessionHelper } from "./SessionHelper.js";
import { TimeoutHelper } from "./TimeoutHelper.js";
import { LatencyHelper } from "./LatencyHelper.js";
import { DeferredWrapper } from "./DeferredWrapper.js";
import { Counter } from "./Counter.js";

import EveryDefaultAdapter from "@nostrwatch/nocap-every-adapter-default"

import SAMPLE_EVENT from "../data/sample_event.js"

/**
 * Check (Base)
 * 
 * @class
 * @classdesc Base class for all Check classes
 * @param {string} url - The URL of the relay to check
 * @param {object} config - The configuration object for the check
 */

export default class Base {

  constructor(url, config={}) {
    this.url = url
    this._init(config)
    this.logger.debug(`constructor(${url}, ${JSON.stringify(this.config)})`)
  }

  _init(config){
    this._init_defaults()
    this._init_instances(config)
    this._init_results()
    this._init_checks()
  }

  _init_defaults(){
    this.ws = null         //set by adapter, needed for conn. status. might be refactored.
    this.cb = {}     //holds user defined callbacks
    this.current = null
    this.hard_fail = false
    this.SAMPLE_EVENT = SAMPLE_EVENT
    
    this.checks = Base.checksSupported()
    this.checksRequested = []
    this.checksIgnoreOutput = []
    this.checksCustom = {}

    this.adaptersInitialized = false
    this.adapters = {}
    this.adaptersValid = ['websocket', 'info', 'geo', 'dns', 'ssl']
  }

  _init_instances(config){
    this.config = new ConfigInterface(config)
    this.results = new ResultInterface()
    this.session = new SessionHelper(this.url)
    this.timeouts = new TimeoutHelper(this.session)
    this.latency = new LatencyHelper(this.session)
    this.promises = new DeferredWrapper(this.session, this.timeouts)
    this.logger = new Logger(this.url, this.config.logLevel)
    this.count = new Counter(this.session, [...this.checks])
  }

  _init_results(){
    this.results.set('url', this.url)
    this.results.set('network', parseRelayNetwork(this.url))
  }

  _init_checks(){
    if(this.config.get('removeFromResult'))
      this.checksIgnoreOutput = [ ...this.checksIgnoreOutput, ...this.config.get('removeFromResult') ]
  }

  evaluate_requested_checks(){
    this.ensure_check_dependencies();
    this.order_requested_checks()
  }

  order_requested_checks() {
    const idealOrder = Base.checksSupported()
    
    this.checksRequested.sort((a, b) => {
        let indexA = idealOrder.indexOf(a);
        let indexB = idealOrder.indexOf(b);

        if (indexA === -1) indexA = Infinity;
        if (indexB === -1) indexB = Infinity;

        return indexA - indexB;
    });
  }

  ensure_check_dependencies(){
    if(!this.checksRequested.includes('open')){
      this.checksRequested.unshift('open')
      if(!this.checksIgnoreOutput.includes('open') && this.config.is('autoDepsIgnoredInResult', true))
        this.checksIgnoreOutput.push('open')
    }
    if(this.checksRequested.includes('geo') && !this.checksRequested.includes('dns')){
      this.checksRequested.unshift('dns')
      if(!this.checksIgnoreOutput.includes('dns') && this.config.is('autoDepsIgnoredInResult', true))
        this.checksIgnoreOutput.push('dns')
    }
  }

  /**
   * check
   * Public method for dataprep and routing a check request
   * 
   * @public
   * @async
   * @param {(string|string[])} keys - The keys to check
   * @param {boolean} headers - Whether to include headers in result (default: true)
   * @returns {Promise<*>} - The result of the checks
   */
  async check(keys, headers=true){
    this.keys = keys
    let result 
    if(!this.session.initial){
      this.hard_fail = false
      this.results.reset({ url: this.url, network: this.network })
      this.session.create()
    }
    if(keys == "all") {
      return this.check(this.checks)
    }
    else if(typeof keys === 'string' && this.checks.includes(keys)) {
      return this.check([keys])
    }
    else if(keys instanceof Array && keys.length) {
      this.checksRequested = keys
      this.evaluate_requested_checks()
      for await (const key of this.checksRequested){
        if(this.hard_fail === true) continue
        this.current = key
        await this._check(key)
      }
      this.close()
      result = this.results.raw(this.checksRequested, this.checksIgnoreOutput)
    }
    else {
      throw new Error(`check(${keys}) failed. keys must be one (string) or several (array of strings) of: ${this.checks.join(', ')}`)
      // return this.throw(`check(${keys}) failed. keys must be one (string) or several (array of strings) of: ${this.checks.join(', ')}`)
    }
    // if(this.isConnected()) this.close()
    return headers? result: this.results.cleanResult(keys, result)
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
  async _check(key){ 
    if(!this.can_check(key)) return
    this.logger.debug(`${key}: check()`)
    this.defaultAdapters()
    const precheck = await this.start(key).catch( err => this.logger.debug(err) )
    const result = await this.promises.get(key).promise
    // process.exit()
    if(result?.[key]?.status === "error" ) {
      this.on_check_error( key, result )
    }
    return result
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
  can_check(key){
    if(this.is_browser() && key === 'ssl') {
      this.logger.warn('Cannot check SSL from browser')
      return false
    }
    return true 
  }

  /**
   * isActive
   * Checks if the current object is active
   *
   * This method evaluates the 'current' property of the instance.
   * If 'current' is null, the method returns false, indicating the object is not active.
   * Otherwise, it returns true, indicating the object is active.
   *
   * @returns {boolean} - True if the current object is active, otherwise false
   */
  isActive(){
    return this.current === null? false: true 
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
  async checkAll(){
    return this.check('all')
  }

  /**
   * maybe_timeout
   * Creates a resolve function for a timeout scenario
   * 
   * @private
   * @param {string} key - The key associated with the timeout
   * @returns {Function} - The reject function
   */
  maybe_timeout(key){ 
    return (resolve, reject) => {  
      const message = `${key} check timed out (after ${this.config.timeout[key]}ms}` 
      this.logger.debug(message)
      const data = this.isWebsocketKey(key)? false: {}
      if(key === 'open' && this.config.rejectOnConnectFailure){
        return reject({ data, duration: -1, status: "error", message})
      }
      else {
        return this.finish( key, { data, duration: -1, status: "error", message})
      }
    }
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
  async start(key){
    this.logger.debug(`${key}: start()`)
    const checkDeferred = await this.addDeferred(key, this.maybe_timeout(key))
    // checkDeferred.catch(this.logger.debug)

    const adapter = this.routeAdapter(key)

    if( typeof key !== 'string')
      throw new Error('Key must be string')

    if( !this?.adapters?.[adapter]?.[`check_${key}`] )
      throw new Error(`check_${key} method not found in ${adapter} Adapter`)

    this.precheck(key)
      .then(async () => {
        this.logger.debug(`${key}: precheck resolved`)
        this.latency.start(key)
        await this.adapters[adapter][`check_${key}`]()
      })
      .catch((precheck) => {
        let reason
        if(key === 'open' && precheck.status == "error" && precheck?.result){
          reason = `${key}: Precheck found that open check was already fulfilled, returning cached result`
          // this.promises.get(key).resolve(precheck.result)
          checkDeferred.resolve(precheck.result)
        } 
        else if (precheck.status == "error") {
          reason = `${key} precheck failed: ${precheck.message}`
          // this.promises.get(key).resolve({ [key]: false, [`${key}Duration`]: -1, ...precheck })
          checkDeferred.resolve({ [key]: false, [`${key}Duration`]: -1, ...precheck })
        }
        else {
          reason = `start(): precheck rejection for ${key} should not ever get here: ${JSON.stringify(precheck)}`
        }
        // deferred.reject(reason)
      })
    return checkDeferred.promise
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
  async finish(key, data={}){
    this.logger.debug(`${key}: finish()`)
    // this.current = null
    this.latency.finish(key)
    const result = this.produce_result(key, data)
    if(this.ignore_result(key)) return this.logger.debug(`ignoring result ${key}`)
    this.results.setMany(result)
    const deferred = await this.promises.resolve(key, result)
    this.on_change()
  }

  /**
   * ignore_result
   * Determines if the result for a given key should be ignored
   * 
   * @private
   * @param {string} key - The key to check for ignoring
   * @returns {boolean} - True if the result should be ignored, false otherwise
   */
  ignore_result(key){
    let ignore = false 
    let reason 
    if(this.promises.reflect(key).state.isRejected){
      ignore = true 
      reason = 'rejected'
    }
    if(this.promises.reflect(key).state.isFulfilled){
      ignore = true 
      reason = 'already fulfilled'
    }
    if(!ignore) return false
    this.logger.warn(`Ignoring ${key} check because the promise was ${reason} when finish() was called`)
    return true
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
  produce_result(key, data={}){
    const result = {}
    const adapter_key = this.routeAdapter(key)
    const adapter_name = this.adapters[adapter_key].constructor.name 
    result.url = this.results.get('url')
    result.network = this.results.get('network')
    result.adapters = [ ...new Set( this.results.get('adapters').concat([adapter_name]) ) ]
    result.checked_at = Date.now()
    result.checked_by = this.config.checked_by
    if(!data?.duration)
      data.duration = this.latency.duration(key)  
    result[key] = { ...data }
    return result
  }

  /**
   * isWebsocketKey
   * Checks if a given key is associated with websocket operations
   * 
   * @private
   * @param {string} key - The key to check
   * @returns {boolean} - True if it's a websocket key, false otherwise
   */
  isWebsocketKey(key){
    return ['open', 'read', 'write'].includes(key)
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
  async precheck(key){
    const precheckDeferred = await this.addDeferred(`precheck_${key}`)
    const needsWebsocket = this.isWebsocketKey(key)
    const keyIsOpen = key === 'open'
    const resolvePrecheck = precheckDeferred.resolve
    const rejectPrecheck = precheckDeferred.reject
    const connectAttempted = this.promises.exists('open') && this.promises.reflect('open').state.isPending

    const waitForConnection = async () => {
      this.logger.debug(`${key}: waitForConnection()`)
      if(this.isConnected())
        return resolvePrecheck()
      if(this.isConnecting())
        setTimeout(waitForConnection, 100)
      if(this.isClosed())
        return rejectPrecheck({ status: "error", message: new Error(`Cannot check ${key}, websocket connection to relay is closed`) })
    }

    const prechecker = async () => {
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
  subid(key){
    return `${this.session.get()}${this.session.get(key)}` 
  }

  /**
   * keyFromSubid
   * Retrieves the key from a given subscription ID
   * 
   * @private
   * @param {string} subid - The subscription ID
   * @returns {string} - The key associated with the subscription ID
   */
  keyFromSubid(subid){
    return Object.keys(this.session.id).find(key => subid.startsWith(this.session.get(key)));
  }

  /**
   * unsubscribe
   * Invokes websocket adapter's unsubscribe method if it exists, otherwise attempts to unsubscribe via adapter provided ws instance
   * 
   * @private
   * @param {string} subid - The subscription ID to unsubscribe from
   */
  unsubscribe(subid){
    if(!this.isConnected())
      return 
    // if(this.adapters.websocket?.unsubscribe)
    //   return this.adapters.websocket.unsubscribe()
    this.maybeExecuteAdapterMethod(
      'websocket', 
      'unsubscribe', 
      () => this.ws.send(['CLOSE', subid]), 
      subid
    )
  }

  /**
   * close
   * Invokes websocket adapter's close method if it exists, otherwise tries to close the websocket connection via adapter provided ws instance
   * 
   * @private
   */
  close(){
    this.logger.debug(`close()`)
    if( !this.isConnected() || this.isClosing() || this.isClosed())
      return
    this.maybeExecuteAdapterMethod(
      'websocket', 
      'close',
      () => this.ws.close()
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
  on(method, fn){
    this.cb[method] = fn
    return this
  }

  /**
   * cbcall
   * Calls a user-defined callback if it exists
   * 
   * @private
   * @returns null
   */
  cbcall(method){
    [].shift.call(arguments,1)
    if(typeof this.cb[method] === 'function')
      this.cb[method](...arguments)
  }

  /**
   * on_open 
   * Standard WebSocket event triggered by Adapter 
   * 
   * @private
   * @returns null
   */
  on_open(e){
    this.cbcall('open', e)
    this.track('relay', 'open')
    this.handle_connect_check(true)
  }

  /**
   * on_error
   * Standard WebSocket event triggered by Adapter 
   * 
   * @private
   * @returns null
   */
  on_error(err){
    this.cbcall('error')
    this.track('relay', 'error', err)
    this?.handle_error(err)
  }

    /**
   * handle_error
   * Standard Websocket handler triggered by ws.on_error
   * @private
   * @returns null
   */
  handle_error(err){
    // this.unsubscribe()
    // this.close()
    this.websocket_hard_fail(err)
    // this.finish(this.current, { [this.current]: false, duration: -1 }, this.promises.get(this.current).reject)
  }
  

  /**
   * on_close
   * Standard WebSocket event triggered by Adapter 
   * 
   * @private
   * @returns null
   */
  on_close(e){
    this.cbcall('close', e)
    this.track('relay', 'close', e)
    this?.handle_close(e)
  }

  /**
   * on_event
   * Special Nostr event triggered by Adapter
   * 
   * @private
   * @returns null
   */
  on_event(subid, ev){
    this.track('relay', 'event', ev.id)
    if(this?.adapters?.websocket?.handle_event)
      this.adapters.websocket.handle_event(subid, ev)
  }

  /**
   * on_notice
   * Special Nostr event triggered by Adapter 
   * 
   * @private
   * @returns null
   */
  on_notice(notice){
    this.logger.debug(notice)
    this.track('relay', 'notice', notice)
    this.cbcall('notice')
    if(this?.adapters?.websocket?.handle_notice)
      this.adapters.websocket.handle_notice(notice)
  }

  /**
   * on_eose
   * Special Nostr event triggered by Adapter
   * 
   * @private
   * @returns null
   */
  on_eose(eose){
    this.cbcall('eose')
    this.track('relay', 'eose', eose) 
    if(this.promises.reflect('read').state.isPending)
      this.handle_eose(eose)
  }

  /**
   * on_ok
   * Special Nostr event triggered by Adapter
   * 
   * @private
   * @returns null
   */  
  on_ok(ok){
    this.cbcall('ok')
    this.handle_ok(ok)
    // if(this.promises.reflect('write').state.isPending)
  }

  /**
   * on_auth
   * Special Nostr event triggered by Adapter
   * 
   * @private
   * @returns null
   */
  on_auth(challenge){
    this.cbcall('auth', challenge)
    this.track('relay', 'auth', challenge)
    this.handle_auth(challenge)
  }

    /**
   * on_check_error
   * nocap specific Event triggered by Check.finish
   * 
   * @private
   * @returns null
   */
    on_check_error(key, err){
      this.cbcall('error', key, err)
      this.track(key, 'error', err)
      if(key === 'open' && this.config.failAllChecksOnConnectFailure)
        this.websocket_hard_fail(err)
    }

  /**
   * on_change
   * nocap specific Event triggered by Check.finish
   * 
   * @private
   * @returns null
   */
  on_change(){
    this.cbcall('change', this.results)
  }

  /**
   * handle_connect
   * nocap specific handler triggered by Hooks proxy-handler
   * @private
   * @returns null
   */ 
  handle_connect_check(data){
    this.finish('open', { data })
  }

  /**
   * handle_read 
   * nocap specific handler triggered by Hooks proxy-handler
   * @private
   * @returns null
   */ 
  handle_read_check(data){
    this.unsubscribe(this.subid('read'))
    this.finish('read', { data })
  }

  /**
   * handle_write 
   * nocap specific handler triggered by Hooks proxy-handler
   * @private
   * @returns null
   */
  handle_write_check(data){
    this.logger.debug('handle_write_checked()')
    this.finish('write', { data })
  }

  /**
   * handle_auth
   * Nostr handler triggered by Hooks proxy-handler
   * @private
   * @returns null
  */
  handle_auth(challenge){
  
  }


  /**
   * handle_on
   * Nostr handler called by Base proxy-handler
   * @private
   * @returns null
   */
  handle_ok(ok){
    this.logger.debug('handle_ok()', "ok?", ok)
    this.handle_write_check(true)
  }

  /**
   * handle_eose
   * Nostr handler called by Base proxy-handler
   * @private
   * @returns null
   */
  handle_eose(){
    this.handle_read_check(true)
  }

  /**
   * handle_close 
   * Handler called by Hook proxy-handler from Standard WebSocket event
   * @private
   * @returns null
   */ 
  handle_close(){
    // const result = { closed_at: Date.now().time(), connected: false }
    // this.log('hook', 'close', result)
    // this.finish('duration', result)
  }  


  /**
   * websocket_hard_fail
   * Handles the hard failure of a websocket connection
   * 
   * @private
   */
  websocket_hard_fail(err){
    this.logger.debug(`websocket_hard_fail(): ${this.url}`)
    const wschecks = ['open', 'read', 'write']
    this.checksRequested.forEach(key => { 
      let message
      if(wschecks.includes(key))
        if(err?.code)
          message = `${err.syscall} ${err.code}`
        else if(err?.open?.message)
          message = err.open.message
        else if(typeof err ==='string')
          message = err
        else 
          message = "unknown error"
      else
        message = "Check skipped because no connection could be made to relay's websocket."
      this.results.set(key, { data: false, duration: -1, status: "error", message }) 
    })
    const promise = this.promises.get(this.current)
    if(!promise) return this.logger.warn(`websocket_hard_fail(): No promise found for ${this.current} check on ${this.url}`)
    this.hard_fail = true
    promise.resolve(this.results.get(this.current))
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
  track(adapter, key, data){
    if(!this.enableCheckLog)
      return

    if(!this?.logdata)
      this.logdata = {}

    this.logdata[this.session.get()].push({
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
  getTrack(key){
    return this.logdata?.[key] || false
  }

  /**
   * clearTrack
   * Clears tracked data for a given session or all sessions
   * 
   * @private
   * @param {string} [session] - The session to clear tracked data for
   */
  clearTrack(session){
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
  maybeExecuteAdapterMethod(adapter, methodname, altFn=()=>{}, ...args) {
    if(this.adapters?.[adapter]?.[methodname]) {
      return this.adapters[adapter][methodname](...args)
    } else {
      try {
        return altFn(...args)
      }
      catch(err){
        throw new Error(`Provided alternative function: Threw error using default method: ${err}, the respective adapter should probably define this method instead` )
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
  attemptBaseCall(call, ...args){
    try {
      if(typeof fn === 'function')
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
  isConnecting(){
    if(this.isConnected())
      return
    return this.maybeExecuteAdapterMethod(
      'websocket', 
      'isConnecting', 
      () => this.ws?.readyState && this.ws.readyState === WebSocket.CONNECTING ? true : false
    )
  }

  /**
   * isConnected
   * Checks if the connection is currently established
   * 
   * @private
   * @returns {boolean} - True if connected, false otherwise
   */
  isConnected(){
    return this.maybeExecuteAdapterMethod(
      'websocket', 
      'isConnected', 
      () => this.ws?.readyState && this.ws.readyState === WebSocket.OPEN ? true : false
    )
  }

  /**
   * isClosing
   * Checks if the connection is currently in the process of closing
   * 
   * @private
   * @returns {boolean} - True if closing, false otherwise
   */
  isClosing(){
    if(this.isClosed())
      return
    return this.maybeExecuteAdapterMethod(
      'websocket', 
      'isClosing', 
      () => this.ws?.readyState && this.ws.readyState === WebSocket.CLOSING ? true : false
    )
  }

  /**
   * isClosed
   * Checks if the connection is currently closed
   * 
   * @private
   * @returns {boolean} - True if closed, false otherwise
   */
  isClosed(){
    return this.maybeExecuteAdapterMethod(
      'websocket', 
      'isClosed', 
      () => this.ws?.readyState && this.ws.readyState === WebSocket.CLOSED ? true : false
    )
  }

  /**
   * addDeferred
   * Helper for adding a deferred object via child promises instance for a given key
   * 
   * @private
   * @async
   * @param {string} key - The key to add the deferred for
   * @param {Function} [cb=()=>{}] - The callback function for the deferred
   * @returns {Promise<*>} - The promise of the deferred
   */
  async addDeferred(key, cb=()=>{}){
    this.logger.debug(`addDeferred('${key}')`)
    const existingDeferred = this.promises.exists(key)
    if(existingDeferred) 
      return this.promises.get(key).promise
    return this.promises.add(key, this.config?.timeout?.[key], cb)
  }

  /**
   * routeAdapter
   * Determines the appropriate adapter for a given key
   * 
   * @private
   * @param {string} key - The key to route the adapter for
   * @returns {string} - The routed adapter
   */
  routeAdapter(key){
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
   * @private
   * @async
   * @param {Function} Adapter - The Adapter class to use
   */
  async useAdapter(Adapter){
    const name = Adapter.name
    const adapterKey = this.getAdapterType(name)
    if(this.adapters?.[adapterKey])
      throw new Error(`${adapterKey.charAt(0).toUpperCase()+adapterKey.slice(1)}Adapter has already been initialized with ${this.adapters[type].name}`)
    const $Adapter = new Adapter(this)
    this.adapters[adapterKey] = $Adapter
  }

  /**
   * defaultAdapterKeys
   * Retrieves the default keys for adapters
   * 
   * @private
   * @returns {string[]} - The array of default adapter keys
   */
  defaultAdapterKeys(){
    return Object.keys(EveryDefaultAdapter)
  }

  /**
   * defaultAdapters
   * Initializes the default adapters
   * 
   * @private
   * @returns {Object} - The initialized adapters
   */
  defaultAdapters(){
    this.logger.debug(`defaultAdapters()`)
    if(this.adaptersInitialized) 
      return this.adapters
    this.defaultAdapterKeys().forEach( adapterKey => {
      const adapterType = this.getAdapterType(adapterKey)
      if(!this.adapters?.[adapterType]){
        this.useAdapter(EveryDefaultAdapter[adapterKey])
      }
    })
    this.adaptersInitialized = true
    return this.adapters 
  }

  /**
   * getAdapterType
   * Helper that determines the type of an adapter based on its class name
   * 
   * @private
   * @param {string} adapterName - The name of the adapter
   * @returns {string} - The type of the adapter
   */
  getAdapterType(adapterName){
    let type 
    this.adaptersValid.forEach(adapterKey => {
      if(adapterName.toLowerCase().startsWith(adapterKey)) 
        type = adapterKey
    })
    if(typeof type === 'undefined')
      throw new Error(`Adapter ${adapterName} is not a valid adapter`)
    return type
  }

  /**
   * set
   * Sets a value for a given key in the instance
   * 
   * @public
   * @param {string} key - The key to set
   * @param {*} value - The value to set for the key
   */
  set(key, value){
    this[key] = value
  }
  /**
   * get
   * Retrieves the value of a given key from the instance
   * 
   * @public
   * @param {string} key - The key to retrieve the value for
   * @returns {*} - The value of the specified key
   */
  get(key){
    return this[key]
  }

  /**
   * throw
   * returns a rejected promise with a provided error as the reason. 
   * 
   * @private
   * @param {Error} error - The error to throw
   * @returns {Promise<*>} - A promise that rejects with the provided error
   */
  throw(error){
    return Promise.reject(error);
  }

  /**
   * is_browser
   * Returns true if in a browser environment
   * 
   * @private
   * @returns {boolean}
   */
  is_browser(){
    (typeof window !== 'undefined' && typeof document !== 'undefined')
  }
    

  /**
   * checksSupported
   * Returns true if in a browser environment
   * 
   * @public
   * @static
   * @returns {boolean}
   */
  static checksSupported(){
    return ['open', 'read', 'write', 'ssl', 'dns', 'geo', 'info'];
  }
}

