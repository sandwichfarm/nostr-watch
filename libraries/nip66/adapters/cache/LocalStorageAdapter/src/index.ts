import { ICacheAdapter } from '../../../src/interfaces/ICacheAdapter';
import { Event } from '../../../src/models/Event';

export class LocalStorageAdapter implements ICacheAdapter {
  private prefix: string;

  constructor(prefix: string = 'NIP66Cache_') {
    this.prefix = prefix;
  }

  private getFullKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  async get(key: string): Promise<Event | null> {
    const item = localStorage.getItem(this.getFullKey(key));
    return item ? JSON.parse(item) : null;
  }

  async set(key: string, value: Event): Promise<void> {
    localStorage.setItem(this.getFullKey(key), JSON.stringify(value));
  }

  async delete(key: string): Promise<void> {
    localStorage.removeItem(this.getFullKey(key));
  }

  async clear(): Promise<void> {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.prefix)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  }
}
