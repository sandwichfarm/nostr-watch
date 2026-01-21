# apps/gui — phased implementation plan

This plan assumes we can modify the GUI sources under `apps/gui/src/` and the Route66/worker packages as needed. Each phase is designed to be shippable behind flags.

## Phase 0 — Baseline + guardrails

- Add a lightweight “perf baseline” checklist: cold load, boot time, main-thread long tasks, worker count.
- Add a runtime “capabilities” panel (hidden behind a dev flag) to show:
  - tab role (leader/client)
  - opfs enabled/disabled
  - active workers + subscriptions

## Phase 1 — Build hygiene + log discipline

- Ensure production builds do not ship livereload injection or verbose `console.log` noise.
- Replace unconditional logs with a gated logger (`DEBUG=...` or config flag).
- Fix obvious worker setup warnings that fire in normal conditions.

Expected impact: better load/boot and clearer debugging signal.

## Phase 2 — Protocol consolidation

- Define a single, versioned runtime protocol (request/response/stream envelopes).
- Wrap existing worker message patterns (NIP-05/NIP-11/schema validation) behind this protocol.
- Add strict validation for protocol messages (schema or lightweight checks).

Expected impact: maintainability and easier refactors.

## Phase 3 — Dedicated “RuntimeWorker” (single-tab first)

- Implement `RuntimeWorker` as a dedicated worker (one tab).
- Move websocket pool + cache + derivation orchestration behind it.
- UI talks only to `RuntimeWorker` (no direct worker fan-out).

Ship behind a flag; keep old path for rollback.

## Phase 4 — Multi-tab shared runtime

Status: implemented (MVP).

- Leader election with Web Locks fallback: `apps/gui/src/lib/managers/ActivityManager.ts`
- Leader-hosted RPC over BroadcastChannel:
  - `apps/gui/src/lib/runtime/leader-tab-server.ts`
  - `apps/gui/src/lib/runtime/leader-tab-client.ts`
  - `apps/gui/src/lib/runtime/tab-client-adapters.ts`
- “Follower” tabs stay usable (no shutdown/“inactive tab” screen).
- SQLite/OPFS is owned by exactly one tab by construction (leader only).

Remaining work:

- Add protocol versioning + stricter schemas (see Phase 2).
- Add explicit snapshots (HELLO/WELCOME) so a newly opened follower can hydrate without running sync tasks.
- Reduce follower-initiated sync work further (prefer leader broadcasts + snapshots).

Expected impact: multi-tab stability, better UX, fewer duplicated connections.

### Optional later: SharedWorker coordinator

- If desired, add a `SharedWorker`-based coordinator to remove most election complexity.
- Keep the leader/client path as a fallback (iOS, SharedWorker limitations, etc).

## Phase 5 — Derivation engine + signature verification pool

Status: in progress (relay check aggregation moved off the main thread via `apps/gui/src/lib/workers/relay-checks-aggregation.worker.ts`; signature verification pool added via `apps/gui/src/lib/services/SignatureVerificationService/signature-verification.worker.ts`).

- Move expensive derivations out of the UI into `DerivationEngine` inside runtime.
- Introduce `VerifyPool` (worker pool) for signature checks and other CPU tasks.
- Store verification results alongside events/metadata and expose to UI.

Expected impact: smoother UI and better scalability as data volume grows.

## Phase 6 — NIP-77 (negentropy) opt-in

- Add `NegentropySynchronizer` to `PoolManager`.
- Gate behind feature flags and per-relay capability detection.
- Start with a single sync-heavy flow (e.g., monitor checks backfill) and expand.

Expected impact: reduced bandwidth and faster sync on supporting relays.

## Phase 7 — Cleanup + hardening

- Remove legacy worker paths and ad-hoc protocols.
- Add regression tests for:
  - multi-tab attach/detach
  - runtime restart
  - OPFS availability vs fallback behavior
- Document operational requirements (COOP/COEP headers for SharedArrayBuffer/OPFS).
