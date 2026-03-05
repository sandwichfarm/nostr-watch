# @nostrwatch/memory-relay

In-memory Nostr relay implementation for testing and SvelteKit application state.

[![npm version](https://img.shields.io/npm/v/@nostrwatch/memory-relay?style=flat-square&label=npm)](https://www.npmjs.com/package/@nostrwatch/memory-relay)
[![License](https://img.shields.io/github/license/sandwichfarm/nostr-watch?style=flat-square)](LICENSE)
[![Status](https://img.shields.io/badge/status-alpha-orange?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)
[![Runtime](https://img.shields.io/badge/runtime-browser-blue?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)

## Overview

`@nostrwatch/memory-relay` provides an in-memory store for Nostr events (signed JSON objects that form the protocol's fundamental data unit) without any network layer or disk persistence. It is used in tests to simulate relay behavior and in SvelteKit applications to hold reactive event collections without a backend relay connection.

The package exports two classes: `AbstractMemoryRelay` — a generic base class with filter-aware query, insert, count, and delete operations — and `SvelteMemoryRelay`, which extends `AbstractMemoryRelay` to back all event storage with a Svelte `Writable` store, making the event collection reactive and compatible with Svelte's `$` syntax and `derived` stores.

A **relay** in Nostr is a WebSocket server that stores and forwards events. This package emulates the data model of a relay in memory without the network transport.

## Installation

```sh
pnpm add @nostrwatch/memory-relay
```

Or with npm:

```sh
npm install @nostrwatch/memory-relay
```

## Quick Start

```ts
import {AbstractMemoryRelay} from '@nostrwatch/memory-relay'
import type {Filter} from 'nostr-tools'

class MyRelay extends AbstractMemoryRelay {
  async init(): Promise<void> {}
}

const relay = new MyRelay()

// Insert a Nostr event
relay.event({id: 'abc123', kind: 1, created_at: 1700000000, content: 'hello', tags: [], pubkey: 'pub1'})

// Query with a filter
const results = relay.req('sub1', [{kinds: [1]}])
console.log(relay.count([{kinds: [1]}]))
// 1
```

## API

### `AbstractMemoryRelay`

```ts
abstract class AbstractMemoryRelay<
  Input extends BaseEvent = any,
  Output extends BaseEvent = any,
  OutputSingle = Output,
  OutputCollection = any,
  OutputCount = any
>
```

Abstract base class for in-memory event storage. Extend this class and implement `init()` to create a concrete relay. Subclasses may override `formatCollection()` to shape query results, and register `qualify` and `instantiate` callbacks to control which events are stored and how they are transformed on insert.

#### `abstract init(): Promise<void>`

Called once before the relay is used. Implement to perform any async setup (e.g. loading seed events from storage). Must return a resolved promise if no setup is needed.

---

#### Event writes

**`event(ev: Input): boolean`**

Inserts a single event. Returns `true` if the event was inserted, `false` if it was rejected (by the qualify callback or because a newer replaceable event already exists).

**`eventBatch(evs: Input[]): number`**

Inserts multiple events. Returns the count of events actually inserted.

**`maybeInsert(event: Input): number`**

Lower-level insert: checks `shouldInsert()`, then stores the event. Returns `1` if inserted, `0` otherwise.

---

#### Event reads

**`req(id: string, filters: Filter[], format?: boolean): OutputCollection | Output[]`**

Queries the store against one or more Nostr filters (a filter is a JSON object with fields like `kinds`, `authors`, `since`, `until`, `#e`, etc.). Returns all matching events. When `format` is `true` (default), passes results through `formatCollection()`.

**`get(key: string): Output | undefined`**

Returns a single event by its internal storage key (event ID or `kind:pubkey` for replaceable events).

**`count(filters: Filter[]): OutputCount`**

Returns the number of events that match the given filters.

**`summary(): Record<string, number>`**

Returns a map of `{ kind: count }` for all stored events. Useful for debugging and test assertions.

---

#### Event deletes

**`delete(filters: Filter[]): string[]`**

Deletes all events matching the filters. Returns the keys of deleted events.

**`wipe(): Promise<void>`**

Clears all stored events.

**`destroy(): void`**

Calls `wipe()` and releases resources.

---

#### Existence checks

**`exists(note: Input | string): boolean`**

Returns `true` if the given event (or event ID string) is present in the store.

**`noteExists(note: Input): boolean`**

Returns `true` if the given event object is in the store.

**`idExists(id: string): boolean`**

Returns `true` if the given event ID string is in the store.

---

#### Lifecycle callbacks

**`on(event: 'qualify' | 'instantiate', listener): void`**

Registers a callback for event lifecycle hooks:

- `qualify(event, key, relay)` — return `false` to reject an event before insert; `true` to accept
- `instantiate(event, key, relay)` — transform an input event into the stored output type; return the transformed event

**`off(event: 'qualify' | 'instantiate'): void`**

Removes the registered callback for the given lifecycle hook.

---

#### Serialization

**`dump(): Promise<Uint8Array>`**

Serializes all stored events to a UTF-8 JSON byte array. Useful for snapshotting relay state in tests.

---

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `events` | `Map<string, Output>` | Direct access to the event store |
| `nip11s` | `Map<string, any>` | NIP-11 info document cache keyed by relay URL |
| `highestTimestamp` | `number[]` | Per-filter highest `created_at` seen during `req()` |
| `lowestTimestamp` | `number[]` | Per-filter lowest `created_at` seen during `req()` |
| `debounceMS` | `number` | Debounce interval in milliseconds (default `1000`) |

---

### `SvelteMemoryRelay`

```ts
class SvelteMemoryRelay<
  InputEvent extends BaseEvent,
  OutputEvent extends BaseEvent,
  OutputSingle extends Readable<OutputEvent> = Readable<OutputEvent>,
  OutputCollection extends Readable<OutputEvent[]> = Readable<OutputEvent[]>,
  OutputCount extends Readable<number> = Readable<number>
> extends AbstractMemoryRelay<InputEvent, OutputEvent, OutputSingle, OutputCollection, OutputCount>
```

Extends `AbstractMemoryRelay` to back event storage with a Svelte `Writable<Map<string, OutputEvent>>` store. All mutations (`maybeInsert`, `wipe`, `_delete`) update the store atomically, triggering reactive updates in subscribing components.

Import from the `svelte` subpath:

```ts
import {SvelteMemoryRelay} from '@nostrwatch/memory-relay/svelte'
import {writable} from 'svelte/store'
```

#### Constructor

```ts
new SvelteMemoryRelay(store: Writable<Map<string, OutputEvent>>)
```

Pass an existing `Writable` store. The relay reads and writes through the store reference, so external subscribers see changes immediately.

**Example (SvelteKit component):**

```ts
import {SvelteMemoryRelay} from '@nostrwatch/memory-relay/svelte'
import {writable, derived} from 'svelte/store'

const eventStore = writable(new Map())
const relay = new SvelteMemoryRelay(eventStore)
await relay.init()

// Reactive query — updates whenever events are inserted or deleted
const kind1Events = relay.$req('sub1', [{kinds: [1]}])

// In Svelte template: {#each $kind1Events as event}
```

#### Reactive query methods

**`$req(id: string, filters: Filter[], format?: boolean): OutputCollection`**

Returns a `Readable<OutputEvent[]>` derived from the store. Updates reactively whenever the store changes.

**`$get(key: string): OutputSingle | undefined`**

Returns a `Readable<OutputEvent>` for a single event by key. Updates reactively.

**`$count(filters: Filter[]): OutputCount`**

Returns a `Readable<number>` that emits the count of matching events. Updates reactively.

#### Properties

**`store: Writable<Map<string, OutputEvent>>`**

Direct access to the underlying Svelte store. Subscribe to it to react to any event store change.

---

### `BaseEvent`

```ts
interface BaseEvent {
  id?: string
  kind?: number
  created_at?: number
  tags?: string[][]
  pubkey?: string
  content?: string
  sig?: string
}
```

Minimum shape required by the relay internals. Use `nostr-tools`' `Event` type for full Nostr event compliance.

## Known Limitations

No known limitations at this time.

## Agent Skills

No agent skills defined yet for this package.

## Related Packages

- [`@nostrwatch/worker-relay`](../worker-relay/README.md) — persistent web worker relay using sqlite-wasm and OPFS; use this when you need durability across page reloads
- [`@nostrwatch/websocket`](../websocket/README.md) — cross-platform WebSocket client; pairs with memory-relay in integration tests that simulate a real relay connection
- [`apps/gui`](../../apps/gui/README.md) — SvelteKit app that uses `SvelteMemoryRelay` for local event caching and reactive UI updates

## License

[MIT](../../LICENSE)
