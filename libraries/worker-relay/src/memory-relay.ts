import { EventEmitter } from "eventemitter3";
import { NostrEvent, RelayHandler, RelayHandlerEvents, ReqFilter, eventMatchesFilter, EventMetadata } from "./types";
import { debugLog } from "./debug";
import { batchNip11s, Nip11Args } from "interface";

/**
 * A very simple dumb fallback relay using a flat table
 */
export class InMemoryRelay extends EventEmitter<RelayHandlerEvents> implements RelayHandler {
  #events: Map<string, NostrEvent> = new Map();
  #nip11s: Map<string, any> = new Map();
  #log = (msg: string, ...args: Array<any>) => debugLog("InMemoryRelay", msg, ...args);

  init() {
    this.#log("Using in-memory relay");
    return Promise.resolve();
  }

  countUniqueNip11s(): Promise<number> {
    return Promise.resolve(this.#nip11s.size);
  }

  countNip11s(): Promise<number> {
    return Promise.resolve(this.#nip11s.size);
  }

  dumpNip11s(): Promise<any[]> {
    return Promise.resolve(Array.from(this.#nip11s.values()));
  }

  batchUpsertNip11(relayNip11s: batchNip11s): Promise<boolean> {
    for (const {relay, nip11} of relayNip11s) {
      this.#nip11s.set(relay, nip11);
    }
    return Promise.resolve(true)
  }

  upsertNip11(nip11Args: Nip11Args): Promise<boolean> {
    const { relay, nip11 } = nip11Args;
    this.#nip11s.set(relay, nip11);
    return Promise.resolve(true);
  }

  getNip11(relay: string): Promise<any> {
    return Promise.resolve(this.#nip11s.get(relay));
  }

  count(req: ReqFilter): number {
    let ret = 0;
    for (const [, e] of this.#events) {
      if (eventMatchesFilter(e, req)) {
        ret++;
      }
    }
    return ret;
  }

  summary(): Record<string, number> {
    let ret = {} as Record<string, number>;
    for (const [k, v] of this.#events) {
      ret[v.kind.toString()] ??= 0;
      ret[v.kind.toString()]++;
    }
    return ret;
  }

  dump(): Promise<Uint8Array> {
    const enc = new TextEncoder();
    return Promise.resolve(enc.encode(JSON.stringify(this.#events.values())));
  }

  close(): void {
    // nothing
  }

  wipe() {
    this.#events = new Map();
    return Promise.resolve();
  }

  destroy(): Promise<void> {
    return this.wipe();
  }

  recreate(): Promise<void> {
    return this.wipe();
  }

  event(ev: NostrEvent) {
    if (this.#events.has(ev.id)) return false;
    this.#events.set(ev.id, ev);
    this.emit("event", [ev]);
    return true;
  }

  eventBatch(evs: NostrEvent[]) {
    const inserted = [];
    for (const ev of evs) {
      if (this.#events.has(ev.id)) continue;
      this.#events.set(ev.id, ev);
      inserted.push(ev);
    }
    if (inserted.length > 0) {
      this.emit("event", inserted);
      return true;
    }
    return false;
  }

  sql(sql: string, params: (string | number)[]): (string | number)[][] {
    return [];
  }

  req(id: string, filter: ReqFilter) {
    const ret = [];
    for (const [, e] of this.#events) {
      if (eventMatchesFilter(e, filter)) {
        if (filter.ids_only === true) {
          ret.push(e.id);
        } else {
          ret.push(e);
        }
      }
    }
    return ret;
  }

  delete(filter: ReqFilter) {
    const forDelete = this.req("ids-for-delete", { ...filter, ids_only: true }) as Array<string>;
    forDelete.forEach(a => this.#events.delete(a));

    return forDelete;
  }

  setEventMetadata(_id: string, _meta: EventMetadata) {
    return;
  }
}
