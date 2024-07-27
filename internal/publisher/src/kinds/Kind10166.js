import { getEventHash } from 'nostr-tools';
import { Publisher } from '../Publisher.js';
import ngeotags from 'nostr-geotags';

/**
 * Represents a specific kind of publisher with additional tagging capabilities.
 */
export class Kind10166 extends Publisher {
  constructor() {
    const KIND = 10166;
    super(KIND);
    this.kind = KIND;
  }

  /**
   * Generates an event with tags based on provided data.
   * @param {Object} data The data to generate event tags from.
   * @returns {Object} The generated event.
   */
  generateEvent(data) {
    let tags = Kind10166.generateTags(data);
    const event = {
      ...this.tpl(),
      tags
    };
    let id = getEventHash(event)
    event.id = id
    return event;
  }

  /**
   * Generates tags from provided data, including geolocation tags if present.
   * @param {Object} data The data to generate tags from.
   * @returns {Array<Array<string|number>>} The generated tags.
   */
  static generateTags(data) {
    const geoOpts = {};
    let tags = [];
    if(data?.frequency)
      tags.push(['frequency', data.frequency]);
    // if(data?.owner)
    //   tags.push(['o', data.owner]);
    if(data?.kinds)
      data?.kinds.map(kind => kind.toString()).forEach(kind => tags.push(["k", kind]));
    if(data?.counts)
      data?.counts.map(count => count.toString()).forEach(count => tags.push(["n", count]));
    if(data?.checks)
      data?.checks.map(check => check.toString()).forEach(check => tags.push(["c", check]));
    if(data?.timeouts)
      Object.keys(data?.timeouts || []).map(key => [ key, data.timeouts[key] ]).forEach(timeout => tags.push([ "timeout", timeout[0], timeout[1].toString() ] ));
    // if(data?.geo && data.geo instanceof Object) 
    //   tags = [...tags, ...ngeotags(data.geo, geoOpts)];
    return tags;
  }

  static parse(event){
    return {
      frequency: event.tags.find(tag => tag[0] === 'frequency')?.[1],
      owner: event.tags.find(tag => tag[0] === 'o')?.[1],
      kinds: event.tags.filter(tag => tag[0] === 'k').map(tag => tag[1]),
      counts: event.tags.filter(tag => tag[0] === 'n').map(tag => tag[1]),
      checks: event.tags.filter(tag => tag[0] === 'c').map(tag => tag[1]),
      timeouts: event.tags.filter(tag => tag[0] === 'timeout').reduce((acc, tag) => { acc[tag[1]] = parseInt(tag[2]); return acc; }, {}),
      geo: ngeotags.parse(event.tags)
    }
  }

}
