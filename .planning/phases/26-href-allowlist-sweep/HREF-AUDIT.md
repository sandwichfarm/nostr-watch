# HREF Allowlist Audit — v2.5 Phase 26

**Audited:** 2026-05-03
**Scope:** every `<a href={…}>` and `<Button href={…}>` in `apps/gui/src` whose value originates in relay aggregate, NIP-11, or kind:0 data.
**Goal:** prove that every dynamic href either passes through `safeHttpUrl` (Phase 24) or is inert by construction.

## Audit Results

| Location | Binding | Value Source | Verdict | Rationale |
|---|---|---|---|---|
| apps/gui/src/routes/relays/[protocol]/[...relay]/(components)/cards/CardFees.svelte:60 | `<Button href={safePaymentsUrl}>` | NIP-11 `payments_url` (relay-controlled) | **WRAPPED** | Phase 26 wraps via `safeHttpUrl` → `$: safePaymentsUrl = safeHttpUrl(paymentsUrl)` |
| apps/gui/src/routes/relays/[protocol]/[...relay]/(components)/cards/CardFees.svelte:132 | `<Button href={paymentUrl}>` | dead-code HTML comment block (lines 84-138) | **DEAD CODE** | Inside `<!-- … -->` — not rendered. Tech-debt cleanup deferred (out of scope for v2.5). |
| apps/gui/src/lib/components/layout/Nav.svelte:44 | `<a href={link.href}>` | `navLinks` prop default (hardcoded literals: `/preferences`, etc.) | **SAFE** | All callers pass static literals — no relay/kind:0 path reaches this binding. |
| apps/gui/src/routes/relays/[protocol]/[...relay]/(components)/RelaySidebar.svelte:29 | `<Button href={item?.href ? item.href : "#"}>` | `generateRelayPathFromUrl(relayUrl)` (route-internal path) | **SAFE** | `relayUrl` is path-validated by SvelteKit routing; `generateRelayPathFromUrl` produces a route-internal `/relays/...` path. No `javascript:` shape reachable. |
| apps/gui/src/routes/(components)/CountCard.svelte:42 | `<a href={link}>` | caller-supplied prop | **SAFE TODAY** | All current callers (`Counts.svelte`: `/relays`, `/monitors`, etc.; `CardInsights` uses `goto`, not `link`) pass hardcoded literals. Phase 27 (CountCard Structural Fix) MAY revisit if it widens the prop contract. |
| apps/gui/src/routes/+error.svelte:14 | `<Button href="/">` | static literal | **SAFE** | Hardcoded `/`. |
| apps/gui/src/routes/relays/[protocol]/[...relay]/(components)/cards/CardNips.svelte:74,87 | `<a href="https://github.com/nostr-protocol/nips/blob/master/{nipLeadingZero(nip)}.md">` | static prefix + numeric segment | **SAFE** | Static `https://github.com/...` prefix; `nipLeadingZero(nip)` returns a numeric string (e.g. `01`, `42`). No relay-controlled segment reaches this binding. |
| apps/gui/src/routes/relays/software/[softwareKey]/+page.svelte:208 | `<a href="/relays/{generateRelayPathFromUrl(check.relay)}">` | route-internal | **SAFE** | Static `/relays/` prefix; `generateRelayPathFromUrl` produces a path-shaped fragment. |
| apps/gui/src/routes/note/[id]/+page.svelte:118 | `<a href="/relays/{generateRelayPathFromUrl(relayUrl)}">` | route-internal | **SAFE** | Same pattern as above. |
| apps/gui/src/routes/monitors/[pubkey]/+page.svelte:564 | `href="/relays/wss/{formatRelayUrl(relay.url)}"` | route-internal | **SAFE** | Static `/relays/wss/` prefix; `formatRelayUrl` strips scheme. |
| apps/gui/src/lib/components/partials/OperatorRelay.svelte:31 | `<a href="/reload/relays/{generateRelayPathFromUrl(event.relay)}">` | route-internal | **SAFE** | Static `/reload/relays/` prefix; same path-derivation pattern. |
| apps/gui/src/lib/components/feeds/FeedNote.svelte:104 / FeedMasonryNote.svelte:88 / modal/Reader.svelte:91 | `<a href="https://njump.me/{note.reference}">` | kind:1 / kind:30818 reference | **DEFERRED** | Phase 28 (notes.ts Hardening) territory — `parseNote`/`replaceNip19` audit covers this surface. |
| apps/gui/src/lib/components/feeds/FeedNote.svelte:115,124,133 / FeedMasonryNote.svelte:99,110,121 | `<a href="">` | static empty placeholder | **SAFE** | Empty `href=""` — no value to validate. UI placeholders for unwired actions. |
| apps/gui/src/lib/components/partials/NoteZap.svelte:56 / PubkeyZap.svelte:54 / data-view/filters/DataViewFilters.svelte:755,806 / lists/table/Filters.svelte:728,779 | `<a href="#">` | static fragment | **SAFE** | Hardcoded `#` — no value to validate. |
| apps/gui/src/routes/monitors/[pubkey]/+page.svelte:249 / lib/components/data-view/map/MapBasic.svelte:53 | `<a href="...">` inside JS string literal (Leaflet attribution) | static | **SAFE** | Hardcoded OpenStreetMap attribution string. Not a Svelte binding. |

## Other Sink Categories (checked, none found)

| Sink | Status |
|---|---|
| `<iframe src={…}>` from relay/kind:0 data | None found in `apps/gui/src`. |
| `<form action={…}>` from relay/kind:0 data | None found. |
| `<link href={…}>` from relay/kind:0 data | None found. |
| `<script src={…}>` from relay/kind:0 data | None found. |

## Verdict

**URL-02 closed:** the live `paymentsUrl` sink in `CardFees.svelte:60` is wrapped via `safeHttpUrl`.
**URL-03 closed:** every dynamic `href` in `apps/gui/src` is either WRAPPED, SAFE (inert by construction), SAFE TODAY (caller contract is hardcoded), or DEFERRED (Phase 28 owns the feed/note rendering surface).

**Follow-ups tracked elsewhere:**
- Phase 27 (CountCard Structural Fix) MAY widen the `link` prop contract — if so, defensively wrap inside CountCard at that time.
- Phase 28 (notes.ts Hardening) owns `replaceNip19` / `parseNote` href emission — audit folds into FEED-01..05.
- Dead-code block at `CardFees.svelte:84-138` is a tech-debt cleanup task; deferred from v2.5.
