import { Event, NostrEvent, NostrEventTags } from '../Event.js';

interface RelayTags {
  relays: string[];
}

export class Kind10002 extends Event {
  public kind: number;
  public discoverable: { pubkey: boolean };
  public human_readable: boolean;
  public machine_readable: boolean;

  constructor(pubkey: string) {
    const KIND = 10002;
    super(KIND, pubkey);
    this.kind = KIND;
    this.discoverable = { pubkey: true };
    this.human_readable = false;
    this.machine_readable = true;
  }

  protected _generateEvent(relays: string[]): NostrEvent {
    const tags: NostrEventTags = Kind10002.generateTags(relays);
    const event: NostrEvent = {
      ...this.tpl(),
      tags,
    };
    return event;
  }

  public static generateTags(relays: string[]): NostrEventTags {
    if (!(relays instanceof Array)) {
      throw new Error("kind10002: generateTags(relays): relays should be an array");
    }
    const tags: Array<[string, string]> = relays.map(relay => ['r', relay]);
    return tags;
  }

  public parse(event: { tags: NostrEventTags }): RelayTags {
    return {
      relays: event.tags
        .filter(tag => tag[0] === 'r')
        .map(tag => tag[1] as string),
    };
  }
}
