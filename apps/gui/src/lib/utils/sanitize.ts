/**
 * Encode-on-output mitigation for relay-controlled NIP-11 / kind-0 fields.
 *
 * The DataTable layer renders cell contents via `{@html ...}` (see
 * apps/gui/src/lib/components/data-view/table/DataTable.svelte). Many of the
 * formatters in `apps/gui/src/lib/config/dataTable/*.ts` build HTML strings
 * that interpolate fields a relay operator controls (icon, banner, name,
 * description, photo, pubkey). Without escaping, a malicious relay can break
 * out of an attribute or CSS context and execute arbitrary JS.
 *
 * This module exports two pure helpers:
 *   - `escapeHtml`     — entity-encodes a string for safe interpolation into
 *                        either element-text or double-quoted-attribute
 *                        contexts.
 *   - `safeImageUrl`   — allowlists `http(s)://` and `data:image/...` URLs and
 *                        rejects any URL containing attribute/CSS breakout
 *                        characters (`"`, `'`, `<`, `>`, `\n`, `\r`, `\\`).
 *
 * Use these helpers at every {@html} sink that interpolates relay-controlled
 * data. The intent is encode-on-output at the formatter, not at the data layer.
 *
 * FOLLOW-UP (out of scope here): replace the HTML-string formatters in
 * `apps/gui/src/lib/config/dataTable/*.ts` with Svelte components and remove
 * `{@html ...}` from `DataTable.svelte` and `PageHeader.svelte`. Once that
 * lands, this module can be deleted.
 */

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
 * or CSS context (`"`, `'`, `<`, `>`, `\n`, `\r`, `\\`). Reject
 * `javascript:`, `vbscript:`, `file:`, `data:text/html`, etc.
 *
 * On accept: returns the URL passed through `escapeHtml(...)` so query-string
 * `&` becomes `&amp;` (safe in both attribute and CSS `url('...')` contexts;
 * modern browsers accept `&amp;` in those positions).
 *
 * On reject: returns ''. Caller decides fallback. Never throws, never logs.
 */
export function safeImageUrl(input: unknown): string {
    if (typeof input !== 'string' || input.length === 0) return '';
    // Reject any breakout characters before any other check.
    if (/["'<>\n\r\\]/.test(input)) return '';
    // Allowlist: http://, https://, or data:image/...
    const isHttp = /^https?:\/\//i.test(input);
    const isDataImage = /^data:image\//i.test(input);
    if (!isHttp && !isDataImage) return '';
    // Encode entities (notably & in query strings) so the value is safe in
    // both `src=""` attribute context and CSS `url('...')` context.
    return escapeHtml(input);
}
