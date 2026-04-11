# Roadmap: nostr-watch

## Milestones

- ✅ **v2.0 Wider NIP Support** - Phases 1-5 (shipped 2026-03-12)
- ✅ **v2.2 Fix Monitors Page** - Phases 14-16 (shipped 2026-03-24)
- 🚧 **v2.3 Relay Dedup Family Scope** - Phases 17-20 (started 2026-04-10)

## Phases

<details>
<summary>✅ v2.0 Wider NIP Support (Phases 1-5) - SHIPPED 2026-03-12</summary>

5 phases, 11 plans completed. See MILESTONES.md for details.

</details>

<details>
<summary>v2.1 Test Profiles - SHELVED at Phase 10</summary>

Phases 10-13 planned but shelved. Phase 10 (taxonomy types) shipped. Phases 11-13 not started.

</details>

<details>
<summary>✅ v2.2 Fix Monitors Page (Phases 14-16) - SHIPPED 2026-03-24</summary>

3 phases, 6 plans completed. See MILESTONES.md and milestones/v2.2-ROADMAP.md for details.

- [x] Phase 14: Revert Broken Bugfix (1/1 plans) — completed 2026-03-19
- [x] Phase 15: Aggregation and Loading (2/2 plans) — completed 2026-03-23
- [x] Phase 16: Data Integrity (3/3 plans) — completed 2026-03-24

</details>

### 🚧 v2.3 Relay Dedup Family Scope (In Progress)

**Milestone Goal:** Eliminate the URL-path-mutation spam vector in `relay_status` without losing legit path-only relays, and harden dedup for performance and extensibility at 30k+ relay scale.

- [x] **Phase 17: Diagnose Dedup Family Scope Failure** - Reproduce the split-outcome behavior on a known-failing sample and produce a written root-cause diagnosis with reproducible evidence (completed 2026-04-10)
- [x] **Phase 18: Fix Dedup Family Scope** - Apply the narrowest fix justified by Phase 17 evidence so dedup correctly collapses URL-path mutations without wrongly ignoring legit path-only relays (completed 2026-04-10)
- [x] **Phase 19: Remediate Affected Rows** - Re-run dedup over already-promoted `relay_status` rows and verify legit path-only relays remain publishable (completed 2026-04-10)
- [ ] **Phase 20: Dedup Performance & Overrides** - Scope the one-shot dedup migration to online+unignored rows, skip live NIP-11 fetches against stale/offline relays in periodic re-evaluation, and introduce a modular override rule system for protecting known-good paths and special-cased hostnames

## Phase Details

### Phase 17: Diagnose Dedup Family Scope Failure
**Goal**: Produce a reproducible, written root-cause diagnosis that explains why dedup catches some URL-path mutations on a hostname and misses others on the same hostname, with enough specificity to select a targeted fix in Phase 18.
**Depends on**: Nothing (first phase of milestone)
**Requirements**: ROOT-01
**Success Criteria** (what must be TRUE):
  1. A written diagnosis document exists that names the exact mechanism causing the split outcome between `wss://relay.lumina.rocks/hotel` (caught) and `wss://relay.lumina.rocks/umbra-vertex` (missed), anchored in runtime evidence (family composition, NIP-11 hashes, dedup branch taken, sibling online state at the moment dedup ran)
  2. The diagnosis reproduces the failure on at least two additional failing samples from STATE.md's failing-sample set and contrasts them with at least two succeeding samples from the control group
  3. The diagnosis explicitly confirms or rules out the "red herring" framing of `hostnames.ts:328-331` as the actual defect site
  4. The diagnosis identifies one or more candidate fixes whose scope is narrow enough to avoid the "mass-ignore legit path-only relays" risk, and names the evidence that would justify each
  5. No production code in `apps/relaymon/src/utils/hostnames.ts` is modified in this phase — only instrumentation and investigation artifacts land
**Plans:** 3/3 plans complete

Plans:
- [x] 17-01-PLAN.md -- Instrument dedup with snapshot capture + reproduction harness
- [x] 17-02-PLAN.md -- Hypothesis testing block covering family composition, hash stability, race
- [x] 17-03-PLAN.md -- Write DIAGNOSIS.md with evidence cross-links and narrow candidate fixes

### Phase 18: Fix Dedup Family Scope
**Goal**: Apply the narrowest code change justified by Phase 17's diagnosis so dedup correctly identifies URL-path mutations as duplicates of their legit siblings regardless of transient sibling state, while leaving legit path-only relays untouched. Ship regression tests that lock the fix in.
**Depends on**: Phase 17
**Requirements**: DEDUP-01, DEDUP-02, DEDUP-03, DEDUP-04, TEST-01, TEST-02, TEST-03
**Success Criteria** (what must be TRUE):
  1. Every URL in the failing-sample set recorded in STATE.md is now recognized as a duplicate by `relayHostnameDedup` and marked `ignore=1` with a `parent` pointing at the legit sibling or root, verified by unit test
  2. `wss://haven.nostrfreedom.net/inbox/` and every other legit path-only relay discovered during Phase 17 remains un-ignored and publishable, verified by unit test
  3. Dedup produces the same ignore decision for a mutation URL whether its legit sibling is currently `online=1` or `online=0` in `relay_status`, verified by a dedicated transient-sibling-offline unit test
  4. Fall-through paths in `relayHostnameDedup` never flip a previously-ignored `result.ignore` back to `false` without a positive matching heuristic, verified by unit test
  5. The unit test suite for `relayHostnameDedup` runs green and covers single-segment path mutations, multi-segment path mutations, legit path-only relays, and the transient-sibling-offline case
**Plans:** 3/3 plans complete

Plans:
- [x] 18-01-PLAN.md -- Fix 1: close the no-relatives race via getRelaysByHostname + defensive-deny
- [x] 18-02-PLAN.md -- Fix 2: stabilize createInfoHash via normalizeNip11 + one-shot rehash migration
- [x] 18-03-PLAN.md -- Fix 3: canonicalize mURL and DB reads to close the normalizeURL trailing-slash bug

### Phase 19: Remediate Affected Rows
**Goal**: Correct the already-promoted `relay_status` rows via an idempotent startup migration (`rerunDedupForAllRowsMigration`) and verify no legit path-only relay is wrongly ignored.
**Depends on**: Phase 18
**Requirements**: REMED-01, REMED-02
**Success Criteria** (what must be TRUE):
  1. The re-evaluation run over affected `relay_status` rows completes and records before/after counts in structured JSON log
  2. Every URL in the failing-sample set carries `ignore=1` and a non-empty `parent` in `relay_status` after the remediation run
  3. Legit path-only relays without root siblings are left unchanged
  4. Zero legit relays are newly ignored as a side effect of the remediation run
**Plans:** 2/2 plans complete

Plans:
- [x] 19-01-PLAN.md -- Create rerunDedupForAllRowsMigration module + hook into initializeDB after rehashRelayInfoMigration
- [x] 19-02-PLAN.md -- Add Phase 19 unit test block covering canonical mutation, legit path-only protection, philosophy case, already-ignored, idempotency, sentinel verification

### Phase 20: Dedup Performance & Overrides
**Goal**: Make relaymon startup and periodic re-evaluation scale to 30k+ relays without hours-long stalls, and provide a modular override rule system so known-good paths and hostname patterns can be protected from naive shortest-URL-wins dedup. Every override rule lives in its own file with its own isolated unit test.
**Depends on**: Phase 19
**Requirements**: PERF-01, PERF-02, OVERRIDE-01, OVERRIDE-02, OVERRIDE-03
**Success Criteria** (what must be TRUE):
  1. `rerunDedupForAllRowsMigration` restricts its row scan to rows with `online = 1 AND ignore = 0` at the SQL layer (the existing unconstrained `SELECT` is replaced), verified by a unit test against a seeded DB with mixed online/offline/ignored rows that asserts the migration touches only online+unignored rows
  2. `getOnlineRelays()` is called at most once per `rerunDedupForAllRowsMigration` run rather than once per row, and the resulting online-relay map is passed into `relayHostnameDedup` rather than re-fetched inside, verified by a unit test that counts DB query calls on a mocked DB
  3. `reevaluateAllDeduplication` does not make live `nocap.check` NIP-11 fetches against relays whose `checked_at` is older than a configurable inactivity threshold, and does not make fetches against rows already marked `ignore=1`, verified by a unit test that asserts zero `nocap.check` invocations for rows matching either skip condition
  4. A modular override system exists at `apps/relaymon/src/utils/dedup-overrides/` where each override is a single file exporting a typed rule with the shape `{ name: string, test(url: URL): boolean, action: 'allow' | 'deny', reason: string }`, and the override list is loaded via an index file that collects all rules
  5. `relayHostnameDedup` consults the override list before any of its existing case1–case8 branches and short-circuits to the override verdict when a rule matches, verified by a unit test
  6. Each override file has its own isolated unit test file at `apps/relaymon/tests/unit/dedup-overrides/{override-name}.test.ts` that exercises only that rule
  7. At least two initial overrides ship and pass unit tests: `allow-known-paths.ts` (always allows `/inbox` and `/outbox` to win over shorter spam siblings regardless of NIP-11 state) and `lang-relays-land.ts` (allows each `lang.relays.land/<two-letter-code>` path as an independent relay rather than a dedup child of a shorter sibling)
  8. Regression: `wss://haven.nostrfreedom.net/inbox/` and every Phase 18 failing-sample test still passes after the override system is introduced — no pre-existing dedup behavior is broken
**Plans**: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 17. Diagnose Dedup Family Scope Failure | 3/3 | Complete | 2026-04-10 |
| 18. Fix Dedup Family Scope | 3/3 | Complete | 2026-04-10 |
| 19. Remediate Affected Rows | 2/2 | Complete | 2026-04-10 |
| 20. Dedup Performance & Overrides | 0/0 | Not Started | - |
