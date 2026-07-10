import createDOMPurify, {
    type Config,
    type DOMPurify as DOMPurifyInstance,
} from 'dompurify';

/**
 * Encode-on-output mitigation for relay-controlled NIP-11 / kind-0 / kind-1 fields.
 *
 * # Trust boundary
 *
 * Data crosses the trust boundary into the GUI render whenever a NIP-11 field,
 * kind:0 metadata field, kind:1 note content, or any other relay-controlled
 * string reaches a Svelte template. Encode at the sink, not at the data layer.
 *
 * The DataTable layer renders cell contents via `{@html ...}` (see
 * apps/gui/src/lib/components/data-view/table/DataTable.svelte). Many of the
 * formatters in `apps/gui/src/lib/config/dataTable/*.ts` build HTML strings
 * that interpolate fields a relay operator controls (icon, banner, name,
 * description, photo, pubkey, paymentsUrl). Without escaping, a malicious
 * relay can break out of an attribute or CSS context and execute arbitrary JS.
 *
 * # Helper-per-sink table
 *
 * | Sink                                        | Helper                              |
 * |---------------------------------------------|-------------------------------------|
 * | Element text                                | Svelte `{}` text-bind (no helper)   |
 * | HTML attribute (alt, title, class, id, ...) | `escapeHtml`                        |
 * | `<a href>` / `<Button href>`                | `safeHttpUrl`                       |
 * | `<img src>`                                 | `safeImageUrl`                      |
 * | CSS `url('…')`                              | `safeImageUrl` (dual-context)       |
 *
 * `safeImageUrl` is intentionally dual-context: it rejects single quotes
 * (and the rest of `["'<>\n\r\\]`) so the same helper is safe in both
 * `<img src="…">` and CSS `url('…')` interpolations.
 *
 * # Test-then-fix discipline (#899 / #900 pattern)
 *
 * Every change to this module follows the #899 / #900 test-then-fix pattern:
 * the failing-test commit lands BEFORE the implementation commit. Tests
 * assert the safe output (no `<script>`, no `onerror=`, no unescaped
 * breakout chars, no scheme outside the allowlist) — never the unsafe shape.
 * The canonical attack payload `http://x" onerror="alert(1)" x="` is
 * exercised against every URL helper and must resolve to `''`.
 *
 * # v2.5 milestone summary
 *
 * The v2.5 GUI XSS Hardening milestone closed every known live XSS vector
 * in `apps/gui`. Fixes shipped across Phases 24-28; Phase 29 is the wrap.
 *
 * | Phase | Requirement(s)            | Fix                                                                                                          |
 * |-------|---------------------------|--------------------------------------------------------------------------------------------------------------|
 * | 24    | URL-01                    | `safeHttpUrl` exported; module-private `isUrlBreakout` factored                                              |
 * | 25    | CSS-01, CSS-02            | `bannerStyleString` helper migrated 4 banner sinks; structural test locks regression                         |
 * | 26    | URL-02, URL-03            | `paymentsUrl` wrapped via `safeHttpUrl` in `CardFees.svelte`; HREF audit pass                                 |
 * | 27    | CARD-01, CARD-02, CARD-03 | `CountCard.svelte` text-bind by default; CardInsights / RelayFeeItem migrated                                |
 * | 28    | FEED-01..05               | `parseNote` always-on DOMPurify; `parseImages`/`parseVideos` URL-validated; `replaceNip19` escapes `user.name` |
 * | 29    | TEST-04..06, AUDIT-01/02  | Adversarial-input regression sweep + cross-cutting `{@html}` walker + this dev note                          |
 *
 * Test canaries that lock these fixes against regression:
 *   - `apps/gui/src/lib/utils/sanitize.test.ts`                                — 52 helper-level cases
 *   - `apps/gui/src/lib/utils/banner-style-structural.test.ts`                 — banner-sink walker
 *   - `apps/gui/src/lib/utils/style-helpers.test.ts`                           — bannerStyleString unit tests
 *   - `apps/gui/src/routes/relays/.../CardFees.test.ts`                        — paymentsUrl regression
 *   - `apps/gui/src/routes/(components)/CountCard.test.ts`                     — CountCard structural
 *   - `apps/gui/src/lib/utils/notes.test.ts`                                   — parseNote / parseImages / replaceNip19
 *   - `apps/gui/src/lib/utils/v2.5-xss-smoke.test.ts`                          — milestone canary (one assertion per attack vector)
 *   - `apps/gui/src/lib/utils/html-sink-audit.test.ts`                         — cross-cutting `{@html}` walker
 *   - `apps/gui/src/lib/utils/cardinsights-relayfeeitem-adversarial.test.ts`   — function-level CARD-02/03 smoke
 *
 * # Deferred AUDIT-01 (formatter migration)
 *
 * AUDIT-01 — replace the HTML-string formatters in
 * `apps/gui/src/lib/config/dataTable/*.ts` with Svelte components and drop
 * `{@html}` from `DataTable.svelte` and `PageHeader.svelte` — is FORMALLY
 * DEFERRED to v2.6+. v2.5 closed every live vector via encode-on-output
 * discipline; the dataTable formatters are encode-on-output safe today
 * (verified by #899/#900 tests + the html-sink-audit canary). Migration to
 * Svelte components is a larger refactor (5+ formatter files, hundreds of
 * HTML-string emissions per file, plus DataTable / PageHeader internals);
 * the right time is when there's a separate UI/styling milestone that
 * touches DataTable anyway.
 *
 * The deferral is recorded in `.planning/PROJECT.md` Key Decisions:
 *   "Defer AUDIT-01 (formatter migration to Svelte components) to v2.6+"
 *
 * When AUDIT-01 lands, this entire `sanitize.ts` module can be deleted.
 * Until then, the cross-cutting `{@html}` walker (html-sink-audit.test.ts)
 * is the canary that catches new sinks added without going through one
 * of these helpers.
 *
 * # Module exports
 *
 *   - `escapeHtml`     — entity-encodes a string for safe interpolation into
 *                        either element-text or double-quoted-attribute
 *                        contexts.
 *   - `safeImageUrl`   — allowlists `http(s)://` and `data:image/...` URLs
 *                        and rejects any URL containing attribute/CSS
 *                        breakout characters. Safe in both `<img src="…">`
 *                        and CSS `url('…')` contexts.
 *   - `safeHttpUrl`    — allowlists `http://` and `https://` ONLY (no
 *                        `data:`, no protocol-relative `//`, no
 *                        `mailto:` / `tel:` / etc.) and rejects the same
 *                        breakout char set as `safeImageUrl`. Use at
 *                        `<a href>` / `<Button href>` sinks.
 *
 * Use these helpers at every {@html} sink that interpolates relay-controlled
 * data. The intent is encode-on-output at the formatter, not at the data layer.
 *
 * FOLLOW-UP: see "# Deferred AUDIT-01 (formatter migration)" above and
 * the corresponding row in `.planning/PROJECT.md` Key Decisions. Once
 * AUDIT-01 lands in v2.6+, this entire module can be deleted.
 */

// Module-private: single source of truth for the URL/CSS attribute breakout
// character set. Both safeHttpUrl and safeImageUrl consume this so the reject
// set never drifts between helpers.
function isUrlBreakout(s: string): boolean {
    return /["'<>\n\r\\]/.test(s);
}

/**
 * Escape a string for safe interpolation into HTML element-text or
 * double-quoted attribute contexts.
 *
 * Returns '' for null, undefined, or non-string input — never throws.
 */
export function escapeHtml(input: unknown): string {
    if (typeof input !== 'string') return '';
    return input
        .replace(/&/g, '&amp;') // MUST be first to avoid double-encoding
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Validate and entity-encode an image URL for safe interpolation into either
 * an HTML `src=""` attribute or a CSS `url('...')` value.
 *
 * Allowlist:
 *   - `http://...`
 *   - `https://...`
 *   - `data:image/...`
 *
 * Reject any URL containing characters that would break out of an attribute
 * or CSS context (`"`, `'`, `<`, `>`, `\n`, `\r`, `\\`) — see `isUrlBreakout`.
 * Reject `javascript:`, `vbscript:`, `file:`, `data:text/html`, etc.
 *
 * On accept: returns the URL passed through `escapeHtml(...)` so query-string
 * `&` becomes `&amp;` (safe in both attribute and CSS `url('...')` contexts;
 * modern browsers accept `&amp;` in those positions).
 *
 * On reject: returns ''. Caller decides fallback. Never throws, never logs.
 *
 * Safe in both `<img src="…">` and CSS `url('…')` contexts (single quotes
 * are in the breakout reject set — see helper-per-sink table in module JSDoc).
 */
export function safeImageUrl(input: unknown): string {
    if (typeof input !== 'string' || input.length === 0) return '';
    // Reject any breakout characters before any other check.
    if (isUrlBreakout(input)) return '';
    // Allowlist: http://, https://, or data:image/...
    const isHttp = /^https?:\/\//i.test(input);
    const isDataImage = /^data:image\//i.test(input);
    if (!isHttp && !isDataImage) return '';
    // Encode entities (notably & in query strings) so the value is safe in
    // both `src=""` attribute context and CSS `url('...')` context.
    return escapeHtml(input);
}

/**
 * Validate and entity-encode an `http(s)` URL for safe interpolation into an
 * HTML `href=""` attribute (typical sinks: `<a href>`, `<Button href>`).
 *
 * Allowlist:
 *   - `http://...`
 *   - `https://...`
 *
 * Rejects every other scheme — `javascript:`, `data:` (any subtype, including
 * `data:image/`), `vbscript:`, `file:`, `mailto:`, `tel:`, protocol-relative
 * `//...`, and bare strings without a scheme. `data:image/` is `safeImageUrl`'s
 * job, not this helper's; this is `<a href>`-shaped.
 *
 * Reject any URL containing characters that would break out of an attribute
 * context (`"`, `'`, `<`, `>`, `\n`, `\r`, `\\`) — same set as `safeImageUrl`,
 * via the shared module-private `isUrlBreakout` helper.
 *
 * On accept: returns the URL passed through `escapeHtml(...)` so query-string
 * `&` becomes `&amp;`, matching `safeImageUrl`'s shape for consistency.
 *
 * On reject: returns ''. Caller decides fallback (typical pattern:
 * `safeHttpUrl(x) || ''` or `safeHttpUrl(x) || fallback`). Never throws,
 * never logs.
 */
export function safeHttpUrl(input: unknown): string {
    if (typeof input !== 'string' || input.length === 0) return '';
    // Reject any breakout characters before any other check.
    if (isUrlBreakout(input)) return '';
    // Allowlist: http:// or https:// ONLY. No data:, no protocol-relative //,
    // no mailto:, no tel:, no file:, no javascript:, no vbscript:.
    if (!/^https?:\/\//i.test(input)) return '';
    // Encode entities (notably & in query strings) so the value is safe in
    // a double-quoted href="" attribute context.
    return escapeHtml(input);
}

let browserPurifier: DOMPurifyInstance | undefined;

function getDomPurify(): DOMPurifyInstance | undefined {
    const maybePurifier = createDOMPurify as DOMPurifyInstance;
    if (typeof maybePurifier.sanitize === 'function') return maybePurifier;
    if (typeof window === 'undefined') return undefined;
    if (!browserPurifier) browserPurifier = createDOMPurify(window);
    return browserPurifier;
}

/**
 * Sanitize HTML for the remaining `{@html}` sinks that intentionally render
 * formatted relay-controlled content. In SSR/no-window contexts DOMPurify
 * cannot build a DOM-backed sanitizer, so fail closed by entity-escaping.
 */
export function sanitizeHtml(input: unknown, config?: Config): string {
    if (typeof input !== 'string') return '';
    const purifier = getDomPurify();
    if (!purifier || typeof purifier.sanitize !== 'function') return escapeHtml(input);
    return purifier.sanitize(input, config);
}
