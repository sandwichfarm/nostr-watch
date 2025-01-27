import { TorWebSocket } from './tor';
import { Buffer } from 'buffer';
import 'core-js/features/global-this';


import {
  AbstractAdapter,
  type Nocap as Base, 
  type IAdapter,
  CompatibleWebSocket,
  AdapterType
} from '@nostrwatch/nocap';

export { TorWebSocket };

class WebsocketAdapterDefault extends AbstractAdapter implements IAdapter {
  count: { event: number };
  static type: AdapterType = 'websocket';
  readonly slug: string = 'WebsocketAdapterDefault';

  constructor(parent: Base) {
    super(parent);
    this.count = { event: 0 };
  }

  initialize(): void {}

  async check_open(): Promise<void> {
    console.log('WebsocketAdapterDefault.check_open()', 'open');
    this.base?.logger?.debug(`${this.base.url}: WebsocketAdapterDefault.check_open()`);
    try {
      if (this.base.network === 'clearnet') {
        this.base.ws = new CompatibleWebSocket(this.base.url);
      } else if (this.base.network === 'tor') {
        const torSocksProxy = 'socks5h://127.0.0.1:9050';
        const agent = new (require('socks-proxy-agent')).SocksProxyAgent(torSocksProxy);
        this.base.ws = new CompatibleWebSocket(this.base.url, { agent });
      } else {
        throw new Error('Unsupported network');
      }
      await this.base.ws.ready();
      console.log('WebsocketAdapterDefault.check_open()', 'connected');
      this.bind_events();
    } catch (error) {
      console.error('Error in check_open:', error);
      throw error;
    }
  }

  async check_read(): Promise<void> {
    this.base?.logger?.debug(`${this.base.url}: WebsocketAdapterDefault.check_read()`);
    if (!this.base.isConnected()) {
      throw new Error('WebSocket is not connected');
    }
    const event = JSON.stringify(['REQ', this.base.subid('read'), { limit: 1, kinds: [1] }]);
    this.base.ws?.send(event);
  }

  async check_write(): Promise<void> {
    this.base?.logger?.debug(`${this.base.url}: WebsocketAdapterDefault.check_write()`);
    if (!this.base.isConnected()) {
      throw new Error('WebSocket is not connected');
    }
    const ev = JSON.stringify(['EVENT', this.base.config?.event_sample || this.base.SAMPLE_EVENT]);
    this.base.ws?.send(ev);
  }

  bind_events(): void {
    this.base?.logger?.debug(`${this.base.url}: WebsocketAdapterDefault.bind_events()`);
    try {
      this.base.ws?.on('open', async (e: Event) => {
        console.log('WebsocketAdapterDefault.check_open()', 'complete', this.base.subid('open'));
        this.base.on_open(e);
        this.count.event++;
      });
      this.base.ws?.on('message', (message: any) => {
        const { data } = message;
        this.handle_nostr_event(data);
      });
      this.base.ws?.on('close', (e: Event) => {
        this.base.on_close();
      });
      this.base.ws?.on('error', (error: Error) => {
        this.base.on_error(error);
      });
    } catch (e) {
      this.base?.logger?.warn(e);
    }
  }

  handle_nostr_event(message: Buffer | string): void {
    this.base?.logger?.debug(`${this.base.url}: WebsocketAdapterDefault.handle_nostr_event()`);
    let ev: any;
    try{
      const messageType = (message instanceof Buffer)? 'buffer': typeof message;
      if(messageType === 'string') {
        ev = JSON.parse(message as string);
      }
      else if(messageType === 'buffer') {
        ev = JSON.parse((message as Buffer).toString());
      }
    } catch (e) {
      console.error('json parsing failed')
      return this.base.websocket_hard_fail(this.notNip01Compat(e));
    }
    const validResponseTypes = ['EVENT', 'EOSE', 'OK', 'NOTICE', 'LIMITS', 'AUTH', 'CLOSED'];
    if(!validResponseTypes.includes(ev?.[0])) {
      console.error('event type failed', typeof ev, ev?.[0])
      return this.base.websocket_hard_fail(this.notNip01Compat(ev));
    }
    if (!ev || !(ev instanceof Array) || !ev.length) return;
    this.base?.logger?.debug(`${this.base.url}: WebsocketAdapterDefault.handle_nostr_event(): ${ev[0]}`);

    switch (ev[0]) {
      case 'EVENT':
        if (this.count.event > this.base.config.tooManyEventsLimit) {
          this.base.auditor.fail('SUBSCRIBE_LIMIT', {
            description: `Relay sent too many events. Requested 1 and received ${this.count.event}.`,
            severity: 'medium',
            impact: ['bandwidth', 'reliability'],
            domain: 'NIP-01',
          });
          this.base.handle_eose();
        }
        this.count.event++;
        if (this.base.subid('read') === ev[1]) this.base.on_event(ev[1], ev[2]);
        break;

      case 'EOSE':
        this.base.on_eose(ev[1]);
        break;

      case 'OK':
        this.base.on_ok(ev[1]);
        break;

      case 'NOTICE':
        if (this.base.current === 'write') {
          return this.base.forced_finish(this.base.current, {
            data: false,
            duration: -1,
            status: 'error',
            message: ev[1],
          });
        }
        this.base.on_notice(ev[1]);
        break;

      case 'LIMITS':
        this.base.on_limits(ev[1]);
        break;

      case 'CLOSED': 
        this.base.on_closed(ev[1], ev?.[2]);
        break;

      case 'AUTH':
        this.base.on_auth(ev[1]);
        break;

      default:
        this.base?.logger?.debug(`${this.base.url}: WebsocketAdapterDefault.handle_nostr_event(): Unknown event type ${ev[0]}`);
    }
  }

  terminate(): void {
    if (!this.base.isConnected()) return;
    this.base?.logger?.debug('WebsocketAdapterDefault.terminate()');
    this.base?.ws?.terminate();
  }

  close(): void {
    if (!this.base.isConnected()) return;
    this.base?.logger?.debug('WebsocketAdapterDefault.close()');
    this.base?.ws?.close();
  }

  notNip01Compat(e?: any): string {
    const err = `${this.base.url} is not NIP-01 compatible, responded with invalid JSON: ${e}`;
    this.base?.logger?.err(err);
    this.base.auditor.fail('INVALID_JSON', {
      description: 'Relay responded to subscription with invalid JSON.',
      severity: 'high',
      impact: ['reliability'],
      domain: 'NIP-01',
    });
    return err
  }
}

export default WebsocketAdapterDefault;
