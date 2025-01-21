// svelte.ts

import { derived, get, type Readable, type Writable } from "svelte/store";
import { Filter } from "nostr-tools";
import { eventKey, eventMatchesFilter } from "./utils.js";
import { AbstractMemoryRelay } from "./abstract.js";
import { BaseEvent } from "./types.js";

export class SvelteMemoryRelay<
  InputEvent extends BaseEvent,
  OutputEvent extends BaseEvent,
  OutputSingle extends Readable<OutputEvent> = Readable<OutputEvent>,
  OutputCollection extends Readable<OutputEvent[]> = Readable<OutputEvent[]>,
  OutputCount extends Readable<number> = Readable<number>
> extends AbstractMemoryRelay<InputEvent, OutputEvent, OutputSingle, OutputCollection, OutputCount> {

  constructor(private _store: Writable<Map<string, OutputEvent>>) {
    super();
  }

  get events(): Map<string, OutputEvent> {
    return get(this._store);
  }

  get store(): Writable<Map<string, OutputEvent>> {
    return this._store;
  }

  protected set events(e: Map<string, OutputEvent>) {
    this.store.set(e);
  }

  async init(): Promise<void> {
    return Promise.resolve();
  }

  maybeInsert(payload: InputEvent | InputEvent[]): number {
    let added = 0;
    this._store.update((current) => {
      let newMap: Map<string, OutputEvent> | undefined;
      if (Array.isArray(payload)) {
        newMap = new Map(current);
        for (const ev of payload) {
          if (!this.shouldInsert(ev)) continue;
          const key = eventKey(ev);
          newMap.set(key, this.instantiateEvent(ev, key));
          added++;
        }
      } else {
        if (this.shouldInsert(payload)) {
          const key = eventKey(payload);
          current.set(key, this.instantiateEvent(payload, key));
          added++;
        }
      }
      return newMap? newMap: current;
    });
    return added;
  }

  $req(id: string, filters: Filter[], format: boolean = true): OutputCollection {
    const store = derived<Writable<Map<string, OutputEvent>>, OutputEvent[]>(
      this.store, 
      ($events) => {
        const results: OutputEvent[] = [];
        for (const filter of filters) {
          for (const [key, event] of $events) {
            if (eventMatchesFilter(event, filter)) {
              results.push(event);
            }
          }
        }
        return results;
      }
    );

    return store as OutputCollection;
  }

  $get(key: string): OutputSingle | undefined {
    return derived(this.store, ($events) => {
      return $events.get(key);
    }) as OutputSingle | undefined;
  }

  $count(filters: Filter[]): OutputCount {
    const request = this.req("", filters) as Readable<OutputEvent[]>;
    const result = derived<Readable<OutputEvent[]>, number>(request, ($events) => {
      return $events.length;
    });
    return result as OutputCount;
  }

  _delete(keys: string[]): string[] {
    const deleted = new Set<string>();
    this.store.update((current) => {
      for (const key of keys) {
        if(!current.has(key)) continue;
        deleted.add(current.get(key)?.id || key);
        current.delete(key);
      }
      return current;
    });
    return Array.from(deleted);
  }

  event(ev: InputEvent): boolean {
    return this.maybeInsert(ev) ? true : false;
  }

  eventBatch(evs: InputEvent[]): number {
    return this.maybeInsert(evs);
  }

  async wipe(): Promise<void> {
    this.store.set(new Map<string, OutputEvent>());
  }
}
