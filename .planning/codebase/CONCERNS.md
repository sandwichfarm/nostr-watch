# Codebase Concerns

**Analysis Date:** 2026-03-04

## Tech Debt

**Outdated Development Utilities:**
- Issue: Development tools in `apps/rstate/src/utils/dev-tools.ts` use old RelayState structure with @ts-nocheck directive
- Files: `apps/rstate/src/utils/dev-tools.ts`
- Impact: Dev utilities cannot be reliably used for testing/debugging; refactored AggregatedValue structure not reflected in mocks
- Fix approach: Complete rewrite of mock generators and debug printers to use current RelayState type with AggregatedValue wrappers. Remove @ts-nocheck and enforce strict typing.

**SDK Stub Dependencies:**
- Issue: `apps/rstate/src/sdk-stubs.ts` contains multiple TODO markers for replacing mock implementations with real SDK classes
- Files: `apps/rstate/src/sdk-stubs.ts` (lines 33, 44, 68, 126, 161, 171, 176, 291)
- Impact: Production code depends on mock implementations (MockRelayPool, MockSigner) instead of actual SDK integrations; cryptographic signing is stubbed with fake signatures
- Fix approach: Replace with real ApplesauceRelayPool and PrivateKeySigner from @contextvm/sdk once SDK stabilizes; implement actual key derivation and signing

**Unfinished Language Tag Validation:**
- Issue: Language tag validation in `internal/publisher/src/kinds/Kind30166.ts` marked as TODO
- Files: `internal/publisher/src/kinds/Kind30166.ts` (line 156)
- Impact: Invalid ISO-639-1 language tags may be published in NIP-30166 events without transformation or validation
- Fix approach: Implement language tag validation against ISO-639-1 standard; add transformation for invalid tags or reject invalid inputs

**Hardcoded Filter Limits:**
- Issue: MAX_FILTERS hardcoded as 10 with TODO in `libraries/route66/src/services/MonitorService.ts`
- Files: `libraries/route66/src/services/MonitorService.ts` (line 515)
- Impact: Filter limit not derived from relay NIP-11, may not align with actual relay capabilities causing subscription failures
- Fix approach: Extract MAX_FILTERS from relay NIP-11 info document at initialization; make dynamic per relay

**Default Relay Configuration:**
- Issue: Default relays hardcoded in constructor rather than loaded from config in `libraries/route66/src/services/RelayService.ts`
- Files: `libraries/route66/src/services/RelayService.ts` (lines 22-25)
- Impact: Changing default relays requires code modification; no configuration flexibility
- Fix approach: Move default relay list to configuration file; load from config or note at initialization

**Incomplete Filter Range Testing:**
- Issue: Ambiguity handling in filter range selection marked as TODO in `libraries/auditor/src/nips/Nip01/tests/FilterRange.ts`
- Files: `libraries/auditor/src/nips/Nip01/tests/FilterRange.ts` (line 65)
- Impact: Filter range selection for timestamp-based queries may produce incorrect ranges in edge cases
- Fix approach: Define and implement ambiguity resolution strategy (probabilistic selection, confidence scoring, or explicit rejection)

**Incomplete RTT Extraction:**
- Issue: TODO to extract RTT from chronicle periods in `libraries/route66/src/services/ChronicleService.ts`
- Files: `libraries/route66/src/services/ChronicleService.ts` (line 667)
- Impact: RTT metrics not populated from historical data; incomplete uptime/downtime records
- Fix approach: Extract RTT values from chronicle period metadata if available; add fallback strategy for missing data

**GUI Table Configuration Separation:**
- Issue: Built-in config not separated from user config in table utilities
- Files: `apps/gui/src/lib/components/data-view/table/utils.ts` (line 30)
- Impact: User customizations cannot cleanly override or extend built-in table column configurations; difficult to maintain/update defaults
- Fix approach: Separate built-in config into distinct structure; apply merge strategy that allows user overrides

## Known Bugs

**Relay URL Filtering with Pipe Character:**
- Symptoms: Relays containing pipe character (|) are logged but not properly cleaned
- Files: `apps/relaymon/src/core/daemon.ts` (lines 234-239)
- Trigger: Relay URL contains | character during enqueue phase
- Issue: This is marked as a "hotfix" but suggests structural problem with URL validation/sanitization
- Workaround: Skip relays with |, delete from database manually if data corrupted
- Fix approach: Implement URL validation at data ingestion layer to reject malformed URLs before they enter system

**Database Inspection Function Incomplete:**
- Symptoms: Debug database inspection code has END marker but incomplete implementation
- Files: `apps/relaymon/src/cli/interactive/index.ts` (lines 31-88)
- Trigger: User calls `debugInspectDatabase` function
- Issue: Function logs inspection start/end but actual SQL inspection queries commented out or incomplete
- Workaround: None; use direct database CLI for inspection
- Fix approach: Complete implementation of database inspection with proper error handling and data formatting

**Monitor Coverage Calculation Debug Logging:**
- Symptoms: Console.log statements left in production monitor scoring code
- Files: `apps/rstate/src/core/score/monitor-scoring.ts` (lines 38, 47, 52)
- Trigger: computeAllScores() method executed
- Issue: Unconditional console.log calls will spam production logs
- Workaround: Set log level to suppress debug output
- Fix approach: Replace with proper logger using debug level; ensure gated by LOG_LEVEL configuration

## Security Considerations

**Cryptographic Signing Stubbed in Development:**
- Risk: MockSigner returns hardcoded 'mock_signature' instead of actual signatures; public key derivation not implemented
- Files: `apps/rstate/src/sdk-stubs.ts` (lines 170-320)
- Current mitigation: File is in /src/sdk-stubs.ts, implying awareness this is temporary; however, if deployed, signed data is fraudulent
- Recommendations:
  - Add explicit runtime check to prevent MockSigner use in production environment
  - Implement actual PrivateKeySigner using real cryptographic libraries
  - Add test to verify signatures are valid before any broadcast

**Development Utilities Exposed to Type Errors:**
- Risk: @ts-nocheck disables all type checking; dev utils could be accidentally called with wrong types in production
- Files: `apps/rstate/src/utils/dev-tools.ts` (line 1)
- Current mitigation: File name suggests development-only use; not exported from package
- Recommendations:
  - Enforce compile-time exclusion from production builds
  - Add guard in import chain to reject at require-time in production
  - Document that this module MUST NOT be imported outside development

**Unvalidated Language Tags in Events:**
- Risk: Publishing NIP-30166 events without validating language tags could create invalid event structures
- Files: `internal/publisher/src/kinds/Kind30166.ts` (lines 154-159)
- Current mitigation: None visible
- Recommendations:
  - Validate language tags against ISO-639-1 standard before publishing
  - Reject or transform invalid tags with clear logging
  - Add validation test with edge cases (empty, null, invalid format)

## Performance Bottlenecks

**Large Files with Single Responsibility Violations:**
- Problem: Multiple files exceed 700-800 lines, indicating potential single-function bloat
- Files:
  - `libraries/nocap/src/classes/Base.ts` (1220 lines)
  - `apps/rstate/src/config.ts` (846 lines)
  - `apps/rstate/src/rest/routes/relays.ts` (808 lines)
  - `apps/relaymon/src/cli/interactive/db.ts` (791 lines)
  - `libraries/route66/src/services/ChronicleService.ts` (722 lines)
- Cause: Monolithic service classes; insufficient module splitting
- Improvement path:
  - Extract Base.ts into adapter-specific subclasses (~200-300 lines each)
  - Split relays.ts route handler by operation type (GET, POST, etc.)
  - Extract ChronicleService utility functions into separate modules
  - Target: No file > 500 lines

**Console.log Statements in Production Code:**
- Problem: Unconditional console.log/warn/error scattered across codebase adds I/O overhead
- Files: 70+ files including `apps/gui/src/lib/stores/`, `internal/announce/`, `internal/publisher/`
- Cause: Debug logging left in place; no centralized logging strategy enforced at build
- Improvement path:
  - Replace all console.* with configured logger using debug levels
  - Add build-time check to reject raw console calls in production builds
  - Implement gated logger with DEBUG env var or config flag

**TypeScript 'any' Type Usage:**
- Problem: 736 occurrences of `any` across 164 files indicates weak type safety
- Files: Widespread across `apps/gui/`, `apps/rstate/`, `apps/relaymon/`
- Cause: Rapid prototyping without strict type definitions; complex data structures
- Improvement path:
  - Create proper type definitions for commonly-used `any` patterns (Record<string, any>, Array<any>)
  - Use satisfies operator and type narrowing instead of any assertions
  - Enable noImplicitAny in tsconfig.json
  - Target: Reduce any usage by 70%

**Worker-based Computation Fallback Issues:**
- Problem: GUI worker failures fall back to legacy stores without performance warning
- Files: `apps/gui/src/lib/workers/dimensions-worker-manager.ts` (lines 189, 200)
- Cause: No telemetry on fallback frequency or performance impact
- Improvement path:
  - Add metrics to track worker failure rates
  - Log performance difference between worker and fallback paths
  - Implement retry strategy with exponential backoff before fallback

## Fragile Areas

**Monitor Service Filter Management:**
- Files: `libraries/route66/src/services/MonitorService.ts`
- Why fragile: MAX_FILTERS hardcoded; if relay rejects filters, no graceful degradation; could cause subscription storms
- Safe modification: Extract filter limit from relay NIP-11 before subscription; implement filter batching logic
- Test coverage: No tests for MAX_FILTERS threshold; no tests for relay rejection scenarios
- Risk: Changes to filter strategy could break all monitor subscriptions without detection

**Database URL Sanitization:**
- Files: `apps/relaymon/src/core/daemon.ts` (lines 234-239)
- Why fragile: Pipe character check is post-hoc; malformed URLs should be rejected at ingestion; simple string check fragile
- Safe modification: Implement URL validation using URL constructor; validate at intake, not at processing
- Test coverage: No tests for malformed URL handling
- Risk: New malformed URL patterns could bypass the | check and cause downstream failures

**Relay State Type Migration:**
- Files: Multiple files in `apps/rstate/` and dev utilities
- Why fragile: Incomplete migration from old to new RelayState/AggregatedValue structure; @ts-nocheck hides type errors
- Safe modification: Use type-safe utilities to access wrapped values; avoid type assertions
- Test coverage: dev-tools not tested; old structure assumptions may break queries
- Risk: Further refactoring of RelayState could break development utilities used in debugging

**GUI Store Initialization Race Conditions:**
- Files: `apps/gui/src/lib/fetchers/seed.ts`, `apps/gui/src/lib/stores/nip11s.ts`
- Why fragile: Multiple stores depend on StateManager initialization; console.warn suggests timing issues
- Safe modification: Use explicit initialization sequence with event handlers; avoid timing assumptions
- Test coverage: Bootstrap tests exist but worker fallback not tested; race conditions possible on slow machines
- Risk: Timing changes (new code, slower hardware) could cause data loss or inconsistent state

## Scaling Limits

**Relay List Size:**
- Current capacity: Tested with ~3000 relays in GUI; memory usage grows linearly with relay count
- Limit: GUI becomes sluggish > 5000 relays; worker thread overhead adds latency
- Scaling path: Implement virtual scrolling in tables; paginate relay loading; move more computation to workers
- Metric to monitor: apps/gui performance metrics under 10K+ relays

**Monitor Subscription Filter Depth:**
- Current capacity: 10 filters per monitor (hardcoded MAX_FILTERS)
- Limit: Most relays support NIP-01 with limits of 10-100 filters; exceeding causes subscription rejection
- Scaling path: Derive MAX_FILTERS from NIP-11; batch large filter sets across multiple subscriptions
- Metric to monitor: Filter rejection rates, resubscription attempts

**Observation Storage:**
- Current capacity: SQLite-based; no stated upper limit but relaymon stores per-relay metrics
- Limit: Long-running instances accumulate 100GB+ databases without pruning
- Scaling path: Implement time-based retention policy; archive old observations; migrate to PostgreSQL for scale
- Metric to monitor: Database size growth; query latency on large tables

**Worker Thread Pool Size:**
- Current capacity: Single worker per GUI window; limited to browser thread pool
- Limit: Heavy computation (derivations) can block UI on weak devices
- Scaling path: Implement worker pool with dynamic sizing; split computations across multiple workers; use SharedArrayBuffer for shared state
- Metric to monitor: Time to interactive (TTI); dropped frame rates under load

## Dependencies at Risk

**nostr-tools Package:**
- Risk: Cryptographic library; if compromised, all Nostr key operations vulnerable
- Impact: All signing, verification, and key derivation affected
- Version: ^2.10.4 allows breaking changes; no lock to specific version
- Migration plan: Implement abstraction layer in `internal/crypto`; allow switching between nostr-tools and alternative implementations (nips library)

**Transient Dependencies Security:**
- Risk: pnpm overrides in place for vulnerable packages (pbkdf2, sha.js, form-data, etc.) indicating known vulnerabilities
- Impact: If vulnerabilities introduced in new versions, override must be updated manually
- Current state: 18 overrides in pnpm.overrides
- Migration plan: Audit each override; migrate to alternative packages where possible; automate override updates via dependabot

**TypeScript Dependency Age:**
- Risk: ^5.7.2 allows TypeScript updates; major versions have breaking changes to type checking
- Impact: Type safety could change unexpectedly; strict checks could fail on upgrade
- Migration plan: Implement pre-upgrade type checking; use narrower semver constraints (5.7.x); test with next major before updating

**esbuild and Rollup Build Tools:**
- Risk: Rapid changes to JavaScript build ecosystem; incompatibilities between versions
- Impact: Build failures, performance regressions, bundle size increases
- Current state: esbuild ^0.25.0, Rollup ^4.59.0 (both with loose constraints)
- Migration plan: Lock to exact versions; test thoroughly before updating; implement build performance benchmarks

## Missing Critical Features

**User-Provided Blocklist Integration:**
- Problem: GUI can sync blocklists from monitors but no user-defined blocklist support
- Blocks: Users cannot maintain personal relays to block
- Files: `apps/gui/src/lib/stores/blocklist.ts` (reads only from monitor events)
- Impact: Users forced to use monitor-provided blocklists; no custom filtering
- Fix approach: Add localStorage-based user blocklist; merge with monitor blocklists; persist across sessions

**Pagination for Large Datasets:**
- Problem: Table components load all data in memory; no server-side pagination for relay lists
- Blocks: Scale beyond 10K relays; mobile devices with limited RAM
- Files: `apps/gui/src/lib/components/lists/table/` (DataTable components)
- Impact: OOM crashes on large relay collections
- Fix approach: Implement infinite scroll or cursor-based pagination; lazy-load table data

**Database Schema Versioning:**
- Problem: No migration system for relaymon database; schema changes require manual intervention
- Blocks: Rolling out schema updates without downtime
- Files: `apps/relaymon/src/db/` (no migration framework)
- Impact: Deployments must stop service; downtime for migrations
- Fix approach: Implement flyway or liquibase-style migrations; version schema; auto-migrate on startup

**Relay Health SLA Metrics:**
- Problem: System tracks uptime/downtime but no SLA calculation (availability %, P99 latency, etc.)
- Blocks: Cannot generate SLA reports for relay operators
- Files: No SLA calculation in rstate or relaymon
- Impact: Operators cannot prove reliability; no objective health benchmarking
- Fix approach: Add SLA calculator; expose via REST API; add to relay detail view

## Test Coverage Gaps

**Monitor Scoring Logic:**
- What's not tested: computeAllScores() method; monitor coverage calculation; edge cases (0 monitors, 1 monitor, very high agreement)
- Files: `apps/rstate/src/core/score/monitor-scoring.ts`
- Risk: Scoring changes could silently break without detection; scoring math could diverge from expected
- Priority: High - affects relay rankings
- Test approach: Add snapshot tests for scoring outputs; add unit tests for edge cases; property-based tests for monotonicity

**Relay URL Validation:**
- What's not tested: Malformed URL handling; edge cases (very long URLs, special characters, non-ASCII)
- Files: `apps/relaymon/src/core/daemon.ts`, `libraries/route66/` (no validation layer found)
- Risk: Malformed URLs cause silent failures or database corruption
- Priority: High - affects data integrity
- Test approach: Implement comprehensive URL validation tests; fuzz testing with invalid inputs; regression test for | character issue

**Worker Restart and Recovery:**
- What's not tested: Worker failure scenarios; fallback to legacy path; recovery after max restarts exceeded
- Files: `apps/gui/src/lib/workers/dimensions-worker-manager.ts` (worker setup, but no tests visible)
- Risk: Worker errors silently fall back without user awareness; no way to diagnose issues
- Priority: Medium - affects user experience on failures
- Test approach: Mock worker failures; test fallback path; verify error messages; test max restart behavior

**Bootstrap Data Initialization:**
- What's not tested: Race conditions in seed/bootstrap loading; missing data handling; partial data states
- Files: `apps/gui/src/lib/fetchers/seed.ts`, `apps/gui/src/lib/fetchers/bootstrap.ts`
- Risk: Race conditions could leave store in inconsistent state; missing telemetry for failures
- Priority: High - affects app stability on startup
- Test approach: Add timing tests; test with slow/failing network; verify store consistency after each stage

**Configuration Type Validation:**
- What's not tested: Invalid config loading; missing required fields; type coercion edge cases
- Files: `apps/rstate/src/config.ts` (complex, 846 lines but no validation tests found)
- Risk: Invalid config silently accepted; runtime errors occur later in cryptic ways
- Priority: Medium - affects startup reliability
- Test approach: Add config schema validation tests; test all error paths; verify type safety

**Nostr Event Signature Verification:**
- What's not tested: Invalid signature handling in GUI; verification failures; replay attack scenarios
- Files: `apps/gui/src/lib/services/SignatureVerificationService/` (exists but coverage unknown)
- Risk: Unsigned or invalid events could be accepted; data integrity compromised
- Priority: Critical - security issue
- Test approach: Add comprehensive signature validation tests; test with tampered events; test with replay scenarios

---

*Concerns audit: 2026-03-04*
