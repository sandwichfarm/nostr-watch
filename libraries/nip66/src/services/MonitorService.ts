// src/services/MonitorService.ts

import { ICacheAdapter } from '@base/core/CacheAdapter';
import { Subscriber } from '@base/core/Subscriber';
import { IWebsocketAdapter, SubscribeHandlers } from '@base/core/WebsocketAdapter';
import { IEvent } from '@base/interfaces';
import { IAdaptersArgument } from '@base/interfaces/IAdaptersArgument';
import { ICheck, IMonitor } from '@base/models';
import { k30166ToICheck } from '@base/transform';
import { Filter } from 'nostr-tools';
import { MonitorManager } from '../managers/MonitorManager';

export type MonitorPriorities = MonitorPriority[];

export enum MonitorPriority {
  Follows = 'FOLLOWS',
  Wot = 'WOT',
  Checks = 'CHECKS',
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

export interface IGroupedRelays {
  userMeta?: string[];
  nip66?: string[];
}

export type IServiceHook = (...args: any[]) => void | undefined | any;
export type TServiceHooks = Record<string, IServiceHook>;

export class MonitorService {
  private cacheAdapter: ICacheAdapter;
  private websocketAdapter: IWebsocketAdapter;
  private monitorManager: MonitorManager;
  private _hooks: TServiceHooks = {};
  private _groupedRelays: IGroupedRelays = {};
  private subscriber: Subscriber = new Subscriber();

  constructor(adapters: IAdaptersArgument) {
    this.cacheAdapter = adapters.cacheAdapter;
    this.websocketAdapter = adapters.websocketAdapter;
    this.monitorManager = MonitorManager.getInstance();
  }

  async init(): Promise<void> {
    if (this?.cacheAdapter?.init) await this?.cacheAdapter?.init();
  }

  async bootstrap(): Promise<void> {
    console.log('MonitorService bootstrap');
    this.bootstrapMonitors();
  }

  get hook() {
    return this._hooks;
  }

  get monitors() {
    return this.monitorManager.getMonitorsMap();
  }

  get monitorsArray() {
    return this.monitorManager.getMonitorsArray();
  }

  get primary() {
    return this.monitorManager.primary;
  }

  get secondary() {
    return this.monitorManager.secondary;
  }

  get tertiary() {
    return this.monitorManager.tertiary;
  }

  get quaternary() {
    return this.monitorManager.quaternary;
  }

  get nip66Relays(): string[] | undefined {
    return this._groupedRelays?.nip66;
  }

  get userMetaRelays(): string[] | undefined {
    return this._groupedRelays?.userMeta;
  }

  addHook(name: string, hook: IServiceHook): void {
    this._hooks[name] = hook;
    this.monitorManager.addHook(name, hook);
  }

  addRelay(to: keyof IGroupedRelays, relay: string): void {
    if (!this._groupedRelays?.[to]) this._groupedRelays[to] = [];
    this._groupedRelays?.[to].push(relay);
  }

  removeRelay(from: keyof IGroupedRelays, relay: string): void {
    if (!this._groupedRelays?.[from]) return;
    this._groupedRelays[from] = this._groupedRelays[from].filter((r) => r !== relay);
  }

  async sync(): Promise<void> {
    const begin = Date.now();
    const filters: Filter[] = this.getMonitorCheckFilters();
    const hash = this.subscriber.request(filters);
    const eventIds = new Set();
    const onevent = (event: IEvent) => {
      if (eventIds.has(event.id)) return;
      eventIds.add(event.id);
      this.hook?.onMonitorCheckEvent?.(event);
    };

    const callbacks: SubscribeHandlers = { onevent };
    this.websocketAdapter.subscribe(
      {
        relays: this.nip66Relays,
        filters,
        options: {
          cache: true,
          returnResults: true,
          keepAlive: false,
          stream: true,
        },
      },
      callbacks
    );

    this.cacheAdapter.REQ(filters).then((events) => {
      console.log(
        `MonitorService sync: cache events: ${events.length}, took: ${(Date.now() - begin) / 1000} seconds`
      );
      for (const event of events) {
        if (eventIds.has(event.id)) continue;
        onevent(event);
      }
    });
  }

  async bootstrapMonitors(): Promise<void> {
    console.log('bootstrapMonitors');
    await this.bootstrapMonitorRegistrations();
    console.log(this.monitorManager.getMonitorsMap())
    await this.bootstrapMonitorData();
    await this.ensureMonitorsActive();
    this.prioritizeMonitors();
    await this.bootstrapMonitorChecks();
  }

  async bootstrapMonitorRegistrations(): Promise<void> {
    console.log('bootstrapMonitorRegistrations');
    const callbacks = {
      onevent: (Event10166: IEvent) => {
        console.log('bootstrapMonitorRegistrations: Event10166', Event10166.pubkey);
        this.monitorManager.handleEvent(Event10166);
      },
    };
    console.log('bootstrapMonitorRegistrations: awaiting bootstrap');
    await this.websocketAdapter.bootstrap([{ kinds: [10166] }], this.nip66Relays, callbacks);
    console.log('bootstrapMonitorRegistrations: done');
  }

  async bootstrapMonitorData(): Promise<void> {
    console.log('bootstrapMonitorData');
    const monitors = [...this.monitorsArray.map((m) => m.registration)];
    const authors = monitors.map((monitor: IMonitor) => monitor.pubkey);
    authors.length = authors.length > 4 ? 4 : authors.length;
    const onevent = (event: IEvent) => {
      this.monitorManager.handleEvent(event);
    };
    const callbacks = { onevent };
    await this.websocketAdapter.bootstrap(
      [
        {
          authors,
          kinds: [0, 10002],
        },
      ],
      this.userMetaRelays,
      callbacks
    );
  }

  async ensureMonitorsActive(): Promise<void> {
    console.log('ensureMonitorsActive');
    const monitors = this.monitorsArray.map((monitor) => [
      monitor.registration.pubkey,
      monitor.registration.frequency,
    ] as [string, number]);
    const filters: Filter[] = [];
    const events: IEvent[] = [];
    monitors.forEach(async ([monitorPubkey, monitorFrequency]) => {
      if (!monitorPubkey) return;
      monitorFrequency = monitorFrequency || 60 * 60;
      console.log(`ensureMonitorsActive: ${monitorPubkey}`, monitorFrequency);
      const limit = 1;
      const kinds = [30166];
      const since = Math.round(Date.now() / 1000) - monitorFrequency;
      const authors = [monitorPubkey];
      filters.push({ limit, kinds, since, authors });
    });
    const onevent = (event: IEvent) => {
      events.push(event);
    };
    const callbacks: SubscribeHandlers = { onevent };
    const relays = this.nip66Relays;
    await this.websocketAdapter.subscribe(
      {
        relays,
        filters,
        options: {
          cache: false,
          returnResults: true,
          keepAlive: false,
          stream: false,
        },
      },
      callbacks
    );
    console.log(`ensureMonitorsActive: events: ${events.length} from ${filters.length} filters`);
    for (const event of events) {
      const { pubkey, created_at } = event;
      const monitor = this.monitors.get(pubkey);
      console.log(`ensureMonitorsActive: monitor exists: ${monitor?.registration?.pubkey}`);
      if (monitor?.registration) {
        const lastActiveOld = monitor.registration.lastActive;
        const lastActiveNew = created_at as number;
        const updateWithNew = !lastActiveOld || lastActiveNew > lastActiveOld;
        monitor.registration.lastActive = updateWithNew ? lastActiveNew : lastActiveOld;
        // Update the monitor in the manager
        this.monitorManager.getMonitorsMap().set(pubkey, monitor);
      }
    }
  }

  prioritizeMonitors(): void {
    this.monitorManager.prioritizeMonitors();
  }

  getMonitorCheckFilters(): Filter[] {
    if (!this.monitorsArray.length) {
      console.warn('MonitorService getMonitorCheckFilters: no monitors');
      return [];
    }
    console.log(`total monitors in array: ${this.monitorsArray.length}`)
    const monitors = this.monitorsArray.slice(0, 4);
    const filters: Filter[] = [];
    monitors.forEach((monitor) => {
      const authors = [monitor.registration.pubkey];
      const frequency = monitor.registration.frequency;
      const since = Math.round(Date.now() / 1000) - frequency;
      filters.push({ authors, since, kinds: [30166] });
    });
    return filters;
  }

  async bootstrapChecksFromWebsocket(): Promise<IEvent[] | boolean | undefined> {
    const filters: Filter[] = this.getMonitorCheckFilters();
    let count = 0;
    const onevent = (event: IEvent) => {
      count++;
      this?.hook?.onMonitorCheckEvent?.(event);
      if (this?.hook?.onMonitorCheck) {
        const check: ICheck = k30166ToICheck(event);
        this?.hook?.onMonitorCheck?.(check);
      }
    };
    const callbacks: SubscribeHandlers = { onevent };
    const relays = this.nip66Relays;
    const result: IEvent[] | boolean = await this.websocketAdapter.fetch(
      {
        relays,
        filters,
        options: {
          cache: true,
          returnResults: true,
          keepAlive: false,
          stream: true,
          // batch: 8
        },
      },
      callbacks
    );
    return result;
  }

  async bootstrapMonitorChecks(): Promise<void> {
    console.log('bootstrapMonitorChecks');
    const result = await this.bootstrapChecksFromWebsocket();
    if (result instanceof Array) {
      for (const event of result) {
        const { pubkey, content } = event;
        const monitor = this.monitors.get(pubkey);
        if (monitor) {
          monitor.registration.checks = JSON.parse(content);
          this.monitorManager.getMonitorsMap().set(pubkey, monitor);
        }
      }
    }
  }

  async getActiveMonitors(): Promise<string[]> {
    const monitors: string[] = [];
    return monitors;
  }
}
