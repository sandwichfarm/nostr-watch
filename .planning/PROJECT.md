# @nostrwatch/auditor — Wider NIP Support

## What This Is

The `@nostrwatch/auditor` library is the relay conformance testing engine for the nostr-watch platform. It connects to Nostr relays over WebSocket, runs NIP-specific test suites, and produces structured pass/fail results. This milestone expands the auditor from 7 runnable NIP suites to comprehensive coverage of every relay-testable NIP in the protocol.

## Core Value

The auditor can test any Nostr relay against every NIP that defines relay behavior, giving relay operators and the nostr-watch platform a complete conformance picture.

## Current Milestone: v2.0 Wider NIP Support

**Goal:** Expand the auditor's NIP test coverage to include every NIP that defines testable relay behavior — not just schema definitions or client-side conventions.

**Target features:**
- Complete NIP-42 (AUTH) test suite (schemata/interfaces exist, no tests)
- New test suites for all relay-behavioral NIPs (research will determine full list)
- Behavioral-focused testing: verify the relay actually does the right thing
- Keep existing auto-detect behavior (NIP-11 `supported_nips`) for suite selection

## Requirements

### Validated

- ✓ Auditor base architecture (Auditor → Suite → SuiteTest → Ingestor/Sampler pipeline) — existing
- ✓ NIP-01 suite (basic protocol: filters, events, REQ/CLOSE, message validation) — existing
- ✓ NIP-02 suite (contact list / replaceable events) — existing
- ✓ NIP-11 suite (relay information document, NIP detection) — existing
- ✓ NIP-22 suite (event `created_at` limits) — existing
- ✓ NIP-42 schemata and interfaces (AUTH message formats) — existing, needs test suite
- ✓ NIP-50 suite (search) — existing
- ✓ NIP-65 suite (relay list metadata) — existing
- ✓ NIP-77 suite (negentropy sync) — existing
- ✓ Dynamic suite loading via manifest.js + suite-test-manifest.js — existing
- ✓ Auto-detection of supported NIPs via NIP-11 — existing
- ✓ Event emitter system for progress reporting — existing
- ✓ Schema validation via SchemaValidator base class — existing

### Active

- [ ] NIP-42 test suite completing the existing schemata/interfaces
- [ ] Test suites for all remaining relay-behavioral NIPs (determined by research)

### Out of Scope

- NIPs that only define event kinds or client-side schemas (no relay behavior to test)
- NIPs that define key derivation, encryption, or identity mapping (client-only)
- Refactoring the existing auditor base architecture
- Changes to the auto-detect mechanism (keep existing NIP-11 approach)
- Performance optimization or parallelization of suite execution

## Context

- The auditor uses a layered architecture: `Auditor` orchestrates `Suite` instances, each `Suite` runs `SuiteTest` subclasses that send messages and evaluate relay responses
- Each NIP lives in `src/nips/NipXX/` with a standard structure: `index.ts` (Suite subclass), `tests/` (SuiteTest subclasses), optionally `schemata/`, `interfaces/`, `ingestors/`
- Two manifest files (`manifest.js`, `suite-test-manifest.js`) register suites for dynamic loading — new NIPs must be added to both
- Suites use `Sampler` + `Ingestor` pipeline to collect relay data before running assertions
- The `Expect` class provides `behavior`, `json`, `message`, and `conditions` assertion groups
- Tests connect via `@nostrwatch/websocket` (UniversalWebSocket), send NIP-01 messages (REQ, EVENT, CLOSE), and evaluate responses
- Lighter suites (Nip02, Nip22, Nip65) show the minimal pattern; Nip01 shows the full-depth pattern with multiple test classes, ingestors, and schema validation

## Constraints

- **Architecture**: Follow existing Suite/SuiteTest pattern — no framework changes
- **Test depth**: Behavioral tests (does the relay do the right thing?) — schema validation only where the NIP defines specific message formats
- **Registration**: Every new NIP must be added to both `manifest.js` and `suite-test-manifest.js`
- **Dependencies**: Use existing `@nostrwatch/websocket` for connections; `nostr-tools` for event signing/verification where needed
- **Naming**: Directory naming follows `NipXX` pattern with zero-padded two-digit numbers

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Behavioral tests over schema-heavy approach | User wants to verify relay does the right thing, not just validate JSON shapes | — Pending |
| Keep auto-detect via NIP-11 | Existing mechanism works; only run suites for NIPs the relay claims to support | — Pending |
| Complete NIP-42 before new NIPs | Schemata/interfaces already exist; finishing it is lower effort than starting fresh | — Pending |
| Research determines NIP list | Let systematic research identify all relay-testable NIPs rather than guessing | — Pending |

---
*Last updated: 2026-03-12 after milestone v2.0 initialization*
