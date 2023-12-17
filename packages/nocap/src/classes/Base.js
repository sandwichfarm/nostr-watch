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

import AllDefaultAdapters from "@nostrwatch/nocap-all-adapters-default"

import SAMPLE_EVENT from "../data/sample_event.js"

/**
 * Check (Base)
 * 
 * @class
 * @classdesc Base class for all Check classes
 * @param {string} url - The URL of the relay to check
 * @param {object} config - The configuration object for the check
 */

export default class {

  constructor(url, config={}) {

    this.url = url
    this.ws = null         //set by adapter, needed for conn. status. might be refactored.
    this.$instance = null   //placeholder for adapters to use for storing a pre-initialized instance
    this.cb = {}     //holds user defined callbacks
    this.current = null
    //
    this.adaptersInitialized = false
    this.adapters = {}
    this.adaptersValid = ['websocket', 'info', 'geo', 'dns','ssl']
    //
    this.checks = ['connect', 'read', 'write', 'info', 'dns', 'geo', 'ssl']
    //
    this.config = new ConfigInterface(config)
    this.results = new ResultInterface()
    this.session = new SessionHelper()
    this.timeouts = new TimeoutHelper(this.session)
    this.latency = new LatencyHelper(this.session)
    this.promises = new DeferredWrapper(this.session, this.timeouts)
    this.logger = new Logger(url, this.config.logLevel)
    this.count = new Counter(this.session, [...this.checks])
    this.customChecks = {}
    //
    this.SAMPLE_EVENT = SAMPLE_EVENT
    //
    this.hard_fail = false
    this.results.set('url', url)
    this.results.set('network', parseRelayNetwork(url))
    this.logger.debug(`constructor(${url}, ${JSON.stringify(config)})`)
  }

  set(key, value){
    this[key] = value
  }

  get(key){
    return this[key]
  }

  isActive(){
    return this.current === null? false: true 
  }

  async checkAll(){
    return this.check('all')
  }

  async rawResult(key, raw){
    
  }

  async check(keys, raw=true){
    let result 
    if(!this.session.initial){
      this.hard_fail = false
      this.results.reset({ url: this.url, network: this.network })
      this.session.create()
    }
    if(keys == "all") {
      return this.check(this.checks)
    }
    else if(typeof keys === 'string') {
      result = await this._check(keys)
      this.close()
    }
    else if(keys instanceof Array && keys.length) {
      for await (const key of keys){
        if(this.hard_fail !== true)
          await this._check(key)
      }
      this.close()
      result = this.results.raw(keys)
    }
    else {
      return this.throw(`check(${keys}) failed. keys must be string or populated array`)
    }
    if(this.isConnected()) this.close()
    return raw? result: this.results.cleanResult(keys, result)
  }

  async _check(key){ 
    this.logger.debug(`${key}: check()`)
    this.defaultAdapters()
    await this.start(key)
    const result = await this.promises.get(key).promise
    if(result.status === "error") {
      this.on_check_error( key, { status: "error", message: result.message } )
    }
    return result
  } 

  maybeTimeoutReject(key){
    return (reject) => {  
      if(this.isWebsocketKey(key))
        return reject({ data: false, duration: -1, status: "error", message: `Websocket connection to relay timed out (after ${this.config.timeout[key]}ms}` })
      else 
        return reject({ data: {}, duration: -1, status: "error", message: `${key} check timed out (after ${this.config.timeout[key]}ms}` })
    }
  }

  async start(key){
    this.logger.debug(`${key}: start()`)
    const deferred = await this.addDeferred(key, this.maybeTimeoutReject(key))
    const adapter = this.routeAdapter(key)

    if( typeof key !== 'string')
      throw new Error('Key must be string')

    if( !this?.adapters?.[adapter]?.[`check_${key}`] )
      throw new Error(`check_${key} method not found in ${adapter} Adapter, key should be 'connect', 'read', or 'write'`)

    this.precheck(key)
      .then(() => {
        this.logger.debug(`${key}: precheck resolved`)
        this.current = key
        this.latency.start(key)
        this.adapters[adapter][`check_${key}`]()
      })
      .catch((precheck) => {
        if(key === 'connect' && precheck.status == "error" && precheck?.result){
          this.logger.debug(`${key}: Precheck found that connect check was already fulfilled, returning cached result`)
          this.promises.get(key).resolve(precheck.result)
        }
        else if(precheck.status == "error") {
          this.logger.debug(`${key} precheck failed: ${precheck.message}`)
          this.promises.get(key).resolve({ [key]: false, [`${key}Duration`]: -1, ...precheck })
        }
        else {
          throw new Error(`start(): precheck rejection for ${key} should not ever get here: ${JSON.stringify(precheck)}`)
        }
        deferred.reject()
      })
    return deferred.promise
  }

  websocket_hard_fail(){
    this.logger.debug(`websocket_hard_fail(): ${this.url}`)
    const wschecks = ['connect', 'read', 'write']
    wschecks.forEach(key => { 
      this.results.set(key, { data: false, duration: -1, status: "error", message: "Websocket connection failed" }) 
    })
    const promise = this.promises.get(this.current)
    if(!promise) return this.logger.warn(`websocket_hard_fail(): No promise found for ${this.current} check on ${this.url}`)
    this.hard_fail = true
    promise.resolve(this.results.get(this.current))
    this.current = null
  }

  async finish(key, data={}){
    this.logger.debug(`${key}: finish()`)
    this.current = null
    this.latency.finish(key)
    const result = this.produce_result(key, data)
    if(this.skip_result(key)) return
    this.results.setMany(result)
    this.promises.get(key).resolve(result)
    this.on_change()
  }

  skip_result(key){
    let skip = false 
    let reason 
    if(this.promises.reflect(key).state.isRejected){
      skip = true 
      reason = 'rejected'
    }
    if(this.promises.reflect(key).state.isFulfilled){
      skip = true 
      reason = 'already fulfilled'
    }
    if(!skip) return 
    
    this.logger.warn(`Skipping ${key} check because it was ${reason} when finish() was called`)
    return true
  }

  produce_result(key, data={}){
    const result = {}
    const adapter_key = this.routeAdapter(key)
    const adapter_name = this.adapters[adapter_key].constructor.name 

    result.url = this.results.get('url')
    result.network = this.results.get('network')
    result.adapters = [ ...new Set( this.results.get('adapters').concat([adapter_name]) ) ]
    result.checked_at = Date.now()
    result.checked_by = this.config.checked_by
    data.duration = this.latency.duration(key)  
    result[key] = { ...data }

    return result
  }

  isWebsocketKey(key){
    return ['connect', 'read', 'write'].includes(key)
  }

  async precheck(key){
    const deferred = await this.addDeferred(`precheck_${key}`)
    const needsWebsocket = this.isWebsocketKey(key)
    const keyIsConnect = key === 'connect'
    const resolvePrecheck = deferred.resolve
    const rejectPrecheck = deferred.reject
    const connectAttempted = this.promises.exists('connect') && this.promises.reflect('connect').state.isFulfilled

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
      this.logger.debug(`${key}: prechecker(): needs websocket: ${needsWebsocket}, key is connect: ${keyIsConnect}, connectAttempted: ${connectAttempted}`)

      //Doesn't need websocket. Resolve precheck immediately.
      if( !needsWebsocket ){  
        this.logger.debug(`${key}: prechecker(): doesn't need websocket. Continue to ${key} check`)
        return resolvePrecheck()
      }

      //Websocket is open, and key is not connect, resolve precheck
      if( keyIsConnect && !this.isConnected() ) {  
        this.logger.debug(`${key}: prechecker(): websocket is not open, and key is connect. Continue to check.`)
        return resolvePrecheck()
      }

      //Websocket is open, and key is not connect, resolve precheck
      if( !keyIsConnect && this.isConnected() ) {  
        this.logger.debug(`${key}: prechecker(): websocket is open, key is not connect. Continue to check.`)
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

      //Websocket is open, key is connect, reject precheck and directly resolve check deferred promise with cached result to bypass starting the connect check.
      if(keyIsConnect && this.isConnected()) {
        this.logger.debug(`${key}: prechecker(): websocket is open, key is connect`)
        // this.logger.debug(`precheck(${key}):prechecker():websocket is open, key is connect`)
        rejectPrecheck({ status: "error", message: 'Cannot check connect because websocket is already connected, returning cached result'})
      }
      //Websocket is not connecting, key is not connect
      if( !keyIsConnect && !this.isConnected()) {
        this.logger.debug(`${key}: prechecker(): websocket is not connecting, key is not connect`)
        return rejectPrecheck({ status: "error", message: `Cannot check ${key}, no active websocket connection to relay` })
      } 

      this.logger.debug(`${key}: Made it here without resolving or rejecting precheck. You missed something.`)
    }
    await prechecker()
    return deferred.promise
  }

  subid(key){
    return `${this.session.get()}${this.session.get(key)}` 
  }

  keyFromSubid(subid){
    return Object.keys(this.session.id).find(key => subid.startsWith(this.session.get(key)));
  }

  throw(error){
    return Promise.reject(error);
  }

  unsubscribe(subid){
    if(!this.isConnected())
      return 
    const event = ['CLOSE', subid]
    // const buffer = Buffer.from(JSON.stringify(event));
    this.ws.send(event)
  }

  close(){
    if(!this.isConnected())
      return
    this.ws.close()
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
    if(this?.handle_error)
      this?.handle_error(err)
  }

    /**
   * handle_error
   * Standard Websocket handler triggered by ws.on_error
   * @private
   * @returns null
   */
    handle_error(){
      // this.unsubscribe()
      // this.close()
      this.websocket_hard_fail()
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
    if(this?.adapters?.relay?.handle_event)
      this.adapters.relay.handle_event(subid, ev)
    this.handle_read_check(true)
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
    if(this?.adapters?.relay?.handle_notice)
      this.adapters.relay.handle_notice(notice)
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
    if(this.promises.reflect('write').state.isPending)
      this.handle_write_check(true)
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
   * Implementation specific Event triggered by Check.finish
   * 
   * @private
   * @returns null
   */
    on_check_error(key, err){
      this.cbcall('error', key, err)
      this.track(key, 'error', err)
    }

  /**
   * on_change
   * Implementation specific Event triggered by Check.finish
   * 
   * @private
   * @returns null
   */
  on_change(){
    this.cbcall('change', this.results)
  }

  /**
   * handle_connect
   * Implementation specific handler triggered by Hooks proxy-handler
   * @private
   * @returns null
   */ 
  handle_connect_check(data){
    this.finish('connect', { data })
  }

  /**
   * handle_read 
   * Implementation specific handler triggered by Hooks proxy-handler
   * @private
   * @returns null
   */ 
  handle_read_check(data){
    this.unsubscribe(this.subid('read'))
    this.finish('read', { data })
  }

  /**
   * handle_write 
   * Implementation specific handler triggered by Hooks proxy-handler
   * @private
   * @returns null
   */
  handle_write_check(data){
    this.finish('write', { data })
  }

  /**
   * handle_auth
   * Implementation specific handler triggered by Hooks proxy-handler
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
  handle_ok(){

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

  getTrack(key){
    return this.logdata?.[key] || false
  }

  clearTrack(session){
    if(session)
      delete this.logdata[session]
    else
      this.logdata = {}
  }

  isConnecting(){
    return this.ws?.readyState && this.ws.readyState === WebSocket.CONNECTING ? true : false
  }

  isConnected(){
    return this.ws?.readyState && this.ws.readyState === WebSocket.OPEN ? true : false
  }

  isClosing(){
    return this.ws?.readyState && this.ws.readyState === WebSocket.CLOSING ? true : false
  }

  isClosed(){
    return this.ws?.readyState && this.ws.readyState === WebSocket.CLOSED ? true : false
  }

  async addDeferred(key, cb=()=>{}){
    const existingDeferred = this.promises.exists(key)
    if(existingDeferred) 
      await this.promises.get(key).promise
    this.promises.add(key, this.config?.timeout?.[key], cb)
    return this.promises.get(key)
  }

  routeAdapter(key){
    switch(key){
      case 'connect':
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

  async useAdapter(Adapter){
    const name = Adapter.name
    const adapterKey = this.getAdapterType(name)
    if(this.adapters?.[adapterKey])
      throw new Error(`${adapterKey.charAt(0).toUpperCase()+adapterKey.slice(1)}Adapter has already been initialized with ${this.adapters[type].name}`)
    const $Adapter = new Adapter(this)
    this.adapters[adapterKey] = $Adapter
  }

  defaultAdapterKeys(){
    return Object.keys(AllDefaultAdapters)
  }

  defaultAdapters(){
    this.logger.debug(`defaultAdapters()`)
    if(this.adaptersInitialized) 
      return this.adapters
    this.defaultAdapterKeys().forEach( adapterKey => {
      const adapterType = this.getAdapterType(adapterKey)
      if(!this.adapters?.[adapterType]){
        this.useAdapter(AllDefaultAdapters[adapterKey])
      }
    })
    this.adaptersInitialized = true
    return this.adapters 
  }

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
}

