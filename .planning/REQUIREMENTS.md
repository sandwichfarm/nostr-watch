# Requirements: @nostrwatch/auditor Wider NIP Support

**Defined:** 2026-03-12
**Core Value:** The auditor can test any Nostr relay against every NIP that defines relay behavior

## v2.0 Requirements

Requirements for milestone v2.0. Each maps to roadmap phases.

### Foundation

- [ ] **FOUND-01**: Fix `formatNip()` condition to correctly pad single-digit NIP numbers only
- [ ] **FOUND-02**: Build manifest consistency validator that asserts key symmetry between `manifest.js` and `suite-test-manifest.js`
- [ ] **FOUND-03**: Add `nostr-tools@^2.10.4` as explicit auditor dependency
- [ ] **FOUND-04**: Create `src/utils/signing.ts` with `generateTestKeypair()`, `signTestEvent()`, and `signAuthEvent()` using `nostr-tools/pure`

### NIP-42 AUTH

- [ ] **AUTH-01**: Auditor can detect AUTH challenge sent by relay on connection or restricted access
- [ ] **AUTH-02**: Auditor can complete AUTH handshake by signing and sending kind 22242 event
- [ ] **AUTH-03**: Relay rejects AUTH events with `created_at` outside 10-minute window
- [ ] **AUTH-04**: Relay validates challenge tag matches issued challenge
- [ ] **AUTH-05**: Relay validates relay tag matches relay's own URL
- [ ] **AUTH-06**: Unauthenticated request to restricted resource returns `CLOSED` with `auth-required:` prefix
- [ ] **AUTH-07**: Auth-on-connect detection pre-flight prevents cascade failures in other suites

### NIP-09 Deletion

- [ ] **DEL-01**: Relay stops serving an event after receiving kind 5 deletion from the event's author (e-tag)
- [ ] **DEL-02**: Relay stops serving a replaceable event after receiving kind 5 deletion with a-tag
- [ ] **DEL-03**: Relay ignores kind 5 deletion from a different pubkey than the event's author
- [ ] **DEL-04**: Relay continues serving the kind 5 deletion event itself

### NIP-40 Expiration

- [ ] **EXP-01**: Relay rejects incoming event with `expiration` tag already in the past
- [ ] **EXP-02**: Relay does not serve stored events whose `expiration` has passed (WARN level — spec uses SHOULD)

### NIP-45 COUNT

- [ ] **COUNT-01**: Relay responds to `["COUNT", id, ...filters]` with `["COUNT", id, {"count": N}]` or refuses with `CLOSED`
- [ ] **COUNT-02**: COUNT response contains valid numeric `count` field

### NIP-70 Protected Events

- [ ] **PROT-01**: Relay rejects event with `["-"]` tag when client is not authenticated
- [ ] **PROT-02**: Relay accepts event with `["-"]` tag when authenticated and pubkey matches
- [ ] **PROT-03**: Relay rejects event with `["-"]` tag when authenticated but pubkey does not match

### NIP-13 PoW

- [ ] **POW-01**: Relay rejects event with insufficient PoW when `min_pow_difficulty > 0` (conditional on NIP-11)
- [ ] **POW-02**: Relay accepts event meeting PoW difficulty threshold

### NIP-01 Extensions

- [ ] **MSG-01**: Relay uses machine-readable prefixes on OK failure messages (`duplicate:`, `pow:`, `blocked:`, `rate-limited:`, `invalid:`, `error:`)
- [ ] **MSG-02**: Relay uses machine-readable prefixes on CLOSED messages (`auth-required:`, `restricted:`)

### NIP-11 Limit Enforcement

- [ ] **LIM-01**: Relay enforces advertised `created_at_lower_limit` and `created_at_upper_limit`
- [ ] **LIM-02**: Relay enforces advertised `max_message_length`
- [ ] **LIM-03**: Relay enforces advertised `max_subscriptions`

## Future Requirements

Deferred to v2.x. Tracked but not in current roadmap.

### Advanced NIPs

- **ADV-01**: NIP-29 relay-based groups conformance testing
- **ADV-02**: NIP-62 Request to Vanish enforcement testing
- **ADV-03**: NIP-86 Relay Management API testing (HTTP-based)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Client-only NIPs (NIP-05, 06, 07, 19, 44, 46, etc.) | No relay behavior to test — 50+ NIPs explicitly excluded |
| Deprecated NIPs (NIP-04, NIP-08, NIP-26) | Unrecommended; testing adds confusion |
| NIP-96 HTTP File Storage | Separate file server protocol, not relay WebSocket |
| NIP-43 Relay Access (invite codes) | Draft status, minimal adoption |
| NIP-66 Publish audit results | About auditor output format, not relay testing — separate milestone |
| Auditor base architecture refactoring | Existing Suite/SuiteTest pattern is sufficient |
| Auto-detect mechanism changes | Keep existing NIP-11 approach |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | TBD | Pending |
| FOUND-02 | TBD | Pending |
| FOUND-03 | TBD | Pending |
| FOUND-04 | TBD | Pending |
| AUTH-01 | TBD | Pending |
| AUTH-02 | TBD | Pending |
| AUTH-03 | TBD | Pending |
| AUTH-04 | TBD | Pending |
| AUTH-05 | TBD | Pending |
| AUTH-06 | TBD | Pending |
| AUTH-07 | TBD | Pending |
| DEL-01 | TBD | Pending |
| DEL-02 | TBD | Pending |
| DEL-03 | TBD | Pending |
| DEL-04 | TBD | Pending |
| EXP-01 | TBD | Pending |
| EXP-02 | TBD | Pending |
| COUNT-01 | TBD | Pending |
| COUNT-02 | TBD | Pending |
| PROT-01 | TBD | Pending |
| PROT-02 | TBD | Pending |
| PROT-03 | TBD | Pending |
| POW-01 | TBD | Pending |
| POW-02 | TBD | Pending |
| MSG-01 | TBD | Pending |
| MSG-02 | TBD | Pending |
| LIM-01 | TBD | Pending |
| LIM-02 | TBD | Pending |
| LIM-03 | TBD | Pending |

**Coverage:**
- v2.0 requirements: 29 total
- Mapped to phases: 0
- Unmapped: 29 ⚠️

---
*Requirements defined: 2026-03-12*
*Last updated: 2026-03-12 after initial definition*
