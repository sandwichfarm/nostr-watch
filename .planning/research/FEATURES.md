# Feature Research

**Domain:** Nostr relay auditor — NIP conformance test suite expansion
**Researched:** 2026-03-12
**Confidence:** HIGH (NIP specs read directly from official source), MEDIUM (adoption rates — inferred from relay implementation lists)

---

## Context

This is a SUBSEQUENT MILESTONE adding comprehensive NIP test coverage to the existing `@nostrwatch/auditor`
library. The auditor already covers NIP-01, 02, 11, 22, 42 (schemata only), 50, 65, and 77. This
research identifies every remaining NIP that defines testable relay behavior, categorizes it, and
estimates implementation complexity within the existing Suite/SuiteTest architecture.

**What counts as testable relay behavior:**
- Relay must handle a specific message type (REQ, EVENT, COUNT, AUTH, etc.)
- Relay must respond in a verifiable way (OK with prefix, CLOSED, AUTH challenge, COUNT response)
- Relay must enforce a constraint (reject expired events, enforce deletion, require auth)
- Relay exposes a machine-readable document (NIP-11 relay info document fields)

**What does NOT count:**
- NIPs that only define event kinds/schemas that clients store and retrieve (no relay logic)
- NIPs defining encryption, key derivation, or identity mapping (fully client-side)
- NIPs defining HTTP file storage servers (not relay WebSocket protocol)
- Deprecated/unrecommended NIPs (NIP-04, NIP-08, NIP-26)

---

## Feature Landscape

### Table Stakes (Every relay auditor must test these)

NIPs with widespread relay adoption, fundamental behavior that distinguishes a compliant relay from
a broken one. Missing these = the auditor is incomplete for any production use.

| NIP | Feature | Why Expected | Complexity | Notes |
|-----|---------|--------------|------------|-------|
| NIP-42 (complete) | AUTH challenge-response test suite | Already has schemata; 3 major relay implementations support it (strfry, nostr-rs-relay). AUTH is the gateway to NIP-70, protected events, and restricted subscriptions. | MEDIUM | Needs: send REQ to restricted resource → expect AUTH challenge; complete AUTH handshake → verify OK; test invalid AUTH → expect rejection with `auth-required:` prefix |
| NIP-09 | Event deletion request enforcement | Implemented by nostr-rs-relay, nostream, strfry. Relay SHOULD delete referenced events and SHOULD NOT serve them after deletion. `e` and `a` tag handling both testable. | MEDIUM | Send kind 5 with `e` ref; query for deleted event; verify not returned. Also test `a` tag for replaceable events. Complexity: requires event publication first, then deletion, then query. |
| NIP-40 | Expiration timestamp enforcement | Implemented by strfry, nostr-rs-relay, nostream. Relay SHOULD drop incoming expired events; SHOULD NOT serve stored expired events. | MEDIUM | Two tests: (1) publish event with past `expiration` tag → expect rejection; (2) query for event known to have expired → verify not returned. |
| NIP-45 | COUNT verb support | Strfry implements it. Widely useful for relay operators. Simple message exchange: `["COUNT", id, filters]` → `["COUNT", id, {"count": N}]`. | LOW | Simple: send COUNT with known filter, verify numeric response. Can also test rejection CLOSED message format. Slightly above NIP-01 complexity. |
| NIP-13 (behavioral) | PoW enforcement via NIP-11 `min_pow_difficulty` | Many relay implementations reject under-powered events if `min_pow_difficulty` is set. Testable if NIP-11 document exposes the field. | LOW | Conditional test: if NIP-11 reports `min_pow_difficulty > 0`, send event with insufficient PoW and expect `["OK", id, false, "pow: ..." ]` rejection. |
| NIP-70 | Protected events (`["-"]` tag enforcement) | Strfry explicitly supports NIP-70. Relay MUST reject `["-"]` events without AUTH; MUST verify pubkey match after AUTH. | MEDIUM | Depends on NIP-42 suite. Three cases: (1) send protected event without auth → expect rejection; (2) send protected event with auth + matching pubkey → expect acceptance; (3) auth + non-matching pubkey → expect rejection. |
| NIP-01 (OK prefixes) | Machine-readable OK/CLOSED prefix validation | NIP-01 defines `duplicate`, `pow`, `blocked`, `rate-limited`, `invalid`, `restricted`, `mute`, `error` as required prefixes. Already partially covered; completing prefix coverage is a table stakes gap. | LOW | Extend existing NIP-01 suite. Trigger each condition where possible and verify prefix format. Relays that use free-form error text fail this test. |
| NIP-11 (limitation fields) | Relay limits enforcement | NIP-11 defines `max_message_length`, `max_subscriptions`, `max_filters`, `max_limit`, `min_pow_difficulty`, `auth_required`, `payment_required`, `created_at_lower_limit`, `created_at_upper_limit`. These are behavioral constraints that can be tested. | MEDIUM | Existing NIP-11 suite can be extended. For each advertised limit: attempt to exceed it and verify the relay enforces it (or flags if limits are advertised but not enforced). |

---

### Differentiators (Valuable but not universally expected)

NIPs with relay behavior that fewer relays implement, or protocols requiring more sophisticated test
scaffolding. Completing these sets the auditor apart from basic NIP-01 checkers.

| NIP | Feature | Value Proposition | Complexity | Notes |
|-----|---------|-------------------|------------|-------|
| NIP-29 | Relay-based groups enforcement | NIP-29 defines MUST relay behaviors: reject unauthorized moderation events, enforce group membership, validate timeline references. This is one of the few NIPs with hard relay requirements beyond basic event storage. | HIGH | Requires relay keypair knowledge, group creation, membership management. Multi-step stateful protocol. Only worthwhile if targeting group-capable relays specifically. |
| NIP-62 | Request to Vanish (pubkey deletion) | MUST requirements: relay MUST delete all events from a pubkey if its service URL is tagged. MUST prevent re-broadcasting. Stronger than NIP-09. | HIGH | Difficult to test definitively without publishing many events first, then vanishing, then verifying none are served. Re-broadcast prevention test is especially complex. |
| NIP-43 | Relay access (invite codes, join/leave) | DRAFT status. Defines join/leave/invite WebSocket flows with OK responses. Niche — only relevant for invite-only relays. | HIGH | NIP-43 is draft; adoption is minimal. Complex stateful flow. Only for specialized audit targets. |
| NIP-86 | Relay Management API | HTTP-based admin API. 18 methods, NIP-98 auth. Supports operational testing (can the operator ban pubkeys, change relay name, etc.). | HIGH | HTTP, not WebSocket. Out-of-band from main auditor protocol. Requires valid NIP-98 auth token. Valuable for relay operators but separate test surface. |
| NIP-66 (publish) | Publishing monitor reports | NIP-66 defines kind 30166 for publishing relay findings. The auditor could publish structured results as NIP-66 events, making findings machine-readable across the nostr network. | MEDIUM | This is about the auditor publishing its results, not testing a relay. Out of scope for test suites but relevant to auditor output. Flag for separate consideration. |
| NIP-37 | Draft event storage (NIP-42 private relay) | Defines kind 31234 events published to NIP-42 authed private relays. Relay SHOULD be NIP-42-authed and restrict access. Tests whether auth-gated draft storage works. | MEDIUM | Depends on NIP-42 suite. Niche use case; only authed private relays implement this pattern. |

---

### Anti-Features (Explicitly exclude from the auditor)

NIPs that should NOT have test suites added. Including them would be wasted effort or misleading.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| NIP-03 (OpenTimestamps) | Client-only attestation. Relay stores kind 1040 events normally; no relay-specific behavior. | No test suite; normal event storage already covered by NIP-01. |
| NIP-04 (Encrypted DM) | Marked unrecommended/deprecated in favor of NIP-17. Testing deprecated protocol adds confusion. | Document as deprecated in any NIP coverage report. |
| NIP-05 (DNS identity) | Purely HTTP GET against a well-known URL. No relay WebSocket behavior. | No test suite. |
| NIP-06 (key derivation) | Client-side only. No relay behavior. | No test suite. |
| NIP-07 (window.nostr) | Browser extension API. No relay behavior. | No test suite. |
| NIP-08 (Handling Mentions) | Deprecated/unrecommended. | No test suite. |
| NIP-10 (e/p tag conventions) | Client interpretation rules. Relay stores events unchanged. | No test suite; normal event storage covered by NIP-01. |
| NIP-14 (Subject tag) | Client-side display convention only. | No test suite. |
| NIP-15 (Marketplace) | Explicitly "software should be entirely clientside". No relay-specific behavior. | No test suite. |
| NIP-17 (Private DMs) | Relay OPTIONALLY restricts kind 1059 via NIP-42 AUTH. Testing this is the NIP-42 AUTH suite's job, not NIP-17's. | Cover via NIP-42 AUTH test for kind 1059 restriction if desired. |
| NIP-18 (Reposts) | Standard event storage. No relay enforcement rules. | No test suite. |
| NIP-19 (bech32) | Encoding format, client-side only. | No test suite. |
| NIP-21 (nostr: URI) | URI scheme, client-side only. | No test suite. |
| NIP-23 (Long-form content) | Client-side content format. Relay stores kind 30023 as standard replaceable events. | Covered by existing NIP-01 replaceable event behavior. |
| NIP-24 (Extra metadata) | Client-side extension of kind 0. No relay logic. | No test suite. |
| NIP-25 (Reactions) | Standard event storage for kind 7. No relay enforcement. | No test suite. |
| NIP-26 (Delegated signing) | Marked unrecommended. Relay behavior (query expansion) is complex, deprecated, and disabled in nostr-rs-relay. | No test suite. |
| NIP-27 (Text Note References) | Client parsing convention. No relay behavior. | No test suite. |
| NIP-28 (Public Chat) | Spec explicitly states moderation is "client-centric" and imposes "no additional requirements on relays." | No test suite. |
| NIP-30 (Custom Emoji) | Client-side only. | No test suite. |
| NIP-31 (Unknown Events) | Client handling only. | No test suite. |
| NIP-32 (Labeling) | Client behavior for kind 1985. No relay enforcement. | No test suite. |
| NIP-34 (git stuff) | Event formats for code collaboration. No relay-specific behavior. | No test suite. |
| NIP-35 (Torrents) | Standard event storage. No relay logic. | No test suite. |
| NIP-36 (Sensitive Content) | Client-side content warning tag. No relay enforcement. | No test suite. |
| NIP-38 (User Statuses) | Client-side kind 30315 event. No relay logic. | No test suite. |
| NIP-39 (External Identities) | Client-side only. | No test suite. |
| NIP-44 (Encrypted Payloads) | Encryption algorithm. Client-only. | No test suite. |
| NIP-46 (Remote Signing) | Relay is infrastructure only; protocol runs client-to-signer. No relay-specific behavior. | No test suite. |
| NIP-47 (Wallet Connect) | Relay used as message bus only. No relay enforcement. | No test suite. |
| NIP-48 (Proxy Tags) | Client metadata tag. No relay enforcement. | No test suite. |
| NIP-49 (Private Key Encryption) | Local encryption format. No relay behavior. | No test suite. |
| NIP-51 (Lists) | Standard addressable event storage. No relay logic. | No test suite. |
| NIP-52 (Calendar Events) | Standard event storage. No relay logic. | No test suite. |
| NIP-53 (Live Activities) | Relay used for standard event distribution. No custom relay logic. | No test suite. |
| NIP-54 (Wiki) | Standard event storage for kind 30818. No relay logic. | No test suite. |
| NIP-55 (Android Signer) | Mobile signing app. No relay behavior. | No test suite. |
| NIP-56 (Reporting) | Standard event storage for kind 1984. No relay enforcement. | No test suite. |
| NIP-57 (Lightning Zaps) | Relay stores kind 9735 receipts. No relay-specific validation logic. | No test suite. |
| NIP-58 (Badges) | Standard event storage. No relay logic. | No test suite. |
| NIP-59 (Gift Wrap) | Relay OPTIONALLY restricts kind 1059 via NIP-42. Testing covered by NIP-42 suite. | No separate test suite; handled by NIP-42 AUTH coverage. |
| NIP-60 (Cashu Wallet) | Standard event kinds. No relay logic. | No test suite. |
| NIP-61 (Nutzaps) | Standard event kinds. No relay logic. | No test suite. |
| NIP-64 (Chess PGN) | Standard event storage. No relay logic. | No test suite. |
| NIP-68 (Picture feeds) | Standard event storage. No relay logic. | No test suite. |
| NIP-69 (P2P Orders) | Standard event kinds. No relay logic. | No test suite. |
| NIP-71 (Video Events) | Standard event storage. No relay logic. | No test suite. |
| NIP-72 (Moderated Communities) | Spec defines relay tags as recommendations, not enforced behavior. No mandatory relay logic. | No test suite. |
| NIP-73 (External Content IDs) | Tag convention. Client-side. No relay enforcement. | No test suite. |
| NIP-75 (Zap Goals) | Standard event storage. No relay logic. | No test suite. |
| NIP-78 (App-specific data) | Standard event kinds (30078). No relay logic. | No test suite. |
| NIP-7D (Threads) | Standard event kind. No relay logic. | No test suite. |
| NIP-84 (Highlights) | Standard event storage. No relay logic. | No test suite. |
| NIP-85 (Trusted Assertions) | Attestation events. No relay enforcement. | No test suite. |
| NIP-87 (Ecash Mint Discovery) | Standard event kind. No relay logic. | No test suite. |
| NIP-88 (Polls) | Standard event kinds. No relay logic. | No test suite. |
| NIP-89 (App Handlers) | Standard event kinds for client discovery. No relay logic. | No test suite. |
| NIP-90 (Data Vending Machines) | Standard event flow for ML tasks. Relay is message bus only. | No test suite. |
| NIP-92 (Media Attachments) | Tag convention. Client-side. | No test suite. |
| NIP-94 (File Metadata) | Standard event kind 1063. No relay logic. | No test suite. |
| NIP-96 (HTTP File Storage) | HTTP file server protocol. Not relay WebSocket behavior. | No test suite. |
| NIP-98 (HTTP Auth) | HTTP server auth using Nostr events. Not relay WebSocket protocol. However, NIP-86 requires NIP-98 — test indirectly via NIP-86 suite if built. | No standalone test suite. |
| NIP-99 (Classified Listings) | Standard event storage for kind 30402. No relay logic. | No test suite. |
| NIP-A0 (Voice Messages) | Standard event kind. No relay logic. | No test suite. |
| NIP-A4 (Public Messages) | Routing is client-side via NIP-65. Relay stores kind 24 as normal events. | No test suite. |
| NIP-B0 (Web Bookmarks) | Standard event storage. No relay logic. | No test suite. |
| NIP-B7 (Blossom) | HTTP media server protocol. Not relay WebSocket behavior. | No test suite. |
| NIP-BE (Nostr BLE) | Bluetooth protocol. Not relay behavior. | No test suite. |
| NIP-C0 (Code Snippets) | Standard event storage. No relay logic. | No test suite. |
| NIP-C7 (Chats) | Standard event kinds. No relay logic. | No test suite. |
| NIP-EE (MLS E2EE) | Relay is just an event store. No relay-specific behavior. | No test suite. |

---

## Feature Dependencies

```
NIP-01 suite (existing)
    └──required by──> All other suites
                         (every test uses REQ/EVENT/CLOSE/OK messages)

NIP-42 AUTH suite (complete)
    └──required by──> NIP-70 protected events test
    └──required by──> NIP-37 private draft relay test
    └──enhances──> NIP-09 deletion test (deletion by authenticated pubkey)
    └──required by──> NIP-86 management API (indirectly, via NIP-98)

NIP-11 suite (existing)
    └──enhances──> NIP-13 PoW test (reads min_pow_difficulty)
    └──enhances──> NIP-45 COUNT test (reads supported_nips to gate suite)
    └──enhances──> NIP-40 expiration test (reads created_at limits)
    └──enables──> Auto-detect gating for all suites

NIP-09 deletion test
    └──requires──> NIP-01 event publication (to create events for deletion)

NIP-40 expiration test
    └──requires──> NIP-01 event publication (to create events with expiration tags)

NIP-70 protected events test
    └──requires──> NIP-42 AUTH suite (AUTH must complete before protected event acceptance)

NIP-45 COUNT test
    └──requires──> NIP-01 data (COUNT filters need pre-existing events to count)
```

### Dependency Notes

- **NIP-42 blocks NIP-70:** NIP-70's three test cases all require completed AUTH flow. Build NIP-42 test suite first; NIP-70 suite imports NIP-42 helpers.
- **NIP-13 PoW test is conditional:** Only runs if `min_pow_difficulty > 0` in NIP-11 document. Test must read NIP-11 data as precondition.
- **NIP-09 requires event setup:** Tests must publish events first, then delete them, then query. Ingestor pattern (like AuthorIngestor in NIP-01) handles setup.
- **NIP-40 expiration is probabilistic:** "SHOULD NOT send expired events" allows relay discretion. Test should flag `WARN` not `FAIL` if expired events are returned, since the spec uses SHOULD not MUST.

---

## MVP Definition

This is a milestone expansion, not a new product. "MVP" here means: minimum test coverage expansion
that gives the auditor comprehensive relay compliance coverage for widely-adopted NIPs.

### Phase 1: Complete AUTH + Core Behavioral NIPs (v2.0)

NIPs that are foundational, widely adopted, and have clear testable behaviors.

- [ ] **NIP-42 complete test suite** — Schemata and interfaces already exist. Highest-impact gap: 3 major relays support it; AUTH gates multiple other NIPs. Tests: challenge generation, kind 22242 validation, timestamp check, challenge matching, relay URL matching, `auth-required:` prefix.
- [ ] **NIP-09 deletion enforcement** — Implemented by all major relays. Tests: publish + delete + query = verify not returned (e-tag); replaceable event deletion via a-tag.
- [ ] **NIP-40 expiration enforcement** — Implemented by strfry, nostr-rs-relay, nostream. Tests: reject expired incoming event; do not serve stored expired events.
- [ ] **NIP-45 COUNT support** — Strfry and others. Simple message exchange, low complexity. Tests: valid COUNT response format; optional approximate flag; CLOSED rejection format.
- [ ] **NIP-70 protected events** — Strfry. Depends on NIP-42. Tests: reject without auth; accept with auth + matching pubkey; reject with auth + mismatched pubkey.
- [ ] **NIP-01 OK/CLOSED prefix completeness** — Extend existing suite. All 8 machine-readable prefixes validated where triggerable.
- [ ] **NIP-11 limitation fields enforcement** — Extend existing suite. Test `max_message_length`, `created_at_lower_limit`/`created_at_upper_limit` enforcement; flag advertised-but-unenforced limits.
- [ ] **NIP-13 PoW conditional test** — Conditional on `min_pow_difficulty` in NIP-11. Low complexity addition.

### Phase 2: Advanced / Niche NIPs (v2.x)

Add if adoption evidence supports or if operator demand exists.

- [ ] **NIP-29 relay-based groups** — High complexity, stateful. Only for dedicated group relay testing.
- [ ] **NIP-62 Request to Vanish** — High complexity. Strong MUST requirements but hard to test comprehensively.
- [ ] **NIP-86 Management API** — HTTP-based, requires NIP-98 auth. Separate test surface from WebSocket protocol.

### Defer Indefinitely

- [ ] **NIP-43 relay access (invite codes)** — Draft status, minimal adoption. Re-evaluate when finalized.
- [ ] **NIP-66 publish results** — This is about auditor output format, not testing relays. Separate milestone.

---

## Feature Prioritization Matrix

| NIP | User Value | Implementation Cost | Priority | Adoption |
|-----|------------|---------------------|----------|----------|
| NIP-42 (complete) | HIGH | MEDIUM | P1 | strfry, nostr-rs-relay, nostream |
| NIP-09 deletion | HIGH | MEDIUM | P1 | strfry, nostr-rs-relay, nostream |
| NIP-40 expiration | HIGH | MEDIUM | P1 | strfry, nostr-rs-relay, nostream |
| NIP-01 OK prefixes | HIGH | LOW | P1 | Universal (NIP-01 is mandatory) |
| NIP-11 limits enforcement | HIGH | MEDIUM | P1 | All NIP-11 relays |
| NIP-45 COUNT | MEDIUM | LOW | P1 | strfry + others |
| NIP-70 protected events | MEDIUM | MEDIUM | P1 | strfry |
| NIP-13 PoW conditional | MEDIUM | LOW | P1 | Any relay with min_pow_difficulty |
| NIP-29 groups | MEDIUM | HIGH | P2 | Niche group relays |
| NIP-62 vanish | MEDIUM | HIGH | P2 | Limited |
| NIP-86 management API | LOW | HIGH | P3 | Relay operators only |
| NIP-43 invite system | LOW | HIGH | P3 | Draft; minimal |

**Priority key:**
- P1: Build in Phase 1 (v2.0)
- P2: Build in Phase 2 (v2.x) — after validation
- P3: Defer pending demand

---

## Relay Adoption Evidence

Cross-referencing three major relay implementations to ground adoption claims:

| NIP | strfry | nostr-rs-relay | nostream | Confidence |
|-----|--------|----------------|----------|------------|
| NIP-01 | YES | YES | YES | HIGH |
| NIP-02 | YES | YES | YES | HIGH |
| NIP-09 | YES | YES | YES | HIGH |
| NIP-11 | YES | YES | YES | HIGH |
| NIP-13 (PoW) | — | — | YES | MEDIUM |
| NIP-22 | — | YES | YES | MEDIUM |
| NIP-40 | YES | YES | YES | HIGH |
| NIP-42 | YES | YES | — | HIGH |
| NIP-45 | YES | — | — | MEDIUM |
| NIP-70 | YES | — | — | MEDIUM |
| NIP-77 | YES | — | — | MEDIUM |
| NIP-29 | — | — | — | LOW |
| NIP-43 | — | — | — | LOW (draft) |
| NIP-62 | — | — | — | LOW |
| NIP-86 | — | — | — | LOW |

Source: strfry GitHub README (direct read, HIGH confidence); nostr-rs-relay GitHub README (direct read, HIGH confidence); nostream GitHub (direct read, HIGH confidence).

---

## NIP-by-NIP Testing Detail (P1 NIPs)

### NIP-42: Complete AUTH Suite
**Relay behavior:** Relay sends `["AUTH", challenge]` on connect or when unauthenticated access is
attempted. Client responds with `["AUTH", kind:22242 event]`. Relay sends `["OK", ...]` back.

**Testable assertions:**
1. Relay sends AUTH message with string challenge on connection (if `auth_required: true` in NIP-11)
2. AUTH response event must be kind 22242
3. Relay rejects AUTH events with `created_at` more than 10 minutes old
4. Relay validates challenge tag matches issued challenge
5. Relay validates relay tag matches relay's own URL
6. Relay never broadcasts kind 22242 events to other subscribers
7. Unauthenticated request to restricted resource → `["CLOSED", id, "auth-required: ..."]`
8. Post-auth request to forbidden resource → `["CLOSED", id, "restricted: ..."]`

**Testing flow:** Multi-step. Requires the suite to track challenge strings, sign events, and
correlate OK messages with prior AUTH responses.

**Complexity: MEDIUM** — More complex than simple request/response because of state tracking.

---

### NIP-09: Event Deletion
**Relay behavior:** Relay receives kind 5 (deletion request). SHOULD delete or stop serving
referenced events if `pubkey` matches. SHOULD preserve the deletion event itself indefinitely.

**Testable assertions:**
1. Publish event E by author A; publish kind 5 by author A with `e: [E]`; query for E → not returned
2. Publish replaceable event R; publish kind 5 with `a: [kind:pubkey:d-tag]`; query → not returned
3. Publish kind 5 by author B referencing event E by author A → E should still be returned (pubkey mismatch)
4. Kind 5 deletion event itself is still retrievable after deletion

**Complexity: MEDIUM** — Three-step setup (publish, delete, query). Ingestor needed for initial
event publication. Replaceable event deletion adds an `a`-tag code path.

---

### NIP-40: Expiration Timestamp
**Relay behavior:** Relay SHOULD drop incoming events with `expiration` tag already in the past.
Relay SHOULD NOT serve stored events whose `expiration` has passed.

**Testable assertions:**
1. Publish event with `expiration: [past_timestamp]` → expect `["OK", id, false, "..."]` rejection
2. Query for events with expired `expiration` tag → none returned (WARN if returned, since SHOULD not MUST)

**Complexity: MEDIUM** — Two test cases; second requires knowing of a previously-stored expired
event (tricky) or using a very short expiration window (timing-dependent). Flag as WARN not FAIL.

---

### NIP-45: COUNT Verb
**Relay behavior:** Relay responds to `["COUNT", query_id, ...filters]` with
`["COUNT", query_id, {"count": N}]` or refuses with `["CLOSED", query_id, reason]`.

**Testable assertions:**
1. Send COUNT with valid filter → receive COUNT response with numeric count field
2. Optional: count value is approximate if `approximate: true` is set
3. Unsupported rejection → `["CLOSED", query_id, "..."]` (correct message format)

**Complexity: LOW** — Single message round-trip. Similar to sending a REQ and waiting for EOSE.

---

### NIP-70: Protected Events
**Relay behavior:** Relay MUST reject any event with `["-"]` tag without AUTH. After successful
AUTH, relay verifies pubkey match before accepting.

**Testable assertions:**
1. Send event with `["-"]` without auth → expect `["OK", id, false, "auth-required: ..."]`
2. Complete AUTH; send event with `["-"]` where `event.pubkey == auth.pubkey` → accept
3. Complete AUTH; send event with `["-"]` where `event.pubkey != auth.pubkey` → reject

**Complexity: MEDIUM** — Requires NIP-42 auth flow as prerequisite; three test cases.

---

### NIP-01 OK/CLOSED Prefix Completeness
**Relay behavior:** All OK and CLOSED messages must use machine-readable prefixes when the reason
is machine-relevant: `duplicate`, `pow`, `blocked`, `rate-limited`, `invalid`, `restricted`, `mute`,
`error`.

**Testable assertions:**
1. Publish duplicate event → `["OK", id, false, "duplicate: ..."]`
2. Publish event violating PoW → `["OK", id, false, "pow: ..."]`
3. Publish event from blocked pubkey → `["OK", id, false, "blocked: ..."]` (if enforceable)
4. Any CLOSED message that has a reason uses a recognized prefix

**Complexity: LOW** — Extends existing NIP-01 suite. Some prefix conditions (blocked, rate-limited,
mute) require relay-specific state that may not be reproducible in a generic auditor.

---

### NIP-11 Limitation Fields Enforcement
**Relay behavior:** If NIP-11 document advertises `max_message_length`, `created_at_lower_limit`,
`created_at_upper_limit`, `max_subscriptions`, or `max_filters`, the relay should enforce them.

**Testable assertions:**
1. If `max_message_length` is set: send message exceeding it → expect rejection (NOTICE or OK false)
2. If `created_at_lower_limit` is set: send event with too-old `created_at` → expect rejection
3. If `created_at_upper_limit` is set: send event with too-future `created_at` → expect rejection
4. If `max_subscriptions` is set: open more subscriptions than allowed → expect rejection or CLOSED
5. If `auth_required: true`: open subscription without auth → expect AUTH challenge or CLOSED

**Complexity: MEDIUM** — All tests are conditional on NIP-11 fields. Existing NIP-11 suite needs
extension; does not need a new suite from scratch.

---

### NIP-13: Proof of Work (Conditional)
**Relay behavior:** If NIP-11 reports `min_pow_difficulty > 0`, relay enforces that incoming events
meet the difficulty threshold. Uses OK `pow:` prefix for rejections.

**Testable assertions:**
1. If `min_pow_difficulty > 0`: send event with zero PoW → expect `["OK", id, false, "pow: ..."]`
2. Send event with PoW meeting the threshold → expect acceptance

**Complexity: LOW** — Conditional on NIP-11. Event generation with PoW requires computing nonce
(available via nostr-tools). Can be a single SuiteTest added to an extended NIP-11 or NIP-13 suite.

---

## Sources

- NIP-01: https://raw.githubusercontent.com/nostr-protocol/nips/master/01.md (HIGH confidence — official spec, direct read)
- NIP-09: https://raw.githubusercontent.com/nostr-protocol/nips/master/09.md (HIGH confidence)
- NIP-11: https://raw.githubusercontent.com/nostr-protocol/nips/master/11.md (HIGH confidence)
- NIP-13: https://raw.githubusercontent.com/nostr-protocol/nips/master/13.md (HIGH confidence)
- NIP-29: https://raw.githubusercontent.com/nostr-protocol/nips/master/29.md (HIGH confidence)
- NIP-40: https://raw.githubusercontent.com/nostr-protocol/nips/master/40.md (HIGH confidence)
- NIP-42: https://raw.githubusercontent.com/nostr-protocol/nips/master/42.md (HIGH confidence)
- NIP-43: https://raw.githubusercontent.com/nostr-protocol/nips/master/43.md (HIGH confidence — draft status confirmed)
- NIP-45: https://raw.githubusercontent.com/nostr-protocol/nips/master/45.md (HIGH confidence)
- NIP-62: https://raw.githubusercontent.com/nostr-protocol/nips/master/62.md (HIGH confidence)
- NIP-66: https://raw.githubusercontent.com/nostr-protocol/nips/master/66.md (HIGH confidence)
- NIP-70: https://raw.githubusercontent.com/nostr-protocol/nips/master/70.md (HIGH confidence)
- NIP-86: https://raw.githubusercontent.com/nostr-protocol/nips/master/86.md (HIGH confidence)
- NIP README (full NIP list): https://raw.githubusercontent.com/nostr-protocol/nips/master/README.md (HIGH confidence)
- strfry relay NIP support: https://github.com/hoytech/strfry (HIGH confidence — direct README read, supports NIPs 1, 2, 4, 9, 11, 28, 40, 42, 45, 70, 77)
- nostr-rs-relay NIP support: https://github.com/scsibug/nostr-rs-relay (HIGH confidence — direct README read)
- nostream NIP support: https://github.com/cameri/nostream (HIGH confidence — direct README read)
- NIP adoption statistics: MEDIUM confidence — inferred from relay implementation READMEs; no comprehensive network-wide statistics found

---

*Feature research for: @nostrwatch/auditor — NIP conformance test suite expansion*
*Researched: 2026-03-12*
