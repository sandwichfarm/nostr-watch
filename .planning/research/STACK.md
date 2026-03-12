# Stack Research

**Domain:** NIP conformance testing for Nostr relays — @nostrwatch/auditor wider NIP support
**Researched:** 2026-03-12
**Confidence:** HIGH (existing stack, nostr-tools API), MEDIUM (NIP coverage boundaries, timing patterns)

---

## Context

This is a **stack additions** research file for a subsequent milestone. The existing auditor stack is fixed and validated. This document answers only: what needs to be added or changed to implement comprehensive NIP test suites beyond what already exists?

The auditor is a Node.js ESM library (`"type": "module"`, target `es2022`, `moduleResolution: node`). It does NOT use Deno. It does NOT currently depend on nostr-tools at all — event signing and key generation are absent from the library. This is the central gap.

---

## Existing Stack (Do Not Re-research)

| Technology | Version | Role |
|------------|---------|------|
| TypeScript | ^5.6.3 | Language |
| @nostrwatch/websocket | workspace | WebSocket connections to relays |
| ajv + ajv-errors | ^8.17.1 / ^3.0.0 | JSON schema validation |
| @nostrability/schemata | ^0.1.6 | NIP JSON schemas |
| cross-fetch | ^4.0.0 | HTTP (NIP-11 uses fetch already) |
| tseep | ^1.3.1 | Internal EventEmitter |
| vitest | 3.1.1 | Unit test runner |
| chalk | ^5.3.0 | Terminal output |

---

## Required Stack Additions

### Core: Event Signing and Key Generation

**The auditor has no event signing capability.** NIP-42 requires the test client to create and sign a kind 22242 event. NIP-09 tests require publishing a delete-target event then a deletion request. NIP-40 tests require publishing an event with an `expiration` tag. NIP-70 tests require publishing an event with the `["-"]` tag. All of these need `finalizeEvent` + `generateSecretKey`.

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| nostr-tools | ^2.10.4 | Event creation, signing, verification, NIP-44 encryption | The workspace root already pins this version (`"nostr-tools": "^2.10.4"` in root package.json). `schemata-js-ajv` uses it at the same constraint. Using the same version avoids duplicate installs. v2 API is the current standard: `generateSecretKey()` returns `Uint8Array`, `finalizeEvent()` signs an event template. The `nip44` subpath export provides encryption for NIP-44 testing if needed. |

**Import pattern for this library (ESM, Node.js):**

```typescript
import { generateSecretKey, getPublicKey, finalizeEvent, verifyEvent } from 'nostr-tools/pure';
import * as nip44 from 'nostr-tools/nip44';
```

Use `nostr-tools/pure` (pure JS crypto) rather than `nostr-tools/wasm` — WASM requires async initialization and adds runtime complexity in a test-runner context. Pure JS is adequate; event signing is not a performance bottleneck for conformance testing.

**What nostr-tools/pure provides for NIP test suites:**

| Function | Used For |
|----------|---------|
| `generateSecretKey()` | Create ephemeral test keypair for each suite run |
| `getPublicKey(sk)` | Derive pubkey from secret key |
| `finalizeEvent(template, sk)` | Sign any event — needed for NIP-42, NIP-09, NIP-40, NIP-70 |
| `verifyEvent(event)` | Verify relay-returned events have valid signatures |
| `nip44.getConversationKey(sk, pk)` | Derive shared secret for NIP-44 encrypted DM tests |
| `nip44.encrypt(plaintext, key)` | Create NIP-44 ciphertext for publishing kind 1059 test events |

---

### HTTP Client: No Addition Needed

`cross-fetch` is already a dependency and is used in NIP-11's `ValidateSchema` test via the global `fetch` API. NIP-86 (Relay Management API) uses HTTP POST with `Content-Type: application/nostr+json+rpc` and an `Authorization: Nostr <base64-event>` header — this is reachable with the existing `fetch`. No new HTTP library needed.

NIP-96 (HTTP File Storage) is out of scope — it's a dedicated file server protocol, not a standard relay WebSocket feature. Fewer than 20% of relays implement it (MEDIUM confidence, community estimates). Skip.

---

## NIP Coverage Map: What Each Target NIP Needs

This section maps each relay-testable NIP to its stack requirements, to confirm nostr-tools covers everything.

### Tier 1: Complete with Existing Stack (No New Dependencies)

| NIP | What to Test | Stack Already Has |
|-----|-------------|-------------------|
| NIP-45 | Send `["COUNT", subId, filter]` over WebSocket, expect `["COUNT", subId, {"count": N}]` response | WebSocket only — no signing needed |
| NIP-50 | Already implemented — search filter behavior | Existing |
| NIP-77 | Already implemented — negentropy sync | Existing |
| NIP-11 | Already implemented — relay info document | Existing |

### Tier 2: Requires nostr-tools (Event Signing)

| NIP | What to Test | Why Signing Needed |
|-----|-------------|-------------------|
| NIP-42 | Connect, receive `["AUTH", challenge]`, create and sign kind 22242 event with `relay` + `challenge` tags, send `["AUTH", signedEvent]`, expect `["OK", ...]` | Must sign kind 22242 with correct relay URL and challenge |
| NIP-09 | Publish event, then publish kind 5 deletion request for same pubkey, query and verify relay stops serving original | Must publish events, sign deletion request |
| NIP-40 | Publish event with `expiration` tag set to past timestamp, verify relay does not serve it | Must publish event with expiration |
| NIP-70 | Publish event with `["-"]` tag without AUTH — expect relay to reject; with AUTH — expect acceptance (if relay supports NIP-42) | Must publish protected events to test relay enforcement |
| NIP-13 | Publish events with varying leading-zero bits in ID, verify relay accepts/rejects per `min_pow_difficulty` in NIP-11 | Must generate PoW-valid events (nonce mining loop using `sha256` from nostr-tools) |

### Tier 3: Requires nostr-tools + NIP-44

| NIP | What to Test | Why NIP-44 Needed |
|-----|-------------|------------------|
| NIP-59 | Relay should guard kind 1059 gift-wrap events using AUTH — serve only to p-tagged recipient | Gift wrap construction requires NIP-44 encryption of sealed inner event |

### Tier 4: Deferred / Out of Scope for This Milestone

| NIP | Reason to Defer |
|-----|----------------|
| NIP-29 | Relay-based groups — requires relay to be a group relay; path-dependent event validation makes general testing impractical. Niche implementation. |
| NIP-86 | Relay Management API — requires relay admin credentials. Not practical to test generically. |
| NIP-96 | HTTP File Storage — separate server protocol, <20% adoption, not a relay WebSocket NIP. |
| NIP-04 | Deprecated in favor of NIP-17. Relay behavior (serving kind 4 events) is covered by NIP-01 filter tests. No new suite needed. |

---

## Supporting Libraries: No New Additions

| Considered | Decision | Rationale |
|------------|----------|-----------|
| `@noble/hashes` (sha256 for NIP-13 PoW) | Not needed separately | nostr-tools/pure already uses `@noble/curves` and `@noble/hashes` internally. NIP-13 PoW can be computed using the `sha256` that nostr-tools depends on, or by re-hashing using the `id` computation already in `finalizeEvent`. Implement PoW mining as a utility that calls `finalizeEvent` in a loop with incrementing nonce tags. |
| `nostr-nip44` (standalone) | Not needed | nostr-tools includes `nip44` as a named subpath export (`nostr-tools/nip44`). Using a separate NIP-44 library when the workspace already pins nostr-tools would create a version split. |
| `ws` (raw WebSocket) | Not needed | Already a dependency. Used internally by `@nostrwatch/websocket`. |

---

## Timing and Timing-Sensitive Test Patterns

NIP-22 (created_at limits) and NIP-40 (expiration) require time-relative event creation. These use:

- `Math.floor(Date.now() / 1000)` for current Unix timestamp (already used in existing tests implicitly via `finalizeEvent`'s `created_at` requirement)
- No timing library needed — the existing `timeoutMs` property on `SuiteTest` handles maximum test duration (default 10 seconds, NIP-77 uses 7 seconds)

NIP-42 has a 10-minute window for kind 22242 `created_at`. The auditor should sign the AUTH event immediately upon receiving the challenge; no timing library needed.

---

## Installation

```bash
# Add nostr-tools to the auditor package
# (workspace root already has ^2.10.4, this adds it explicitly to the auditor's own deps)
pnpm --filter @nostrwatch/auditor add nostr-tools@^2.10.4
```

No other additions needed.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `nostr-tools/pure` | `nostr-tools/wasm` | Use WASM only if event verification speed is a bottleneck at scale (it is 7x faster). For conformance testing of individual relays, pure JS is adequate and requires no async WASM init. |
| nostr-tools ^2.10.4 | NDK (@nostr-dev-kit/ndk) | NDK is a full client framework — pool management, caching, event stores. The auditor is not a client; it sends raw NIP-01 messages. NDK would add unnecessary abstraction and dependency weight. |
| nostr-tools built-in nip44 | @paulmillr/nip44 (standalone) | If nostr-tools dropped nip44 support. Currently it's in the package, verified via package.json exports. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| NDK (`@nostr-dev-kit/ndk`) | Full relay pool client framework; hides the raw WebSocket messages the auditor needs to inspect and validate | `nostr-tools/pure` for signing only; existing `@nostrwatch/websocket` for transport |
| `nostr-tools@1.x` | v1 API (`finishEvent`, `generatePrivateKey`, hex secret keys) is incompatible with v2. The workspace root pins v2. Mixing versions causes type errors. | `nostr-tools@^2.10.4` |
| Any separate SHA-256 library for NIP-13 PoW | nostr-tools already bundles `@noble/hashes`. Adding a separate `sha256` or `@noble/hashes` dep creates a duplicate that pnpm must deduplicate. | Use `getEventHash` or re-derive via `finalizeEvent` with incremented nonce |
| `node-fetch` | Project already has `cross-fetch` which provides isomorphic fetch. `node-fetch` adds a duplicate. | `cross-fetch` or native `fetch` (Node 20+) |

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| nostr-tools@^2.10.4 | Node >=18, ESM | Workspace root already uses this constraint. Auditor's `"type": "module"` is compatible. |
| nostr-tools@^2.10.4 | TypeScript ^5.6.3 | Type definitions bundled at `lib/types/`. `resolveJsonModule: true` in auditor tsconfig is compatible. |
| nostr-tools/pure vs /wasm | Node.js | `/pure` works in Node.js without any additional setup. `/wasm` requires `await init()` before use. |
| nostr-tools@^2 | nostr-tools@^1 (trawler) | CRITICAL: The trawler (Deno) pins `nostr-tools@1.17.0` for `nostrawl` compat. The auditor is a separate Node.js package. pnpm workspaces will resolve them independently — they do NOT conflict because auditor is Node and trawler is Deno. No version collision. |

---

## Sources

- Workspace root `package.json` (nostr-tools ^2.10.4 pin) — verified directly, HIGH confidence
- `libraries/schemata-js-ajv/package.json` (nostr-tools ^2.10.4 usage pattern) — verified directly, HIGH confidence
- nostr-tools README, nbd-wtf/nostr-tools GitHub — generateSecretKey/finalizeEvent/nip44 API — MEDIUM confidence (WebSearch, not Context7)
- NIP-42 spec, nips.nostr.com/42 — AUTH flow and kind 22242 requirements — HIGH confidence (official spec, fetched)
- NIP-45 spec, nips.nostr.com — COUNT message format — HIGH confidence (official spec, fetched)
- NIP-70 spec, nips.nostr.com/70 — protected events relay enforcement — HIGH confidence (official spec, fetched)
- NIP-09 relay behavior — WebSearch verified against spec language — MEDIUM confidence
- NIP-40 relay behavior — WebSearch verified against spec language — MEDIUM confidence
- NIP-13 relay behavior — spec describes client-side validation; relay enforcement via `min_pow_difficulty` in NIP-11 — MEDIUM confidence
- NIP-96 adoption estimate (~20% relays) — WebSearch community estimate — LOW confidence (single source)
- nostr-tools/pure vs /wasm performance comparison — WebSearch (34ms vs 239ms for verification) — MEDIUM confidence

---

*Stack research for: @nostrwatch/auditor wider NIP support — stack additions for new NIP test suites*
*Researched: 2026-03-12*
