import WebSocket from 'ws'

import Logger from "@nostrwatch/logger"
import { parseRelayNetwork } from "@nostrwatch/utils"

import { ConfigInterface } from "../interfaces/ConfigInterface.js";
import { ResultInterface } from "../interfaces/ResultInterface.js";

import { SessionHelper } from "./SessionHelper.js";
import { TimeoutHelper } from "./TimeoutHelper.js";
import { LatencyHelper } from "./LatencyHelper.js";
import { DeferredWrapper } from "./DeferredWrapper.js";

import AllDefaultAdapters from "@nostrwatch/nocap-all-adapters-default"

import SAMPLE_EVENT from "../data/sample_event.js"

/**
 * Check (Base)
 * 
 * @class
 * @classdesc Base class for all Check classes
 * @param {string} url - The URL of the relay to connect to
 * @param {object} config - The configuration object for the check
 */

export default class {

  constructor(url, config) {
    
    this.url = url
    this.ws = null         //set by adapter, needed for conn. status. might be refactored.
    this.$instance = null   //placeholder for adapters to use for storing a pre-initialized instance
    this.cb = {}     //holds user defined callbacks
    this.current = null
    //
    this.adaptersInitialized = false
    this.adapters = {}
    this.adaptersValid = ['relay', 'info', 'geo', 'dns','ssl']
    //
    this.checks = ['connect', 'read', 'write', 'info', 'geo', 'dns', 'ssl']
    //
    this.config = new ConfigInterface(config)
    this.results = new ResultInterface()
    this.session = new SessionHelper()
    this.timeouts = new TimeoutHelper(this.session)
    this.latency = new LatencyHelper(this.session)
    this.promises = new DeferredWrapper(this.session, this.timeouts)
    this.logger = new Logger(url, this.config.logLevel)
    this.customChecks = {}
    //
    this.SAMPLE_EVENT = SAMPLE_EVENT
    //
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

  async check(keys){
    if(keys === "all") {
      await this.check(this.checks)
      return this.results.dump()
    }
      
    if(typeof keys === 'string')
      return this._check(keys)
    
    if(keys instanceof Array) {
      let result = {}
      for(const key of keys){
        result = { ...result, ...await this._check(key) }
      }
      return new Promise(resolve => resolve(result))
    }
  }

  async _check(key){ 
    this.logger.debug(`check(${key})`)
    this.defaultAdapters()
    await this.start(key)
    const result = await this.promises.get(key).promise
    if(result?.error) {
      this.on_check_error( key, result )
    }
    return result
  } 

  async start(key){
    this.logger.debug(`${key}: start()`)
    const deferred = this.addDeferred(key)
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
        if(precheck.error === true) {
          this.logger.debug(`${key}: precheck rejected with error`)
          this.logger.error(`Error in ${key} precheck: ${precheck.error}`)
          this.promises.get(key).resolve({ [key]: false, [`${key}Latency`]: -1, ...precheck })
        }
        else if(key === 'connect' && precheck.error === false && precheck?.result){
          this.logger.debug(`${key}: precheck rejected with cached result`)
          this.logger.warn(`Precheck found that connect check was already fulfilled, returning cached result`)
          this.promises.get(key).resolve(precheck.result)
        }
        else {
          throw new Error(`start(): precheck rejection for ${key} should not ever get here: ${JSON.stringify(precheck)}`)
        }
        deferred.reject()
      })
    return deferred.promise
  }

  async finish(key, result={}){
    this.logger.debug(`${key}: finish()`)
    this.current = null
    this.latency.finish(key)
    result[`${key}Latency`] = this.latency.duration(key)
    this.results.set('url', this.url)
    this.results.set(`${key}Latency`, result[`${key}Latency`])
    this.results.setMany(result)
    this.promises.get(key).resolve(result)
    this.on_change()
  }

  async precheck(key){
    const deferred = this.addDeferred(`precheck_${key}`)
    const needsWebsocket = ['connect', 'read', 'write'].includes(key)
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
        return rejectPrecheck({ error: true, reason: new Error(`Cannot check ${key}, websocket connection to relay is closed`) })
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
          return rejectPrecheck({ error: true, reason: new Error(`Cannot check ${key}, websocket connection could not be established`) })
      }

      //Websocket is open, key is connect, reject precheck and directly resolve check deferred promise with cached result to bypass starting the connect check.
      if(keyIsConnect && this.isConnected()) {
        this.logger.debug(`${key}: prechecker(): websocket is open, key is connect`)
        // this.logger.debug(`precheck(${key}):prechecker():websocket is open, key is connect`)
        rejectPrecheck({ error: false, reason: 'Cannot check connect because websocket is already connected, returning cached result'})
      }

      //Websocket is not connecting, key is not connect
      if( !keyIsConnect && !this.isConnected()) {
        this.logger.debug(`${key}: prechecker(): websocket is not connecting, key is not connect`)
        const error = { error: true, reason: new Error(`Cannot check ${key}, no active websocket connection to relay`) }
        if(connectAttempted){
          this.logger.debug(`${key}: prechecker(): websocket is not connecting, key is not connect, connectAttempted is true`)
          this.logger.warn(`Error in ${key} precheck: ${error.reason}`)
          return rejectPrecheck(error)
        }
        const result = await this.check('connect')
        if(result.connect){
          this.logger.debug(`${key}: prechecker(): websocket is not connecting, key is not connect, connectAttempted is false, connect check succeeded`)
          return resolvePrecheck()
        }
        else {
          this.logger.debug(`${key}: prechecker(): websocket is not connecting, key is not connect, connectAttempted is false, connect check failed`)
          return rejectPrecheck(error)
        }
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
    this?.handle_error(err)
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
    this.unsubscribe(subid)
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
    console.log(notice)
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
    this.handle_eose(eose)
    if(this.promises.reflect('read').state.isPending)
      this?.logger.warn(`received EOSE event but read promise is pending`)
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
    this.handle_write_check(true)
    if(this.promises.reflect('write').state.isPending)
      this?.logger.warn(`received OK event but write promise is pending`)
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
    this?.handle_auth(challenge)
  }

  /**
   * on_change
   * Implementation specific Event triggered by Check.finish
   * 
   * @private
   * @returns null
   */
  on_change(){
    this.cbcall('change', this.result)
  }

  /**
   * handle_connect
   * Implementation specific handler triggered by Hooks proxy-handler
   * @private
   * @returns null
   */ 
  handle_connect_check(success){
    const result = { connect: success }
    this.finish('connect', result, this.promises.get('connect').resolve)
  }

  /**
   * handle_read 
   * Implementation specific handler triggered by Hooks proxy-handler
   * @private
   * @returns null
   */ 
  handle_read_check(success){
    const result = { read: success }
    this.finish('read', result, this.promises.get('read').resolve)
  }

  /**
   * handle_write 
   * Implementation specific handler triggered by Hooks proxy-handler
   * @private
   * @returns null
   */
  handle_write_check(success){
    const result = { write: success }
    this.finish('write', result, this.promises.get('write').resolve)
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

  addDeferred(key){
    const existingDeferred = this.promises.exists(key)
    if(!existingDeferred)
      this.promises.add(key, this.config?.[`${key}_timeout`])
    return this.promises.get(key)
  }

  routeAdapter(key){
    switch(key){
      case 'connect':
      case 'read':
      case 'write':
        return 'relay'
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

