import "websocket-polyfill";
import WebSocket from 'ws';
// import { WebsocketTor } from 'ws-tor'
import Nocap from "../../../src/classes/Base.ts";  // Adjust the path as needed to properly import Nocap

interface Deferred {
  resolve: (value?: any) => void;
  reject: (reason?: any) => void;
}

class WebsocketAdapterDefault {
  private $: Nocap;

  constructor(parent: Nocap) {
    this.$ = parent;
  }

  /**
   * Establishes a WebSocket connection to the provided URL and binds event handlers.
   * @param deferred Deferred object to handle connection outcome.
   */
  async check_open(deferred: Deferred): Promise<Deferred> {
    let $ws: WebSocket;

    // Uncomment and use if WebsocketTor needs to be integrated
    // if (this.$.results.network === 'tor') {
    //   $ws = new WebsocketTor(this.$.url, {
    //     socksHost: this.$.config?.tor?.host,
    //     socksPort: this.$.config?.tor?.port
    //   });
    // } else {
    $ws = new WebSocket(this.$.url);
    
    this.$.set('ws', $ws);
    this.bind_events();
    return deferred;
  }

  /**
   * Simulates a read operation over the WebSocket connection.
   */
  async check_read(): Promise<void> {
    const event = JSON.stringify(['REQ', this.$.subid('read'), { limit: 1, kinds: [1] }]);
    this.$.ws.send(event);
  }
  
  /**
   * Simulates a write operation over the WebSocket connection.
   */
  async check_write(): Promise<void> {
    this.$.logger.debug(`check_write()`);
    const ev = JSON.stringify(['EVENT', this.$.config?.event_sample || this.$.SAMPLE_EVENT]);
    this.$.ws.send(ev);
  }

  /**
   * Binds WebSocket event handlers.
   */
  private bind_events(): void {
    this.$.ws.on('open', (e: any) => this.$.on_open(e));
    this.$.ws.on('message', (ev: any) => this.handle_nostr_event(ev));
    this.$.ws.on('close', (e: any) => this.$.on_close(e));
    this.$.ws.on('error', (...args: any[]) => this.$.on_error(...args));
  }

  /**
   * Processes Nostr protocol events.
   * @param buffer Data received from the WebSocket.
   */
  private handle_nostr_event(buffer: WebSocket.Data): void {
    let ev: any;
    try {
      ev = JSON.parse(buffer.toString());
    } catch (e) {
      const err = `${this.$.url} is not NIP-01 compatible, responded with invalid JSON: ${e}`;
      this.$.logger.error(err);
      return this.$.websocket_hard_fail(err);
    }
    
    if (!ev || !(ev instanceof Array) || !ev.length) return;
    
    const action = ev[0];
    switch (action) {
      case 'EVENT':
        if (this.$.subid('read') === ev[1]) {
          this.$.on_event(ev[1], ev[2]);
        }
        break;
      case 'EOSE':
        this.$.on_eose(ev[1]);
        break;
      case 'OK':
        this.$.on_ok(ev[1]);
        break;
      case 'NOTICE':
        this.$.on_notice(ev[1]);
        break;
      case 'AUTH':
        this.$.on_auth(ev[1]);
        break;
      default:
        break;
    }
  }

  // Further WebSocket utilities methods can be uncommented and used as necessary
}

export default WebsocketAdapterDefault;
