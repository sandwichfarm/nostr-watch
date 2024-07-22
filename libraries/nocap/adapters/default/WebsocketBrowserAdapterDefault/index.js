// import WebSocketNode from 'ws';
// import "websocket-polyfill";
// import { WebsocketTor } from 'ws-tor'

class WebsocketAdapterDefault {

  constructor(parent){
    this.$ = parent
  }

  /**
   * check_open 
   * Returns a promise that resolves to the result of the connection check, called by Base.checkConnect
   * @private
   * @returns promise<result?>
   */
  async check_open(deferred){
    console.log('check_open')
    try {
      this.$.set('ws', new WebSocket(this.$.url));
      this.bind_events();
      return deferred;
    } catch (error) {
      console.error('Error in check_open:', error);
      throw error; // Rethrow the error or handle it appropriately
    }
  }

  /**
   * check_read
   * Returns a promise that resolves to the result of the read check, called by Base.checkRead
   * @private
   * @returns promise<result?>
   */
  async check_read() {
    if (!this.isConnected()) {
      throw new Error('WebSocket is not connected');
    }

    let event = JSON.stringify(['REQ', this.$.subid('read'), { limit: 1, kinds: [1] }]);
    this.$.ws.send(event);
  }
  
  /**
   * check_write
   * Returns a promise that resolves to the result of the write check, called by Base.checkWrite
   * @private
   * @returns promise<result?>
   */
  async check_write() {
    if (!this.isConnected()) {
      throw new Error('WebSocket is not connected');
    }

    this.$.logger.debug(`check_write()`);
    const ev = JSON.stringify(['EVENT', this.config?.event_sample || this.$.SAMPLE_EVENT]);
    this.$.ws.send(ev);
  }

  /**
   * bind_events 
   * Binds event handlers to the WebSocket instance
   * 
   * @private
   * @returns null
   */ 
  bind_events(){
    try { 
      this.$.ws.addEventListener("open", (e) => this.$.on_open(e))
      this.$.ws.addEventListener("message", (ev) => this.handle_nostr_event(ev))
      this.$.ws.addEventListener("close", (e) => this.$.on_close(e))
      this.$.ws.addEventListener("error", (...args) => this.$.on_error(...args))
    }
    catch(e) {
      this.$.logger.warn(e)
    }
  }

  /**
   * handle_nostr_events
   * Handler for special nostr events called bound to Standard WebSocket event 'event'
   * @private
   * @returns null
   */
  handle_nostr_event(buffer){
    let ev 
    try{
      ev = JSON.parse(buffer.toString())
    } 
    catch(e){
      const err = `${this.$.url} is not NIP-01 compatible, responded with invalid JSON: ${e}`
      this.$.logger.err(err)
      return this.$.websocket_hard_fail(err)
    }
    if(!ev || !(ev instanceof Array) || !ev.length) return
    if(ev[0] === 'EVENT') {
      if(this.$.subid('read') === ev[1])
        this.$.on_event(ev[1], ev[2])
    }
    if(ev[0] === 'EOSE') {
      this.$.on_eose(ev[1])
    }
    if(ev[0] === 'OK') {
      this.$.on_ok(ev[1])
    }
    if(ev[0] === 'NOTICE') {
      this.$.on_notice(ev[1])
    }
    if(ev[0] === 'AUTH') {
      this.$.on_auth(ev[1])
    }
  }

  close(){
    if(!this.isConnected())
      return
    this.$.ws.close()
  }
  /* 
    since this adapter uses `ws` library, these methods are handled by base class 
    and do not need to be implemented in adapter.
  */
  //  unsubscribe(subid) {
  //   this.$.ws.send(['CLOSE', subid])
  // }
  isConnected() {
    this.ws?.readyState && this.ws.readyState === WebSocket.OPEN ? true : false
  }
  isConnecting() {
    this.ws?.readyState && this.ws.readyState === WebSocket.CONNECTING ? true : false
  }
  isClosing() {
    this.ws?.readyState && this.ws.readyState === WebSocket.CLOSING ? true : false
  }
  isClosed() {
    this.ws?.readyState && this.ws.readyState === WebSocket.CLOSED ? true : false
  }

}

export default WebsocketAdapterDefault