---
gsd_state_version: 1.0
milestone: v2.5
milestone_name: GUI XSS Hardening
status: verifying
stopped_at: Completed 29-01-adversarial-regression-sweep-PLAN.md (Phase 29 ready for verification — final v2.5 phase)
last_updated: "2026-05-03T20:30:10.501Z"
last_activity: 2026-05-03
progress:
  total_phases: 6
  completed_phases: 6
  total_plans: 6
  completed_plans: 6
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-03)

**Core value:** Anyone can run their own relay monitor — from watching a handful of personal relays to scanning the entire network — with a one-click install on self-hosted platforms.
**Current focus:** Phase 29 — Adversarial Regression Sweep & Sanitization-Contract Doc

## Current Position

Phase: 29 (Adversarial Regression Sweep & Sanitization-Contract Doc) — EXECUTING
Plan: 1 of 1
Status: Phase complete — ready for verification
Last activity: 2026-05-03

**Phase queue (v2.5):**

1. Phase 24 — Sanitize Helper Surface (URL-01)
2. Phase 25 — CSS Banner Sinks (CSS-01, CSS-02)
3. Phase 26 — href Allowlist Sweep (URL-02, URL-03)
4. Phase 27 — CountCard Structural Fix (CARD-01, CARD-02, CARD-03)
5. Phase 28 — notes.ts Hardening (FEED-01..05)
6. Phase 29 — Adversarial Regression Sweep & Sanitization-Contract Doc (TEST-04, TEST-05, TEST-06, AUDIT-01, AUDIT-02)

## Performance Metrics

**Velocity:**

- Total plans completed: 0 (this milestone)
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
| Phase 14-revert-broken-bugfix P01 | 6 | 2 tasks | 2 files |
| Phase 15-aggregation-and-loading P01 | 2 | 2 tasks | 2 files |
| Phase 15 P02 | 5 | 2 tasks | 3 files |
| Phase 15-aggregation-and-loading P02 | 5 | 3 tasks | 3 files |
| Phase 16-data-integrity P00 | 3 | 2 tasks | 2 files |
| Phase 16 P01 | 5 | 2 tasks | 5 files |
| Phase 16-data-integrity P02 | ~45 | 2 tasks | 3 files |
| Phase 20-dedup-performance-overrides P02 | 2min | 1 tasks | 1 files |
| Phase 20-dedup-performance-overrides P01 | 4min | 2 tasks | 8 files |
| Phase 20 P03 | 9min | 2 tasks | 2 files |
| Phase 20-dedup-performance-overrides P04 | 5min | 2 tasks | 2 files |
| Phase 24-sanitize-helper-surface P01 | 3min | 2 tasks | 2 files |
| Phase 25-css-banner-sinks P01 | 4min | 2 tasks | 7 files |
| Phase 26-href-allowlist-sweep P01 | 3min | 2 tasks | 3 files |
| Phase 27-countcard-structural-fix P01 | 6min | 3 tasks | 5 files |
| Phase 28-notes.ts-hardening P01 | 4min | 2 tasks | 2 files |
| Phase 29-adversarial-regression-sweep-&-sanitization-contract-doc P01 | 5min | 3 tasks | 9 files |

## Accumulated Context

### Decisions

- Revert first: Start from pre-bugfix/monitor-pages-aggregation state, fix properly afterward
- v2.1 shelved: Test profiles work (Phases 11-13) not abandoned, just paused
- v3.0 continues separately: Self-hosted distribution on feature/self-hosted branch (PR #874)
- [Phase 14-revert-broken-bugfix]: Revert first: surgically remove all PR #861 changes to establish known-good baseline before re-implementing aggregation properly in Phase 15
- [Phase 15-aggregation-and-loading]: Collapsed monitors+monitorsSorted into single derived store with re-export alias; StateManager.set extracted into separate subscription to break localStorage cascade
- [Phase 15-aggregation-and-loading]: computeAndUpdateRelayLiveness now unconditionally overwrites liveness counts with dead-threshold zeroing — no merge with stale data
- [Phase 15-aggregation-and-loading]: null sentinel for uninitialized liveness counts: enables formatters to show '-' vs '0' for uninitialized state
- [Phase 15-aggregation-and-loading]: livenessReady initialized from cache at startup: returning users with warm cache skip loading dashes
- [Phase 15-aggregation-and-loading]: empty state checks monitors.length not monitorRows.length: discriminates no-monitors from rows-still-computing
- [Phase 15-aggregation-and-loading]: Checkpoint:human-verify approved: monitors page shows progressive reveal with '-' count columns until livenessReady, resolving to real numbers after first computation
- [Phase 16-data-integrity]: TDD RED scaffolds use vi.mock() for localStorage-dependent store imports in test environment; computeActive pure function in test file validates formula contract Plan 01 must implement
- [Phase 16-data-integrity]: monitorFreshness store tests use dynamic import() + manual cleanup; dataTable tests mock $lib/stores/monitors.js to prevent module-level localStorage crash
- [Phase 16-data-integrity]: monitorFreshness is ephemeral — never persisted to StateManager/localStorage to avoid stale fresh-flags across sessions
- [Phase 16-data-integrity]: monitorsLivenessLeniency added as reactive derived input to monitorRows so leniency changes instantly re-derive all rows without separate trigger
- [Phase 16-data-integrity P02]: Freshness signal driven by liveness computation completion, not bootstrap lifecycle — avoids premature fresh state on cached-only rows
- [Phase 20-dedup-performance-overrides]: Plan 20-02: Default applied via validateConfig mutation, not processConfigTimeValues — keeps Plan inside strict single-file constraint and matches existing lazy conversion pattern for nip11_cache_ttl
- [Phase 20-dedup-performance-overrides]: DedupOverrideRule locked to 4 fields (name/test/action/reason); evaluator parses URL once + per-rule try/catch; static barrel + first-match-wins, no priority field
- [Phase 20-dedup-performance-overrides]: Per-rule isolation: each override rule has its own source file AND its own test file; no cross-test imports — adding a new override = create one source + one test + add one barrel line
- [Phase 20]: Override hook placed immediately after canonicalMURL normalization and BEFORE the same-NIP-11 early-return — covers all downstream cases with a single short-circuit, per Plan 20-03
- [Phase 20]: Consumer-side lazy timestring conversion via local parseStaleSkipTimestring helper (not importing from core/daemon.ts) — keeps hostnames.ts self-contained, matches the deferred-conversion pattern established by Plan 20-02
- [Phase 20]: Per-group granularity for the stale-skip gate (not per-row) with structural-proxy test assertions — avoids refactoring nocap.check injection point while still guaranteeing zero-call invariant via LOCKED INTERPRETATION comment
- [Phase 20-dedup-performance-overrides]: Plan 20-04: Migration sentinel renamed to rerun_dedup_online_unignored_v1 (Phase 19 v2 row stays as history); SQL-layer scope narrowing via WHERE online=1 AND ignore=0; cachedOnline snapshot passed via ctx.onlineUrls on every per-row relayHostnameDedup call
- [Phase 20-dedup-performance-overrides]: Plan 20-04: Lockstep sentinel literal rename across 12 occurrences in hostname-dedup.test.ts — including the Plan-20-03-Task-2-inserted literal at line 2007 in the Phase 20 philosophy test block which 20-03 deliberately left unchanged pending this plan
- [Phase 20-dedup-performance-overrides]: Plan 20-04: db.query monkey-patch + exact-SQL regex as the PERF-02 query-count assertion mechanism (mutable singleton pattern); try/finally guarantees originalQuery restored before subsequent tests
- [v2.5]: Encode-on-output at the sink (extends `apps/gui/src/lib/utils/sanitize.ts`) — locked by audit on `security/xss-3` 2026-05-03; carries forward #899 / #900 pattern
- [v2.5]: Text-bind-by-default for fallbacks — mirrors #900 DataTable fallback fix; `CountCard` is the next candidate
- [v2.5]: No new runtime dependencies — DOMPurify already in `apps/gui` deps; v2.5 extends `sanitize.ts`, no new packages
- [v2.5]: Test-then-fix discipline (#899 / #900 pattern) — failing-test commit lands before fix commit; tests import the real component / formatter / parser and feed it adversarial input
- [v2.5]: `@nostrwatch` package boundary stays clean — sanitization is the GUI's responsibility at the sink; `libraries/` and `internal/` source contains no innerHTML / outerHTML / insertAdjacentHTML / document.write
- [Phase 24-sanitize-helper-surface]: safeHttpUrl exported from apps/gui/src/lib/utils/sanitize.ts (http/https-only allowlist, rejects javascript:/data:/vbscript:/file:/mailto:/tel:/protocol-relative + breakout char set); on accept returns escapeHtml(input) for &amp; consistency with safeImageUrl
- [Phase 24-sanitize-helper-surface]: Module-private isUrlBreakout factored as single source of truth — both safeHttpUrl and safeImageUrl call it; the regex literal /["'<>\n\r\\]/ now appears exactly once in sanitize.ts
- [Phase 24-sanitize-helper-surface]: safeImageUrl stays dual-context (img src AND css url('…')) — does NOT split into safeImageUrl + safeCssUrl; documented in JSDoc helper-per-sink table
- [Phase 24-sanitize-helper-surface]: AUDIT-02 sanitization-contract dev note authored in JSDoc header of sanitize.ts (trust boundary, helper-per-sink table, #899/#900 discipline) — Phase 29 AUDIT-02 becomes verification of the table, not authoring
- [Phase 24-sanitize-helper-surface]: MIGR-01 FOLLOW-UP note (delete sanitize.ts module once {@html} is gone) preserved verbatim in JSDoc — its disappearance would be a regression
- [Phase 25-css-banner-sinks]: Phase 25-01: bannerStyleString helper centralizes the dual-variant linear-gradient + url() banner CSS template across all 4 banner sinks (data-view DataTable, lists DataTable, CardOperator, PageHeader); helper internally gates via Phase 24's safeImageUrl, closing CSS-02 single-quote breakout at every sink
- [Phase 25-css-banner-sinks]: Phase 25-01: detection regex revised to domain-specific /url\(\s*['"]\$\{[^}]*banner/i (case-insensitive) — original /background:\s*url\('\$\{/ was a false-pass (real sinks have linear-gradient between background: and url(); broader /url\(['"]\$\{/ would falsely flag the legitimate network-icon CSS in lib/config/dataTable/relays.ts
- [Phase 25-css-banner-sinks]: Phase 25-01: structural test (banner-style-structural.test.ts) walks apps/gui/src/**/*.{svelte,ts}, runs the domain-specific regex with one whitelist (the test file itself) — turns future banner-injection regression into a build-fail event; pattern is reusable for Phase 29 cross-cutting sweeps over href/image/kind:0 sinks
- [Phase 26-href-allowlist-sweep]: Wrap ONLY the known vuln (CardFees:60) — Nav/RelaySidebar/CountCard hrefs are safe-by-construction; defensive wrapping rejected (audit-pass doc gives evidence; saves runtime cost)
- [Phase 26-href-allowlist-sweep]: HREF-AUDIT.md ships at .planning/phases/26-href-allowlist-sweep/HREF-AUDIT.md (force-added with git add -f to override the .planning/ gitignore; also mirrored to GREEN commit body for git log discoverability)
- [Phase 26-href-allowlist-sweep]: Reactive-pair pattern: keep $: paymentsUrl reactive (source-truthy guard for {#if}) AND add sibling $: safePaymentsUrl = safeHttpUrl(paymentsUrl) (sanitized rendering) — separates concerns, smaller diff than collapsing into one reactive
- [Phase 26-href-allowlist-sweep]: Comment-stripping helper /<!--[\s\S]*?-->/g excludes dead-code blocks from structural source scanning — reusable pattern for any Svelte component with HTML comment-wrapped legacy code (CardFees.svelte:84-138 dead block preserved byte-for-byte)
- [Phase 27-countcard-structural-fix]: Slot-API + text-bound prop fallback for CountCard topText/bottomText/$value (mirrors #900 DataTable pattern); callers opt in via slot syntax for markup, plain-text props text-bind transparently via slot fallback
- [Phase 27-countcard-structural-fix]: Reactive-pair safeLink/internalLink in CountCard — external URLs through Phase 24 safeHttpUrl allowlist; leading-single-slash internal routes via /^\/(?!\/)/ to block protocol-relative // bypass while preserving Counts.svelte /relays-style links
- [Phase 27-countcard-structural-fix]: valueSentinel readable in RelayFeeItem keeps CountCard's value-display gate satisfied; default-slot content does the visible CARD-03 Number(amount) coercion in template text-bind position
- [Phase 27-countcard-structural-fix]: CardFees.svelte dead CountCard import removed in GREEN-B (audit step from CONTEXT.md surfaced it); dead-code comment block lines 85-139 preserved byte-for-byte
- [Phase 27-countcard-structural-fix]: RED test adversarial assertion uses /<\s*\w/ instead of literal onerror= substring — escapeHtml only neutralizes tag delimiters; substring onerror= survives entity encoding (and is inert without a live <...> around it). Structural test on migrated callers is what guarantees onerror= cannot reach a live tag context (Rule 1 deviation fixed before RED commit)
- [Phase 28-notes.ts-hardening]: Sequential async pipeline (applyAsyncSequential) replaces broken parallel-on-same-input applyAsync; each transform's output feeds the next via for-await reduce
- [Phase 28-notes.ts-hardening]: applySanitize is the LAST async step and always-on; the if(config.sanitize) gate is structurally removed at parseNote(), the field stays in ParseConfig as @deprecated for caller back-compat
- [Phase 28-notes.ts-hardening]: parseImages/parseVideos: matched URL through safeImageUrl — on reject REMOVE from text; regex tightened from \S+ to [^\s"'<>]+ as defense-in-depth above safeImageUrl
- [Phase 28-notes.ts-hardening]: DOMPurify ADD_TAGS:['iframe'] + ADD_ATTR includes 'src' (load-bearing — without it, iframe tag survives but src is stripped, breaking YouTube embeds); iframe src is regex-locked at replaceYoutubeLink (videoId=[a-zA-Z0-9_-]+) so no attacker input reaches it
- [Phase 28-notes.ts-hardening]: vi.mock target literal-matching: '$lib/stores/services.js' with .js suffix is load-bearing — must match notes.ts:7 source import literal byte-for-byte; missing suffix silently bypasses interception and creates false security regression coverage
- [Phase 28-notes.ts-hardening]: Test assertion correction (Rule 1 deviation, mirrors Phase 27): bare /onerror=/i substring assertion replaced with structural /<\s*img\b/ 'no live tag opener' — escapeHtml only neutralizes tag delimiters; substring onerror= survives entity encoding but is inert as visible text without surrounding live <...>
- [Phase 29-adversarial-regression-sweep-&-sanitization-contract-doc]: Inventory floor adjusted from 13 to 12 LIVE sinks — planner's count included a commented-out {@html $readerContent} in Reader.svelte:110 inside dead-code block; walker correctly strips comments before counting (matches runtime surface)
- [Phase 29-adversarial-regression-sweep-&-sanitization-contract-doc]: Behavioral parseNote test in v2.5-xss-smoke uses Phase 28 byte-for-byte assertion shape (not.toMatch /<script\b/i + /onerror=/i + not.toContain alert(1)) — DOMPurify keeps <img src="x">, so asserting not.toMatch /<img\b/i would falsely fail
- [Phase 29-adversarial-regression-sweep-&-sanitization-contract-doc]: AUDIT-01 (formatter migration to Svelte components) FORMALLY DEFERRED to v2.6+ via PROJECT.md Key Decisions row; v2.5 closed live vectors via encode-on-output discipline + dataTable formatters are encode-on-output safe today (verified by #899/#900 + html-sink-audit canary)
- [Phase 29-adversarial-regression-sweep-&-sanitization-contract-doc]: Sanitization contract dev note co-located in sanitize.ts JSDoc header (5 sections: Trust boundary, Helper-per-sink table, Test-then-fix discipline, v2.5 milestone summary, Deferred AUDIT-01) — no separate SECURITY.md or docs/security.md; lives with the helper that enforces the contract

### Pending Todos

None yet.

### Blockers/Concerns

- Detail page (/monitors/[pubkey]) is out of scope — working acceptably, do not touch
- AUDIT-01 follow-up (replace HTML-string formatters with Svelte components, drop `{@html}` from `DataTable.svelte` / `PageHeader.svelte`) is currently scoped as deliver-or-defer in Phase 29 — if the migration is large, defer with a tracked decision rather than blocking the milestone

## Session Continuity

Last session: 2026-05-03T20:30:10.498Z
Stopped at: Completed 29-01-adversarial-regression-sweep-PLAN.md (Phase 29 ready for verification — final v2.5 phase)
Resume file: None
Next action: `/gsd:plan-phase 24` — plan Phase 24 Sanitize Helper Surface
