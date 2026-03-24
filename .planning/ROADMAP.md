# Roadmap: nostr-watch

## Milestones

- ✅ **v2.0 Wider NIP Support** - Phases 1-5 (shipped 2026-03-12)
- 🚧 **v2.2 Fix Monitors Page** - Phases 14-16 (in progress)

## Phases

<details>
<summary>✅ v2.0 Wider NIP Support (Phases 1-5) - SHIPPED 2026-03-12</summary>

5 phases, 11 plans completed. See MILESTONES.md for details.

</details>

<details>
<summary>v2.1 Test Profiles - SHELVED at Phase 10</summary>

Phases 10-13 planned but shelved. Phase 10 (taxonomy types) shipped. Phases 11-13 not started.

</details>

### 🚧 v2.2 Fix Monitors Page (In Progress)

**Milestone Goal:** Fix the monitors listing page — revert broken bugfix changes, restore correct aggregation logic, and ensure accurate, consistent relay liveness counts.

- [x] **Phase 14: Revert Broken Bugfix** - Remove the compound return type and broken merge logic introduced by bugfix/monitor-pages-aggregation (PR #861) (completed 2026-03-19)
- [x] **Phase 15: Aggregation and Loading** - Restore correct liveness count computation and clean up the initialization control flow (completed 2026-03-22)
- [x] **Phase 16: Data Integrity** - Ensure active/inactive monitor detection is accurate and stale data is never silently preserved (completed 2026-03-24)

## Phase Details

### Phase 14: Revert Broken Bugfix
**Goal**: The monitors page returns to its pre-PR-#861 state, removing the compounding damage from the broken aggregation attempt
**Depends on**: Nothing (first phase of milestone)
**Requirements**: AGGR-04
**Success Criteria** (what must be TRUE):
  1. The `monitorRelayDetails` and `monitorLastSeenFromCache` stores introduced by the bugfix no longer exist in the codebase
  2. `computeRelayLivenessFromCache` returns a simple value type, not the compound result type added by the bugfix
  3. The merge logic changes from PR #861 are absent from monitors.ts and +page.svelte
  4. The app compiles and the monitors page loads without runtime errors after the revert
**Plans:** 1/1 plans complete

Plans:
- [x] 14-01-PLAN.md -- Surgically remove all PR #861 changes from monitors.ts and detail page

### Phase 15: Aggregation and Loading
**Goal**: Relay liveness counts are accurate and stable, and the page initialization sequence is deterministic
**Depends on**: Phase 14
**Requirements**: AGGR-01, AGGR-02, AGGR-03, LOAD-01, LOAD-02, LOAD-03
**Success Criteria** (what must be TRUE):
  1. Online, offline, and dead relay counts on the monitors listing page match the actual number of Kind 30166 check events in the cache for each monitor
  2. Sorting or filtering the monitors table does not change or reset any displayed relay counts
  3. A monitor that has not reported recently shows zero or near-zero relay counts, not the inflated numbers of the full network
  4. The page progresses through a clear loading state before showing data — not a flash of stale or empty content
  5. Error conditions (cache miss, network failure) result in a visible fallback state rather than silent failure
**Plans:** 2/2 plans complete

Plans:
- [x] 15-01-PLAN.md -- Collapse store chain, extract cache persistence side effect, fix liveness computation
- [x] 15-02-PLAN.md -- Add progressive reveal loading states, empty state, and livenessReady flag

### Phase 16: Data Integrity
**Goal**: The monitors page reflects truthful, current data — inactive monitors are identified correctly and stale cache entries do not corrupt displayed values
**Depends on**: Phase 15
**Requirements**: DATA-01, DATA-02
**Success Criteria** (what must be TRUE):
  1. A monitor whose most recent Kind 30166 event is older than its declared frequency window is shown as inactive, not active
  2. When fresh data is fetched and contradicts a cached value, the UI reflects the fresh data — the stale cached value is not preserved
  3. The distinction between "loading" and "inactive monitor with no data" is visually clear to a user on the monitors listing page
**Plans:** 3/3 plans complete

Plans:
- [ ] 16-00-PLAN.md -- Create test scaffolds for active detection leniency and formatter pending/fresh states (Wave 0)
- [ ] 16-01-PLAN.md -- Fix active detection leniency bug, add monitorFreshness store, wire backfill freshness signals
- [ ] 16-02-PLAN.md -- Add pending/fresh visual states to count formatters with pulse animation and color transition

## Progress

**Execution Order:** 14 → 15 → 16

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 14. Revert Broken Bugfix | 1/1 | Complete    | 2026-03-19 | - |
| 15. Aggregation and Loading | 2/2 | Complete    | 2026-03-23 | - |
| 16. Data Integrity | 3/3 | Complete   | 2026-03-24 | - |
