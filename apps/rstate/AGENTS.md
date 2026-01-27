Agents Guide for relay-state
===========================

Purpose
- Define how automation/AI agents work in this repository: plan, implement, validate, and document changes. Standardize where plans live and how to handle imports/moves to avoid duplication or data loss.

Scope
- Applies to the entire repository.
- Primary app focuses on RelayVM/State Machine, REST surface, and CVM transport.

Core Principles
- Plan before you build. Keep plans living and accurate.
- Small, focused changes. Avoid wide refactors unless asked.
- Favor existing building blocks (ContextVM SDK, utilities) over bespoke code.
- Be deterministic and auditable: produce reproducible aggregates and document policies.
- Do not create ad‑hoc planning folders (e.g., `.plans`). Use `.memory/plans` only.
- Do not place planning documents in the repository root. Always put planning, milestone, and architecture docs under `.memory/plans/`.
- When importing or flattening code, avoid overwriting existing files and avoid nesting redundant app roots.

SDLC for Agents
1) Discovery
- Read the master plan under `.memory/plans/` and any active milestone documents.
- Skim ContextVM SDK notes captured in the plans.
- When clarifying requirements, record assumptions in the appropriate plan document.

2) Planning
- Use the Codex plan tool to track the work units you will do in this session.
- Update plan docs:
  - Keep the master plan current (architecture, policies, glossary, updated high‑level scope).
  - Add or update milestone documents under `.memory/plans/` using a clear numbered convention.
- Confirm acceptance criteria and non‑goals in the plan before coding.

3) Design
- Align with ContextVM protocol and SDK where applicable:
  - Use `@contextvm/sdk` transports, relay handler, and signer.
  - Treat NIP‑66 kinds `10166/30166` and NIP‑32 labels (`L`/`l`) as primary inputs.
- Document aggregation/conflict rules (median+MAD, quorum/majority, label support ratios), and any deviations, in the milestone plan.
- Payments must be decoupled (plugin architecture). REST uses HTTP 402 (L402 + P2PK), CVM will have a separate token mechanism.

4) Implementation
- Default to minimal, targeted changes needed for the milestone.
- Prefer composing SDK primitives:
  - Server: `NostrServerTransport` (+ `ApplesauceRelayPool`, `PrivateKeySigner`).
  - Ingest: `ApplesauceRelayPool` with nostr filters for NIP‑66.
  - Client/dev: `NostrClientTransport` and `ctxcn`‑generated clients.
- Avoid committing secrets. Read keys and relay lists from env/config.
- Keep code style consistent with the repo; do not add license headers.
- Payment backends must be implemented behind interfaces (LightningProvider, CashuProvider, PaymentGateway) and not hard‑wired into REST or CVM.

5) Validation
- Start with focused tests (units for normalization/aggregation/geo), then integration.
- When using networked checks (e.g., `nak`), keep queries scoped. Store transient outputs under `/tmp/`.
- Verify that method responses are stable and schema‑friendly for `ctxcn` codegen.
- For payments, verify exact header formats (L402/P2PK) and replay protection paths; for CVM future tokens, verify authorizer hooks.

6) Documentation & Handoff
- Update the relevant plan(s) to reflect what was delivered and what remains.
- Summarize changes succinctly in your final message, linking file paths.
- If you added tools or changed schemas, note it in the master plan.

Plans: Directory, Naming, and Usage
- Location: `.memory/plans/`
- Organize by topic as needed; keep historical material separate from active work.
- Maintain a master plan as the source of truth for architecture, policies, surfaces, and milestones.
- Maintain milestone documents using a consistent, numbered naming scheme.
- Content guidance:
  - State scope, inputs, outputs, acceptance criteria, risks.
  - Keep docs concise; prefer bullet points and explicit field names.
  - Record policy/heuristic choices and defaults.
- Do not create ad‑hoc folders like `.plans`; always use `.memory/plans`.

Tests & Scripts
- Place all automated tests under `./test/`.
- Place test runner scripts (e.g., smoke test shell scripts) under `./test/` as well, not in the repository root.
- Do not add ad‑hoc test files or scripts at the repository root.

Interfaces & Conventions
- Configuration (env preferred):
  - `CVM_RELAYS` (server transport relays)
  - `INGEST_RELAYS` (ingest relays for NIP‑66)
  - `CVM_SERVER_NSEC` (or hex key), `CVM_ENCRYPTION_MODE`
  - `CVM_ALLOWED_PUBKEYS` for gating policy mutations
  - `LOG_LEVEL`, `LOG_DESTINATION`, `LOG_FILE`, `LOG_ENABLED`
  - Feature flags: `FEATURE_CVM`, `FEATURE_REST`, `FEATURE_402`, `FEATURE_402_L402`, `FEATURE_402_P2PK`, `FEATURE_SUBSCRIPTIONS`
  - Payments: `PAY_PRICES_JSON`, `REDIS_URL`, LN env (LND/CLN/LNURL), Cashu env per plan
- Aggregation defaults:
  - Window: global now − 3×max(10166.frequency) or per‑author now − 2×frequency_i
  - Numeric: median + MAD outlier rejection
  - Booleans: majority + support ratio; quorum configurable
  - Sets (NIPs/labels): include when support ≥ labelQuorum; track conflicts
  - Enums: majority; tie‑break by recency and author reliability
- Geo:
  - Prefer the longest `g` geohash; expose precision; Haversine distance.
- Labels (NIP‑32):
  - Treat `L`/`l` as generic metadata usable on any event; index `{namespace,value}` per relay and author.

Tooling & Execution Rules
- Use `rg` for search, small `sed`/`jq` reads (≤250 lines at a time).
- Use `apply_patch` for edits; avoid `git commit` unless explicitly asked.
- For moving/flattening imported trees:
  - Propose a non‑destructive merge first (e.g., `rsync --ignore-existing`); list potential conflicts before moving.
  - Do not nest redundant app roots (e.g., avoid `./cvm/` when files belong in repo root).
  - Place planning/doc files under `.memory/plans` (not project root).
- Be mindful of sandbox/approval policy; request escalations only when necessary.
- Network usage: minimize and batch requests; prefer narrow filters; document relay endpoints used.

Security & Privacy
- Never commit private keys or secrets; use env vars.
- Avoid logging sensitive data. When necessary, scrub before sharing.
- Payment backends may be proprietary; keep all payment logic behind public interfaces so proprietary modules can plug in without repo changes.

Acceptance & Review Checklist
- Plans updated (master + milestone).
- Code compiles and passes local checks.
- APIs/tool schemas stable and suitable for `ctxcn`.
- Tests added or updated where applicable.
- Payment flows (if touched) conform to 402.markets or CVM token rules.
- Final handoff includes file references and next steps.
