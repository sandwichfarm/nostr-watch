import murmurhash from 'murmurhash';
import { random } from '../utils';

export class SessionHelper {
  url: string;
  salt?: number;
  id?: Record<string, number>;
  initial: boolean;

  constructor(url: string) {
    this.url = url;
    this.init();
    this.initial = true;
  }

  init(): Record<string, number> {
    this.salt = murmurhash.v3(random(50));
    this.id = {
      session: murmurhash.v3('session', this.salt),
      open: murmurhash.v3('open', this.salt),
      read: murmurhash.v3('read', this.salt),
      write: murmurhash.v3('write', this.salt),
      info: murmurhash.v3('info', this.salt),
      geo: murmurhash.v3('geo', this.salt),
    };
    this.initial = false;
    return this.id;
  }

  create(): Record<string, number> {
    return this.init();
  }

  get(key?: string): number | undefined {
    if (!key || !this?.id?.[key]) {
      return this?.id?.session;
    }
    return this.id[key];
  }
}
