import WebSocket from 'ws';
import { WebsocketTor } from 'ws-tor'

class WebsocketAdapterDefault {

  constructor(parent){
    this.$ = parent
  }

  /**
   * check_connect 
   * Returns a promise that resolves to the result of the connection check, called by Base.checkConnect
   * @private
   * @returns promise<result?>
   */
  async check_connect(deferred){
    let $ws

    if(this.$.results.network === 'tor') 
      $ws = new WebsocketTor(this.$.url, { socksHost: this.$.config?.tor?.host, socksPort: this.$.config?.tor?.port })
    else
      $ws = new WebSocket(this.$.url)
    
    this.$.set('ws', $ws)
    this.bind_events()
    return deferred
  }

  /**
   * check_read
   * Returns a promise that resolves to the result of the read check, called by Base.checkRead
   * @private
   * @returns promise<result?>
   */
  async check_read(){
    let event = JSON.stringify(['REQ', this.$.subid('read'), { limit: 1, kinds: [1] }])
    this.$.ws.send(event)
  }
  
  /**
   * check_write
   * Returns a promise that resolves to the result of the write check, called by Base.checkWrite
   * @private
   * @returns promise<result?>
   */
  async check_write(){
    const ev = JSON.stringify(['EVENT', this.config?.event_sample || this.$.SAMPLE_EVENT])
    this.$.ws.send(ev)
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
      this.$.ws.on('open', (e) => this.$.on_open(e))
      this.$.ws.on('message', (ev) => this.handle_nostr_event(ev))
      this.$.ws.on('close', (e) => this.$.on_close(e))
      this.$.ws.on('error', (...args) => this.$.on_error(...args))
    }
    catch(e) {
      this.$.log.warn(e)
    }
  }

  /**
   * handle_nostr_events
   * Handler for special nostr events called bound to Standard WebSocket event 'event'
   * @private
   * @returns null
   */
  handle_nostr_event(buffer){
    const ev = JSON.parse(buffer.toString())
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
}

export default WebsocketAdapterDefault