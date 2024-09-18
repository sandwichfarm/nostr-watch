import relaycache from '@nostrwatch/nwcache';
import { capitalize } from '@nostrwatch/utils';

interface RetryCache {
  get: (key: string) => Promise<number | null>;
  set: (key: string, value: number) => Promise<string | null>;
  increment: (key: string) => Promise<string | null>;
}

interface RelayCache {
  retry: RetryCache;
}

export class RetryManager {
  caller: string;
  config: any;
  retries: any[];
  rcache: RelayCache;
  log?: { info: (msg: string) => void };

  constructor(caller: string, config?: any, rcache?: RelayCache) {
    if (!caller) throw new Error('caller is required');
    this.caller = caller;
    this.config = config || {};
    this.retries = [];
    this.rcache = rcache!;
  }

  cacheId(url: string): string {
    return `${capitalize(this.caller)}:${url}`;
  }

  expiry(retries: number | null): number {
    if (retries === null) return 0;
    let map;
    if (this.config?.expiry && Array.isArray(this.config.expiry)) {
      map = this.config.expiry.map((entry: { max: number; delay: string }) => {
        return { max: entry.max, delay: parseInt(eval(entry.delay)) };
      });
    } else {
      map = [
        { max: 3, delay: 1000 * 60 * 60 },
        { max: 6, delay: 1000 * 60 * 60 * 24 },
        { max: 13, delay: 1000 * 60 * 60 * 24 * 7 },
        { max: 17, delay: 1000 * 60 * 60 * 24 * 28 },
        { max: 29, delay: 1000 * 60 * 60 * 24 * 90 },
      ];
    }
    const found = map.find((entry: { max: number; delay: number }) => retries <= entry.max);
    return found ? found.delay : map[map.length - 1].delay;
  }

  getRetries(url: string): Promise<number | null> {
    return this.rcache.retry.get(this.cacheId(url));
  }

  getExpiry(url: string): Promise<number> {
    return this.getRetries(url).then((retries) => this.expiry(retries));
  }

  async setRetries(url: string, success: boolean): Promise<string | null> {
    let id: string | null;
    if (success) {
      this.log?.info(`${url} did not require a retry`);
      id = await this.rcache.retry.set(this.cacheId(url), 0);
    } else {
      this.log?.info(`${url} required a retry`);
      id = await this.rcache.retry.increment(this.cacheId(url));
    }
    return id;
  }
}
