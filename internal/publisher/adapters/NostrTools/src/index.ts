import { SimplePool } from 'nostr-tools';

export default class WsAdapter {
  relays: string[];
  pool: SimplePool;

  constructor(relays: string[], config?: any) {
    this.relays = relays;
    this.pool = new SimplePool();
  }

  async publish(signedEvent: any): Promise<any> {
    return this.pool.publish(this.relays, signedEvent);
  }
}