# Roadmap: nostr-watch

## Milestones

- ✅ **v2.0 Wider NIP Support** - Phases 1-5 (shipped 2026-03-12)
- ✅ **v2.2 Fix Monitors Page** - Phases 14-16 (shipped 2026-03-24)
- ✅ **v2.3 Relay Dedup Family Scope** - Phases 17-20 (shipped 2026-04-11)
- ✅ **v2.4 NATO Phonetic Spam Purge** - Phases 21-23 (shipped 2026-04-12)
- 🚧 **v2.5 GUI XSS Hardening** - Phases 24-29 (started 2026-05-03)

## Phases

<details>
<summary>✅ v2.0 Wider NIP Support (Phases 1-5) - SHIPPED 2026-03-12</summary>

5 phases, 11 plans completed. See MILESTONES.md for details.

</details>

<details>
<summary>v2.1 Test Profiles - SHELVED at Phase 10</summary>

Phases 10-13 planned but shelved. Phase 10 (taxonomy types) shipped. Phases 11-13 not started.

</details>

<details>
<summary>✅ v2.2 Fix Monitors Page (Phases 14-16) - SHIPPED 2026-03-24</summary>

3 phases, 6 plans completed. See MILESTONES.md and milestones/v2.2-ROADMAP.md for details.

- [x] Phase 14: Revert Broken Bugfix (1/1 plans) — completed 2026-03-19
- [x] Phase 15: Aggregation and Loading (2/2 plans) — completed 2026-03-23
- [x] Phase 16: Data Integrity (3/3 plans) — completed 2026-03-24

</details>

<details>
<summary>✅ v2.3 Relay Dedup Family Scope (Phases 17-20) - SHIPPED 2026-04-11</summary>

4 phases, 12 plans completed. See MILESTONES.md and milestones/v2.3-ROADMAP.md for details.

- [x] Phase 17: Diagnose Dedup Family Scope Failure (3/3 plans) — completed 2026-04-10
- [x] Phase 18: Fix Dedup Family Scope (3/3 plans) — completed 2026-04-10
- [x] Phase 19: Remediate Affected Rows (2/2 plans) — completed 2026-04-10
- [x] Phase 20: Dedup Performance & Overrides (4/4 plans) — completed 2026-04-11

</details>

<details>
<summary>✅ v2.4 NATO Phonetic Spam Purge (Phases 21-23) - SHIPPED 2026-04-12</summary>

3 phases shipped. See MILESTONES.md and milestones/v2.4-ROADMAP.md for details.

- [x] Phase 21: Disable Dedup Migration & Loop — completed 2026-04-12
- [x] Phase 22: NATO URL Purge & NIP-09 Broadcast — completed 2026-04-12
- [x] Phase 23: Trawler Block & Reintroduction Guard — completed 2026-04-12

</details>

### 🚧 v2.5 GUI XSS Hardening (In Progress)

**Milestone Goal:** Close every remaining XSS vector in `apps/gui` so a malicious relay, kind:0 publisher, or Nostr event author cannot execute JavaScript, inject HTML, or break out of CSS context in a visitor's browser.

- [x] **Phase 24: Sanitize Helper Surface** - Extend `apps/gui/src/lib/utils/sanitize.ts` with `safeHttpUrl` and tighten the URL/CSS-context contract so every later phase has one place to call. (completed 2026-05-03)
- [x] **Phase 25: CSS Banner Sinks** - Apply `safeImageUrl` to the three remaining `style="background: url('${banner}')"` sinks and lock the single-quote breakout closed with regression tests. (completed 2026-05-03)
- [x] **Phase 26: href Allowlist Sweep** - Validate NIP-11 `paymentsUrl` and every other relay/kind:0-controlled `<a href>` / `<Button href>` through `safeHttpUrl`. (completed 2026-05-03)
- [x] **Phase 27: CountCard Structural Fix** - Text-bind `CountCard.svelte` by default and migrate `CardInsights` / `RelayFeeItem` to the safe rendering path. (completed 2026-05-03)
- [x] **Phase 28: notes.ts Hardening** - Force DOMPurify on every feed/wiki render, validate `parseImages` / `parseVideos` URLs, HTML-escape kind:0 names, eliminate the `sanitize: false` opt-out. (completed 2026-05-03)
- [x] **Phase 29: Adversarial Regression Sweep & Sanitization-Contract Doc** - Land the cross-cutting adversarial regression suite, the `CountCard` structural test, the AUDIT-01 follow-up decision, and the developer-facing sanitization-contract note. (completed 2026-05-03)

## Phase Details

### Phase 24: Sanitize Helper Surface
**Goal**: Extend `apps/gui/src/lib/utils/sanitize.ts` so that every later phase has one centralized, test-locked helper to call when a URL crosses the trust boundary into an `href`, an attribute, or a CSS `url('…')` context. Foundation phase; smallest blast radius lands first.
**Depends on**: Nothing (first phase of milestone)
**Requirements**: URL-01
**Success Criteria** (what must be TRUE):
  1. A `safeHttpUrl(input)` function exported from `apps/gui/src/lib/utils/sanitize.ts` returns a safe `http://` or `https://` string and returns an empty string (or documented sentinel) for any input whose scheme parses as `javascript:`, `data:`, `vbscript:`, `file:`, or anything outside the http/https allowlist
  2. `safeHttpUrl` strips or rejects attribute-breakout characters (`"`, `'`, `<`, `>`, backtick, raw whitespace, control chars) such that the canonical attack payload `http://x" onerror="alert(1)" x="` resolves to a value that cannot break out of a double-quoted HTML attribute
  3. The CSS-context behavior of the URL helpers (`safeImageUrl` and/or a dedicated `safeCssUrl`) explicitly rejects single quotes and any other characters that escape from `url('…')`, with a unit test that fails on input shaped like `x'); position:fixed; top:0; …; url('y`
  4. The helper module's JSDoc documents which helper to reach for at each sink type (text, attribute, URL `href`, CSS `url('…')`) and preserves the existing follow-up note about deleting the module once `{@html}` is gone
  5. A failing-tests-first commit lands before the implementation commit, mirroring the #899 / #900 test-then-fix discipline; tests assert no `<script>`, no `onerror=`, no unescaped breakout characters, and no scheme outside the allowlist
**Plans**: 1 plan
- [x] 24-01-sanitize-helper-surface-PLAN.md — Add safeHttpUrl, factor isUrlBreakout, document sanitization contract, land CSS-context single-quote regression test (test-then-fix discipline; AUDIT-02 partial)

### Phase 25: CSS Banner Sinks
**Goal**: Close the CSS-context breakout in the three banner-URL sinks that did not get the `PageHeader.svelte` fix, and prove via regression test that single-quote payloads can no longer break out of `style="background: url('${banner}')"`. Mechanical second phase that exercises the Phase 24 helper end-to-end.
**Depends on**: Phase 24
**Requirements**: CSS-01, CSS-02
**Success Criteria** (what must be TRUE):
  1. `apps/gui/src/lib/components/data-view/table/DataTable.svelte`, `apps/gui/src/lib/components/lists/table/DataTable.svelte`, and `apps/gui/src/routes/relays/[protocol]/[...relay]/(components)/cards/CardOperator.svelte` all pass `banner` through the Phase 24 URL-validation helper before interpolating into `style="background: url('${…}')"`
  2. A relay returning a banner of `x'); position:fixed; top:0; left:0; width:100vw; height:100vh; background:url('y` renders as either an empty background or an inert escaped string — the surrounding `style` attribute remains exactly one well-formed `background: url('…')` declaration with no injected properties
  3. Every CSS-context regression test for the three sinks asserts the rendered HTML contains no unescaped `'`, no injected `position:`, `top:`, `left:`, `width:`, or `height:` declarations, and no second `url('…')` segment
  4. A grep over `apps/gui/src` for `background: url('${` (or equivalent template syntax) finds no remaining unguarded banner interpolations — every match either calls the safe helper or is a static asset path
  5. Failing-tests-first commit lands before the fix commit; tests import the real component, feed it adversarial banner payloads, and assert the rendered DOM is safe
**Plans**: 1 plan
- [x] 25-01-css-banner-sinks-PLAN.md — Extract bannerStyleString helper, migrate 4 banner sinks (data-view DataTable, lists DataTable, CardOperator, PageHeader), CSS-context single-quote regression test (test-then-fix discipline; CSS-01 + CSS-02)
**UI hint**: yes

### Phase 26: href Allowlist Sweep
**Goal**: Validate every relay-, NIP-11-, or kind:0-controlled URL that reaches an `<a href>` or `<Button href>` through `safeHttpUrl`, starting at the known-exploitable `paymentsUrl` sink in `CardFees.svelte` and finishing with an audit pass over the entire `apps/gui/src` tree.
**Depends on**: Phase 24
**Requirements**: URL-02, URL-03
**Success Criteria** (what must be TRUE):
  1. The live path in `CardFees.svelte` (and any active dead-code clone) routes `paymentsUrl = $nip11?.paymentsUrl` through `safeHttpUrl` before binding it to `<Button href>` / `<a href>`; a relay returning `payments_url: "javascript:alert(document.cookie)"` produces no clickable `javascript:` link in the rendered DOM
  2. An audit-pass document or commit message enumerates every `<a href={…}>` and `<Button href={…}>` in `apps/gui/src` whose value originates in relay aggregate data, NIP-11, or kind:0, and shows each one either calling `safeHttpUrl` or proven inert by construction (static literal, route-internal, or already-validated upstream)
  3. A regression test feeds the canonical attack payloads (`javascript:alert(1)`, `data:text/html,<script>alert(1)</script>`, `vbscript:msgbox`, `file:///etc/passwd`, and `http://x" onerror="alert(1)" x="`) into the `CardFees` paymentsUrl path and asserts the rendered `href` is empty or a safe http(s) URL
  4. Failing-tests-first commit lands before the fix commit; tests import the real component, feed it adversarial NIP-11 payloads, and assert the rendered HTML contains no `javascript:`, `data:`, or attribute-breakout `onerror=` strings
**Plans**: 1 plan
- [x] 26-01-href-allowlist-sweep-PLAN.md — Wrap CardFees.svelte paymentsUrl through safeHttpUrl + ship HREF-AUDIT.md (test-then-fix discipline; URL-02 + URL-03)
**UI hint**: yes

### Phase 27: CountCard Structural Fix
**Goal**: Convert `CountCard.svelte` from `{@html}`-by-default to text-bound-by-default for unregistered/freeform input, mirroring the #900 `DataTable` fallback fix, then migrate the three callers that compose markup from relay aggregate data (`CardInsights`, `RelayFeeItem`, plus any caller surfaced during the migration) onto the safe rendering path.
**Depends on**: Phase 24
**Requirements**: CARD-01, CARD-02, CARD-03
**Success Criteria** (what must be TRUE):
  1. `CountCard.svelte` no longer contains `{@html topText}`, `{@html bottomText}`, or `{@html $value}` for unregistered / freeform input — the default branch text-binds, and any caller that genuinely needs markup must opt in via an explicit slot or a sanitized-string prop with a documented contract
  2. `CardInsights.svelte` interpolations of `software` / `version` / `geocode` / `isp` reach `bottomText` either HTML-escaped or via the new safe rendering path; a relay returning `software: "<img src=x onerror=alert(1)>"` produces visible text, not an executing image tag
  3. `RelayFeeItem.svelte` coerces `fee.amount` to a number (`Number(...)` or equivalent numeric-only path) before interpolating; a NIP-11 `fee.amount: "<img src=x onerror=alert(1)>"` either renders as `NaN` / `0` / inert text or is rejected — never reaches `{@html}` as raw markup
  4. A regression test feeds adversarial NIP-11 input (HTML-laden `software`, `version`, `geocode`, `isp`, non-numeric `fee.amount`) through the real `CardInsights` and `RelayFeeItem` components and asserts the rendered DOM contains no `<script>`, no `onerror=`, no executing `<img>`
  5. Failing-tests-first commit lands before each fix commit; the structural change to `CountCard` is committed separately from the caller migration so each step is independently revertible
**Plans**: 1 plan
- [x] 27-01-countcard-structural-fix-PLAN.md — RED + GREEN-A (CountCard slot API + safeHttpUrl link wrap) + GREEN-B (Counts/RelayFeeItem/CardInsights migration; dead CardFees import removal); 3-commit shape per success criterion 5 (CARD-01 + CARD-02 + CARD-03)
**UI hint**: yes

### Phase 28: notes.ts Hardening
**Goal**: Eliminate the three compounding `notes.ts` bugs that put attacker-controlled Nostr event content into `{@html}`: (1) `parseNote` is called with `sanitize: false` at every call site, (2) `parseImages` / `parseVideos` interpolate raw URLs into `<img src>` / `<video src>` with a greedy `\S+` regex, (3) `replaceNip19` interpolates `user.name` raw. Largest-blast-radius phase; closes drive-by XSS via feed and wiki content.
**Depends on**: Phase 24
**Requirements**: FEED-01, FEED-02, FEED-03, FEED-04, FEED-05
**Success Criteria** (what must be TRUE):
  1. Nostr event content rendered through `feeds/FeedNoteContent.svelte`, `feeds/FeedNote.svelte`, `feeds/FeedMasonryNote.svelte`, `modal/Reader.svelte`, and the wiki route at `routes/relays/software/[softwareKey]/+page.svelte` passes through DOMPurify before reaching `{@html}` — proven by a regression test that feeds a kind:1 with `<script>alert(1)</script><img src=x onerror=alert(1)>` and asserts the rendered DOM contains neither
  2. `parseImages` and `parseVideos` validate every matched URL through `safeImageUrl` (or reject it) before interpolating into `<img src>` / `<video src>`; the canonical breakout payload `https://x.png"<script>alert(1)</script><img src="https://y.png` does not produce an executing `<script>` tag in any feed component
  3. `replaceNip19` HTML-escapes `user.name` before interpolating into the rendered `<a>` text; a kind:0 from `wss://purplepag.es` with `name: "<img src=x onerror=alert(1)>"` renders as visible text, not an executing image tag
  4. The `sanitize: false` parser option is either removed from defaults or made structurally impossible to reach the unsafe `{@html}` path — verified by reading the call sites and by a unit test that demonstrates the option no longer disables sanitization at the `{@html}` boundary
  5. Wiki content (kind:30818 from `wss://relay.wikifreedia.xyz`) rendered through `Reader.svelte` traverses the same sanitization path as kind:1 feed content; a regression test asserts attacker-controlled wiki HTML is sanitized
  6. Failing-tests-first commits land before each fix commit; the parser-option fix, the URL-validation fix, and the `replaceNip19` escape fix are committed separately so each is independently revertible
**Plans**: 1 plan
- [x] 28-01-notes-ts-hardening-PLAN.md — Sequential pipeline + always-on DOMPurify + safeImageUrl-validated parseImages/parseVideos + escapeHtml-wrapped replaceNip19 user.name (test-then-fix discipline; FEED-01..05; 2-commit RED+GREEN shape)
**UI hint**: yes

### Phase 29: Adversarial Regression Sweep & Sanitization-Contract Doc
**Goal**: Lock the milestone in. Cross-cut every fixed sink with adversarial input regression tests, ship the structural test that asserts `{@html}` removal in `CountCard`, deliver-or-defer the `sanitize.ts` JSDoc follow-up about replacing HTML-string formatters with Svelte components, and document the sanitization contract so a future contributor knows which helper to reach for at each sink type.
**Depends on**: Phase 25, Phase 26, Phase 27, Phase 28
**Requirements**: TEST-04, TEST-05, TEST-06, AUDIT-01, AUDIT-02
**Success Criteria** (what must be TRUE):
  1. Unit tests cover the canonical attack payload `http://x" onerror="alert(1)" x="` against `safeHttpUrl` and the updated CSS-context behavior of `safeImageUrl` (or `safeCssUrl`); each test asserts no `<script>`, no `onerror=`, and no unescaped breakout characters in the helper output
  2. A regression test exists for every fixed sink — at minimum: `notes.ts` (`parseImages`, `parseVideos`, `replaceNip19`, full `parseNote`), `CardFees.svelte` `paymentsUrl`, `CardInsights.svelte` `bottomText` composition, `RelayFeeItem.svelte` `amount` coercion, and the three CSS banner sinks — each test imports the real component / formatter / parser and feeds it adversarial NIP-11 / kind:0 / kind:1 input
  3. A structural test under `apps/gui/src/.../CountCard*.test.ts` (or equivalent location) reads `CountCard.svelte`'s source and asserts it no longer contains `{@html topText}`, `{@html bottomText}`, or `{@html $value}` for unregistered branches — mirroring the `DataTableFallback.test.ts` pattern from #900
  4. The `sanitize.ts` JSDoc follow-up about replacing HTML-string formatters with Svelte components and dropping `{@html}` from `DataTable.svelte` / `PageHeader.svelte` is either delivered (with the migration shipping in this phase) or formally deferred via a tracked decision recorded in `PROJECT.md` Key Decisions and referenced from the JSDoc
  5. A short developer-facing note (in `apps/gui/src/lib/utils/sanitize.ts` JSDoc and/or `apps/gui/README.md`) documents the sanitization contract: where data crosses the trust boundary into the GUI, which helper to reach for at each sink type (text → Svelte default text-bind, attribute → escapeHtml, URL `href` → `safeHttpUrl`, image `src` → `safeImageUrl`, CSS `url('…')` → `safeImageUrl` / `safeCssUrl`)
**Plans**: 1 plan
- [x] 29-01-adversarial-regression-sweep-PLAN.md — 3 new test files (TEST-05 smoke + TEST-06 walker + v2.5-xss-smoke canary) + sanitize.ts JSDoc expansion (AUDIT-02) + PROJECT.md AUDIT-01 formal defer + 4 caller cleanup; single GREEN commit (TEST-04, TEST-05, TEST-06, AUDIT-01, AUDIT-02)

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 24. Sanitize Helper Surface | 1/1 | Complete    | 2026-05-03 |
| 25. CSS Banner Sinks | 1/1 | Complete    | 2026-05-03 |
| 26. href Allowlist Sweep | 1/1 | Complete    | 2026-05-03 |
| 27. CountCard Structural Fix | 1/1 | Complete    | 2026-05-03 |
| 28. notes.ts Hardening | 1/1 | Complete    | 2026-05-03 |
| 29. Adversarial Regression Sweep & Sanitization-Contract Doc | 1/1 | Complete   | 2026-05-03 |
