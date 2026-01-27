# apps/gui — proposal

## Goals (as stated)

1. Improve load speed
2. Improve maintainability
3. Improve main-thread GUI performance

## Summary recommendation

Move from “each tab boots its own worker graph” to a **shared runtime** that:

- Owns websocket/pool management once per origin.
- Owns the cache once per origin (SQLite/OPFS via a single dedicated DB worker).
- Exposes a clean, versioned protocol to any number of tabs.
- Offloads CPU-heavy work (signature verification + derivations) into a worker pool behind that same runtime.

This directly addresses:

- Multi-tab lifecycle bugs (no more per-tab OPFS contention).
- Worker sprawl and duplicated bundles (centralized scheduling + shared code paths).
- Main-thread perf (UI becomes a thin view layer over derived state/diffs).

## Current status (in this repo)

The first major step is already implemented in `apps/gui`:

- **Leader-tab runtime**: one tab owns SQLite/OPFS + websocket workers; other tabs act as clients via BroadcastChannel RPC and event broadcasts.
- This removes the “only one tab can run” UX and prevents multi-tab OPFS contention by construction.

## Key design choices

### 1) Use a leader-tab runtime (recommended default)

**Why**: It works with OPFS/sqlite stacks that require `DedicatedWorkerGlobalScope` (a common blocker for SharedWorker-based DB hosting), while still delivering multi-tab UX if followers are treated as clients.

**What changes**:

- Exactly one tab (the leader) runs the full runtime (websocket pool + cache + derivations).
- All other tabs connect as **clients** over `BroadcastChannel` (and/or `MessageChannel`) and:
  - request snapshots
  - request queries (`REQ/COUNT/...`)
  - subscribe to derived-state diffs/streams

**Implementation notes**:

- Prefer `navigator.locks` for election/ownership (fallback to storage/heartbeat where unavailable).
- Add a `termId` so clients can ignore stale leaders and resync cleanly.

### 2) Optional later: SharedWorker coordinator

**Why**: A SharedWorker can simplify coordination (no leader election), but it often can’t *host* an OPFS sync sqlite DB directly. If adopted, the common workable shape is:

- SharedWorker (ports/protocol) → Dedicated DB worker (OPFS sqlite) + websocket worker

**Caveat**: SharedWorker support is not universal (notably iOS Safari), so even if you add it you still want the leader/client fallback path.

### 3) Replace inline Blob workers with module workers

Inline Blob workers force worker code into the main bundle and make sharing/caching harder.

Move worker entrypoints to module workers:

- `new Worker(new URL('./runtime.worker.ts', import.meta.url), { type: 'module' })`
- `new SharedWorker(new URL('./runtime.shared-worker.ts', import.meta.url), { type: 'module' })`

Expected wins:

- smaller initial JS for the UI
- better caching and debugging
- enables shared runtime strategy cleanly

### 4) Streamline and version the message protocol

Unify worker<->UI communication under one schema:

- request: `{ v, id, type, payload }`
- response: `{ v, id, type, payload, error? }`
- stream: `{ v, streamId, type, payload }`

Rules:

- everything is versioned (`v`)
- every request is correlatable (`id`)
- streaming updates use explicit stream ids
- large payloads use Transferables (ArrayBuffer) where possible

### 5) Move derivations to the runtime (state machine / materialized views)

Instead of holding “all events” in UI stores and deriving on the main thread:

- ingest events into the cache layer (SQLite or in-memory)
- run a derivation engine in the runtime to maintain:
  - relay aggregates (online/offline/dead counts, software/country/isps rollups)
  - monitor aggregates and health
  - any “conflict resolution” logic for overlapping publishers
- push UI-friendly snapshots/diffs to tabs

### 6) Add signature verification via a worker pool

Add a `VerifyPool` behind the runtime:

- `N = max(1, hardwareConcurrency - 2)` workers (configurable)
- verify events in parallel
- store verification status alongside events (or in an index table/metadata map)
- UI never blocks on verification

### 7) Add NIP-77 (negentropy) opportunistically

Implement a `NegentropySynchronizer` in the websocket layer:

- detect relay support (via cached NIP-11 supported nips or an allowlist)
- for sync-heavy flows, reconcile against the local cache first:
  - exchange fingerprints
  - fetch only missing events

This should be opt-in per relay (or behind a feature flag) until field-tested.

## Why “service worker launches all workers” is not the primary path

Service Workers are great for asset caching and offline, but they are not a good fit for:

- long-lived websocket pools
- long-lived OPFS sqlite sync handles
- always-on compute

Even if possible in some environments, SW lifecycle semantics (suspension/termination) make it an unreliable “always running” host for your data plane.

Use a SharedWorker (preferred) or leader-tab runtime (fallback) instead; keep Service Worker for PWA/offline caching separately.

## Next proposal increments (high value)

- Version and harden the leader RPC protocol (schemas, request ids, errors, streaming semantics).
- Consolidate “dataRegister”-initiated sync so follower tabs rely on leader broadcasts by default (avoid duplicate sync work).
- Offload heavy derivations (current store-based derivations) into a derivation worker/state machine behind the runtime.
- Add signature verification via a worker pool.
- Add opt-in NIP-77 negentropy inside the websocket/pool layer for backfill-heavy flows.
