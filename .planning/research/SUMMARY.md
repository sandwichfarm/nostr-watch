# Project Research Summary

**Project:** @nostrwatch/auditor — Wider NIP Support
**Domain:** Nostr relay conformance testing — NIP test suite expansion
**Researched:** 2026-03-12
**Confidence:** HIGH

## Executive Summary

The `@nostrwatch/auditor` library is a Node.js ESM conformance testing tool that checks Nostr relay behavior against official NIP specifications. The existing suite architecture (Suite → SuiteTest → Sampler/Ingestor → Expect) is well-designed and extensible; research confirms every new NIP can be added by following one of five established patterns without changing the base framework. The single most impactful gap blocking nearly all new test suites is the absence of event signing capability — the library has no dependency on `nostr-tools`, so it cannot create, sign, or verify Nostr events. Adding `nostr-tools@^2.10.4` (already pinned at the workspace root) resolves this in a single `pnpm` command and unlocks six or more NIP suites simultaneously.

The recommended approach is a staged expansion: fix the existing broken NIP-42 scaffolding first, then build the shared signing utilities that unblock write-heavy NIPs, then add the high-adoption behavioral NIPs (NIP-09, NIP-40, NIP-45, NIP-70, NIP-13, NIP-01 completeness, NIP-11 limits enforcement) as Phase 1, and defer high-complexity niche NIPs (NIP-29, NIP-62, NIP-86) to Phase 2. The majority of target NIPs have HIGH-confidence official specs and clear testable behaviors, making this expansion well-scoped with low ambiguity.

The key risks are operational, not architectural. Writing test events to live relays permanently pollutes relay data; this must be mitigated by using ephemeral keypairs and marker tags from the first write-heavy suite. The dual-manifest registration pattern (both `manifest.js` and `suite-test-manifest.js` must be updated atomically) is a silent failure trap that will cause carelessly added suites to be silently skipped with no error. A manifest consistency validator should be the very first deliverable of the implementation work. There is also a latent `formatNip()` bug with incorrect padding logic that will silently drop suites if left unfixed.

## Key Findings

### Recommended Stack

The auditor stack requires only one net-new dependency: `nostr-tools@^2.10.4`. The workspace root and `schemata-js-ajv` already pin this version, so no version conflicts arise. The `nostr-tools/pure` subpath (pure JS crypto, no WASM initialization required) provides all necessary primitives: `generateSecretKey`, `getPublicKey`, `finalizeEvent`, `verifyEvent`, and the `nip44` subpath for gift-wrap encryption. No other additions are needed — HTTP is covered by the existing `cross-fetch`, WebSocket by `@nostrwatch/websocket`, and PoW computation reuses `@noble/hashes` already bundled inside `nostr-tools`.

**Core technologies:**
- `nostr-tools@^2.10.4` (new): Event signing, key generation, NIP-44 encryption — only addition needed; matches workspace root pin
- `@nostrwatch/websocket` (existing): WebSocket connections to relays — unchanged
- `ajv` + `@nostrability/schemata` (existing): JSON schema validation for message types — unchanged
- `cross-fetch` (existing): HTTP for NIP-11 and NIP-86 pattern tests — unchanged
- `vitest` (existing): Unit testing — applies to new ingestors and signing utilities

Use `nostr-tools/pure` not `nostr-tools/wasm` — WASM requires async initialization that adds complexity in a test-runner context. Pure JS is adequate for conformance testing throughput.

**What NOT to use:** NDK (`@nostr-dev-kit/ndk`) obscures the raw WebSocket messages the auditor must inspect and validate. `nostr-tools@1.x` has an incompatible v1 API. Separate SHA-256 libraries duplicate what `nostr-tools` already bundles via `@noble/hashes`.

### Expected Features

Research from official NIP specs and three major relay implementation READMEs (strfry, nostr-rs-relay, nostream) identifies eight P1 features with broad adoption and clear testable behaviors.

**Must have (table stakes — P1):**
- **NIP-42 complete AUTH suite** — challenge-response flow with kind 22242; schemata exist but class is not runnable; 3 major relays support it; gates NIP-70, NIP-37, and NIP-59 behavior
- **NIP-09 deletion enforcement** — publish kind 5 + query verification; all three major relays implement it
- **NIP-40 expiration enforcement** — reject expired incoming events; do not serve stored expired events; all three major relays; spec uses SHOULD not MUST (test as WARN not FAIL)
- **NIP-45 COUNT verb support** — `["COUNT", id, filter]` → `["COUNT", id, {"count": N}]`; low complexity; relay may legitimately refuse with CLOSED
- **NIP-70 protected events** — `["-"]` tag enforcement without/with AUTH; strfry; depends on NIP-42
- **NIP-01 OK/CLOSED prefix completeness** — all 8 machine-readable prefixes (`duplicate`, `pow`, `blocked`, `rate-limited`, `invalid`, `restricted`, `mute`, `error`)
- **NIP-11 limitation fields enforcement** — test advertised limits (`max_message_length`, `created_at` bounds, `max_subscriptions`) for actual enforcement
- **NIP-13 PoW conditional** — send under-powered event if `min_pow_difficulty > 0` in NIP-11; expect `pow:` prefix rejection

**Should have (differentiators — P2):**
- **NIP-29 relay-based groups** — stateful, niche, only group relays; HIGH complexity; limited adoption
- **NIP-62 Request to Vanish** — strong MUST requirements but testing re-broadcast prevention is inherently hard
- **NIP-86 Relay Management API** — HTTP-only, NIP-98 auth required, operator-targeted; separate test surface

**Defer indefinitely:**
- **NIP-43 invite system** — draft status, minimal adoption; re-evaluate when finalized
- **NIP-66 publish results** — about auditor output format, not testing relays; separate milestone
- All client-only NIPs (NIP-05, NIP-06, NIP-07, NIP-19, NIP-44, NIP-46, etc.) — no relay behavior to test

### Architecture Approach

The auditor follows a layered architecture where `Auditor` orchestrates `Suite` instances, each owning a WebSocket connection and routing messages to `SuiteTest` implementations. Five established patterns cover all new NIPs: Filter-and-Assert (passive read), Write-Then-Read (event signing required), Challenge-Response (NIP-42 only), Custom Protocol Extension (NIP-77-style new message types), and HTTP-Only (NIP-11/NIP-86 style). Every NIP follows the same directory layout (`src/nips/NipXX/index.ts`, `tests/`, optional `interfaces/`, `schemata/`, `ingestors/`). No framework changes are needed.

**Major components:**
1. `Auditor` — suite orchestration, NIP-11 pre-check, passrate aggregation, dual-manifest loading via `isRunnableSuiteKey()`
2. `Suite` — WebSocket ownership, message routing to `_onMessageXxx`/`onMessageXxx` handlers, schema validation, Sampler lifecycle
3. `SuiteTest` — single behavioral scenario: send messages, await responses, assert with Expect; state is isolated per test
4. `Sampler/Ingestor` — pre-test data collection for suites requiring real relay content before test execution
5. `src/utils/signing.ts` (new, shared) — `generateTestKeypair()`, `signTestEvent()`, `signAuthEvent()` using nostr-tools; prerequisite for 6+ suites

**Critical structural issue to fix now:** The existing `Nip42/index.ts` is a bare class — it does not extend `Suite`, has no `slug` getter, no `requires`, no `test()` method, and is absent from both manifests. It is completely non-runnable. The schemata and interfaces are valid and should be kept; only the class structure needs to be promoted to a proper Suite subclass.

### Critical Pitfalls

1. **Dual manifest mismatch causes silent skip** — Adding a NIP to `manifest.js` without also updating `suite-test-manifest.js` causes the suite to be silently dropped by `isRunnableSuiteKey()`. No error, no warning, no test run. Prevention: build a manifest consistency validator as the first deliverable; treat both files as an atomic pair.

2. **Test event pollution on live relays** — Write-heavy NIPs (NIP-09, NIP-40, NIP-42, NIP-70) publish events to production relays permanently. These contaminate ingestor samples in future runs. Prevention: always use ephemeral keypairs generated fresh per audit run; tag test events with `["test", "nostr-watch-auditor"]`; use ephemeral event kinds (20000–29999) where allowed.

3. **NIP-42 blocking all other suites on auth-required relays** — Relays requiring AUTH before any subscription respond `CLOSED: auth-required` to every suite, cascading into false failures everywhere. Prevention: detect auth-on-connect in a NIP-42 pre-flight; mark all other suites as `skipped` with reason `"relay requires auth"` rather than failing them.

4. **Timing-sensitive write/read gaps** — Slow relays may not have indexed a written event by the time the subsequent REQ arrives. Prevention: insert configurable 100–200ms delay between EVENT submission and follow-up REQ; design NIP-09 tests to assert deletion acceptance (OK: true), not immediate absence.

5. **`formatNip()` bug** — The condition `if (number > 0 || number <= 9)` is logically wrong and misformats NIP numbers >= 100. Prevention: fix to `number < 10`, add unit tests covering `formatNip(1)`, `formatNip(9)`, `formatNip(42)`, `formatNip(100)`.

## Implications for Roadmap

The dependency graph dictates phase order. Signing utilities block all write-heavy NIP suites. NIP-42 blocks NIP-70. NIP-11 data gates NIP-13 PoW tests. Two bugs in the foundation layer must be fixed before any new suite is registered. These dependencies naturally collapse into five phases.

### Phase 1: Foundation — Code Quality, Shared Infrastructure, and Tooling

**Rationale:** Two latent bugs (`formatNip()` condition, NIP-42 bare class) and missing signing utilities will silently break every subsequent phase if not addressed first. The manifest consistency validator prevents wasted debugging cycles across all later phases. This phase is entirely code-quality and infrastructure work with no external dependencies.

**Delivers:** A trustworthy platform for adding NIP suites — all silent failure modes eliminated, shared signing utilities available for 6+ suites.

**Addresses:**
- Fix `formatNip()` condition to `number < 10`; add unit tests
- Build manifest consistency validator (test-time or build-time check asserting key symmetry between both manifests)
- Create `src/utils/signing.ts` with `generateTestKeypair()`, `signTestEvent()`, `signAuthEvent()` using `nostr-tools/pure`
- Create `src/utils/async.ts` with `waitFor(ms)` for expiration timing
- Add `nostr-tools@^2.10.4` as explicit auditor dependency (`pnpm --filter @nostrwatch/auditor add nostr-tools@^2.10.4`)

**Avoids:** Pitfall 1 (manifest mismatch), Pitfall 5 (formatNip bug); enables Pitfalls 2/4 tooling

### Phase 2: NIP-42 AUTH — Fix Broken Scaffolding and Build Complete Suite

**Rationale:** NIP-42 scaffolding exists but is non-runnable. It must be fixed before any auth-dependent suite can exist. NIP-42 also has the most complex test pattern (challenge-response with state tracking) and should be proven in isolation before NIP-70, NIP-09 (authenticated deletion), and NIP-37 depend on it.

**Delivers:** A fully functional NIP-42 suite covering 8 testable assertions: challenge detection, kind 22242 validation, timestamp window, challenge matching, relay URL matching, no-broadcast enforcement, `auth-required:` prefix, `restricted:` prefix.

**Uses:** `signAuthEvent()` from Phase 1; existing NIP-42 schemata and interfaces (valid, retained).

**Implements:** Challenge-Response pattern (Architecture Pattern 3); auth-on-connect detection pre-flight to prevent cascade failures in other suites.

**Avoids:** Pitfall 3 (auth blocking all suites), Pitfall 10 (10-minute timestamp window handling)

### Phase 3: Core Behavioral NIPs — Write-Then-Read Suite Group

**Rationale:** These NIPs are the highest-value additions (all three major relays implement them), share the Write-Then-Read architectural pattern, and all depend on Phase 1 signing utilities. Grouping them minimizes context-switching.

**Delivers:** NIP-09 deletion enforcement, NIP-40 expiration enforcement.

**Addresses:**
- NIP-09: publish event, kind-5 deletion, query verification (e-tag and a-tag paths); assert deletion acceptance not immediate absence (SHOULD behavior; assert OK: true then test absence as advisory)
- NIP-40: reject expired incoming events (FAIL); do not serve stored expired events (WARN, not FAIL — spec says SHOULD not MUST)

**Uses:** `signTestEvent()`, `generateTestKeypair()` from Phase 1; Write-Then-Read pattern with `completeOn = ['off']`.

**Avoids:** Pitfall 2 (test event pollution — ephemeral keypairs), Pitfall 4 (write/read timing gaps), Pitfall 7 (SHOULD treated as MUST)

### Phase 4: Protocol Extensions and Conditional Tests

**Rationale:** NIP-45 introduces a new message type (COUNT) requiring a generator class and messageValidator but is otherwise low-complexity. NIP-70 depends on Phase 2 NIP-42. NIP-13 and NIP-11 limits enforcement are conditional on NIP-11 document fields and extend the existing NIP-11 suite. NIP-01 prefix completeness extends the existing NIP-01 suite. This phase completes all P1 table-stakes features.

**Delivers:** NIP-45 COUNT support, NIP-70 protected events, NIP-13 PoW conditional test, NIP-01 OK/CLOSED prefix completeness, NIP-11 limitation field enforcement.

**Addresses:**
- NIP-45: COUNT generator class, messageValidator for COUNT response; pass if COUNT response OR CLOSED received (refusal is valid per spec); timeout-only is the failure condition
- NIP-70: declare NIP-42 as prerequisite in `suite.requires`; three test cases (no auth, auth + matching pubkey, auth + mismatched pubkey)
- NIP-13: conditional on `min_pow_difficulty > 0` from NIP-11; add as single SuiteTest to NIP-13 or extended NIP-11 suite
- NIP-01 prefixes: extend existing suite; trigger each condition where reproducible; verify prefix format
- NIP-11 limits: extend existing suite; test `max_message_length`, `created_at` bounds, `max_subscriptions`; flag "advertised but unenforced" as advisory

**Uses:** Architecture Pattern 4 (Custom Protocol Extension) for NIP-45 COUNT message type; Phase 2 NIP-42 for NIP-70; Architecture Pattern 1 extensions for NIP-01/NIP-11.

**Avoids:** Pitfall 8 (NIP-45 CLOSED treated as failure), Pitfall 12 (NIP-70 missing NIP-42 precondition), Pitfall 5 (NIP-11 supported_nips false negatives / reporting semantics)

### Phase 5: Advanced and Niche NIPs (v2.x — validate demand first)

**Rationale:** NIP-29 (groups), NIP-62 (vanish), and NIP-86 (management API) are all HIGH complexity with low current adoption evidence. They should not be scheduled until relay ecosystem adoption warrants the investment.

**Delivers:** Group relay conformance (NIP-29), pubkey vanish enforcement (NIP-62), HTTP management API testing (NIP-86).

**Go/no-go criteria before scheduling:**
- NIP-29: evidence of 3+ production relays with groups enabled
- NIP-62: at least 2 relay implementations supporting vanish
- NIP-86: operator demand via issue tracker or community request

### Phase Ordering Rationale

- **Foundation before NIPs:** Latent bugs and missing shared utilities silently corrupt all NIP suite results if not fixed first. Recovery cost after the fact is HIGH.
- **NIP-42 before NIP-70 and auth-dependent suites:** Hard dependency. NIP-70's three test cases all require completed AUTH flow.
- **Signing utilities before any write-heavy NIPs:** Six suites cannot be implemented without `signTestEvent()` and `generateTestKeypair()`.
- **Extension NIPs last in P1:** NIP-13 and NIP-11 enforcement are low-complexity but depend on NIP-11 suite stability; extending a stable suite is simpler than building new ones from scratch.
- **Phase 5 gated on adoption evidence:** High-complexity niche work only makes sense when a real audience exists.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 5 (NIP-29 groups):** Relay-based group protocol is stateful and multi-step; group relay implementations are sparse and may have diverged from the spec. Needs dedicated research before planning begins.
- **Phase 5 (NIP-62 vanish):** Re-broadcast prevention testing requires an external vantage point to verify. Implementation strategy is conceptually unclear. Needs research into how existing tools (relay-tester) approach this.
- **Phase 5 (NIP-86 management):** NIP-98 HTTP auth token format and relay-specific method support varies across implementations. Needs API surface research against real relays.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundation):** Code quality and utility extraction — no new protocols or APIs. Entirely internal.
- **Phase 2 (NIP-42):** Schemata exist; AUTH flow is fully specified in the official NIP; challenge-response pattern maps directly to the existing NegOpen.ts template in NIP-77.
- **Phase 3 (NIP-09, NIP-40):** Both NIPs have HIGH-confidence official specs with clear MUST/SHOULD semantics and the Write-Then-Read pattern is documented in architecture.
- **Phase 4 (extensions):** All target NIPs have HIGH-confidence specs and established patterns in the codebase. NIP-11 and NIP-01 extend existing suites rather than building new ones.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Workspace root pin verified directly in codebase; nostr-tools/pure API confirmed against README and official NIP specs; no guesswork on versions |
| Features | HIGH | Target NIP specs read directly from official source (raw GitHub); relay adoption cross-referenced against three major relay READMEs (direct reads) |
| Architecture | HIGH | Sourced entirely from direct codebase analysis of working implementations (Nip01, Nip77, Nip11) and broken scaffolding (Nip42) |
| Pitfalls | HIGH (architectural) / MEDIUM (behavioral) | Architectural pitfalls verified in codebase source; NIP behavioral edge cases verified against official specs; relay ecosystem quirks from WebSearch only |

**Overall confidence:** HIGH

### Gaps to Address

- **NIP-40 expiration test (second case):** Testing that stored expired events are not served requires knowing a relay has a previously-stored expired event, or using precise timing (publish with short TTL, wait, query). The timed approach may produce flaky results on slow relays. Validate test strategy against a real relay before committing to assertion level.
- **NIP-42 clock drift:** The kind 22242 10-minute window can be broken by clock skew between auditor host and relay server. The strategy for surfacing this as a diagnostic notice (not test failure) needs validation during implementation; the expected relay error message text varies.
- **Live relay test pollution recovery:** Kind-5 deletion requests for test-keypair events will not be honored by all relays. Accept residual pollution as a known limitation and document it in the contributing guide.
- **NIP-96 adoption estimate (~20%):** Single WebSearch source, LOW confidence. Not blocking for this milestone (NIP-96 is deferred), but if community demand emerges, re-research with relay implementation census data.

## Sources

### Primary (HIGH confidence)
- Workspace root `package.json` — nostr-tools ^2.10.4 pin verification (direct codebase read)
- `libraries/auditor/src/base/Auditor.ts`, `Suite.ts`, `SuiteTest.ts`, `Sampler.ts`, `Ingestor.ts`, `Expect.ts` — direct codebase analysis
- `libraries/auditor/src/nips/manifest.js` + `suite-test-manifest.js` — registration mechanism analysis
- `libraries/auditor/src/nips/Nip01/`, `Nip77/`, `Nip42/`, `Nip11/` — pattern examples and broken scaffolding analysis
- NIP-01: https://raw.githubusercontent.com/nostr-protocol/nips/master/01.md (official spec)
- NIP-09: https://raw.githubusercontent.com/nostr-protocol/nips/master/09.md (official spec)
- NIP-11: https://raw.githubusercontent.com/nostr-protocol/nips/master/11.md (official spec)
- NIP-13: https://raw.githubusercontent.com/nostr-protocol/nips/master/13.md (official spec)
- NIP-40: https://raw.githubusercontent.com/nostr-protocol/nips/master/40.md (official spec)
- NIP-42: https://raw.githubusercontent.com/nostr-protocol/nips/master/42.md (official spec)
- NIP-45: https://raw.githubusercontent.com/nostr-protocol/nips/master/45.md (official spec)
- NIP-62: https://raw.githubusercontent.com/nostr-protocol/nips/master/62.md (official spec)
- NIP-70: https://raw.githubusercontent.com/nostr-protocol/nips/master/70.md (official spec)
- NIP-86: https://raw.githubusercontent.com/nostr-protocol/nips/master/86.md (official spec)
- strfry relay NIP support — https://github.com/hoytech/strfry (direct README read)
- nostr-rs-relay NIP support — https://github.com/scsibug/nostr-rs-relay (direct README read)
- nostream NIP support — https://github.com/cameri/nostream (direct README read)

### Secondary (MEDIUM confidence)
- nostr-tools README / nbd-wtf/nostr-tools GitHub — generateSecretKey/finalizeEvent/nip44 API details (WebSearch)
- NIP-09 and NIP-40 relay enforcement behavior — WebSearch corroborated against spec language
- relay-tester tool warnings about live relay testing — https://github.com/mikedilger/relay-tester (community tool)
- CLOSED messages design rationale — https://github.com/nostr-protocol/nips/pull/902 (merged PR)

### Tertiary (LOW confidence)
- NIP-96 adoption estimate (~20% of relays) — single WebSearch community estimate; not blocking for this milestone
- nostr-tools/pure vs /wasm performance comparison (34ms vs 239ms) — WebSearch, not benchmarked in this repo

---
*Research completed: 2026-03-12*
*Ready for roadmap: yes*
