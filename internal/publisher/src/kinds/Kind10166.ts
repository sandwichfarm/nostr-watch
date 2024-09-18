import { Event, NostrEvent, NostrEventTags } from '../Event.js';
import { getEventHash } from 'nostr-tools';
import ngeotags from 'nostr-geotags';

interface GeoData {
  // Define the structure of geo data as required by ngeotags
  latitude: number;
  longitude: number;
  [key: string]: any;
}

interface Timeouts {
  [key: string]: any;
}

interface Kind10166Data {
  frequency?: string;
  // owner?: string; // Uncomment if needed
  kinds?: number[];
  counts?: number[];
  checks?: string[];
  timeouts?: Timeouts;
  geo?: GeoData;
}

export class Kind10166 extends Event {
  public kind: number;

  constructor(pubkey: string) {
    const KIND = 10166;
    super(KIND, pubkey);
    this.kind = KIND;
  }

  /**
   * Generates an event with tags based on provided data.
   * @param data The data to generate event tags from.
   * @returns The generated event.
   */
  protected _generateEvent(data: Kind10166Data): NostrEvent {
    let tags: NostrEventTags= Kind10166.generateTags(data);
    const event: NostrEvent = {
      ...this.tpl(),
      tags,
    };
    const id = getEventHash(event);
    event.id = id;
    return event;
  }

  /**
   * Generates tags based on the provided data.
   * @param data The data to generate tags from.
   * @returns An array of tags.
   */
  public static generateTags(data: Kind10166Data): NostrEventTags {
    const geoOpts: Record<string, any> = {};
    let tags: NostrEventTags = [];

    if (data.frequency) {
      tags.push(['frequency', data.frequency]);
    }

    // if (data.owner) {
    //   tags.push(['o', data.owner]);
    // }

    if (data.kinds) {
      data.kinds.map(kind => kind.toString()).forEach(kindStr => {
        tags.push(['k', kindStr]);
      });
    }

    if (data.counts) {
      data.counts.map(count => count.toString()).forEach(countStr => {
        tags.push(['n', countStr]);
      });
    }

    if (data.checks) {
      data.checks.map(check => check.toString()).forEach(checkStr => {
        tags.push(['c', checkStr]);
      });
    }

    if (data.timeouts) {
      Object.keys(data.timeouts).forEach(key => {
        const value = data.timeouts![key];
        tags.push(['timeout', key, value.toString()]);
      });
    }

    if (data.geo && typeof data.geo === 'object') {
      const geoTags = ngeotags(data.geo, geoOpts);
      tags = [...tags, ...geoTags];
    }

    return tags;
  }

  /**
   * Parses the event to extract relevant information.
   * @param event The event to parse.
   * @returns An object containing parsed data.
   */
  public parse(event: NostrEvent): { relays: string[] } {
    return {
      relays: event.tags
        .filter(tag => tag[0] === 'r')
        .map(tag => String(tag[1])),
    };
  }
}
