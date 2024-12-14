
import { IEvent } from '@base/interfaces';
import { Monitor } from '../models/Monitor';
import { NostrEvent } from '@base/models';

export type MonitorPriorities = MonitorPriority[];

export type MonitorCached = {
  pubkey: string,
  registration?: IEvent,
  profile?: IEvent,
  relays?: IEvent,
  priority: number,
  enabled: boolean,
  lastActive?: number
}

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

  get array(): Monitor[] {
    return Array.from(this.monitors.values());
  }

  get activeMonitors(): Monitor[] {
    return this.array.filter((monitor) => monitor.active);
  }

  get enabledMonitors(): Monitor[] {  
    return this.sortedMonitors.filter((monitor) => monitor.enabled);
  }

  get disabledMonitors(): Monitor[] {  
    return this.sortedMonitors.filter((monitor) => !monitor.enabled);
  }

  get disabledActiveMonitors(): Monitor[] {  
    return this.sortedMonitors.filter((monitor) => !monitor.enabled && monitor.active);
  }

  get disabledInactiveMonitors(): Monitor[] {  
    return this.sortedMonitors.filter((monitor) => !monitor.enabled && !monitor.active);
  }

  get sortedMonitors(): Monitor[] {
    return this.sortMonitors();
  }

  get qualified(): Monitor[] {
    const qualified = this.array.filter((monitor) => {
      if (!monitor?.lastActive) return false;
      if (!monitor?.registration?.checks?.length) return false;
      if (!monitor?.profile) return false;
      if (!monitor?.relays) return false;
      return monitor.lastActive > 0;
    });
    return qualified;
  }

  loadMonitors(monitors: MonitorCached[]) {
    monitors.forEach((monitor) => {
      if(monitor?.registration) {
        this.monitors.set(monitor.pubkey, Monitor.fromCache(monitor) as Monitor);  
      }
    });
  }

  handleEvent(event: IEvent): void {
    const { kind, pubkey } = event;
    let monitor = this.monitors.get(pubkey);
    if (!monitor && kind === 10166) {
      monitor = new Monitor(event);
      this.monitors.set(pubkey, monitor);
      ////console.log(`created new monitor for pubkey: ${pubkey}`);
    } else if(!monitor) {
      console.warn(`Monitor not found for pubkey: ${pubkey}`);
      return;
    }
    if (kind === 10166) {
      monitor.addRegistration(event);
    } else if (kind === 0) {
      monitor.addProfile(event);
    } else if (kind === 10002) {
      monitor.addRelays(event);
    }
    this.monitors.set(pubkey, monitor);
    ////console.log(`did stuff for ${pubkey}`)
    ////console.log(`total monitors: ${this.monitors.size}`);
  }

  sortMonitors(priority: MonitorPriority = MonitorPriority.Checks, apply: boolean = false): Monitor[] {
    let sortedMonitors: Monitor[] = [];
    switch (priority) {
      case MonitorPriority.LoadSpeed:
        return this.sort('ASC');
      case MonitorPriority.Checks:
      default:
        return this.sort();
    }
  }

  sort(order: 'ASC' | 'DESC' = 'DESC'): Monitor[] {
    // Clone the array to avoid mutating the original
    const monitors = [...this.array];

    // Calculate scores for each monitor
    const scores: Record<string, number> = {};
    monitors.forEach((monitor) => {
      if (!monitor?.registration?.pubkey) return;

      let score = 0;
      if (monitor.registration) score++;
      if (monitor.registration.checks?.length) score += new Set(monitor.registration.checks).size;
      if (monitor.profile) score++;
      if (monitor.relays) score++;
      if (!monitor.active) score = 0; // Inactive monitors have a score of 0

      ////console.log(`prioritizeMonitors: ${monitor.registration.pubkey} score: ${score}`);
      scores[monitor.registration.pubkey] = score;
    });

    // Sort monitors based on the defined criteria
    monitors.sort((a, b) => {
      // 1. Active Status: Active monitors come before inactive
      if (a.active && !b.active) return -1; // a before b
      if (!a.active && b.active) return 1;  // b before a

      // If both are active or both inactive, proceed to next criteria

      // 2. Enabled Status: Enabled monitors come before disabled
      if (a.enabled && !b.enabled) return -1;
      if (!a.enabled && b.enabled) return 1;

      // 3. Number of Checks: More checks come first
      const checksA = a.registration?.checks?.length || 0;
      const checksB = b.registration?.checks?.length || 0;
      if (checksA !== checksB) return checksB - checksA; // Descending

      // 4. Reported Online: More reported online comes first
      const onlineA = a.reportedOnline || 0;
      const onlineB = b.reportedOnline || 0;
      if (onlineA !== onlineB) return onlineB - onlineA; // Descending

      // 5. Last Active: More recent comes first
      const lastActiveA = a.lastActive || 0;
      const lastActiveB = b.lastActive || 0;
      if (lastActiveA !== lastActiveB) return lastActiveB - lastActiveA; // Descending

      // 6. Score: Higher scores come first (or based on 'order')
      const scoreA = scores[a.registration?.pubkey || ''] || 0;
      const scoreB = scores[b.registration?.pubkey || ''] || 0;
      if (order === 'ASC') return scoreA - scoreB;
      return scoreB - scoreA;
    });

    return monitors;
  }
  

  // prioritizeMonitors(priority: MonitorPriority = MonitorPriority.Checks): void {
  //   const monitors = this.sortMonitors(priority);
  //   monitors.forEach((sortedMonitor, index) => {
  //     sortedMonitor.priority = index + 1;
  //   });
  // }

  // static sortMonitorsByPriority(monitors: Monitor[]): Monitor[] {
  //   return monitors.filter(monitor => monitor.priority >= 0).sort((a, b) => a.priority - b.priority);
  // }
}
