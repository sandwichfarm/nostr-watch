// KindBase.ts
import {
  getEventHash,
} from 'nostr-tools';
import Logger from '@nostrwatch/logger';
import { IResult } from '@nostrwatch/nocap';

export abstract class Transform {
  kind: number;
  pubkey: string;
  logger: Logger;
  event: any;

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

  generateEvent(data: IResult) {
    this.event = this._generateEvent(data);
    this.event.id = getEventHash(this.event);
    return this.event;
  }

  protected _generateEvent(data: IResult) {
    let content = '{}';
    const tags = this.generateTags(data);
    const nip11 = String(data.info?.data);

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

  abstract generateTags(check: IResult): string[][];
}
