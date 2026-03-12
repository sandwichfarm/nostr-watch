# Pitfalls Research

**Domain:** Nostr relay conformance testing — expanding NIP test coverage in @nostrwatch/auditor
**Researched:** 2026-03-12
**Confidence:** HIGH for architectural pitfalls (verified against codebase); MEDIUM for behavioral pitfalls (verified against official NIP specs); LOW for relay ecosystem quirks (WebSearch only, flagged inline)

---

## Critical Pitfalls

### Pitfall 1: Registering in One Manifest But Not Both

**What goes wrong:**
A new NIP suite is added to `manifest.js` but not `suite-test-manifest.js`, or vice versa. The Auditor's `isRunnableSuiteKey()` check gates on both files: `Boolean(nipManifest?.[suiteKey]) && Boolean(suiteTests?.[suiteKey])`. If either registration is missing, the suite key passes NIP-11 auto-detection but is silently filtered out in `Auditor.constructor()` — no error, no warning, no test run. The result looks like a skip but is actually a misconfiguration.

**Why it happens:**
There are two separate manifest files that must stay in sync. The distinction (suite class vs. test classes) is non-obvious. `manifest.js` registers the Suite subclass; `suite-test-manifest.js` registers the test classes dynamically loaded inside `Suite.setup()`. Forgetting one produces no compile-time error and no runtime exception.

**How to avoid:**
Add a manifest consistency check (a build-time or test-time validator that asserts every key in `manifest.js` also appears in `suite-test-manifest.js` and vice versa). Treat the two files as a pair: always update both in the same commit.

**Warning signs:**
- A NIP that the relay advertises in `supported_nips` but whose suite never appears in the results (not skipped, just absent)
- `Auditor.suites` set is smaller than expected for a known-compliant relay

**Phase to address:**
Every NIP suite implementation phase. Build the consistency validator in the first NIP implementation phase so it catches mistakes in all subsequent phases.

---

### Pitfall 2: Test Events Written to Live Relays Contaminate Future Samples

**What goes wrong:**
Tests that write events (EVENT messages) to validate relay behavior publish permanent, signed events onto production relays. These test events then appear in future ingestor samples. A `KindIngestor` or `AuthorIngestor` picks up test-generated events in the sampling phase, and subsequent tests operate on that test data as if it were real relay content. Over time, a relay's sample pool becomes saturated with test-generated content and ingestor-derived tests start producing misleading results.

**Why it happens:**
The auditor runs against live relays. Unlike the `relay-tester` tool (which explicitly requires a fresh install), the auditor is designed to test production systems. NIPs like NIP-09 (deletion), NIP-40 (expiration), NIP-70 (protected events), and NIP-42 (auth) require the tester to write events. There is no automatic cleanup mechanism in the codebase.

**How to avoid:**
1. Use ephemeral event kinds (20000–29999) wherever the NIP under test allows it. Relays are not required to store ephemeral events, so pollution is minimized.
2. For NIPs that require persistent events, use a dedicated test keypair (generated fresh per audit run, never reused). Tag all test events with a recognizable marker tag (e.g., `["test", "nostr-watch-auditor"]`) so they can be queried and excluded.
3. For NIP-09 tests specifically: publish, assert, then immediately publish the kind-5 deletion request.
4. Accept that some permanent event pollution is unavoidable when testing against live relays. Design sampling ingestors to be resilient to noise rather than assuming a clean slate.

**Warning signs:**
- FilterAuthor or FilterKinds tests producing unexpected results after multiple audit runs against the same relay
- Sampler returning events with anomalously uniform `created_at` values (all from recent test runs)

**Phase to address:**
Any NIP that requires writing events (NIP-09, NIP-42, NIP-40, NIP-70). Establish the event-isolation strategy in the first write-heavy NIP phase.

---

### Pitfall 3: Testing NIP-42 AUTH Against Relays That Require Auth for Everything

**What goes wrong:**
Some relays require NIP-42 authentication before accepting any subscription or event. When the auditor opens a connection and sends a REQ without first completing the AUTH flow, the relay responds with `CLOSED ["auth-required: ..."]` and the test fails — not because the relay is broken, but because the test did not fulfill the relay's precondition. This produces a false negative for every NIP whose suite sends REQ before handling AUTH.

**Why it happens:**
NIP-42 specifies that the relay "MAY send an AUTH message at any moment." Some relays send it immediately on connection; others send it only when an unauthenticated client attempts a restricted operation. The auditor's current `SuiteTest.run()` method calls `socket.connect()`, then immediately `this.REQ(this.filters)` with no AUTH handling. If the relay requires auth, every subsequent suite fails with `auth-required`.

The existing `Nip42` class in the codebase provides message generators and validators but has no tests. The AUTH flow needs to be either handled transparently by the suite infrastructure or explicitly modeled as a test condition.

**How to avoid:**
1. In the NIP-42 suite, detect whether the relay sends AUTH on connection and record that behavior.
2. For suites that test non-AUTH behavior, treat `CLOSED` with `"auth-required:"` prefix as a "skip" rather than a "fail" — the relay is technically conformant, just inaccessible without credentials.
3. Consider a pre-flight check in `Suite.setup()` or `Auditor.test()` that detects auth-on-connect relays and marks all other suites as `skipped: true` with reason `"relay requires auth"`.
4. Do not attempt to auto-auth with a test key unless the suite is explicitly testing NIP-42 — authenticating just to run other tests changes the test conditions.

**Warning signs:**
- All suites showing `pass: false` for the same relay with `CLOSED: auth-required` in the messages map
- The relay's NIP-11 `supported_nips` includes 42 but no test key is configured

**Phase to address:**
NIP-42 suite implementation phase. Must be resolved before other write-heavy NIP suites (NIP-09, NIP-70, NIP-59) are added, since they share the same auth precondition problem.

---

### Pitfall 4: Timing-Sensitive Tests That Depend on Relay Processing Speed

**What goes wrong:**
Tests that write an event and then immediately query for it can fail on slow relays because the event has not yet been indexed. The 10-second default `timeoutMs` measures the full round-trip, but the write→read gap is not protected by any explicit wait. A test might send EVENT, receive OK, send REQ, receive EOSE with no matching events, and conclude the relay failed — when the relay simply hadn't finished indexing yet.

This is especially acute for:
- NIP-09 deletion: write event, write deletion, query and expect the event to be absent
- NIP-40 expiration: set an expiration in the past and expect the event to be filtered out
- NIP-40 near-future expiration: test expiration timing within a second

**Why it happens:**
WebSocket is asynchronous. Relays vary from in-memory (sub-millisecond commit) to disk-backed with write-ahead logging (50–200ms commit). The auditor currently uses a single `timeoutMs` for the entire test, with no explicit sequencing between write and read phases.

**How to avoid:**
1. For write-then-read tests, introduce a brief sequenced delay (100–200ms) between the EVENT submission and the subsequent REQ. Do not hardcode values — make this configurable per-suite.
2. For NIP-40 expiration tests, use expiration timestamps at least 2 seconds in the future during setup, then wait for expiration before querying. Never use `since: 0` expiration (already expired) and expect immediate filtering — the NIP explicitly says "MAY NOT delete immediately."
3. Design NIP-09 deletion tests to assert that the deletion request was accepted (via OK), not that the event is immediately absent. Immediate absence is a bonus; eventual absence is the spec.

**Warning signs:**
- Tests that pass on fast local relays (strfry, nostr-rs-relay) but intermittently fail on remote relays
- NIP-09 or NIP-40 tests showing inconsistent results across runs against the same relay

**Phase to address:**
Any phase implementing write-then-read tests (NIP-09, NIP-40). Document the write/read gap convention in the SuiteTest base class or contributing guide.

---

### Pitfall 5: False Negatives from NIP-11 supported_nips Mismatch

**What goes wrong:**
The auto-detection mechanism in `Auditor.addNipSuites()` only enables suites for NIPs listed in the relay's `supported_nips` array. If a relay implements a NIP correctly but omits it from `supported_nips`, the suite never runs and the relay appears less capable than it is. Conversely, if a relay lists a NIP it does not actually implement, the suite runs and produces failures that may be attributed to bugs in the test code rather than the relay.

`supported_nips` is entirely optional in NIP-11 and all fields may be omitted. Some relay implementations copy-paste a default `supported_nips` list without actually implementing all listed NIPs. Others implement NIPs correctly without advertising them.

**Why it happens:**
The NIP-11 spec says `supported_nips` is informational, not authoritative. Relay operators set it manually. There is no enforcement that a relay's behavior matches its declarations.

**How to avoid:**
1. When a suite fails for a relay that advertises the NIP, report the failure as "advertised but failed" — not just "failed." This separates implementation problems from declaration problems.
2. Add a test to the NIP-11 suite that counts advertised NIPs and cross-references them against suites that actually ran — flagging discrepancies as a notice rather than a hard failure.
3. Do not interpret "suite skipped because NIP not advertised" as a conformance result. Skipped suites should be invisible in the pass/fail scoring.

**Warning signs:**
- Relay advertising a NIP whose suite always fails with a suspiciously basic assertion (like "received zero events")
- Relay obviously implementing a feature (e.g., full-text search visible in clients) but NIP-50 not listed in `supported_nips`

**Phase to address:**
NIP-11 suite enhancement phase. The reporting semantics for "advertised vs. actually tested" need to be established before most new suites are added.

---

### Pitfall 6: Test Isolation — One Suite's Messages Bleeding Into Another Suite's Handlers

**What goes wrong:**
`Suite.setupHandlers()` calls `this.socket.off()` to clear all listeners and then re-registers `this.handleMessage`. Between suites, the socket is closed and reconnected. However, if a relay sends a message (NOTICE, CLOSED, or late EVENT) after `socket.terminate()` but before the handler is cleared, the message may be routed to the wrong test's handler via `testKey`. The existing code sets `this.testKey = "unset"` in `Suite.reset()`, but a message arriving at `testKey === "unset"` attempts `this.testers["unset"]` which is undefined and would throw.

This also occurs if two suites run sequentially on a shared socket and the first suite's subscription ID leaks into the second suite's handler.

**Why it happens:**
The 500ms inter-test pause in `Suite.test()` mitigates this in practice, but it is not a complete fix. The real issue is that the message handler dispatches to `testKey` without checking that the message's subscription ID matches the current test's `subId`. Relays may also send unsolicited NOTICE messages at any time.

**How to avoid:**
1. Before routing to a test handler, verify that the message's subscription ID (where present) matches `this.testKey`'s active `subId`. Discard messages for stale subscription IDs.
2. In the SuiteTest base, guard `this.testers[this.testKey]` with a null check before calling any method on it.
3. For NOTICE messages, which have no subscription ID, route them to a dedicated NOTICE collector rather than the active test handler.

**Warning signs:**
- TypeError "Cannot read properties of undefined" in the message handler during multi-suite runs
- Test results that vary when suites run in different orders

**Phase to address:**
Address in the NIP-01 suite audit / code quality phase before adding more suites. Each new suite added increases the probability of hitting this race.

---

## Moderate Pitfalls

### Pitfall 7: NIP-40 Expiration Is "SHOULD" — Testing With Hard Assertions Fails Good Relays

**What goes wrong:**
NIP-40 says relays "SHOULD NOT send expired events to clients" and "MAY NOT delete expired messages immediately on expiration." Writing a test that asserts "expired events must be absent" treats a SHOULD as a MUST. Many fully capable relays will fail this test because they retain expired events in storage and only filter them at query time — which is spec-compliant.

**How to avoid:**
Test the filtering behavior (relay does not return expired events in responses), not the storage behavior (relay has deleted the event). Assert at query time with a filter that would match the expired event. If the relay returns the expired event, that is a failure. If the relay omits it, that is a pass. Do not assert that a `kinds: [5]` deletion-style query shows the event is gone.

**Phase to address:**
NIP-40 implementation phase.

---

### Pitfall 8: NIP-45 COUNT Refusing Is Valid — Treating CLOSED as Failure

**What goes wrong:**
NIP-45 says "Whenever the relay decides to refuse to fulfill the COUNT request, it MUST return a CLOSED message." A relay is permitted to refuse COUNT entirely. If the test asserts "relay must return COUNT response," it will fail on relays that legitimately refuse. These relays are conformant — they are just not implementing COUNT.

The situation is compounded by the fact that some relays that advertise NIP-45 in `supported_nips` will still refuse individual COUNT queries (e.g., for auth-protected subscriptions).

**How to avoid:**
A COUNT test should pass if the relay either returns a `["COUNT", <id>, {"count": N}]` or returns `CLOSED` with a recognized reason prefix. The test fails only if the relay returns no response at all (timeout), or returns a malformed response.

**Phase to address:**
NIP-45 implementation phase.

---

### Pitfall 9: Replaceable Event Testing Assumes Relay Has the Event

**What goes wrong:**
NIPs like NIP-01 replaceable events (kinds 0, 3, 10000–19999) and NIP-33 parameterized replaceable events (30000–39999) require writing a replaceable event, then writing a newer version, then querying and expecting only the latest version. This only works if:
1. The relay accepts writes from the test key (not blocked, not auth-required)
2. The test key's events are not already present from previous test runs (stale replaceable state)
3. The relay actually replaces on write rather than storing both versions

If the test key has residual replaceable events from a prior run, the "latest" event might be the old test event, not the one just written.

**How to avoid:**
Generate a fresh keypair per audit run for write-heavy tests. The replaceable event test should write a known event, then write a second event with `created_at` strictly greater than the first, then query and verify only the second event is returned. Do not assume a clean slate.

**Phase to address:**
Any phase implementing replaceable event tests.

---

### Pitfall 10: NIP-42 Authentication Event Has a 10-Minute Window

**What goes wrong:**
The NIP-42 `kind: 22242` auth event must have a `created_at` "close (e.g. within ~10 minutes) of the current time." If the system clock where the auditor runs is drifted, or if the relay's clock is drifted, the auth event may be rejected as too old or too far in the future. This manifests as `OK: false` for the AUTH response even though the event is correctly signed and the challenge matches.

**How to avoid:**
Log the relay's AUTH response message text when auth fails. The relay should include a human-readable reason. If the reason suggests timestamp issues, surface this in the audit result as a notice rather than a test failure — the auditor's clock vs. the relay's clock is outside the test's control.

**Phase to address:**
NIP-42 suite implementation phase.

---

### Pitfall 11: Ingestor Starvation When Relay Has No Matching Events

**What goes wrong:**
Suite-level ingestors (used by FilterAuthor, FilterRange, Nip50/ContentIngestor) require the relay to have pre-existing events of the right kind. If the relay is lightly used or the target kind has no events, `Sampler.sample()` returns no results, the ingestor never calls `complete()`, and the sampler falls back to its timeout. The suite then skips all tests with "failed to obtain samples." This is correct behavior — but on a new NIP's ingestor, the `complete()` signal can be missed if the ingestor has a bug in its feed/complete logic.

**Why it happens:**
`Ingestor.completed()` is a polling loop (`while(!this._completed)`). If `complete()` is never called because `feed()` never received a qualifying event, the sampler waits for the full 5-second timeout. If the ingestor's `feed()` has a bug (wrong kind filter, wrong tag check), it silently discards every event without completing.

**How to avoid:**
Every new ingestor must have a unit test with synthetic event data that verifies `complete()` is called when the expected sample size is reached, and that `poop()` returns the expected format. Do not rely solely on integration testing against live relays to validate ingestor logic.

**Warning signs:**
- A suite always times out on the sampling phase even on relays with many events
- `poop()` returning empty arrays or `undefined` for ingestors that should have found data

**Phase to address:**
Every phase implementing a new ingestor. Unit test the ingestor before wiring it into a suite.

---

### Pitfall 12: NIP-70 Protected Events Require NIP-42 as a Precondition

**What goes wrong:**
NIP-70 protected events (events with `["-"]` tag) require the relay to implement NIP-42 AUTH before it can accept them. A relay can advertise NIP-70 in `supported_nips` but if it does not implement NIP-42, it should reject all protected events with a different reason. Testing NIP-70 without handling the AUTH flow will always produce `OK: false, "auth-required"` — not because NIP-70 is broken, but because the auth precondition is unmet.

**How to avoid:**
The NIP-70 suite must either: (a) require NIP-42 as a prerequisite in `Suite.requires`, skipping if auth is unavailable; or (b) attempt the auth flow internally and surface the result in the NIP-70 test data. Make the dependency explicit in the suite code, not implicit.

**Phase to address:**
NIP-70 implementation phase.

---

### Pitfall 13: Slug Naming for NIPs with Padded vs. Non-Padded Numbers

**What goes wrong:**
The `formatNip()` function in `Auditor.ts` pads NIP numbers to two digits: `Nip01`, `Nip09`, etc. But higher NIP numbers (40, 42, 45, 50, 65, 70, 77) do not need padding. The manifest files use the NipXX naming convention. An off-by-one in padding (e.g., registering as `Nip09` vs. `Nip9`) causes `isRunnableSuiteKey()` to return false, silently skipping the suite.

There is a latent bug in `formatNip()`: the condition `if (number > 0 || number <= 9)` applies the padding for ALL positive numbers, not just single-digit ones. This means `formatNip(42)` returns `Nip42` (correct) but the logic is technically wrong (it would also pad numbers like 100 as `Nip100` without leading zeros). Any NIP number >= 100 would be named incorrectly if the condition is ever hit.

**How to avoid:**
Fix `formatNip()` to use `number < 10` not `number > 0 || number <= 9`. Add a test that verifies `formatNip(1)` → `Nip01`, `formatNip(9)` → `Nip09`, `formatNip(42)` → `Nip42`, `formatNip(100)` → `Nip100`.

**Warning signs:**
- A NIP suite that exists in both manifests but never appears in Auditor results
- Any NIP with a number >= 100 (none currently exist in this codebase, but worth guarding)

**Phase to address:**
Early in the milestone — fix the `formatNip()` bug before adding suites for any NIP that would expose it.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Write test events to live relays with the real production keypair | No key management needed | Contaminates real relay data; test events appear in client apps | Never |
| Skip precheck() and rely on timeout to detect missing samples | Less boilerplate per suite | Timeout is 5–10s; silent failures look the same as real failures | Never for write-heavy tests |
| Use `completeOn: ['EOSE']` for tests that expect no response | Simple completion logic | EOSE never arrives if relay rejects REQ with CLOSED; test hangs to timeout | Never — always handle CLOSED |
| Assert SHOULD behaviors as hard failures | Simple pass/fail logic | Fails conformant relays that implement optional behavior differently | Never — distinguish MUST from SHOULD in assertion messages |
| Hardcode a single `timeoutMs` for all suites | One setting to maintain | Slow relays time out on legitimate operations; expiration tests need precise timing | Use a sensible default but allow per-suite override |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| NIP-42 AUTH flow | Treat `CLOSED: auth-required` as test failure | Treat as skip when test doesn't require auth; only fail when NIP-42 suite tests auth behavior explicitly |
| NIP-40 expiration | Assert expired event is absent immediately | Assert expired event is absent at query time; accept that storage cleanup is relay-discretionary |
| NIP-09 deletion | Assert deleted event is immediately absent | Assert deletion request was accepted (OK: true); absence is best-effort per spec |
| Sampler/Ingestor pipeline | Test ingestor only via live relay runs | Unit test `feed()` and `poop()` with synthetic events before any integration |
| NIP-11 auto-detect | Trust `supported_nips` as authoritative | Treat `supported_nips` as a hint; skip suites for unadvertised NIPs but flag "advertised but failed" separately |

---

## "Looks Done But Isn't" Checklist

- [ ] **Both manifests updated:** Adding a NIP to `manifest.js` — verify `suite-test-manifest.js` has the matching entry and the `isRunnableSuiteKey()` check passes
- [ ] **SHOULD vs MUST in assertions:** Suite marked complete — verify every assertion message identifies whether it tests a MUST (hard failure) or SHOULD (advisory) requirement
- [ ] **Ingestor unit tested:** New ingestor written — verify unit tests exist that cover `feed()` reaching `sampleSize` and `poop()` returning expected shape
- [ ] **CLOSED message handled:** New SuiteTest written — verify `_onMessageClosed()` is handled or inherited, not silently swallowed
- [ ] **Test keypair isolated:** Suite writes events — verify it uses an ephemeral or audit-run-specific keypair, not a shared permanent key
- [ ] **Timeout is suite-appropriate:** Suite implemented — verify `timeoutMs` is calibrated for the expected relay response pattern (e.g., NIP-77 NegOpen uses 7s, not 10s)

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Suite silently skipped due to manifest mismatch | LOW | Add missing entry to the missing manifest file; add consistency validator to prevent recurrence |
| Live relay polluted with test events | MEDIUM | Publish kind-5 deletion events for all test-keypair events; accept that some relays will not honor them |
| NIP-42 blocking all other suites | MEDIUM | Add auth-detection precheck; mark downstream suites as skipped with reason |
| Timing-sensitive tests failing on remote relays | LOW | Add configurable inter-step delays; document the write/read gap assumption |
| Ingestor silently never completing | MEDIUM | Add unit tests for the ingestor; add a `completionTimeout` safeguard in `Sampler` |
| formatNip() bug causing wrong suite key | LOW | Fix the condition and add a unit test; single-line code change |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Dual manifest mismatch | Every NIP suite phase | Build-time validator that asserts manifest key symmetry |
| Event pollution on live relays | First write-heavy NIP phase | Test keypair policy documented and enforced in suite code review |
| NIP-42 blocking all suites | NIP-42 suite phase | Auth-on-connect detection implemented before other auth-dependent NIPs |
| Timing-sensitive write/read gaps | NIP-09 / NIP-40 phase | Configurable inter-step delay in SuiteTest; integration test on a throttled relay |
| NIP-11 supported_nips false negatives | NIP-11 suite enhancement phase | Suite distinguishes "advertised and failed" from "not advertised" in result output |
| Test isolation / subscription ID bleeding | Code quality review before first new NIP suite | Guard on testKey access in handleMessage; unit test for concurrent-subscription scenario |
| NIP-40 SHOULD treated as MUST | NIP-40 implementation phase | Assertion messages specify "MUST" or "SHOULD"; integration test on a relay that retains expired events |
| NIP-45 CLOSED treated as failure | NIP-45 implementation phase | Test explicitly expects either COUNT response or CLOSED; timeout only is a failure |
| Ingestor starvation | Per new ingestor | Unit tests for ingestor feed/poop; sampler timeout logged as "no samples" not as test failure |
| NIP-70 missing NIP-42 precondition | NIP-70 implementation phase | Suite checks `suite.requires` includes NIP-42 availability; skip if absent |
| formatNip() slug bug | Early in milestone | Unit tests for formatNip(); fix condition before any new suites are registered |

---

## Sources

- @nostrwatch/auditor codebase: `src/base/Auditor.ts`, `src/base/Suite.ts`, `src/base/SuiteTest.ts`, `src/base/Sampler.ts`, `src/nips/manifest.js`, `src/nips/suite-test-manifest.js` (HIGH confidence — direct code analysis)
- NIP-42 Authentication of clients to relays — [nips.nostr.com/42](https://nips.nostr.com/42) (HIGH confidence — official spec)
- NIP-40 Expiration Timestamp — [nips.nostr.com/40](https://nips.nostr.com/40) (HIGH confidence — official spec)
- NIP-45 COUNT — [nips.nostr.com/45](https://nips.nostr.com/45) (HIGH confidence — official spec)
- NIP-70 Protected Events — [nips.nostr.com/70](https://nips.nostr.com/70) (HIGH confidence — official spec)
- NIP-09 Event Deletion — [nips.nostr.com/9](https://nips.nostr.com/9) (HIGH confidence — official spec)
- NIP-11 Relay Information Document — [nips.nostr.com/11](https://nips.nostr.com/11) (HIGH confidence — official spec)
- NIP-01 Basic Protocol — [nips.nostr.com/1](https://nips.nostr.com/1) (HIGH confidence — official spec)
- CLOSED messages PR by fiatjaf — [github.com/nostr-protocol/nips/pull/902](https://github.com/nostr-protocol/nips/pull/902) (HIGH confidence — merged spec change with design rationale)
- relay-tester tool warnings about live relay testing — [github.com/mikedilger/relay-tester](https://github.com/mikedilger/relay-tester) (MEDIUM confidence — community tool, single source)

---

*Pitfalls research for: Nostr relay conformance testing — @nostrwatch/auditor NIP expansion*
*Researched: 2026-03-12*
