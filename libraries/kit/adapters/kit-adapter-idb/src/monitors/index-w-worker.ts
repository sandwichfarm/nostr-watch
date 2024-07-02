import NDK from "@nostr-dev-kit/ndk";
import Deferred from "promise-deferred";

import { MonitorRelayFetcher, KitCacheRelayMonitorInterface, RelayMonitorSetExt } from "@nostrwatch/kit";
import { IMonitor, type MonitorDb, monitorDb, MonitorTransform } from "@nostrwatch/idb";

export class MonitorCacheIdbAdapter implements KitCacheRelayMonitorInterface {
  db: MonitorDb;
  ndk: NDK | undefined;
  worker: Worker | undefined;
  workPromises: Map<string, Deferred> = new Map();

  constructor(ndk?: NDK, worker?: Worker) {   
    this.db = monitorDb;
    this.ndk = ndk;
    this.worker = worker;
    this.setupWorkerListeners();
  }

  setupWorkerListeners() {
    if (this.worker) {
      this.worker.onmessage = (event) => {
        const { id, success, error } = event.data;
        const workPromise = this.workPromises.get(id);
        if (workPromise) {
          if (success) {
            workPromise.resolve(true);
          } else {
            workPromise.reject(error);
          }
          this.workPromises.delete(id);
        }
      };
    }
  }

  async set(monitorEvent: MonitorRelayFetcher): Promise<boolean> {
    const method = 'set';
    const created_at = monitorEvent.created_at as number;
    const id = monitorEvent.id;
    const existing = this.db.monitors
      .where('monitorPubkey').equals(monitorEvent.pubkey)
      .and(m => m.created_at >= created_at);

    const request = MonitorTransform(monitorEvent);

    if (!this.worker) {
      this.worker = await this.workerPromise;
    }

    const message = { id, method, request };

    console.log('to worker: setting monitor', message);

    this.worker?.postMessage(message);
    this.workPromises.set(id, new Deferred());

    const response = await this.workPromises.get(id).promise;

    console.log('from worker: setting monitor', response);

    return response.success as boolean;
  }

  async get(monitorPubkey: string): Promise<MonitorRelayFetcher | undefined> {
    const monitor: IMonitor | undefined = await this.db.monitors.where({ monitorPubkey }).first();
    if (!monitor) return undefined;
    return new MonitorRelayFetcher(this.ndk, monitor.event);
  }

  async remove(monitorPubkey: string): Promise<boolean> {
    const method = 'remove';
    const request = monitorPubkey;
    const id = monitorPubkey;

    if (!this.worker) {
      this.worker = await this.workerPromise;
    }

    this.worker?.postMessage({ id, method, request });
    this.workPromises.set(id, new Deferred());

    const response = await this.workPromises.get(id).promise;

    return response.success as boolean;
  }

  async keys(): Promise<Set<string>> {
    return new Set(await this.db.monitors.toCollection().primaryKeys());
  }

  async load(monitorEvents: RelayMonitorSetExt): Promise<void> {
    if (!monitorEvents) return;
    const arr = Array.from(monitorEvents);
    arr.forEach(monitor => this.set(monitor));
  }

  async dump(): Promise<RelayMonitorSetExt> {
    const monitors: MonitorRelayFetcher[] = (await this.db.monitors.toArray()).map((monitor) => new MonitorRelayFetcher(this.ndk, monitor.event));
    console.log('dump wtf', await this.db.monitors.toArray());
    return new Set(monitors) as RelayMonitorSetExt;
  }

  async reset(): Promise<void> {
    this.db.monitors.clear();
  }
}
    