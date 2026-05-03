/**
 * CardInsights / RelayFeeItem adversarial-input smoke — TEST-05.
 *
 * Function-level + structural tests that lock the Phase 27 migration
 * contract for the two highest-risk callers of CountCard:
 *   - CardInsights (CARD-02): software / version / geocode / isp reach
 *     bottomText via slot-bound interpolation, never via `{@html}`.
 *   - RelayFeeItem (CARD-03): fee.amount is coerced via Number(...) before
 *     it can reach a render context, neutralizing non-numeric NIP-11 input.
 *
 * Mirrors the function-level coercion-contract assertions already in
 * CountCard.test.ts but co-locates them in `lib/utils/` for canary
 * discoverability — a future contributor running just the helpers test
 * suite (`vitest run src/lib/utils/`) sees these regression locks.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { escapeHtml } from './sanitize';

// apps/gui/src — resolved relative to this file (apps/gui/src/lib/utils/...)
const APPS_GUI_SRC = resolve(__dirname, '../..');
const RELAY_FEE_ITEM_PATH = resolve(
    APPS_GUI_SRC,
    'routes/relays/[protocol]/[...relay]/(components)/partials/RelayFeeItem.svelte'
);
const CARD_INSIGHTS_PATH = resolve(
    APPS_GUI_SRC,
    'routes/relays/[protocol]/[...relay]/(components)/cards/CardInsights.svelte'
);

/**
 * Strip HTML comment blocks so structural assertions only inspect LIVE code.
 * Mirrors Phase 26/27.
 */
function stripHtmlComments(source: string): string {
    return source.replace(/<!--[\s\S]*?-->/g, '');
}

describe('RelayFeeItem CARD-03 — Number coercion contract', () => {
    it('Number("<img src=x onerror=alert(1)>") is NaN', () => {
        expect(Number.isNaN(Number('<img src=x onerror=alert(1)>'))).toBe(true);
    });

    it('Number(undefined) is NaN', () => {
        expect(Number.isNaN(Number(undefined))).toBe(true);
    });

    it('Number(1500) is 1500', () => {
        expect(Number(1500)).toBe(1500);
    });

    it('source contains Number(amount) or Number(fee.amount)', () => {
        const live = stripHtmlComments(readFileSync(RELAY_FEE_ITEM_PATH, 'utf8'));
        expect(live).toMatch(/Number\s*\(\s*(amount|fee\.amount)\s*\)/);
    });
});

describe('CardInsights CARD-02 — slot-bound bottomText contract', () => {
    it('escapeHtml on adversarial software field produces no live tag', () => {
        // Mirror the Phase 27 Rule 1 deviation pattern: assert /<\s*\w/ does NOT
        // match — escapeHtml only neutralizes tag delimiters, but once the
        // surrounding `<...>` is gone, any `onerror=` substring is inert text.
        const out = escapeHtml('<img src=x onerror=alert(1)>');
        expect(out).not.toMatch(/<\s*\w/);
        expect(out).toContain('&lt;');
        expect(out).toContain('&gt;');
    });

    it('source contains <svelte:fragment slot="bottomText"> at least 4 times', () => {
        // CardInsights has 4 CountCard call sites: software, version, geocode, isp.
        const live = stripHtmlComments(readFileSync(CARD_INSIGHTS_PATH, 'utf8'));
        const fragMatches = live.match(/<svelte:fragment\s+slot=["']bottomText["']/g) ?? [];
        expect(fragMatches.length).toBeGreaterThanOrEqual(4);
    });

    it('source contains zero bottomText template-literal HTML strings', () => {
        const live = stripHtmlComments(readFileSync(CARD_INSIGHTS_PATH, 'utf8'));
        // bottomText={`...<tag...`} — template literal containing an HTML tag.
        expect(live).not.toMatch(/bottomText=\{`[^`]*<[a-z]/i);
    });
});
