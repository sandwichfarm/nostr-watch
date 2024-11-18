import { IEvent } from '@base/interfaces';
import { n66IEventToIMonitor } from '@base/transform';

export type IMonitor = {
  pubkey: string; 
  eventId: string; 
  frequency: number;
  lastActive?: number;
  geohash?: string;
  geocode?: string[];
  checks?: string[];
}

export class Monitor {
  priority: number;
  registration: IMonitor;
  profile: any;
  relays: string[];

  constructor() {
    this.priority = 0;
    this.registration = {} as IMonitor;
    this.profile = {};
    this.relays = [];
  }

  addRegistration(event: IEvent): void {
    this.registration = n66IEventToIMonitor(event);
    console.log(`Monitor: addRegistration:`, this.registration);
  }

  addProfile(event: IEvent, hook?: any): void {
    try {
      let profile = JSON.parse(event.content);
      if (hook?.beforeAddProfile) {
        profile = hook.beforeAddProfile(profile);
      }
      this.profile = profile;
      hook?.afterAddProfile?.(profile);
    } catch (e) {
      console.warn('Monitor addProfile error:', e);
    }
  }

  addRelays(event: IEvent, hook?: any): void {
    try {
      let relays = event.tags.filter((t) => t[0] === 'r').map((t) => new URL(t[1]).toString());
      relays = relays ?? [];
      if (hook?.beforeAddRelays) {
        relays = hook.beforeAddRelays(relays);
      }
      this.relays = relays;
      hook?.afterAddRelays?.(relays);
    } catch (e) {
      console.warn('Monitor addRelays error:', e);
    }
  }
}
