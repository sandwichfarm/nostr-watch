import { finalizeEvent } from "nostr-tools/pure";
import { verifyEvent } from "nostr-tools/pure";
import { hexToBytes } from "@noble/hashes/utils";

export type NostrEventTags = string[][]

export interface NostrEvent {
  id?: string;
  signature?: string;
  tags: NostrEventTags;
  content: string;
  pubkey: string;
  kind: number;
  created_at: number;
}

export class Event {
  public kind: number = 0;
  public pubkey: string = '';
  private event?: NostrEvent | undefined;

  constructor(kind: number, pubkey: string) {
    this.kind = kind;
    this.pubkey = pubkey;
  }

  async signEvent(sk: string): Promise<any> {
    if(!this?.event) {
      console.warn('Event not generated');
      return;
    }
    const signed = finalizeEvent(this.event, hexToBytes(sk));
    if(verifyEvent(signed)) {
      return signed;
    }
    throw new Error('Failed to sign event');
  }

  protected _generateEvent(data: any): NostrEvent { 
    console.error('no implementation for _generateEvent');
    return this.tpl(data) 
  }

  generateEvent(data: any): NostrEvent {
    this.event = this._generateEvent(data);
    return this.event;
  }

  tpl(data?: NostrEvent): NostrEvent {
    const pubkey = this.pubkey ?? "";
    const kind = this.kind ?? 0;
    const created_at = data?.created_at ?? Math.round(Date.now() / 1000)
    const content = data?.content ?? '';
    const tags = data?.tags ?? [];

    return { pubkey, kind, created_at, tags, content };
  }
}