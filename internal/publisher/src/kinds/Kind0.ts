import { Event, NostrEvent } from '../Event.js';

export class Kind0 extends Event {
  public kind: number;

  constructor(pubkey: string) {
    const KIND = 0;
    super(KIND, pubkey);
    this.kind = KIND;
  }

  protected _generateEvent(data: any): NostrEvent {
    const tags: any[] = [];
    const content: string = Kind0.generateContent(data);

    const event: NostrEvent = {
      ...this.tpl(),
      content,
      tags,
    };

    return event;
  }

  public static generateContent(data: any): string {
    let content = "";
    try {
      content = JSON.stringify(data);
    } catch (e) {
      console.dir(`Kind0::generateContent(): Error: ${e}`);
      throw new Error('Was not able to stringify data for kind 0 content field.');
    }
    if (!content) {
      content = "{}";
    }
    return content;
  }

  public static parse(event: { content: string }): any {
    return JSON.parse(event.content);
  }
}
