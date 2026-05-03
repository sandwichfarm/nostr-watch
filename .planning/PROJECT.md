# nostr-watch

## What This Is

The nostr-watch platform monitors Nostr relay availability, performance, and conformance. It is a monorepo containing: the `@nostrwatch/auditor` conformance testing library, `relaymon` (relay monitoring daemon), `trawler` (relay discovery crawler), and shared libraries. The platform publishes NIP-66 monitoring events so relay operators and users can assess relay health across the network.

## Core Value

Anyone can run their own relay monitor — from watching a handful of personal relays to scanning the entire network — with a one-click install on self-hosted platforms.

## Current State

**Auditor (libraries/auditor):** v2.0 shipped (14 NIP suites, 3,387 LOC). v2.1 Test Profiles shelved at Phase 10 complete (taxonomy types shipped, classification/filtering/profiles pending).

**RelayMon (apps/relaymon):** Deno app with 5 Docker stack variants (clearnet, VPN, multinet, trawler+clearnet, trawler+multinet). Supports clearnet, Tor, and I2P via hedproxy. Publishes Kind 1066 check results and Kind 30166 announcements. v2.4 shipped — NATO phonetic spam URLs purged from database with NIP-09 delete events broadcast; dedup startup migration and scheduled re-evaluation loop disabled (code preserved).

**Trawler (apps/trawler):** Deno app that crawls nostr relay lists to discover relays. Writes to SQLite DB that relaymon reads as a seed source. v2.4 — NATO phonetic spam URLs purged at startup; nostrings library blocks NATO patterns before DB insertion.

**Docker stacks:** Fully containerized with example configs and env files. Multi-arch Dockerfiles (debian-based, Deno runtime).

**GUI (apps/gui):** SvelteKit 2 / Svelte 5 web app. v2.2 shipped — monitors listing page has accurate liveness counts, side-effect-free store chain, progressive reveal with per-monitor freshness indicator, and 23 unit tests.

## Requirements

### Validated

- ✓ Auditor base architecture (Auditor → Suite → SuiteTest → Ingestor/Sampler pipeline) — v2.0
- ✓ 14 NIP conformance test suites (01, 02, 09, 11, 13, 22, 40, 42, 45, 50, 65, 70, 77) — v2.0
- ✓ RelayMon daemon with WebSocket checks (open, read, info, dns) — existing
- ✓ Trawler relay discovery via relay list crawling — existing
- ✓ Docker stacks for all deployment variants (clearnet, VPN, multinet, trawler combos) — existing
- ✓ Hedproxy-based multinet routing (clearnet/.onion/.i2p URL detection) — existing
- ✓ NIP-66 event publishing (Kind 1066 results, Kind 30166 announcements, Kind 20166 state changes) — existing
- ✓ Configurable seeding (static config, events/relay lists, database, combinations) — existing
- ✓ Exponential backoff retry strategy for failed relay connections — existing
- ✓ Accurate relay liveness counts (online/offline/dead) reflecting cached Kind 30166 events — v2.2
- ✓ Consistent liveness counts across sort/filter/interactions — v2.2
- ✓ Inactive monitor detection using frequency * leniency threshold — v2.2
- ✓ Progressive reveal with per-monitor freshness indicator — v2.2
- ✓ Clean initialization sequence with loading/empty states — v2.2
- ✓ Written root-cause diagnosis for relay dedup family-scope failure with reproducible runtime evidence — v2.3 (ROOT-01)
- ✓ URL-path mutations of live relays are collapsed by dedup regardless of source (spam, typo, copy-paste, misconfig) — v2.3 (DEDUP-01)
- ✓ Dedup identity is deterministic, independent of transient `online=1/0` state of sibling relays — v2.3 (DEDUP-02)
- ✓ Legit path-only relays (e.g. `wss://haven.nostrfreedom.net/inbox/`) remain un-ignored when no matching-NIP-11 root sibling exists — v2.3 (DEDUP-03)
- ✓ Fall-through paths in `relayHostnameDedup` do not silently un-ignore previously-ignored relays — v2.3 (DEDUP-04)
- ✓ Previously-promoted `relay_status` rows are re-evaluated and corrected on monitor restart via idempotent startup migration — v2.3 (REMED-01)
- ✓ Remediation run does not wrongly ignore any legit relay — enforced by construction (all decisions route through `relayHostnameDedup`) — v2.3 (REMED-02)
- ✓ Unit test coverage for single/multi-segment path mutations, legit path-only relays, transient-sibling-offline — v2.3 (TEST-01/02/03)
- ✓ Disabled rerunDedupForAllRowsMigration() and runDedupReevaluation() (code preserved) — v2.4 (CLEAN-01)
- ✓ Migration identifies and deletes relay URLs ending with 1-3 NATO phonetic codes — v2.4 (PURGE-01/02)
- ✓ Persistent list of deleted URLs saved for NIP-09 processing — v2.4 (PURGE-03)
- ✓ NATO purge migration runs at startup in both trawler and relaymon — v2.4 (PURGE-04)
- ✓ Kind 5 delete events published for every purged URL via existing publisher infrastructure — v2.4 (NIP09-01/02)
- ✓ Trawler rejects NATO phonetic code URLs before database insertion via nostrings — v2.4 (BLOCK-01/02)

### Active

**Current Milestone: v2.5 GUI XSS Hardening**

**Goal:** Close every remaining XSS vector in `apps/gui` so a malicious relay, kind:0 publisher, or Nostr event author cannot execute JavaScript, inject HTML, or break out of CSS context in a visitor's browser.

**Target features:**
- DOMPurify-always-on note/wiki rendering with URL-validated parseImages/parseVideos and escaped kind:0 names
- `safeHttpUrl` helper validating NIP-11 `paymentsUrl` and other relay-controlled `<a>`/`<Button>` bindings
- Structural fix to `CountCard` (text-bind by default) plus sanitized inputs in CardInsights / RelayFeeItem
- `safeImageUrl(banner)` at three CSS `url('...')` sinks (data-view/table, lists/table, CardOperator)
- Adversarial-input regression tests + structural test for `{@html}` removal in CountCard
- Sanitization-contract dev note + follow-up decision on dataTable formatter migration

### Out of Scope

- Client-only NIPs (NIP-05, 06, 07, 19, 44, 46, etc.) — no relay behavior to test
- Deprecated NIPs (NIP-04, NIP-08, NIP-26) — unrecommended
- NIP-96 HTTP File Storage — separate protocol, not relay WebSocket

### Shelved (v2.1 Test Profiles)

- Impact/stress taxonomy types and `impactAllowed()` utility — Phase 10 complete
- Retroactive classification of 37 SuiteTest subclasses — Phase 11 not started
- Filtering infrastructure (maxImpact/allowStress in Suite.test()) — Phase 12 not started
- Profile API and public surface (PROFILE_WEB/CLI/CVM constants) — Phase 13 not started

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Revert PR #861 before fixing | The fix compounded existing problems — wrong counts, state resets, inconsistent data | ✓ Good — clean baseline enabled proper fixes |
| Collapse monitors + monitorsSorted into single store | Dual store was redundant, caused side-effect cascade on sort/filter | ✓ Good — eliminated count resets |
| Per-monitor freshness tied to liveness computation | isBootstrapped signal too slow (requires full sync:all); freshness should reflect actual data availability | ✓ Good — monitors transition to fresh within 10s |
| v2.1 shelved, not abandoned | Auditor test profiles resumable; monorepo isolation means no conflict | — Pending |
| v3.0 continues separately | Self-hosted distribution work is on feature/self-hosted branch (PR #874) | — Pending |
| Disable dedup migration + loop, not delete | Code may be re-enabled after fixing deeper logic; purge-first approach clears spam faster | ✓ Good — unblocked NATO purge without losing dedup code |
| NATO blocking in nostrings, not trawler sanitize.ts | sanitize.ts is dead code; trawler uses nostrings.sanitize.relayUrls() | ✓ Good — blocks at actual ingestion point |
| Duplicate isNatoPhoneticSpam in db and nostrings | Keeps nostrings dependency-free; both use identical NATO code sets | — Pending (low drift risk) |
| Encode-on-output at the sink (XSS) | Carries forward #899/#900 pattern — fixing at the sink is local, testable, survives upstream data-shape changes; package boundary stays clean | — Pending (v2.5) |
| Text-bind-by-default for fallbacks | Mirrors #900 DataTable fallback fix — silent regression vector closes when missing formatters render as text instead of `{@html}` | — Pending (v2.5) |
| Defer AUDIT-01 (formatter migration to Svelte components) to v2.6+ | v2.5 closed live vectors via encode-on-output discipline; dataTable formatters are encode-on-output safe today (verified by #899/#900 tests); migration touches 5+ formatter files + DataTable/PageHeader internals — too large for v2.5 scope | — Pending (v2.6+) |

## Context

- GUI is a SvelteKit 2 app (Svelte 5) at `apps/gui/`, statically built
- Monitors page: `src/routes/monitors/+page.svelte` (listing), `src/routes/monitors/[pubkey]/+page.svelte` (detail)
- Core store: `src/lib/stores/monitors.ts` — collapsed store chain with side-effect-free derivations
- Data flows through Route66 library (`@nostrwatch/route66`) MonitorService → Svelte stores → components
- NIP-66 events: Kind 10166 (monitor registration), Kind 30166 (relay checks), Kind 0 (profiles)
- Liveness computation: `computeRelayLivenessFromCache()` queries cache adapter, classifies by timestamp, full-replaces counts each run
- Leader/follower tab architecture for cross-tab state sync via StateManager (localStorage)
- 23 unit tests covering leniency formula (12 store tests) and formatter states (11 formatter tests)

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
---
*Last updated: 2026-05-03 after starting v2.5 GUI XSS Hardening milestone*
