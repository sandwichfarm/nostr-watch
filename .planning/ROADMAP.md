# Roadmap: @nostrwatch/auditor — Wider NIP Support

## Overview

This milestone expands the auditor from 7 NIP suites to full coverage of every relay-testable NIP in the Nostr protocol. The work proceeds in dependency order: fix silent failure modes and build shared infrastructure first, complete the partially-built NIP-42 AUTH suite next (it gates NIP-70), then add the write-heavy behavioral NIPs (deletion, expiration), then the protocol extensions and conditional suites, and finally extend the existing NIP-01 and NIP-11 suites with completeness checks. Every phase delivers runnable, verifiable test suites — nothing is a stub.

## Milestones

- 📋 **v2.0 Wider NIP Support** — Phases 5-9 (planned)

## Phases

**Phase Numbering:**
- Integer phases (5, 6, 7, 8, 9): Planned v2.0 milestone work
- Decimal phases (5.1, 6.1, etc.): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 5: Foundation** - Fix latent bugs, add signing utilities, and install nostr-tools dependency
- [ ] **Phase 6: NIP-42 AUTH** - Promote broken scaffolding to a complete, runnable AUTH suite with pre-flight cascade protection
- [ ] **Phase 7: Deletion and Expiration** - NIP-09 kind-5 enforcement and NIP-40 expiration enforcement using ephemeral keypairs
- [ ] **Phase 8: COUNT and Protected Events** - NIP-45 COUNT verb support and NIP-70 protected event enforcement
- [ ] **Phase 9: Extensions and Limit Enforcement** - NIP-13 PoW, NIP-01 prefix completeness, NIP-11 limit enforcement

## Phase Details

### Phase 5: Foundation
**Goal**: The auditor has a trustworthy, bug-free platform for adding NIP suites — all silent failure modes eliminated and shared signing utilities available for every subsequent phase
**Depends on**: Nothing (first phase of v2.0 milestone)
**Requirements**: FOUND-01, FOUND-02, FOUND-03, FOUND-04
**Success Criteria** (what must be TRUE):
  1. `formatNip(1)` returns `"01"`, `formatNip(9)` returns `"09"`, `formatNip(42)` returns `"42"`, `formatNip(100)` returns `"100"` — all NIP numbers format correctly with unit tests proving it
  2. Running the manifest consistency validator with mismatched keys between `manifest.js` and `suite-test-manifest.js` produces a clear error identifying which keys are missing from which file
  3. `src/utils/signing.ts` exports `generateTestKeypair()`, `signTestEvent()`, and `signAuthEvent()` and these can be imported and called by NIP suite tests
  4. `nostr-tools@^2.10.4` appears in the auditor's own `package.json` dependencies and `import { generateSecretKey } from 'nostr-tools/pure'` resolves without error inside the auditor package
**Plans**: TBD

### Phase 6: NIP-42 AUTH
**Goal**: The auditor can run a complete NIP-42 AUTH suite that detects challenge issuance, completes the handshake, and validates relay enforcement — and a pre-flight guard prevents cascade failures on auth-required relays
**Depends on**: Phase 5
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07
**Success Criteria** (what must be TRUE):
  1. Pointing the auditor at a relay that issues AUTH challenges results in the suite detecting the `AUTH` message and recording AUTH-01 as pass
  2. The suite sends a correctly-signed kind 22242 event and verifies the relay accepts it — AUTH-02 passing on a cooperating relay
  3. The suite sends a kind 22242 with `created_at` outside the 10-minute window and verifies the relay rejects it — AUTH-03 passing
  4. The suite verifies challenge tag and relay URL tag matching correctness — AUTH-04 and AUTH-05 passing or advisory on relays that do not enforce
  5. Pointing the auditor at an auth-required relay results in other suites being marked `skipped` with reason `"relay requires auth"` rather than failing — AUTH-07 pre-flight working
**Plans**: TBD

### Phase 7: Deletion and Expiration
**Goal**: The auditor can verify that relays honor NIP-09 kind-5 deletion requests and NIP-40 expiration tags, using freshly-generated ephemeral keypairs per run to avoid polluting live relay data
**Depends on**: Phase 5
**Requirements**: DEL-01, DEL-02, DEL-03, DEL-04, EXP-01, EXP-02
**Success Criteria** (what must be TRUE):
  1. The NIP-09 suite publishes a test event under an ephemeral keypair, sends a kind-5 deletion with an `e` tag, and records whether the relay accepts the deletion (OK: true) — DEL-01 result recorded on cooperating relays
  2. The NIP-09 suite tests a-tag deletion of a replaceable event and records the relay's response independently — DEL-02 result recorded
  3. The NIP-09 suite publishes an event under keypair A, attempts deletion from keypair B, and verifies the event remains fetchable — DEL-03 passing
  4. The NIP-09 suite confirms the kind-5 deletion event itself remains fetchable after submission — DEL-04 passing
  5. The NIP-40 suite submits an event with an `expiration` tag already in the past and verifies the relay rejects it with OK: false — EXP-01 passing
**Plans**: TBD

### Phase 8: COUNT and Protected Events
**Goal**: The auditor can test NIP-45 COUNT verb support and NIP-70 protected event enforcement, with NIP-70 correctly requiring a completed AUTH suite as a declared precondition
**Depends on**: Phase 6
**Requirements**: COUNT-01, COUNT-02, PROT-01, PROT-02, PROT-03
**Success Criteria** (what must be TRUE):
  1. The NIP-45 suite sends a COUNT request and records PASS when the relay replies with a valid `{"count": N}` response (COUNT-01 and COUNT-02 passing)
  2. The NIP-45 suite records PASS when the relay refuses with CLOSED — refusal is valid per spec and must not be treated as failure
  3. The NIP-45 suite records FAIL only when the relay times out with no response to a COUNT message
  4. The NIP-70 suite confirms an unauthenticated client cannot publish an event with a `["-"]` tag — PROT-01 passing on relays that support NIP-70
  5. Running NIP-70 tests on a relay whose `requires` check fails (NIP-42 not available) causes the suite to skip gracefully with a dependency message rather than producing false failures
**Plans**: TBD

### Phase 9: Extensions and Limit Enforcement
**Goal**: Existing NIP-01 and NIP-11 suites gain completeness checks for machine-readable message prefixes and advertised limit enforcement; a new NIP-13 suite tests PoW rejection conditionally on NIP-11 data
**Depends on**: Phase 5
**Requirements**: POW-01, POW-02, MSG-01, MSG-02, LIM-01, LIM-02, LIM-03
**Success Criteria** (what must be TRUE):
  1. The NIP-01 extension verifies that OK failure messages from the relay use one of the machine-readable prefixes (`duplicate:`, `pow:`, `blocked:`, `rate-limited:`, `invalid:`, `error:`) — MSG-01 recorded on testable conditions
  2. The NIP-01 extension verifies that CLOSED messages from the relay use `auth-required:` or `restricted:` prefixes where the condition is triggerable — MSG-02 recorded
  3. When a relay's NIP-11 document advertises `min_pow_difficulty > 0`, the NIP-13 suite sends an event with insufficient PoW and verifies the relay rejects it with a `pow:` prefix — POW-01 and POW-02 passing
  4. The NIP-11 extension tests that advertised `max_message_length`, `created_at` bounds, and `max_subscriptions` limits are actually enforced, flagging unenforced advertised limits as advisory rather than hard FAIL — LIM-01, LIM-02, LIM-03 recorded
  5. All three extension suites skip gracefully and produce no result entries when the relay's NIP-11 document does not advertise the relevant fields
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in dependency order: 5 → 6 → 7 → 8 → 9

Note: Phase 7 depends only on Phase 5 (signing utils), not Phase 6 (AUTH). Phase 9 depends only on Phase 5. Phases 7 and 9 can begin as soon as Phase 5 completes. Phase 8 must wait for Phase 6 (NIP-70 requires AUTH).

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 5. Foundation | 0/TBD | Not started | - |
| 6. NIP-42 AUTH | 0/TBD | Not started | - |
| 7. Deletion and Expiration | 0/TBD | Not started | - |
| 8. COUNT and Protected Events | 0/TBD | Not started | - |
| 9. Extensions and Limit Enforcement | 0/TBD | Not started | - |
