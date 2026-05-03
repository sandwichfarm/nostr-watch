/**
 * v2.5 GUI XSS Hardening — milestone canary.
 *
 * One file, one assertion per attack vector across Phases 24-28. If this
 * test file fails, something regressed in v2.5's security posture and
 * a future contributor should hunt down WHICH structural / behavioral
 * fix was undone before doing anything else.
 *
 * Coverage map:
 *   - Phase 24 (URL-01)        — helper-level safeHttpUrl + safeImageUrl
 *   - Phase 25 (CSS-01/02)     — banner-sink files import bannerStyleString
 *   - Phase 26 (URL-02/03)     — CardFees imports safeHttpUrl + no raw paymentsUrl href
 *   - Phase 27 (CARD-01..03)   — CountCard has no {@html} on topText/bottomText/$value
 *   - Phase 28 (FEED-01..05)   — parseNote DOMPurifies <script> + <img onerror>
 */

import { describe, it, expect, vi } from 'vitest';
import { tick } from 'svelte';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { get, writable, type Readable } from 'svelte/store';
import { safeHttpUrl, safeImageUrl } from './sanitize';

// UserService mock — see notes.test.ts:9-41 for full rationale. The .js suffix
// is load-bearing: notes.ts:7 imports `userService` from `$lib/stores/services.js`.
// The stub is harmless here because test case 9 below uses a payload that does
// NOT trigger the npub branch — but mocking keeps the import resolution clean.
vi.mock('$lib/stores/services.js', () => {
    const stubUser = {
        name: 'safe-name',
        ready: () => Promise.resolve(),
    };
    const stubService = {
        userFromPubkey: (_pubkey: string) => stubUser,
    };
    return {
        userService: writable(stubService),
        feedService: writable(null),
    };
});

// notes.ts MUST be imported AFTER the vi.mock call (vitest hoists, but explicit
// ordering documents intent — mirrors notes.test.ts:43-45).
import { parseNote } from './notes';

// apps/gui/src — resolved relative to this file (apps/gui/src/lib/utils/...)
const APPS_GUI_SRC = resolve(__dirname, '../..');
const COUNT_CARD_PATH = resolve(APPS_GUI_SRC, 'routes/(components)/CountCard.svelte');
const CARD_FEES_PATH = resolve(
    APPS_GUI_SRC,
    'routes/relays/[protocol]/[...relay]/(components)/cards/CardFees.svelte'
);
const BANNER_SINK_FILES = [
    'lib/components/data-view/table/DataTable.svelte',
    'lib/components/lists/table/DataTable.svelte',
    'routes/relays/[protocol]/[...relay]/(components)/cards/CardOperator.svelte',
    'lib/components/layout/PageHeader.svelte',
];

/**
 * Strip HTML comment blocks so structural assertions only inspect LIVE code.
 * Mirrors Phase 26/27 helper.
 */
function stripHtmlComments(source: string): string {
    return source.replace(/<!--[\s\S]*?-->/g, '');
}

/**
 * Drain the parseNote pipeline (mirrors notes.test.ts:55-60). The pipeline is
 * async — wait for tick + 50ms macrotask + tick to let DOMPurify, marked, and
 * service.ready() flush.
 */
async function drain<T>(store: Readable<T>): Promise<T> {
    await tick();
    await new Promise((r) => setTimeout(r, 50));
    await tick();
    return get(store);
}

describe('v2.5 XSS milestone canary', () => {
    // -------------------------------------------------------------------------
    // Phase 24 (URL-01) — helper-level URL allowlist
    // -------------------------------------------------------------------------

    it('safeHttpUrl rejects javascript: scheme', () => {
        expect(safeHttpUrl('javascript:alert(1)')).toBe('');
    });

    it('safeHttpUrl rejects the canonical attribute-breakout payload', () => {
        expect(safeHttpUrl('http://x" onerror="alert(1)" x="')).toBe('');
    });

    it('safeImageUrl rejects CSS single-quote breakout', () => {
        expect(
            safeImageUrl(
                `x'); position:fixed; top:0; left:0; width:100vw; height:100vh; background:url('y`
            )
        ).toBe('');
    });

    it('safeImageUrl rejects javascript: scheme', () => {
        expect(safeImageUrl('javascript:alert(1)')).toBe('');
    });

    // -------------------------------------------------------------------------
    // Phase 27 (CARD-01..03) — CountCard structural
    // -------------------------------------------------------------------------

    it('CountCard.svelte has zero {@html topText|bottomText|$value} patterns', () => {
        const live = stripHtmlComments(readFileSync(COUNT_CARD_PATH, 'utf8'));
        expect(live.match(/\{@html\s+topText\b/g)).toBeNull();
        expect(live.match(/\{@html\s+bottomText\b/g)).toBeNull();
        expect(live.match(/\{@html\s+\$value\b/g)).toBeNull();
    });

    // -------------------------------------------------------------------------
    // Phase 26 (URL-02/03) — CardFees imports safeHttpUrl, never binds raw paymentsUrl
    // -------------------------------------------------------------------------

    it('CardFees.svelte imports safeHttpUrl', () => {
        const source = readFileSync(CARD_FEES_PATH, 'utf8');
        expect(source).toMatch(
            /import\s*\{[^}]*\bsafeHttpUrl\b[^}]*\}\s*from\s*['"]\$utils\/sanitize['"]/
        );
    });

    it('CardFees.svelte does not bind raw paymentsUrl to href', () => {
        const live = stripHtmlComments(readFileSync(CARD_FEES_PATH, 'utf8'));
        // Negative anchor: raw `href={paymentsUrl}` (with optional surrounding quotes
        // for Svelte's string-interpolation form `href="{paymentsUrl}"`) must NOT match.
        expect(live).not.toMatch(/href\s*=\s*["']?\{paymentsUrl\}/);
        // Positive anchor: the safe wrapper `safePaymentsUrl` MUST appear in href context.
        // Real binding shape at CardFees.svelte:61 is `href="{safePaymentsUrl}"`.
        expect(live).toMatch(/href\s*=\s*["']?\{safePaymentsUrl\}/);
    });

    // -------------------------------------------------------------------------
    // Phase 25 (CSS-01/02) — banner-sink files reach bannerStyleString
    // -------------------------------------------------------------------------

    BANNER_SINK_FILES.forEach((rel) => {
        it(`${rel} imports bannerStyleString`, () => {
            const source = readFileSync(resolve(APPS_GUI_SRC, rel), 'utf8');
            expect(source).toMatch(/bannerStyleString/);
        });
    });

    // -------------------------------------------------------------------------
    // Phase 28 (FEED-01..05) — parseNote always-on DOMPurify
    // -------------------------------------------------------------------------

    it('parseNote(<script>...) strips <script> + onerror handler', async () => {
        const payload = '<script>alert(1)</script><img src=x onerror=alert(1)>';
        const rendered = await drain(parseNote(payload));
        // Mirror notes.test.ts:101-106 literally — DOMPurify keeps `<img src="x">`
        // (strips the handler, keeps the element). Do NOT assert /<img\b/i missing.
        expect(rendered).not.toMatch(/<script\b/i);
        expect(rendered).not.toMatch(/onerror=/i);
        expect(rendered).not.toContain('alert(1)');
    });
});
