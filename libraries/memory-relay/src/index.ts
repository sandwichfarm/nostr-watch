import { isReplaceableKind, isParameterizedReplaceableKind } from "nostr-tools/kinds";
import { IEvent } from "@nostrwatch/route66/models";
import { Filter, NostrEvent } from "nostr-tools";

type EventType = 'replaceable' | 'parameterized' | 'event';

export const eventType = ( event: any ): EventType => {
    if(isReplaceableKind(event.kind)) {
        return 'replaceable';
    }
    else if(isParameterizedReplaceableKind(event.kind)){
        return 'parameterized';
    }
    else {
        return 'event'
    }
}

export const eventAddr = ( event: any, type?: EventType ) => {
    let { pubkey, kind } = event;
    type = type ?? eventType(event);
    pubkey = pubkey.slice(0,16);
    if(type === 'parameterized') {
        const dtag = event.tags.find((t: string[]) => t[0] === 'd')?.[1]
        const key = `${pubkey}:${kind}:${dtag}`
        return `${pubkey}:${kind}:${dtag}`;
    }
    else if(type === 'replaceable') {
        const key = `${pubkey}:${kind}`
        return `${pubkey}:${kind}`;
    }
}

export const eventKey = (event: any, type?: EventType) =>{
    type = type ?? eventType(event);
    if(type === 'replaceable') {
        return eventAddr(event, type);
    }
    else if(type === 'parameterized') {
        return eventAddr(event, type);
    }
    else {
        return event.id
    }
}

type EventKeyDataType = {
    type: EventType;
    key: string;
}

export const eventIdData = (event: any): EventKeyDataType => {
    const type =  eventType(event)
    return {
        type,
        key: eventKey(event, type)
    }
}

export class MemoryRelay {
  private events: Map<string, IEvent> = new Map();
  private nip11s: Map<string, any> = new Map();
  private log = (msg: string, ...args: Array<any>) => console.log("InMemoryRelay", msg, ...args);

  init() {
    this.log("Using in-memory relay");
    return Promise.resolve();
  }

  exists(note: IEvent | string): boolean {
    if(typeof note === 'string') {
        return this.idExists(note);
    }
    return this.noteExists(note);
  }

  noteExists(note: IEvent): boolean {
    return this.events.has(eventKey(note));
  }

  idExists(id: string): boolean {
    return this.events.has(id);
  }

  private shouldInsert(event: any){
    const {type, key} = eventIdData(event);
    const existing = this.events.get(key);
    if(!existing) return true;
    if(type === 'replaceable' || type === 'parameterized') {
        return !existing?.created_at || event.created_at > existing.created_at;
    }
    return false;
  }

  count(filters: Filter[]): number {
    let ret = 0;
    for (const [, e] of Object.entries(this.events)) {
      for(const filter of filters) {
        if (eventMatchesFilter(e, filter)) {
            ret++;
        }
      }
    }
    return ret;
  }

  summary(): Record<string, number> {
    let ret = {} as Record<string, number>;
    for (const [k, v] of Object.entries(this.events)) {
      ret[v.kind.toString()] ??= 0;
      ret[v.kind.toString()]++;
    }
    return ret;
  }

  dump(): Promise<Uint8Array> {
    const enc = new TextEncoder();
    return Promise.resolve(enc.encode(JSON.stringify(this.events.values())));
  }

  close(): void {
    // nothing
  }

  wipe() {
    this.events = new Map();
    return Promise.resolve();
  }

  event(ev: IEvent) {
    if (!this.shouldInsert(ev)) return false;
    this.events.set(ev.id, ev);
    return true;
  }

  eventBatch(evs: IEvent[]): number {
    const inserted = [];
    for (const ev of evs) {
      if (!this.shouldInsert(ev)) continue;
      this.events.set(ev.id, ev);
      inserted.push(ev);
    }
    if (inserted.length > 0) {
      return inserted.length;
    }
    return 0;
  }

  sql(sql: string, params: (string | number)[]): (string | number)[][] {
    return [];
  }

  req(id: string, filters: Filter[]): IEvent[] {
    const ret = [];
    for (const [, e] of Object.entries(this.events)) {
        for(const filter of filters) {
            if (eventMatchesFilter(e, filter)) {
                ret.push(e);
            }
        }
    }
    return ret;
  }

  delete(filters: Filter[]): string[] {
    const ids = new Set<string>();
    const forDelete: IEvent[] = this.req("ids-for-delete", filters);
    forDelete.forEach(a => this.events.delete(eventKey(a)));
    forDelete.map(a => a.id).forEach(ids.add);
    return Array.from(ids);
  }

  destroy() {
    this.wipe();
  }
}

export function eventMatchesFilter(ev: IEvent | NostrEvent | any, filter: Filter): boolean {
    if (filter.since && ev.created_at < filter.since) {
      return false;
    }
    if (filter.until && ev.created_at > filter.until) {
      return false;
    }
    if (!(filter.ids?.includes(ev.id) ?? true)) {
      return false;
    }
    if (!(filter.authors?.includes(ev.pubkey) ?? true)) {
      return false;
    }
    if (!(filter.kinds?.includes(ev.kind) ?? true)) {
      return false;
    }
    const orTags = Object.entries(filter).filter(([k]) => k.startsWith("#"));
    for (const [k, v] of orTags) {
      const vargs = v as Array<string>;
      for (const x of vargs) {
        if (!ev.tags.find((a: string[]) => a[0] === k.slice(1) && a[1] === x)) {
          return false;
        }
      }
    }
    const andTags = Object.entries(filter).filter(([k]) => k.startsWith("&"));
    for (const [k, v] of andTags) {
      const vargs = v as Array<string>;
      const allMatch = vargs.every(x => ev.tags.some((tag: string[]) => tag[0] === k.slice(1) && tag[1] === x));
      if (!allMatch) {
        return false;
      }
    }
    return true;
  }
  