/**
 * Hooks 
 * @class
 * @classdesc Base mixin that adds hooks to the Check class
 * @mixes Base
 * @param {class} Base - The base class to mix into
 * @returns {class} - The mixed class
 */
export const Hooks = (Base) => class extends Base {
  
  // constructor(){}
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
    this?.handle_open(e)
    this.handle_connect_check(e)
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
  on_event(subid, event){
    this.cbcall('note', subid, event)
    this?.handle_event(subid, event)
    this.handle_read_check(e)
  }

  /**
   * on_notice
   * Special Nostr event triggered by Adapter 
   * 
   * @private
   * @returns null
   */
  on_notice(notice){
    this.cbcall('notice')
    this?.handle_notice(notice)
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
    this.handle_write_check(eose)
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
    this?.handle_change()
  }

  /**
   * handle_connect
   * Implementation specific handler triggered by Hooks proxy-handler
   * @private
   * @returns null
   */ 
  handle_connect_check(){
    const result = { connect: true }
    this.finish('connect', this.promises.get('connect').resolve)
  }

  /**
   * handle_read 
   * Implementation specific handler triggered by Hooks proxy-handler
   * @private
   * @returns null
   */ 
  handle_read_check(event){
    const result = { read: true }
    this.finish('read', this.promises.get('read').resolve)
  }

  /**
   * handle_write 
   * Implementation specific handler triggered by Hooks proxy-handler
   * @private
   * @returns null
   */
  handle_write_check(){
    const result = { write: true }
    this.finish('write', result, this.promises.get('write').resolve)
  }

  /**
   * handle_on
   * Nostr handler called by Hook proxy-handler
   * @private
   * @returns null
   */
  handle_ok(ok){
    
  }

  handle_eose(eose){
    
  }

  /**
   * handle_close 
   * Handler called by Hook proxy-handler from Standard WebSocket event
   * @private
   * @returns null
   */ 
  handle_close(){
    // const result = { closed_at: Date.now().time(), connected: false }
    this.log('hook', 'close', result)
    // this.finish('duration', result)
  }  
}