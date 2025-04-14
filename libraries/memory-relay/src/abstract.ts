// abstract.ts

import { Filter } from "nostr-tools";
import { eventIdData, eventKey, eventMatchesFilter } from "./utils.js";
import { AbstractMemoryRelayCallback, AbstractMemoryRelayCallbackInstatiate, AbstractMemoryRelayCallbackQualify } from "./types.js";
import { BaseEvent } from "./types.js";

export abstract class AbstractMemoryRelay<
  Input extends BaseEvent = any,
  Output extends BaseEvent = any,
  OutputSingle = Output,
  OutputCollection = any | any[],
  OutputCount = any
> {
  private listeners: Map<string, AbstractMemoryRelayCallback<this, Output>> = new Map();

  protected _events: Map<string, Output> = new Map();  
  protected _nip11s: Map<string, any> = new Map();

  highestTimestamp: number[] = new Array(0);
  lowestTimestamp: number[] = new Array(0);
  debounceMS: number = 1000;

  protected set events(e: Map<string, Output>) {
    this._events = e;
  }

  get events() {
    return this._events;
  }

  get nip11s() {
    return this._nip11s;
  }

  abstract init(): Promise<void>;

  on(event: "qualify" | "instantiate", listener: AbstractMemoryRelayCallback<this, Output>): void {
    this.listeners.set(event, listener);
  }

  off(event: "qualify" | "instantiate"): void {
    this.listeners.delete(event);
  }

  protected instantiateEvent(event: Input, key: string): Output {
    return (
      (this.listeners.get("instantiate") as AbstractMemoryRelayCallbackInstatiate<this, Output>)?.(event, key, this)
      ?? (event as unknown as Output)
    );
  }

  protected qualifyEvent(event: Input, key: string): boolean {
    return (
      (this.listeners.get("qualify") as AbstractMemoryRelayCallbackQualify<this>)?.(event, key, this)
      ?? true
    );
  }

  exists(note: Input | string): boolean {
    return typeof note === "string" ? this.idExists(note) : this.noteExists(note);
  }

  noteExists(note: Input): boolean {
    return this.events.has(eventKey(note));
  }

  idExists(id: string): boolean {
    return this.events.has(id);
  }

  count(filters: Filter[]): OutputCount {
    let ret = 0;
    for (const [, e] of this.events) {
      for (const filter of filters) {
        if (eventMatchesFilter(e, filter)) {
          ret++;
        }
      }
    }
    return ret as unknown as OutputCount;
  }

  summary(): Record<string, number> {
    const ret: Record<string, number> = {};
    for (const [, event] of this.events) {
      if (!event.kind) continue;
      ret[event.kind.toString()] ??= 0;
      ret[event.kind.toString()]++;
    }
    return ret;
  }

  async dump(): Promise<Uint8Array> {
    const enc = new TextEncoder();
    return enc.encode(JSON.stringify(Array.from(this.events.values())));
  }

  close(): void {
    // no-op
  }

  async wipe() {
    this.events = new Map();
  }

  maybeInsert(event: Input): number {
    if (!this.shouldInsert(event)) return 0;
    const key = eventKey(event);
    this.events.set(key, this.instantiateEvent(event, key));
    return 1;
  }

  event(ev: Input): boolean {
    return this.maybeInsert(ev) ? true : false;
  }

  eventBatch(evs: Input[]): number {
    const inserted = [];
    for (const ev of evs) {
      if(ev.tags?.find(tag => tag[1] === "tor")){
        console.log('TOR RELAY', ev.id)
      }
      const inserts: number = this.maybeInsert(ev);
      if (!inserts) continue;
      inserted.push(ev);
    }
    return inserted.length;
  }

  setTimestampRange(event: Input | Output | BaseEvent, index: number = 0) {
    const ts = event.created_at as number;
    if (!this.highestTimestamp?.[index] || ts > this.highestTimestamp[index]) this.highestTimestamp[index] = ts;
    if (!this.lowestTimestamp?.[index] || ts < this.lowestTimestamp[index]) this.lowestTimestamp[index] = ts;
  }

  formatCollection(collection: Output[]): OutputCollection {
    return collection as unknown as OutputCollection;
  }

  req(id: string, filters: Filter[], format: boolean = true): OutputCollection | Output[] {
    const ret: Output[] = [];
    for (const [, e] of this.events) {
      for (const [index, filter] of filters.entries()) {
        if (eventMatchesFilter(e, filter)) {
          ret.push(e);
          this.setTimestampRange(e, index);
        }
      }
    }
    return format ? this.formatCollection(ret) : ret;
  }

  get(key: string): Output | undefined {
    return this.events.get(key) as Output | undefined;
  }

  delete(filters: Filter[]): string[] {
    const forDelete: Output[] = this.req("ids-for-delete", filters, false) as Output[];
    const keys = forDelete
      .map((e) => eventKey(e))
      .filter((a) => typeof a === "string");
    if (!keys?.length) return [];
    return this._delete(keys);
  }

  _delete(keys: string[]): string[] {
    keys.forEach((k) => this.events.delete(k));
    return keys;
  }

  destroy() {
    this.wipe();
  }

  protected shouldInsert(event: Input) {
    const { type, key } = eventIdData(event);
    const existing = this.events.get(key);
    const qualified = this.qualifyEvent(event, key)
    if (!qualified) return false;
    if (!existing) return true;
    if (type === "replaceable" || type === "parameterized") {
      return (event.created_at as number) > (existing.created_at as number)
    }
    return false;
  }
}
