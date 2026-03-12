# Architecture Research

**Domain:** Nostr relay conformance testing — NIP suite expansion for @nostrwatch/auditor
**Researched:** 2026-03-12
**Confidence:** HIGH (sourced entirely from direct codebase analysis)

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Auditor                               │
│  - Orchestrates suite execution (sequential)                 │
│  - Loads suites via nipManifest dynamic import               │
│  - Runs NIP-11 pre-check for supported_nips auto-detect      │
│  - Emits auditor.suite:start/finish events                   │
│  - Aggregates IAuditorResult with passrate                   │
└────────────────────────┬────────────────────────────────────┘
                         │ creates one per suite key
┌────────────────────────▼────────────────────────────────────┐
│                     Suite (abstract)                         │
│  - Owns the WebSocket connection (shared with SuiteTests)    │
│  - Registers messageValidators / jsonValidators              │
│  - Routes incoming messages to per-test handlers             │
│  - Runs Sampler before tests when ingestors are registered   │
│  - Runs each SuiteTest in sequence, 500ms apart              │
│  - Emits auditor.suite.test:start/finish events              │
└──────┬──────────────────────────┬──────────────────────────┘
       │ 0..N ingestors            │ 1..N testers
┌──────▼──────────┐     ┌─────────▼────────────────────────┐
│ Sampler/Ingestor│     │       SuiteTest (abstract)        │
│                 │     │  - Holds per-test state            │
│ Sampler sends   │     │  - Implements digest/precheck/test │
│ a REQ, feeds    │     │  - Calls REQ/EVENT/CLOSE helpers   │
│ notes to        │     │  - Awaits testable() (EOSE/max)    │
│ Ingestors.      │     │  - Calls conclude() to close WS    │
│                 │     │  - Uses Expect for assertions       │
│ Each Ingestor   │     │  - _onMessageXxx = qualify gate    │
│ collects typed  │     │  - onMessageXxx  = handler         │
│ samples then    │     │                                    │
│ signals done.   │     └────────────────────────────────────┘
│                 │
│ poop() returns  │
│ sample payload. │
└─────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Communicates With |
|-----------|----------------|-------------------|
| `Auditor` | Suite orchestration, NIP-11 pre-check, passrate aggregation | `Suite` (creates), `Emitter` (events), `manifest.js` (dynamic load) |
| `Suite` | WS connection ownership, message routing, schema validation, Sampler lifecycle | `SuiteTest` (runs), `Sampler` (owns), `SchemaValidator` (validates), `Emitter` |
| `SuiteTest` | Single behavioral test: sends messages, awaits responses, asserts with Expect | `Suite` (via ISuite reference), `WebSocket` (via suite.socket), `Sampler` (optional local) |
| `Sampler` | Pre-test data collection: opens REQ, runs Ingestors, closes WS | `Ingestor[]` (feeds notes), `WebSocket` (connection), `Emitter` (EOSE signal) |
| `Ingestor` | Typed data extraction from a stream of Notes | `Sampler` (receives feed calls), `SuiteTest` (owner reads via poop()) |
| `SchemaValidator` | JSON Schema validation wrapper | `Suite` (called via validateMessage/validateJson), `Expect.message/json` |
| `Expect` / `AssertWrap` | Fluent assertion groups (behavior, json, message, conditions) | `SuiteTest` (used in test/precheck), `Suite` (used in validateMessage) |
| `Emitter` | Global singleton event bus (tseep) | All layers emit/consume events |
| `manifest.js` | Dynamic import map: suiteKey → `() => import(...)` | `Auditor` (loads suites) |
| `suite-test-manifest.js` | Dynamic import map: suiteKey → `() => import(tests/index.ts)` | `Suite.setup()` (loads test classes) |

## Recommended Project Structure

Each NIP follows an identical directory shape. Complexity within each slot varies by NIP.

```
src/nips/NipXX/
├── index.ts              # Suite subclass: slug, messageValidators, jsonValidators,
│                         #   onMessageXxx handlers, optional generator classes
├── tests/
│   ├── index.ts          # Re-exports all SuiteTest subclasses for this NIP
│   └── SomeTestName.ts   # One SuiteTest subclass per behavioral scenario
├── interfaces/           # TypeScript types for NIP-specific message shapes
│   ├── index.ts          # Barrel export
│   └── SomeMessage.ts
├── schemata/             # JSON Schema files for message validation
│   ├── index.ts          # Imports .json files, exports named + default bundle
│   └── some-message.schema.json
└── ingestors/            # Optional: only when Sampler pre-collection is needed
    └── SomeIngestor.ts
```

**Minimal NIP (no pre-sampling, no custom messages):**
- `index.ts` + `tests/index.ts` + `tests/SomeTest.ts` — 3 files total

**Full-depth NIP (pre-sampling, custom message types):**
- Add `interfaces/`, `schemata/`, `ingestors/` — up to ~12 files

### Structure Rationale

- **index.ts at NIP root:** Suite constructor always imported from here; Auditor manifest points here.
- **tests/index.ts barrel:** `suite-test-manifest.js` imports `tests/index.ts`; the barrel re-exports all test classes so Suite.setup() can iterate them dynamically.
- **schemata/ + interfaces/ optional:** Only needed when the NIP defines new message types beyond NIP-01 baseline. NIPs that only filter standard events (NIP-02, NIP-65) reuse Nip01 interfaces directly.
- **ingestors/ optional:** Only needed when tests require pre-existing relay data. NIPs that write-then-read can use a local Sampler inside the SuiteTest instead of suite-level ingestors.

## Architectural Patterns

### Pattern 1: Standard Filter-and-Assert (most NIPs)

**What:** Send a REQ with NIP-specific filter fields, receive events via onMessageEvent, call test() after EOSE.
**When to use:** Any NIP that adds filter fields or new event kinds. Examples: NIP-02, NIP-22, NIP-65, NIP-25, NIP-94, NIP-58.
**Trade-offs:** Zero infrastructure additions needed. Limited to passive read behavior. Cannot verify write-side acceptance.

```typescript
export class MyTest extends SuiteTest implements ISuiteTest {
  readonly slug = 'MyTest';

  get filters(): INip01Filter[] {
    return [{ kinds: [1234], limit: 5 }];
  }

  test({ behavior }) {
    behavior.toBeOk(this.events.length > 0, 'relay returned kind 1234 events');
    behavior.toBeOk(
      this.events.every(e => e.kind === 1234),
      'all returned events are kind 1234'
    );
  }
}
```

### Pattern 2: Write-Then-Read Behavioral Test

**What:** EVENT to publish a test event, then REQ to verify the relay stored or acted on it. Requires nostr-tools for event signing.
**When to use:** NIP-09 (deletion — publish kind 5, verify target gone), NIP-40 (expiration — publish with expiration tag, verify eviction), NIP-16 (replaceable events — publish two events same kind+pubkey, verify only latest survives).
**Trade-offs:** Requires test keypair management. Timing-sensitive for expiration tests. Must use `completeOn = ['off']` and manually call `conclude()` inside `_onMessageOk`, exactly as Nip77's NegOpen does.

```typescript
export class DeleteTest extends SuiteTest implements ISuiteTest {
  readonly slug = 'DeleteTest';
  private publishedId?: string;
  private okAccepted = false;
  completeOn: CompleteOnTypeArray = ['off'];

  async prepare() {
    const note = await signTestEvent({ kind: 1, content: 'delete me' });
    this.publishedId = note.id;
    this.EVENT(note);
    await this.testable();
  }

  _onMessageOk(message: RelayOkMessage): boolean {
    if (message[1] !== this.publishedId) return true;
    this.okAccepted = message[2];
    this.test(this.expect);
    this.conclude();
    return false;
  }

  test({ behavior }) {
    behavior.toBeOk(this.okAccepted, 'relay accepted published event');
  }
}
```

### Pattern 3: Challenge-Response (AUTH / NIP-42)

**What:** Connect, receive relay AUTH challenge, sign a response event, send AUTH back, verify relay accepts the subscription or returns CLOSED with auth-required.
**When to use:** NIP-42 AUTH suite exclusively.
**Trade-offs:** Requires extending Suite to add `onMessageAuth` handler. The `_onMessage{Suffix}` → `onMessage{Suffix}` dispatch chain in Suite.handleMessage already handles custom message types via camelCase suffix routing — no new routing infrastructure needed. The current `Nip42` class does NOT extend Suite and is not registered in manifests; this must be corrected before tests can run.

```typescript
// Nip42 Suite index.ts — must extend Suite:
export class Nip42 extends Suite implements ISuite {
  public get slug() { return 'Nip42'; }
  readonly requires = ['websocket'];

  readonly messageValidators = {
    AUTH: new SchemaValidator<RelayAuthMessage>(schemata.RelayAuthMessage),
  };

  protected onMessageAuth(message: RelayAuthMessage): void {
    // challenge is captured by SuiteTest via _onMessageAuth
  }
}

// In test class:
export class AuthChallenge extends SuiteTest implements ISuiteTest {
  readonly slug = 'AuthChallenge';
  completeOn: CompleteOnTypeArray = ['off'];
  private challengeReceived = false;

  _onMessageAuth(message: RelayAuthMessage): boolean {
    const challenge = message[1];
    this.challengeReceived = true;
    const signedEvent = signAuthEvent(challenge, this.socket.url);
    this.socket.send(Nip42ClientMessageGenerator.AUTH(signedEvent));
    return false;
  }
}
```

### Pattern 4: Custom Protocol Extension (NIP-77 style)

**What:** NIP introduces non-NIP-01 message types. Suite defines custom message generators and messageValidators keyed on new type strings.
**When to use:** NIP-77 (negentropy: NEG-OPEN/NEG-MSG/NEG-ERR/NEG-CLOSE).
**Trade-offs:** Requires new interfaces and schemata. The `handleMessage` dispatch in Suite uses `message[0]` as a key suffix, so `NEG-OPEN` routes to `onMessageNegOpen` automatically via `handlerSuffix()` camelCase logic. No Suite base class changes needed.

### Pattern 5: HTTP-Only Test (NIP-11 / NIP-86 style)

**What:** Override `requires = []` in Suite to skip WebSocket setup. Use `fetch()` inside SuiteTest.prepare() instead of REQ/CLOSE.
**When to use:** NIP-11 (relay information document), NIP-86 (relay management API — HTTP POST to relay URL).
**Trade-offs:** No WebSocket involved. Suite still needs both manifest registrations and the test result flows through ISuiteTestResult normally. The existing ValidateSchema.ts in Nip11 demonstrates this pattern completely — it directly calls `fetch()` in `prepare()`.

```typescript
// Suite:
export class Nip86 extends Suite implements ISuite {
  public get slug() { return 'Nip86'; }
  readonly requires = [];  // no WebSocket
}

// Test:
export class RelayManagementApi extends SuiteTest implements ISuiteTest {
  async prepare() {
    const url = new URL(this.socket.url.toString());
    url.protocol = 'https:';
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/nostr+json-rpc' },
      body: JSON.stringify({ method: 'supportedmethods' })
    });
    // inspect response
  }
}
```

### Pattern 6: Sampler Pre-Collection + Digest

**What:** Register ingestors in SuiteTest constructor via `this.suiteIngest(ingestor)`. Suite runs Sampler before tests. Test calls `this.getSamples<T>()` in `digest()`.
**When to use:** Any NIP where tests need real relay data to construct meaningful filters (NIP-01 FilterAuthor, NIP-50 search terms). Required when you cannot construct a useful filter without knowing what's on the relay.
**Trade-offs:** Adds a sampling round-trip before tests. If sampling fails, all tests in the suite skip automatically via Suite.test(). Use `precheck(conditions)` to validate samples are sufficient before the test body runs.

## Data Flow

### Standard Suite Execution Flow

```
Auditor.test(relay)
    |
    +-- import nipManifest[suiteKey]()   --> Suite constructor
    |
    +-- Suite.test()
          |
          +-- Suite.ready()              --> wait for setup() (async test class loading)
          |
          +-- [if sampler.samplable]
          |   +-- Sampler.sample()       --> connect WS, send REQ {limit:500, since:0}
          |   |     +-- on EVENT --> Ingestor.feed(note)
          |   |     +-- on EOSE  --> resolve, close WS
          |   +-- Suite.toilet()         --> ingestor.poop() --> SuiteState['samples']
          |
          +-- for each SuiteTest:
                +-- SuiteTest.run()
                |     +-- sampler.sample() (if test-local ingestors)
                |     +-- suite.reset() --> testKey = slug
                |     +-- suite.setupHandlers() --> socket.on('message', handleMessage)
                |     +-- socket.connect()
                |     +-- timeoutBegin()
                |     +-- digest()        --> getSamples() --> populate test fields
                |     +-- precheck()      --> conditions assertions
                |     +-- evaluateConditions() --> skip behavior if conditions fail
                |     +-- prepare()       --> send REQ/EVENT/custom messages
                |     |     +-- testable() --> await until socket closes
                |     +-- finish()        --> collect Expect results --> resulter
                +-- await 500ms delay
    |
    +-- Auditor.calculatePassrate() --> IAuditorResult
```

### Message Dispatch Flow (Suite.handleMessage)

```
WebSocket 'message' event
    |
    +-- JSON.parse(data) --> message[]
    +-- message[0] --> key (e.g., "OK", "EVENT", "NEG-MSG")
    +-- handlerSuffix(key) --> suffix (e.g., "Ok", "Event", "NegMsg")
    |
    +-- validateMessage(message)    --> messageValidators[key].validate()
    |                                   --> expect.message.toBeOk(...)
    |
    +-- messages.set(key, [...])    --> accumulate for result
    |
    +-- [if key == 'EVENT']
    |   +-- testInstance.addEvent(note)
    |
    +-- Suite.onMessage{Suffix}(message)   --> Suite-level handler (optional override)
    |
    +-- testInstance._onMessage{Suffix}(message) --> qualifying gate
    |   +-- returns false --> stop; returns true --> continue to test handler
    |
    +-- testInstance.onMessage{Suffix}(message)  --> test-level handler
```

### Key Data Flows

1. **Sample data:** Sampler -> Ingestor.feed() -> Ingestor.poop() -> SuiteState['samples'][testSlug] -> SuiteTest.getSamples()
2. **Assertion results:** SuiteTest.test(expect) -> Expect.behavior.toBeOk() -> AssertWrap._result[] -> SuiteTest.finish() -> SuiteTestResulter -> Suite.resulter -> Auditor.resulter
3. **Events from relay:** Suite.handleMessage -> testInstance.addEvent() -> SuiteTest.events[] -> used in test()

## NIP Integration Classification

### Category A: Standard Pattern — No Architecture Changes Needed

These NIPs use existing Suite/SuiteTest/Ingestor as-is, following the NIP-65 or NIP-02 template.

| NIP | Test Pattern | Key Behavior to Verify |
|-----|-------------|------------------------|
| NIP-25 (Reactions) | Filter-and-Assert | Query kind 7, assert `e` tag points to target event |
| NIP-94 (File Metadata) | Filter-and-Assert | Query kind 1063, assert required `url`, `m`, `x` tags |
| NIP-58 (Badges) | Filter-and-Assert | Query kinds 30008/30009, assert tag structure |
| NIP-09 (Deletion) | Write-Then-Read | Publish kind 5 deletion, verify target kind 1 disappears |
| NIP-16 (Replaceable Events) | Write-Then-Read | Publish kind K twice with same pubkey, only latest survives |
| NIP-40 (Expiration) | Write-Then-Read with delay | Publish with `expiration` tag, wait, REQ, assert gone |
| NIP-26 (Delegated Events) | Write-Then-Read | Publish event with `delegation` tag, verify relay accepts |
| NIP-04 (Direct Messages) | Write-Then-Read | Publish kind 4, verify relay does not expose to non-participants |

### Category B: Requires Small Suite Extension

| NIP | Required Extension | Notes |
|-----|--------------------|-------|
| NIP-42 (AUTH) | Promote `Nip42` to extend `Suite` properly; add to both manifests | Schemata and interfaces already exist; bare class is not runnable by Auditor |
| NIP-86 (Relay Mgmt API) | `requires = []` in Suite; fetch() in prepare() | Identical to NIP-11 HTTP pattern; model directly on ValidateSchema.ts |

### Category C: New Message Type Infrastructure

| NIP | New Messages | Extension Needed |
|-----|-------------|-----------------|
| NIP-45 (COUNT) | Client sends `COUNT` verb; relay responds with `["COUNT", subId, {"count": N}]` | Add COUNT generator class in NIP-45 index.ts; add messageValidator for COUNT response |

### Shared Utilities to Build Before Any Write-Then-Read NIPs

| Utility | Suggested Location | Purpose | Used By |
|---------|-------------------|---------|---------|
| `generateTestKeypair()` | `src/utils/signing.ts` (new file) | Ephemeral pubkey/privkey using nostr-tools | NIP-09, NIP-16, NIP-40, NIP-42, NIP-26 |
| `signTestEvent(params)` | `src/utils/signing.ts` | Sign a Note with throw-away key | Same NIPs |
| `signAuthEvent(challenge, relayUrl)` | `src/utils/signing.ts` | Build NIP-42 auth signed event | NIP-42 exclusively |
| `waitFor(ms)` | `src/utils/async.ts` (new file) | Simple delay for expiration tests | NIP-40 |

The signing utilities are the highest-priority shared infrastructure — 6+ NIP suites cannot be implemented without them.

## Anti-Patterns

### Anti-Pattern 1: Monolithic SuiteTest Per NIP

**What people do:** Put all behavioral assertions for a NIP into a single SuiteTest class.
**Why it's wrong:** The Suite.test() loop runs each SuiteTest independently with its own WebSocket lifecycle. A single class cannot be independently skipped when samples are missing for one scenario. NIP-01 splits into FilterAuthor/FilterKinds/FilterLimit/FilterMulti/FilterRange/FilterTags — each independently skippable and independently reportable.
**Do this instead:** One SuiteTest per distinct behavioral scenario. Different filter parameters = different test class.

### Anti-Pattern 2: Skipping One of the Two Manifest Files

**What people do:** Implement Suite and SuiteTest but forget to update one of the two manifest files.
**Why it's wrong:** `isRunnableSuiteKey()` in Auditor requires presence in BOTH `manifest.js` AND `suite-test-manifest.js`. Missing either causes the suite to be silently filtered out. No error is thrown — the suite simply never runs.
**Do this instead:** Update both manifests atomically. Treat them as a pair. Add an entry to `manifest.js` (Suite loader) and `suite-test-manifest.js` (tests loader) in the same commit.

### Anti-Pattern 3: Bare Class for Nip42 (Current State Is Broken)

**What people do:** The current `Nip42` in `src/nips/Nip42/index.ts` is a plain class — not a Suite subclass. It has `messageValidators` and generator classes but no `slug` getter, no `requires`, no `test()` method, and is absent from both manifests.
**Why it's wrong:** `resolveSuiteConstructor()` in Auditor looks for `prototype.test` — a bare class fails this check silently. Even if registered, `$Suite.test()` would throw.
**Do this instead:** Extend `Suite` properly, declare `readonly requires = ['websocket']`, implement `get slug() { return 'Nip42'; }`. The existing interfaces and schemata are valid — keep them and promote the class structure.

### Anti-Pattern 4: Using Default completeOn for Write-Then-Read Tests

**What people do:** Use the default `completeOn = ['maxEvents', 'EOSE']` in a write-then-read test that needs to inspect the OK response.
**Why it's wrong:** `_onMessageEose()` calls `conclude()` immediately after EOSE, terminating the WebSocket before the write-side OK/CLOSED messages can be received.
**Do this instead:** Set `completeOn = ['off']` and manually call `this.test(this.expect); this.conclude()` inside the appropriate `_onMessageXxx` handler — exactly as NegOpen.ts does for NIP-77.

### Anti-Pattern 5: Suite-Level State Shared Between Tests

**What people do:** Store per-scenario state on the Suite subclass instead of the SuiteTest subclass.
**Why it's wrong:** Suite instances are reused across all tests. State set during one SuiteTest's `onMessageXxx` persists into the next test. `Suite.reset()` only clears `testKey` — all other state is the test's responsibility.
**Do this instead:** Keep all per-scenario state in the SuiteTest subclass. Suite-level state is only appropriate for things that must survive across all tests (validators, generators).

## Build Order Implications

### Phase 1: Shared Signing Infrastructure (prerequisite)

Build first; blocks 6+ NIP suites otherwise.

1. `src/utils/signing.ts` — `generateTestKeypair()`, `signTestEvent()`, `signAuthEvent()` using nostr-tools
2. `src/utils/async.ts` — `waitFor(ms)` for expiration timing

### Phase 2: NIP-42 AUTH (fix existing scaffolding)

Schemata and interfaces exist. Suite fix is small. AUTH pattern is unique and should be proven before other suites that might need similar challenge-response flows.

3. Fix `Nip42/index.ts` to extend Suite
4. Implement AUTH challenge-response test(s)
5. Add to both manifests

### Phase 3: Passive Read NIPs (standard pattern, no signing required)

Follow NIP-65 as the template. These are straightforward.

6. NIP-25 (Reactions — kind 7)
7. NIP-94 (File Metadata — kind 1063)
8. NIP-58 (Badges — kinds 30008/30009)

### Phase 4: Write-Then-Read NIPs (depends on Phase 1 signing utils)

9. NIP-09 (Deletion — kind 5, verify target disappears)
10. NIP-16 (Replaceable events — same kind+pubkey, latest wins)
11. NIP-26 (Delegated events — delegation tag acceptance)
12. NIP-40 (Expiration — short-TTL events, verify eviction)

### Phase 5: Protocol Extensions

13. NIP-45 (COUNT filter extension — new message type)
14. NIP-86 (Relay Management API — HTTP pattern)

### Phase 6: Encrypted / Privacy NIPs (most research-intensive)

15. NIP-04 (Direct Messages — relay access control behavior)
16. NIP-44 (Encrypted Payloads — relay storage assertions)

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Nostr relay (WebSocket) | `UniversalWebSocket` from `@nostrwatch/websocket` | One WS per suite; Sampler creates and closes its own connection |
| Nostr relay (HTTP) | `fetch()` inside SuiteTest.prepare() | Model: Nip11/tests/ValidateSchema.ts; applies to NIP-86 |
| `@nostrability/schemata` | Static import of JSON Schema objects | Central schema library; check here before defining custom schemata |
| `nostr-tools` | Event signing for write-then-read and AUTH tests | Already a project dependency |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Auditor ↔ Suite | Direct method call `$Suite.test()` | Auditor catches errors and converts to skippedSuiteResult |
| Suite ↔ SuiteTest | Suite creates instances from suite-test-manifest; calls `suiteTest.run()` | 500ms delay between tests |
| Suite ↔ Sampler | Suite.initSampler() on first registerIngestor call | Lazily initialized |
| SuiteTest ↔ WebSocket | Via `this.suite.socket` property | Socket owned by Suite; SuiteTest closes via `conclude()` only |
| Global event bus | `Emitter` singleton (tseep) | Events: `auditor.suite:start/finish`, `auditor.suite.test:start/finish`, `auditor.suite:samples`, `all:abort`, `socket:eose:{subId}` |

## Sources

- `libraries/auditor/src/base/Auditor.ts` — direct code analysis (HIGH confidence)
- `libraries/auditor/src/base/Suite.ts` — direct code analysis (HIGH confidence)
- `libraries/auditor/src/base/SuiteTest.ts` — direct code analysis (HIGH confidence)
- `libraries/auditor/src/base/Ingestor.ts` — direct code analysis (HIGH confidence)
- `libraries/auditor/src/base/Sampler.ts` — direct code analysis (HIGH confidence)
- `libraries/auditor/src/base/Expect.ts` — direct code analysis (HIGH confidence)
- `libraries/auditor/src/nips/Nip01/index.ts` + tests/ — full-depth pattern example (HIGH confidence)
- `libraries/auditor/src/nips/Nip77/index.ts` + tests/NegOpen.ts — custom protocol extension example (HIGH confidence)
- `libraries/auditor/src/nips/Nip42/index.ts` + schemata/ interfaces/ — incomplete scaffolding analysis (HIGH confidence)
- `libraries/auditor/src/nips/Nip11/tests/ValidateSchema.ts` — HTTP-only test pattern (HIGH confidence)
- `libraries/auditor/src/nips/manifest.js` + suite-test-manifest.js — registration mechanism (HIGH confidence)

---
*Architecture research for: @nostrwatch/auditor wider NIP support*
*Researched: 2026-03-12*
