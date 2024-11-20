// src/managers/MonitorManager.ts

import { IEvent } from '@base/interfaces';
import { Monitor } from '../models/Monitor';
import { Filter } from 'nostr-tools';

export type IServiceHook = (...args: any[]) => void | undefined | any;
export type TServiceHooks = Record<string, IServiceHook>;

export class MonitorManager {
  private static instance: MonitorManager;

  private monitors: Map<string, Monitor> = new Map();
  private hooks: TServiceHooks = {};

  private constructor() {}

  public static getInstance(): MonitorManager {
    if (!MonitorManager.instance) {
      MonitorManager.instance = new MonitorManager();
    }
    return MonitorManager.instance;
  }

  get monitorsMap(): Map<string, Monitor> {
    return this.monitors;
  }

  get monitorsArray(): Monitor[] {
    return Array.from(this.monitors.values());
  }

  get activeMonitors(): Monitor[] {
    return this.monitorsArray.filter((monitor) => monitor.lastActive > 0 && monitor.priority >= 0);
  }

  get sortedMonitors(): Monitor[] {
    const sortedMonitors = this.activeMonitors.sort((a, b) => a.priority - b.priority);
    return sortedMonitors
  }

  get primary(): Monitor | undefined {
    return this.monitorsArray.find((monitor) => monitor.priority === 1);
  }

  get secondary(): Monitor | undefined {
    return this.monitorsArray.find((monitor) => monitor.priority === 2);
  }

  get tertiary(): Monitor | undefined {
    return this.monitorsArray.find((monitor) => monitor.priority === 3);
  }

  get quaternary(): Monitor | undefined {
    return this.monitorsArray.find((monitor) => monitor.priority === 4);
  }

  get hook() {
    return this.hooks;
  }

  addHook(name: string, hook: IServiceHook): void {
    this.hooks[name] = hook;
  }

  handleEvent(event: IEvent): void {
    const { kind, pubkey } = event;
    let monitor = this.monitors.get(pubkey);
    if (!monitor && kind === 10166) {
      monitor = new Monitor(event);
      this.monitors.set(pubkey, monitor);
      console.log(`created new monitor for pubkey: ${pubkey}`);
    } else if(!monitor) {
      throw new Error(`Monitor not found for pubkey: ${pubkey}`);
    }
    if (kind === 10166) {
      monitor.addRegistration(event);
    } else if (kind === 0) {
      monitor.addProfile(event, this.hooks);
    } else if (kind === 10002) {
      monitor.addRelays(event, this.hooks);
    }
    this.monitors.set(pubkey, monitor);
    console.log(`did stuff for ${pubkey}`)
    console.log(`total monitors: ${this.monitors.size}`);
  }

  prioritizeMonitors(): void {
    const goodMonitors = this.monitorsArray.filter((monitor) => {
      if (!monitor?.registration?.lastActive) return false;
      if (!monitor?.registration?.checks?.length) return false;
      if (!monitor?.profile) return false;
      if (!monitor?.relays) return false;
      return monitor.registration.lastActive > 0;
    });
    const scores: Record<string, number> = {};
    goodMonitors.forEach((monitor) => {
      let score = 0;
      if (!monitor?.registration?.pubkey) return;
      if (monitor?.registration) score++;
      if (monitor?.registration?.checks?.length) score += monitor?.registration?.checks?.length;
      if (monitor?.profile) score++;
      if (monitor?.relays) score++;
      console.log(`prioritizeMonitors: ${monitor.registration.pubkey} score: ${score}`);
      scores[monitor.registration.pubkey] = score;
    });
    goodMonitors.sort((a, b) => {
      const scoreA = scores?.[a.registration.pubkey] || 0;
      const scoreB = scores?.[b.registration.pubkey] || 0;
      return scoreB - scoreA;
    });
    console.log(`prioritizeMonitors: monitors sorted:`, goodMonitors);
    goodMonitors.forEach((sortedMonitor, index) => {
      sortedMonitor.priority = index + 1;
    });
  }
}
