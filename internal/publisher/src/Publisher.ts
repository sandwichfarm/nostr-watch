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
  public relays: string[];
  ws: any;
  pool = new SimplePool();
  private pendingPublishes = new Set<Promise<unknown>>();
  private closePromise: Promise<void> | undefined;

  constructor(pubkey: string, relays: string[], config: Config = {}) {
    this.logger = new Logger(`@nostrwatch/publisher: ${pubkey}`);
    this.pubkey = pubkey;
    this.relays = relays;
  }

  async publishEvent(signedEvent: any): Promise<any> {
    if (this.closePromise) throw new Error("Publisher is closed");
    // Attach .catch() to each individual relay promise so that rejections from
    // closed connections (e.g. SendingOnClosedConnection) don't leak as unhandled.
    const promises = this.pool.publish(this.relays, signedEvent).map(p =>
      p.catch((err: any) => {
        this.logger.warn(`Publish to relay failed: ${err?.message || err}`);
        throw err; // re-throw so Promise.any still sees it as rejected
      })
    );
    for (const promise of promises) {
      this.pendingPublishes.add(promise);
      // Observe both outcomes without introducing an unhandled rejected promise.
      promise.then(
        () => this.pendingPublishes.delete(promise),
        () => this.pendingPublishes.delete(promise),
      );
    }
    return Promise.any(promises)
      .catch((err: any) => {
        this.logger.error(`All publish relays failed: ${err?.message || err}`);
        throw err;
      });
  }

  /** Release an owned pool after all relay ACKs/rejections/timeouts settle.
   * publishEvent resolves on the first ACK, so closing immediately afterwards
   * would cancel delivery to slower relays. Shared publishers stay open until
   * their owner explicitly closes them.
   */
  close(): Promise<void> {
    return this.closePromise ??= Promise.allSettled([...this.pendingPublishes])
      .then(() => { this.pool.close(this.relays); });
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


