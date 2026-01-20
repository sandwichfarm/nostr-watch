# apps/gui — current state

This repo contains the full GUI sources under `apps/gui/src/` (SvelteKit + Svelte 5). The GUI is a SPA that renders from Svelte stores while delegating most data-plane work to Route66 and web workers.

## High-level architecture

Key pieces:

- **UI (main thread)**: SvelteKit routes + components + Svelte stores.
- **Route66 core + services**: provides NIP-01-ish primitives (`subscribe/fetch/REQ`) plus higher-level services (`monitors`, `relay`).
- **Workers**:
  - **Websocket worker** (pool/sub management): `@nostrwatch/route66-wsadapter-nostrtools` (NostrTools worker).
  - **SQLite cache worker** (event store/query): `@nostrwatch/route66-cacheadapter-nostrsqlite` (OPFS when available, fallback otherwise).
  - **Auxiliary workers**: NIP-11 fetch (`apps/gui/src/lib/services/Nip11Service/nip11.worker.ts`), schema validation, etc.

The GUI ingests events into an in-memory relay (`@nostrwatch/memory-relay`) and derives aggregates for rendering.

## Boot path + leadership

The root entry is `apps/gui/src/routes/+layout.svelte`:

- Dynamically loads heavy modules (`apps/gui/src/routes/layout.modules.ts`).
- Elects a **single leader tab** (`apps/gui/src/lib/managers/ActivityManager.ts`):
  - Uses **Web Locks API** when available (strong single-leader guarantee).
  - Falls back to a `localStorage` heartbeat (`leaderId`) + `BroadcastChannel('myAppLifecycle')`.
- Boots the app after leadership is settled:
  - **Leader** runs full sync (`sync:all` / `sync:all-force`).
  - **Follower** runs a light boot (mostly `sync:cache`) and stays usable.

## Leader-tab runtime (implemented)

The multi-tab solution is a “leader-tab runtime”:

- **Leader tab** owns the heavy resources:
  - websocket worker(s) + pool
  - sqlite worker + OPFS handle
- **Follower tabs** do not start sqlite/websocket workers. They instead use:
  - **RPC over BroadcastChannel** to call into the leader’s Route66 adapters
    - `apps/gui/src/lib/runtime/leader-tab-server.ts`
    - `apps/gui/src/lib/runtime/leader-tab-client.ts`
    - proxy adapters: `apps/gui/src/lib/runtime/tab-client-adapters.ts`
  - **Event broadcast** from leader → followers for UI reactivity:
    - `apps/gui/src/lib/stores/events-helpers.ts` broadcasts `events` batches from the leader and followers ingest them.

Net effect: multiple tabs are usable without OPFS/SQLite contention; only one tab ever opens the DB.

## Worker inventory (current)

Not exhaustive, but the main workers involved are:

- Route66:
  - websocket worker (NostrTools)
  - sqlite worker (NostrSqlite + sqlite wasm helpers)
- GUI:
  - NIP-11 worker (`apps/gui/src/lib/services/Nip11Service/nip11.worker.ts`)
  - schema validation worker (`apps/gui/src/lib/services/SchemaValidationService/schemavalidation.worker.ts`)

## Current debt / known issues

- `apps/gui/tsconfig.json` `baseUrl/paths` conflicts with SvelteKit’s generated tsconfig (SvelteKit warns during `svelte-check`).
- `svelte-check` currently reports many pre-existing type errors; this document doesn’t attempt to catalog them.
- Some dev-time noise exists (e.g. livereload connection attempts in console during dev).
- NIP-11 cache operations are now handled end-to-end (worker-relay sqlite + in-memory implement `upsertNip11/batchUpsertNip11/countNip11s/getNip11`).
