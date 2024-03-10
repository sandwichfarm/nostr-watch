import { Publisher } from '../Publisher.js';
import ngeotags from 'nostr-geotags';

/**
 * Represents a specific kind of publisher with additional tagging capabilities.
 */
export class Kind10166 extends Publisher {
  constructor() {
    super();
    /** @type {number} The kind identifier. */
    this.kind = 10166;
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
    if(data?.owner)
      tags.push(['o', data.owner]);
    if(data?.kinds)
      data?.kinds.map(kind => kind.toString()).forEach(kind => tags.push(["k", kind]));
    if(data?.counts)
      data?.counts.map(count => count.toString()).forEach(count => tags.push(["n", count]));
    if(data?.checks)
      data?.checks.map(check => check.toString()).forEach(check => tags.push(["c", check]));
    if(data?.timeouts)
      Object.keys(data?.timeouts || []).map(key => [ key, data.timeouts[key] ]).forEach(timeout => tags.push([ "timeout", timeout[0], timeout[1].toString() ] ));
    if(data?.geo && data.geo instanceof Object) 
      tags = [...tags, ...ngeotags(data.geo, geoOpts)];
    // console.dir(tags)
    return tags;
  }
}
