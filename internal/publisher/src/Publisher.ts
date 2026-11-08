import Logger from '@nostrwatch/logger';
import { SimplePool, utils } from 'nostr-tools';
import type { PublishTransport } from './transport.js';

interface Config {
  wsAdapter?: any;
  wsConf?: any;
  transport?: PublishTransport;
}

export class Publisher {
  event: any = null;
  pubkey: string;
  logger: Logger;
  public relays: string[];
  ws: any;
  pool: SimplePool;
  private transport?: PublishTransport;
  private pendingPublishes = new Set<Promise<unknown>>();
  private closePromise: Promise<void> | undefined;

  constructor(pubkey: string, relays: string[], config: Config = {}) {
    this.logger = new Logger(`@nostrwatch/publisher: ${pubkey}`);
    this.pubkey = pubkey;
    this.relays = relays;
    this.transport = config.transport;
    // Do not construct an in-process SDK pool for an injected transport.
    this.pool = config.transport ? undefined as unknown as SimplePool : new SimplePool();
  }

  async publishEvent(signedEvent: any): Promise<any> {
    if (this.closePromise) throw new Error("Publisher is closed");
    // SimplePool.publish in nostr-tools 2.23.3 fulfills connection failures with
    // a string. Only Relay.publish's positive OK may count as an ACK here.
    // New SDKs require an explicit connection timeout; older ones own their
    // default on the relay instead.
    const connectionTimeout = this.pool && 'maxWaitForConnection' in this.pool
      ? this.pool.maxWaitForConnection as number
      : undefined;
    const relays = [...new Set(this.relays.map(utils.normalizeURL))];
    // Attach .catch() to each individual relay promise so that rejections from
    // closed connections (e.g. SendingOnClosedConnection) don't leak as unhandled.
    const promises = relays.map(url =>
      Promise.resolve().then(() => this.transport
        ? this.transport.publish(url, signedEvent)
        : this.pool.ensureRelay(url, { connectionTimeout })
          .then(relay => relay.publish(signedEvent)))
        .catch((err: any) => {
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
      .then(async () => {
        if (this.transport) await this.transport.release();
        else this.pool.close(this.relays);
      });
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


