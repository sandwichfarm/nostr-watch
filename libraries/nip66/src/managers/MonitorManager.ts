// src/managers/MonitorManager.ts

import { IEvent } from '@base/interfaces';
import { Monitor } from '../models/Monitor';

export type MonitorPriorities = MonitorPriority[];

export enum MonitorPriority {
  Follows = 'FOLLOWS',
  Wot = 'WOT',
  Checks = 'CHECKS',
  LoadSpeed = 'LOADSPEED',
  Geohash = 'GEOHASH',
  Country = 'COUNTRY',
  Network = 'NETWORK',
}

export const DEFAULT_ANON_MONITOR_PRIORITIES: MonitorPriorities = [
  MonitorPriority.Network,
  MonitorPriority.Checks,
  MonitorPriority.Geohash,
];

export const DEFAULT_AUTHED_MONITOR_PRIORITIES: MonitorPriorities = [
  MonitorPriority.Follows,
  MonitorPriority.Wot,
  MonitorPriority.Checks,
];

export class MonitorManager {
  private static instance: MonitorManager;

  private monitors: Map<string, Monitor> = new Map();

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

  get enabledMonitors(): Monitor[] {  
    return this.monitorsArray.filter((monitor) => monitor.enabled);
  }

  get sortedMonitors(): Monitor[] {
    const sortedMonitors = MonitorManager.sortMonitorsByPriority(this.activeMonitors);
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

  get qualified(): Monitor[] {
    const qualified = this.monitorsArray.filter((monitor) => {
      if (!monitor?.registration?.lastActive) return false;
      if (!monitor?.registration?.checks?.length) return false;
      if (!monitor?.profile) return false;
      if (!monitor?.relays) return false;
      return monitor.registration.lastActive > 0;
    });
    return qualified;
  }

  loadMonitors(monitors: any[]) {
    monitors.forEach((monitor) => {
      const { pubkey } = monitor.registration;
      if(!pubkey) return;
      this.monitors.set(pubkey, Monitor.fromJson(monitor));
    });
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
      monitor.addProfile(event);
    } else if (kind === 10002) {
      monitor.addRelays(event);
    }
    this.monitors.set(pubkey, monitor);
    console.log(`did stuff for ${pubkey}`)
    console.log(`total monitors: ${this.monitors.size}`);
  }

  sortMonitors(priority: MonitorPriority = MonitorPriority.Checks, apply: boolean = false): Monitor[] {
    let sortedMonitors: Monitor[] = [];
    switch (priority) {
      case MonitorPriority.LoadSpeed:
        return this.sortByNumberOfChecks('ASC');
      case MonitorPriority.Checks:
      default:
        return this.sortByNumberOfChecks();
    }
  }

  sortByNumberOfChecks(order: 'ASC' | 'DESC' = 'DESC'): Monitor[] {
    const qualifiedMonitors = this.qualified
    const scores: Record<string, number> = {};
    qualifiedMonitors.forEach((monitor) => {
      let score = 0;
      if (!monitor?.registration?.pubkey) return;
      if (monitor?.registration) score++;
      if (monitor?.registration?.checks?.length) score += monitor?.registration?.checks?.length;
      if (monitor?.profile) score++;
      if (monitor?.relays) score++;
      console.log(`prioritizeMonitors: ${monitor.registration.pubkey} score: ${score}`);
      scores[monitor.registration.pubkey] = score;
    });
    qualifiedMonitors.sort((a, b) => {
      const scoreA = scores?.[a.registration.pubkey] || 0;
      const scoreB = scores?.[b.registration.pubkey] || 0;
      if(order === 'ASC') return scoreA - scoreB;
      return scoreB - scoreA;
    });
    return qualifiedMonitors;
  }

  prioritizeMonitors(priority: MonitorPriority = MonitorPriority.Checks): void {
    const monitors = this.sortMonitors(priority);
    monitors.forEach((sortedMonitor, index) => {
      sortedMonitor.priority = index + 1;
    });
  }

  static sortMonitorsByPriority(monitors: Monitor[]): Monitor[] {
    return monitors.sort((a, b) => a.priority - b.priority);
  }
}
