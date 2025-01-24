// KindBase.ts
import {
  getEventHash,
} from 'nostr-tools';
import Logger from '@nostrwatch/logger';
import { type IResult } from '@nostrwatch/nocap';


export interface ITransform {
  generateEvent(data: IResult): any;
  generateTags(data: IResult): string[][];
  dedupLabels(tags: string[][]): string[][];
  removeLabels(tags: string[][]): string[][];
}

export abstract class Transform {
  logger: Logger;
  event: any;

  constructor(public kind: number, public pubkey: string) {
    if (!kind) {
      throw new Error('Kind must be defined');
    }
    if (!pubkey) {
      throw new Error('DAEMON_PUBKEY must be defined');
    }
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

  dedupLabels(tags: string[][]) {
    const labels = new Set();
    let deduped = tags.filter((tag) => {
      if (tag[0] === 'L') {
        if (labels.has(tag[1])) {
          return false;
        }
        labels.add(tag[1]);
      }
      return true;
    });

    const lTags = new Map();
    deduped.forEach((tag) => {
      if (tag[0] === 'l') {
        const label = tag[2];
        const value = tag[1];
        if (!lTags.has(label)) {
          lTags.set(label, new Set());
        }
        const labelMap = lTags.get(label)
        if (labelMap.has(value)) {
          return;
        }
        labelMap.add(value);
        lTags.set(label, labelMap);
      }
    });

    deduped = deduped.filter( tag => tag[0] !== 'l');

    deduped.push(
      ...Array.from(lTags.entries()).flatMap(([key, values]) => {
        return Array.from(values).map((value) => ['l', value, key]);
      })
    );

    return deduped;
  }

  removeLabels(tags: string[][]) {
    const labels = new Set();
    return tags.filter((tag) => {
      if (tag[0] === 'L' || tag[0] === 'l') {
        return false
      }
      return true;
    });
  }
    

  generateEvent(data: IResult) {
    this.event = this._generateEvent(data);
    this.event.id = getEventHash(this.event);
    return this.event;
  }

  protected _generateEvent(data: IResult) {
    let content = '{}';
    const tags = this.generateTags(data);
    const nip11 = data?.info?.data;

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
