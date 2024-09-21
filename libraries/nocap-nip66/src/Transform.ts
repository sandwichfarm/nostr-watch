// KindBase.ts
import {
  getEventHash,
} from 'nostr-tools';
import Logger from '@nostrwatch/logger';

export interface GeoData {
  isp?: string;
  as?: string;
  asname?: string;
  [key: string]: any;
}

export interface CheckData {
  url: string;
  info?: { data?: any };
  ssl?: { data?: any };
  dns?: { data?: any };
  geo?: { data?: any[] };
  open?: { duration?: number };
  read?: { duration?: number };
  write?: { duration?: number };
  network?: string;
  [key: string]: any;
}

export abstract class Transform {
  kind: number;
  pubkey: string;
  logger: Logger;
  event: any;
  discoverable: { tags: string[] };
  human_readable: boolean;
  machine_readable: boolean;

  constructor(kind: number, pubkey: string) {
    if (typeof kind === 'undefined' || kind === null) {
      throw new Error('Kind must be defined');
    }
    if (!pubkey) {
      throw new Error('DAEMON_PUBKEY must be defined');
    }
    this.kind = kind;
    this.pubkey = pubkey;
    this.logger = new Logger(`@nostrwatch/publisher/event: ${kind}`);
    this.discoverable = { tags: ['d', 'n', 'l', 'N', 's', 't', 'R'] };
    this.human_readable = false;
    this.machine_readable = true;
  }

  tpl(data?: any) {
    const id = null;
    const pubkey = this.pubkey;
    const kind = this.kind;
    const created_at = data?.checked_at
      ? data.checked_at
      : Math.round(Date.now() / 1000);
    const content = data?.content ?? '';
    const tags = data?.tags ?? [];

    return { id, pubkey, kind, created_at, tags, content };
  }

  json() {
    return this.event;
  }

  generateEvent(data: CheckData) {
    this.event = this._generateEvent(data);
    this.event.id = getEventHash(this.event);
    return this.event;
  }

  protected _generateEvent(data: CheckData) {
    let content = '{}';
    const tags = this.generateTags(data);
    const nip11 = data.info?.data;

    if (nip11) {
      try {
        content = JSON.stringify(nip11);
      } catch (e) {
        this.logger.err(`generateEvent(): Error: ${e}`);
        this.logger.info(nip11);
      }
    }

    return {
      ...this.tpl(),
      content,
      tags,
    };
  }

  abstract generateTags(check: CheckData): string[][];

  dedupLabels(tags: string[][]): string[][] {
    const dedupedTags: string[][] = [];
    const keys: Map<string, Set<string>> = new Map();

    tags.forEach((item) => {
      if (item[0] === 'L') {
        const key = item[1];
        if (!keys.has(key)) {
          keys.set(key, new Set());
          dedupedTags.push(item);
        }
      } else if (item[0] === 'l') {
        const key = item[2];
        const value = item[1];
        if (keys.has(key) && !keys.get(key)!.has(value)) {
          keys.get(key)!.add(value);
          dedupedTags.push(item);
        }
      } else {
        dedupedTags.push(item);
      }
    });

    return dedupedTags;
  }

  removeLabels(tags: string[][]): string[][] {
    return tags.filter((t) => t[0] !== 'l' && t[0] !== 'L');
  }
}
