import Logger from '@nostrwatch/logger';
import { verifyEvent } from 'nostr-tools/pure';
import { SimplePool } from 'nostr-tools';

interface Config {
  wsAdapter?: any;
  wsConf?: any;
}

export class Publisher {
  event: any = null;
  pubkey: string;
  logger: Logger;
  relays: string[];
  ws: any;
  pool = new SimplePool();

  constructor(pubkey: string, relays: string[], config: Config = {}) {
    this.logger = new Logger(`@nostrwatch/publisher: ${pubkey}`);
    this.pubkey = pubkey;
    this.relays = relays;
  }

  async publishEvent(signedEvent: any): Promise<any[]> {
    return Promise.any(this.pool.publish(this.relays, signedEvent))
      .then((publish: any) => {
        return publish;
      })
      .catch((err: any) => {
        console.log('err', err)
        return [];
      })
  }

  async publishEvents(signedEvents: AsyncIterable<any>): Promise<any[]> {
    const publishes = [];
    for await (const signedEvent of signedEvents) {
      const pub = await this.publishEvent(signedEvent);
      publishes.push(pub);
    }
    return publishes;
  }
}


