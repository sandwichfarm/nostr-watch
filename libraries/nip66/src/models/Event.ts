export type IEvent = {
  id: string;
  pubkey: string;
  kind: number;
  tags: string[][];
  content: string;
  signature: string;
  created_at: number | null;
}

export class NostrEvent implements IEvent{
  protected _json: IEvent;

  constructor(event: IEvent) {
    this._json = event;
  }

  get id(): string {
    return this.json.id;
  }

  get pubkey(): string {
    return this.json.pubkey;
  }

  get kind(): number {
    return this.json.kind;
  }

  get tags(): string[][] {
    return this.json.tags;
  }

  set tags(tags: string[][]) {
    this.json.tags = tags;
  }

  get content(): string {
    return this.json.content;
  }

  get signature(): string {
    return this.json.signature;
  }

  get created_at(): number | null {
    return this.json.created_at;
  }

  get json(): IEvent {
    return this._json;
  }
}

export type NostrTag = string[];