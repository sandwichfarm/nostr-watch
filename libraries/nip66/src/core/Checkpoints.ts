import { LocalStorage } from 'node-localstorage';

export default class {
  private readonly prefix: string = 'cp'
  static measurement: string = 's'
  private localStorage!: LocalStorage | Storage;

  constructor(){}

  async init(){
    if (typeof localStorage === "undefined" || localStorage === null) {
      const LocalStorage = (await import('node-localstorage')).LocalStorage;
      this.localStorage = new LocalStorage('./checkpoints');
    }
  }

  async set(key: string, value: any, timestamp: number = Math.round(Date.now()/1000)): Promise<void> {
    this.localStorage.setItem(`${this.prefix}:${key}`, String(timestamp));
  }

  async get(key: string): Promise<number> {
    return JSON.parse(this.localStorage.getItem(`${this.prefix}:${key}`) || '{}');
  }
}