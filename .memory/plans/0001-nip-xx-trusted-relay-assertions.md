# NIP-XX Trusted Relay Assertions — Stack Integration

This document describes how we will implement the draft NIP-XX “Trusted Relay Assertions” throughout the nostr-watch stack (monitors → aggregation service → GUI).

Reference spec: `NIP-XX-TRUSTED-RELAY-ASSERTIONS.md` (Letdown2491/trustedrelays).

## Status (implemented)

- Shared canonical relay URL helper: `internal/utils/src/relay-url.ts` (`canonicalizeRelayUrl`)
- Route66:
  - Trust assertions fetch/subscribe: `libraries/route66/src/services/TrustAssertionService.ts`
  - Models: `libraries/route66/src/models/TrustedRelayAssertion.ts`, `libraries/route66/src/models/TrustedRelayAssertionProviders.ts`
- GUI:
  - Treats assertions as normal Nostr events (cache → StateManager → memory relay)
  - Derivation stores: `apps/gui/src/lib/stores/trust-assertions.ts`
  - Detail UI: `apps/gui/src/routes/relays/[protocol]/[...relay]/(components)/cards/CardTrust.svelte`
  - Local provider allowlist: `apps/gui/src/lib/stores/trust-assertion-providers.ts`
- rstate (consume/overlay):
  - Ingest allowlisted `kind 30385` and expose aggregate in relay state / REST: `apps/rstate/src/services/ingestion.ts`, `apps/rstate/src/core/store/trust-assertion-store.ts`, `apps/rstate/src/core/api.ts`

## Overview

NIP-66 tells us what relays *do* (observed behavior, liveness, RTT, metadata). NIP-XX adds a trust layer: third-party **assertion providers** publish **parameterized replaceable** events that express a scored conclusion about a relay (“what we conclude”).

### Core NIP-XX primitives (what we must support)

- **Kind `30385` — Trusted Relay Assertion**
  - Parameterized replaceable, keyed by `d=<canonical_relay_ws_url>`.
  - Required tags: `d`, `status`, `score` (required when `status=evaluated`).
  - Optional tags: `reliability`, `quality`, `accessibility`, `confidence`, `observations`, `observation_period`, `operator*`, `policy*`, `country_code`, `region`, `network`, etc.
- **Kind `10385` — User’s trusted providers list**
  - `["p", "<provider_pubkey>", "<optional_relay_hint>"]`.
  - Clients use it to decide which providers’ `30385` events to query.
- **Kind `1985` — Reports/appeals (NIP-32 Labels)**
  - `L=relay-report` with `l ∈ {spam,censorship,unreliable,malicious}` and `r=<relayUrl>`.
  - `L=relay-appeal` with `l` and optional `e=<evidence_event_id>`.

### Product goals

- Make relay trust visible and queryable end-to-end:
  - Provider publishes `30385`
  - rstate ingests/serves/optionally publishes
  - GUI fetches/displays/aggregates across providers
- Keep “objective” NIP-66 aggregation distinct from “subjective” NIP-XX evaluation, but allow using NIP-XX for sorting/filtering UX.

### Non-goals (initially)

- Full Web-of-Trust weighting (NIP-85 / operator_trust derivation)
- Paid-provider access flows
- Making GUI a signing client (NIP-07/NIP-46) in v1 (we’ll phase this in)

## Decisions

### 1) Who publishes trusted relay assertions?

**Primary publisher: `apps/rstate`**

- Rationale: NIP-XX providers “SHOULD consume NIP-66”. rstate already aggregates multiple independent NIP-66 monitors, resolves conflicts, and can compute stable, explainable scores.
- rstate becomes the default “nostr.watch” assertion provider (one pubkey, one algorithm).

**Optional (later): `apps/relaymon`**

- Relaymon may publish `30385` as an independent provider when explicitly enabled (feature flag / config).
- This is useful for decentralization and experimentation, but not required for the first complete stack rollout.

### 2) How does rstate incorporate trusted relay assertions?

rstate will support **two roles**:

1) **Provider role (publish):** compute and publish `kind 30385` using aggregated NIP-66 + optional extra signals.
2) **Aggregator role (consume):** ingest `kind 30385` from *other* allowlisted providers and expose:
   - per-provider latest assertion (by `provider_pubkey + d`)
   - aggregated/consensus view (avg/min/max, divergence)

Critically: NIP-XX assertions will be an **overlay**. They do not change base NIP-66 liveness computation; they enrich relay state and enable ranking/filtering.

### 3) How does the GUI aggregate and show trust?

The GUI will:

- Read `30385` events from selected providers and show a trust indicator per relay.
- Aggregate across providers (avg/range) and expose drill-down (“why” + “who said this”).
- Manage provider selection locally first; later optionally follow NIP-XX `10385` when the GUI gains signing.

## HLDD (High-Level Design)

### A) Shared data model & normalization

**Canonical relay URL**

NIP-XX requires `d` to be the relay’s canonical WebSocket URL: lowercase, no trailing slash.

We standardize a single canonicalization function used by:

- rstate ingestion + publishing
- route66/GUI querying + display
- (future) relaymon publishing

Behavior:

- Accept only `ws:`/`wss:`
- Lowercase hostname
- Strip username/password, query, hash
- Drop default ports (80/443)
- Remove trailing slash from path (keep non-root path)

**Parsed assertion object**

Introduce a parsed representation (shared shape across stack), e.g.:

- `providerPubkey`, `relayUrl`, `createdAt`, `status`
- `score`, `reliability`, `quality`, `accessibility` (0–100)
- `confidence`, `observations`, `observationPeriod`
- `algorithm`, `algorithmUrl`
- `operator*`, `policy*`, `jurisdiction*`
- `rawEvent` (optional, for debugging/inspection)

### B) rstate design

#### B1) Ingestion (consume external providers)

- Add a new ingestion path subscribing to `kind 30385`.
- Filter by:
  - `authors` = configured allowlist of provider pubkeys
  - optional `#d` restriction for targeted fetches (for on-demand APIs), otherwise ingest broadly.
- Store latest per `(providerPubkey, d)` (parameterized replaceable semantics).

**Storage**

- In-memory `TrustAssertionStore`:
  - `Map<relayUrl, Map<providerPubkey, ParsedAssertion>>`
  - Track staleness (`fresh<=1h`, `stale<=24h`, `expired>24h`) per spec.

#### B2) Publishing (rstate as a provider)

- Add `TrustScoringService` that consumes rstate’s aggregated relay state and produces `ParsedAssertion` + an unsigned Nostr event.
- Sign and publish `kind 30385` to configured relays.
- Publish policy:
  - publish on material change (status change, score delta ≥ threshold)
  - and/or periodic refresh (e.g. daily) to prevent “disappearance” on sparse networks

**Algorithm versioning**

- Set `algorithm` and `algorithm_url` tags; treat the scoring method as versioned and documented.
- Preserve backward compatibility by allowing multiple algorithms (future), but publish one active version initially.

#### B3) APIs (REST + MCP)

Expose trust alongside relay state:

- **REST**: extend existing relay state payloads to include:
  - `trust.providers`: latest per provider
  - `trust.aggregate`: avg/min/max, providerCount, freshestAt, divergence
  - `trust.staleness`: derived from newest provider assertion
- **MCP tools**: add `relays.getTrust` and/or include `trust` fields in `relays.getState` results.

Add optional query controls:

- `providers=` (explicit list)
- `minScore=`, `status=` (evaluated/unreachable/…)
- `includeRawEvents=` (debug)

### C) relaymon design (optional / later)

If enabled, relaymon can publish `kind 30385` using only its local observation history + NIP-11 fetches it already does/has access to.

Constraints:

- Mark `confidence` lower unless sufficient observations
- Publish less frequently; avoid flooding
- Use a distinct provider pubkey per monitor instance (already required)

### D) route66 + GUI design

#### D1) Fetching assertions

Add a Route66 service (or lightweight GUI-side service) that:

- For a given relay URL (or page of relays), queries `kind 30385` from selected providers:
  - filter: `{ kinds:[30385], authors:[...], "#d":[...canonicalOrVariants] }`
- Stores events in the existing cache layer (SQLite worker) and broadcasts to followers (leader-tab runtime).

Handle Nostr filter size limits by chunking `#d` lists.

#### D2) UI integration

**Relay list pages**

- Add a “Trust” column/badge showing:
  - aggregated score (avg across selected providers)
  - status (“unreachable”, “insufficient data”, etc.)
  - staleness indicator (fresh/stale/expired)

**Relay detail page**

- Add a “Trusted Assertions” card:
  - per-provider rows (score + sub-scores + confidence + last update)
  - algorithm metadata and link
  - jurisdiction/operator/policy fields when present
  - divergence summary (range)

**Preferences**

- Add provider selection UI stored locally (initially).
- Later: if/when GUI gains signing, optionally publish/read `kind 10385`.

### E) Reports & appeals (kind 1985) — later phases

- GUI: allow submitting `relay-report` (and viewing aggregate counts).
- rstate provider role: ingest `relay-report` / `relay-appeal`, compute weighted influence (eventually WoT-aware), and incorporate into trust scoring as an input signal.

## Phased implementation plan

### Phase 1 — Foundations (shared parsing + normalization)

Deliverables:

- Add a canonical relay URL helper for NIP-XX `d` tags (shared, reusable by Node + browser code).
- Define a strict parser/validator for `kind 30385` events (required tags, type coercion, enums).
- Define a “provider config” shape: `{ pubkey, relayHints?: string[] }[]`.

Exit criteria:

- We can take a raw Nostr event, parse/validate it into a typed assertion object, and reliably derive the canonical `d` value used for queries/publishing.

### Phase 2 — rstate consume + serve (read-only trust overlay)

Deliverables:

- Add config/env for provider allowlist + (optional) dedicated ingestion relays for `30385`.
- Implement `TrustAssertionStore`:
  - latest per `(providerPubkey, relayUrl)`
  - staleness classification (fresh/stale/expired) per spec guidance
- Extend REST + MCP outputs to include `trust` data:
  - `providers` map (per-provider latest)
  - `aggregate` (avg/min/max + divergence)

Exit criteria:

- Given a relay URL, rstate can return trust assertions from configured providers, plus a deterministic aggregated view.

### Phase 3 — GUI read + display (Nostr-first)

Deliverables:

- Add a GUI-side fetch path for `kind 30385`:
  - per-relay (detail page)
  - per-page (relay list pages, chunked filters)
- Add UI rendering:
  - relay list trust badge/column
  - relay detail “Trusted Assertions” card (per provider + aggregate)
- Add local provider selection UI (no signing required).

Exit criteria:

- Users can see trust scores and drill into provider-specific details for any relay page without relying on rstate.

### Phase 4 — rstate publish (nostr.watch provider)

Deliverables:

- Implement `TrustScoringService v0.1` driven by rstate aggregated data:
  - compute `status` + `score` (+ optional sub-scores) with documented weights
  - compute `confidence`/`observations`/`observation_period`/`first_seen`
- Add publisher scheduler:
  - material change thresholds
  - backoff on publish errors
- Publish `kind 30385` to configured relays using a dedicated provider key.

Exit criteria:

- rstate produces stable, correctly-formed `30385` events and they are visible to external clients/GUI via Nostr.

### Phase 5 — User provider lists + reports (full NIP-XX posture)

Deliverables:

- Add GUI signing path (NIP-07 and/or NIP-46):
  - publish/read `kind 10385` provider lists
  - publish `kind 1985` `relay-report` / `relay-appeal`
- Add rstate ingestion of `kind 1985` and expose report aggregates per relay.
- Incorporate reports (with conservative weighting) into provider scoring inputs.

Exit criteria:

- Users can manage provider trust lists and submit reports; rstate can incorporate and surface those signals.

### Phase 6 — Ranking/search + hardening

Deliverables:

- rstate: add query filters/sorting by trust (min score, status, provider selection).
- GUI: sorting/filtering UI for trust dimensions.
- Observability: track provider divergence, freshness coverage, and publish/ingest health.

Exit criteria:

- Trust becomes a first-class dimension across search, ranking, and relay exploration, with measurable freshness and provider agreement.
