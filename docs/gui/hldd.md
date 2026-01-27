# apps/gui — HLDD (High-Level Design)

## Problem statement

`apps/gui` relies on multiple web workers (websocket/pool, sqlite cache, NIP-05/NIP-11/schema validation) and currently struggles with:

- multi-tab contention (especially OPFS/SQLite exclusivity)
- “inactive tab” UX when more than one tab is open
- maintainability issues from scattered worker responsibilities and ad-hoc protocols
- load-time cost from large bundles and inline (Blob) workers

## Design overview

Introduce a **GUI Runtime** that centralizes the data plane and exposes a stable interface to the UI.

Two deployments:

1. **Primary**: leader-tab runtime (one active tab runs it; other tabs attach as clients).
2. **Optional later**: `SharedWorker` coordinator (one per origin) if desired; still usually requires a dedicated DB worker for OPFS sync sqlite, and still needs a fallback for iOS.

The UI becomes a thin view layer that subscribes to derived state and issues explicit queries/commands.

## Implemented MVP (leader-tab runtime)

`apps/gui` currently implements a leader-tab runtime in-process (no SharedWorker):

- **Leader election**: `apps/gui/src/lib/managers/ActivityManager.ts`
  - Prefer `navigator.locks` (Web Locks API) for exclusivity.
  - Fallback to `BroadcastChannel('myAppLifecycle')` + `localStorage` heartbeat.
- **Leader RPC bus**: `BroadcastChannel('nostrwatch:route66:leader-tab-rpc:v1')`
  - Server: `apps/gui/src/lib/runtime/leader-tab-server.ts`
  - Client: `apps/gui/src/lib/runtime/leader-tab-client.ts`
  - Proxy adapters in follower tabs: `apps/gui/src/lib/runtime/tab-client-adapters.ts`
    - `TabClientCacheAdapter` proxies cache calls (`REQ/COUNT/...`) to the leader.
    - `TabClientWebsocketAdapter` proxies websocket calls (`fetch/subscribe/publish/...`) to the leader and streams events back.
- **Event broadcast**: leader broadcasts event batches and followers ingest them to keep UI reactive:
  - `apps/gui/src/lib/stores/events-helpers.ts`

This ensures only one tab ever opens the SQLite/OPFS handle while allowing other tabs to remain usable.

## Components

### A) Runtime host

- `RuntimeHost` (SharedWorker or DedicatedWorker)
  - maintains a list of connected clients (MessagePorts)
  - routes requests to internal subsystems
  - emits snapshots/diffs/streams to clients

### B) Websocket subsystem

- `PoolManager`
  - owns relay connections and subscription lifecycles
  - multiplexes multiple UI subscriptions onto minimal relay subscriptions
  - enforces backpressure and batching
  - integrates NIP-77 when supported and enabled

### C) Cache subsystem

- `CacheStore`
  - single writer/owner of the local cache (SQLite/OPFS preferred)
  - if OPFS `createSyncAccessHandle` is required, run the DB in a dedicated worker even when using a SharedWorker coordinator
  - provides `REQ/COUNT/DELETE`-like queries and summary indices
  - provides a write-ahead ingest path for event streams

### D) Derivation subsystem

- `DerivationEngine`
  - incremental reducers/materialized views fed from event ingest
  - produces UI-oriented aggregates:
    - relay liveness + counts
    - country/software/isp rollups
    - monitor health + activity summaries
  - outputs snapshots and/or diffs

### E) CPU task pool

- `TaskPool`
  - worker pool for CPU-bound tasks:
    - signature verification
    - schema validation (if not merged into a single runtime worker)
    - optional NIP-05 validation

## Runtime protocol (versioned)

All messages are versioned and correlatable.

### Message envelope

- Request: `{ v: 1, id: string, type: string, payload: any }`
- Response: `{ v: 1, id: string, type: string, payload?: any, error?: { code, message, data? } }`
- Stream event: `{ v: 1, streamId: string, type: string, payload: any }`

### Core message types

- `HELLO` → runtime returns capabilities (shared-worker vs leader, opfs enabled, nip77 enabled, etc.)
- `SUBSCRIBE` / `UNSUBSCRIBE` → websocket subscriptions, with stream ids
- `QUERY` → cache-backed request (`REQ`-like)
- `GET_SNAPSHOT` → current derived state snapshot
- `WATCH_DERIVATIONS` → stream diffs of derived state
- `SET_PREFS` / `GET_PREFS` → persisted settings
- `VERIFY_EVENTS` → optional explicit verification requests

### Transferables

For event arrays, use Transferables:

- `payload.eventsBuffer: ArrayBuffer` (encoded events)
- runtime and UI can reuse Route66-style TextEncoder encoding initially, and later upgrade to a more compact binary format if needed.

## Multi-tab behavior

### SharedWorker mode

- Each tab connects via `SharedWorker.port`.
- The runtime:
  - owns the single cache instance (often: SharedWorker coordinates; dedicated DB worker owns the SQLite/OPFS handle)
  - owns websocket pool and subscriptions
  - pushes derived updates to all connected ports

No leader election needed.

### Leader-tab fallback mode

- A leader is elected (prefer `navigator.locks`, fallback to existing BroadcastChannel+storage approach).
- Leader runs the runtime in a dedicated worker graph.
- Followers attach via BroadcastChannel protocol:
  - follower sends `HELLO`
  - leader responds with snapshot + begins streaming diffs
  - follower sends `QUERY/SUBSCRIBE` requests to leader

Tabs are never “inactive” from the user’s POV; they are either leader or client.

## NIP-77 (negentropy) integration

Introduce a `NegentropySynchronizer` inside `PoolManager`:

- Capability detection:
  - NIP-11 supported nips includes `77`, or explicit allowlist.
- For eligible sync flows:
  - build a local set of event ids for the filter (from cache)
  - execute negentropy reconciliation messages with relay
  - fetch only missing events and ingest into cache

Feature flagging:

- global flag: `enableNip77`
- per-relay override: `relayCapabilities[relay].nip77`

## Non-goals (for this phase)

- Perfect offline-first behavior (service worker can be layered later).
- Rewriting the entire UI; the aim is to change the data plane first.
