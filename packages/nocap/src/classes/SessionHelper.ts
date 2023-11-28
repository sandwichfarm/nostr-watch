import murmurhash from 'murmurhash';
import { random } from '../utils.js';

interface IdMap {
  [key: string]: number; // Assuming murmurhash returns a number
}

export class SessionHelper {
  private salt: number;
  private id: IdMap;

  constructor() {
    this.init();
  }

  init(): IdMap {
    this.salt = murmurhash.v3(random(50));
    this.id = {};
    this.id.session = murmurhash.v3('session', this.salt);
    this.id.connect = murmurhash.v3('connect', this.salt);
    this.id.read = murmurhash.v3('read', this.salt);
    this.id.write = murmurhash.v3('write', this.salt);
    this.id.info = murmurhash.v3('info', this.salt);
    this.id.geo = murmurhash.v3('geo', this.salt);
    return this.id;
  }

  new(): IdMap {
    return this.init();
  }

  get(key?: string): number { // Assuming the method returns a number
    if (!key) {
      return this.id.session;
    }
    return this.id[key];
  }
}
