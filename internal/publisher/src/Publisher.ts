// src/Publisher.ts
import Logger from '@nostrwatch/logger';
import { isClassInstance } from '@nostrwatch/utils';

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

  constructor(pubkey: string, relays: string[], config: Config = {}) {
    this.logger = new Logger(`@nostrwatch/publisher: ${pubkey}`);
    this.pubkey = pubkey;
    this.relays = relays;
    if(!config?.wsAdapter) {
      import('@nostrwatch/publisher-nostrtools').then((m) => {
        config.wsAdapter = m.default
        new config.wsAdapter(relays, config?.wsConf || {})
      });
    } else {
      this.ws = isClassInstance(config?.wsAdapter) ? config?.wsAdapter : new config.wsAdapter(relays, config?.wsConf || {});
    }
  }

  async publishEvent(signedEvent: any): Promise<any> {
    return this.ws.publish(signedEvent).catch((e: any) => {
      this.logger.warn(`Publisher::publishEvent(): Error: ${e}`);
    });
  }

  async publishEvents(signedEvents: AsyncIterable<any>): Promise<any[]> {
    const publishes = [];
    for await (const signedEvent of signedEvents) {
      const pub = await this.publishEvent(signedEvent).catch(this.logger.warn);
      publishes.push(pub);
    }
    return publishes;
  }
}