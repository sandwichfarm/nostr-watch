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

  constructor(kind: number, pubkey: string) {
    this.kind = kind;
    this.pubkey = pubkey;
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