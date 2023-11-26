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
    this.current = ""
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
    this.logger = new Logger(url)
    //
    this.SAMPLE_EVENT = SAMPLE_EVENT
    //
    this.results.set('url', url)
    this.results.set('network', parseRelayNetwork(url))
  }

  set(key, value){
    this[key] = value
  }

  get(key){
    return this[key]
  }

  async checkAll(){
    this.defaultAdapters()
    for(const check of this.checks) {
      await this.check(check).catch(this.logger.warn)
    }
    return this.results.dump()
  }

  async check(key){ 
    this.defaultAdapters()
    const adapter = this.routeAdapter(key)
    if( typeof key !== 'string')
      return this.throw('Key must be string')
    if( !this?.adapters?.[adapter]?.[`check_${key}`] )
      return this.throw(`Cannot check ${key}, key invalid`)
    await this.start(key)
    await this.adapters[adapter][`check_${key}`](this.quick_resolve_check.bind(this))
    this.current = key
    return this.promises.get(key).promise
  } 

  quick_resolve_check(key, result){
    this.addPromise(key)
    return this.finish(key, result, this.promises.get(key).resolve)
  }

  async start(key){
    if(key !== 'connect' && !this.isConnected()) {
      await this.adapters.relay.check_connect()
      if(!this.isConnected())
        throw new Error(`Cannot check ${key}, cannot connect to relay`)
    }
    this.latency.start(key)
  }

  async finish(key, result={}, resolve){
    this.latency.finish(key)
    result[`${key}Latency`] = this.latency.duration(key)
    this.results.set(`${key}Latency`, result[`${key}Latency`])
    this.results.setMany(result)
    resolve(result)
    this.on_change()
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
    // if(Buffer.isBuffer(ev))
    //   ev = JSON.parse(buffer.toString())
    // else if(typeof ev === 'string')
    //   ev = JSON.parse(ev)
    // ev = JSON.parse(ev.toString())
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
    this.logger.warn(notice)
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
    console.log('on_ok')  
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
  
  log(adapter, key, data){
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

  getLog(key){
    return this.logdata?.[key] || false
  }

  clearLog(session){
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

  addPromise(key){
    return this.promises.add(key, this.config?.[`${key}_timeout`])
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

  async defaultAdapters(){
    if(this.adaptersInitialized) return
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

