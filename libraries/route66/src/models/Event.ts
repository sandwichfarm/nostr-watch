import { isPRE, isRE } from "@base/utils";
import { zapSum, zapSumNum } from "@base/utils/nostr";
import { nip19 } from "nostr-tools";

export enum Kinds {
  Note = 1,
  Comment = 1111,
  Reaction = 7,
  ReactionUri = 17,
  ZapReciept = 9725,

  RelayCheck = 30166,
  RelayMonitorRegistration = 10166,

  Wiki = 30818
}


export type NostrTag = string[];

export const SOURCE: unique symbol = Symbol('SOURCE');

export type IEvent = {
  id: string;
  pubkey: string;
  kind: number;
  tags: string[][];
  content: string;
  signature: string;
  created_at: number | null;
  [SOURCE]?: string; 
}

export type NostrEventOptions = {
  relays: string[];
}

export type NostrEventRelatives = {
  zaps: NostrEvent[],
  comments: NostrEvent[],
  reactions: NostrEvent[]
}

export const defaultNostrEventOptions: NostrEventOptions = { relays: [] };

export class NostrEvent implements IEvent {
  protected _json: IEvent;
  protected _options: NostrEventOptions;
  private _relatives: NostrEventRelatives = {
    zaps: [],
    comments: [],
    reactions: []
  };

  constructor(event: IEvent, options?: NostrEventOptions) {
    this._json = event;
    this._options = options || defaultNostrEventOptions;
  }

  get isComment(): boolean {
    return this.kind === 1 && this.tags.some((tag: string[]) => tag[0] === 'e');
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

  get relays(): string[] {
    return this._options.relays;
  }

  get reference(): `naddr1${string}` | `nevent1${string}` {
    if(isPRE(this.json) || isRE(this.json)) {
      return this.naddr
    }
    else {
      return this.nevent
    }
  }

  get naddr() {
    const { pubkey, kind, relays } = this;
    const identifier = this.tags.find((tag: string[]) => tag[0] === 'd')?.[1];
    if(!identifier) throw new Error('No identifier found in event tags');
    const pointer: nip19.AddressPointer = { identifier, pubkey, kind, relays }
    return nip19.naddrEncode(pointer);
  }

  get nevent() {
    const pointer: nip19.EventPointer = {
      id: this.id,
      relays: this.relays,
      author: this.pubkey,
      kind: this.kind
    }
    return nip19.neventEncode(pointer);
  }

  get nnote() {
    return nip19.noteEncode(this.id);
  }

  get zaps() {
    return this._relatives.zaps;
  }

  get comments() {
    return this._relatives.comments;
  }

  get commentsCount(): number {
    return this._relatives.comments.length;
  }

  get reactions() {
    return this._relatives.reactions;
  }

  get reactionsCount(): number {  
    return this._relatives.reactions.length;
  }

  get zapSum(): string {
    return zapSum(this.zaps);
  }

  get zapSumNum(): number {
    return zapSumNum(this.zaps);
  }

  // addRelatives(events: IEvent[]): void {
  //   events.forEach(event => this.addRelative(event))
  // }

  // addRelative(event: IEvent): any {
  //   const type = relativesKindMap?.[event.kind]
  //   if(!type) return;
  //   const model = relativesModelMap?.[type];
  //   if(!model) return;
  //   const instance = new model(event)
  //   this._relatives[ relativesKindMap[event.kind] ].push( instance );
  //   return instance
  // }
}

// export const relativesKindMap: Record<number, keyof NostrEventRelatives>  = {
//   1: 'comments',
//   1111: 'comments',
//   7: 'reactions',
//   9725: 'zaps'
// }

// export const relativesModelMap: Record<keyof NostrEventRelatives, any> = {
//   comments: NostrEvent,
//   reactions: NostrEvent,
//   zaps: NostrEvent
// }



