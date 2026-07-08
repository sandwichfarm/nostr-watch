import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { escapeHtml } from '$utils/sanitize';

// Resolved relative to this file:
// apps/gui/src/routes/(components)/CountCard.test.ts
const COUNT_CARD_PATH = resolve(__dirname, 'CountCard.svelte');
const COUNTS_PATH = resolve(__dirname, 'Counts.svelte');
const RELAY_FEE_ITEM_PATH = resolve(
    __dirname,
    '../relays/[protocol]/[...relay]/(components)/partials/RelayFeeItem.svelte'
);
const CARD_INSIGHTS_PATH = resolve(
    __dirname,
    '../relays/[protocol]/[...relay]/(components)/cards/CardInsights.svelte'
);

/**
 * Strip HTML comment blocks so structural assertions only inspect LIVE code.
 * Mirrors Phase 26's CardFees.test.ts helper. CountCard / callers have no
 * known dead-code blocks, but the helper keeps assertions resilient to any
 * future commented-out reference shape.
 */
function stripHtmlComments(source: string): string {
    return source.replace(/<!--[\s\S]*?-->/g, '');
}

describe('CountCard structural', () => {
    it('imports safeHttpUrl from $utils/sanitize', () => {
        const source = readFileSync(COUNT_CARD_PATH, 'utf8');
        expect(source).toMatch(
            /import\s*\{[^}]*\bsafeHttpUrl\b[^}]*\}\s*from\s*['"]\$utils\/sanitize['"]/
        );
    });

    it('declares $: safeLink = safeHttpUrl(link)', () => {
        const source = readFileSync(COUNT_CARD_PATH, 'utf8');
        expect(source).toMatch(/\$:\s*safeLink\s*=\s*safeHttpUrl\s*\(\s*link\s*\)/);
    });

    it('binds <a href> to safeLink, never raw link', () => {
        const live = stripHtmlComments(readFileSync(COUNT_CARD_PATH, 'utf8'));
        expect(live).toMatch(/href\s*=\s*\{\s*safeLink\s*\}/);
        // \b after `link` so we don't accidentally match `safeLink`.
        expect(live).not.toMatch(/href\s*=\s*\{\s*link\b/);
    });

    it('contains zero {@html topText} occurrences', () => {
        const live = stripHtmlComments(readFileSync(COUNT_CARD_PATH, 'utf8'));
        expect(live.match(/\{@html\s+topText\b/g)).toBeNull();
    });

    it('contains zero {@html bottomText} occurrences', () => {
        const live = stripHtmlComments(readFileSync(COUNT_CARD_PATH, 'utf8'));
        expect(live.match(/\{@html\s+bottomText\b/g)).toBeNull();
    });

    it('contains zero {@html $value} occurrences', () => {
        const live = stripHtmlComments(readFileSync(COUNT_CARD_PATH, 'utf8'));
        expect(live.match(/\{@html\s+\$value\b/g)).toBeNull();
    });

    it('declares slot for topText', () => {
        const source = readFileSync(COUNT_CARD_PATH, 'utf8');
        expect(source).toMatch(/<slot\s+name=["']topText["']/);
    });

    it('declares slot for bottomText', () => {
        const source = readFileSync(COUNT_CARD_PATH, 'utf8');
        expect(source).toMatch(/<slot\s+name=["']bottomText["']/);
    });

    it('declares a default (unnamed) slot whose fallback references $value', () => {
        const source = readFileSync(COUNT_CARD_PATH, 'utf8');
        // Default slot — `<slot>` with no `name=`, fallback contains `$value`.
        expect(source).toMatch(/<slot(?![^>]*\sname=)[^>]*>[^<]*\$value/);
    });
});

describe('CountCard caller migration — Counts.svelte', () => {
    it('passes plain-text props (no readable() with HTML markup)', () => {
        const live = stripHtmlComments(readFileSync(COUNTS_PATH, 'utf8'));
        expect(live).not.toMatch(/value=\{readable\([^)]*<[a-z]/i);
    });
});

describe('CountCard caller migration — RelayFeeItem.svelte', () => {
    it('coerces fee.amount via Number(...) before interpolation (CARD-03)', () => {
        const live = stripHtmlComments(readFileSync(RELAY_FEE_ITEM_PATH, 'utf8'));
        expect(live).toMatch(/Number\s*\(\s*(amount|fee\.amount)\s*\)/);
    });

    it('does not pass HTML-string-as-value (no readable(`...<span...`))', () => {
        const live = stripHtmlComments(readFileSync(RELAY_FEE_ITEM_PATH, 'utf8'));
        expect(live).not.toMatch(/value=\{readable\([^)]*<[a-z]/i);
    });

    it('uses CountCard with default-slot content (closing </CountCard> tag present)', () => {
        const live = stripHtmlComments(readFileSync(RELAY_FEE_ITEM_PATH, 'utf8'));
        expect(live).toMatch(/<\/CountCard>/);
    });

    it('retains a value= prop or valueSentinel reactive (locks CountCard gate-satisfying contract)', () => {
        // Phase 27 locked decision: RelayFeeItem must keep CountCard's value-display
        // gate satisfied. The default slot does the visible CARD-03 coercion, but
        // CountCard's `{#if $value !== null && $value !== undefined ...}` gate
        // requires a defined `value` prop. Lock in either `value=` (any form) or
        // a `valueSentinel` reactive name so a future refactor cannot silently
        // drop the prop and break the gate.
        const live = stripHtmlComments(readFileSync(RELAY_FEE_ITEM_PATH, 'utf8'));
        expect(live).toMatch(/\bvalue\s*=|\bvalueSentinel\b/);
    });
});

describe('CountCard caller migration — CardInsights.svelte', () => {
    it('has zero bottomText template-literal HTML strings (CARD-02)', () => {
        const live = stripHtmlComments(readFileSync(CARD_INSIGHTS_PATH, 'utf8'));
        // bottomText={`...<tag...`} — template literal containing an HTML tag.
        expect(live).not.toMatch(/bottomText=\{`[^`]*<[a-z]/i);
    });

    it('uses <svelte:fragment slot="bottomText"> at every CountCard call site', () => {
        const live = stripHtmlComments(readFileSync(CARD_INSIGHTS_PATH, 'utf8'));
        const fragMatches = live.match(/<svelte:fragment\s+slot=["']bottomText["']/g) ?? [];
        // CardInsights has 4 CountCard call sites (software, version, geocode, isp).
        expect(fragMatches.length).toBeGreaterThanOrEqual(4);
    });

    it('has 4+ CountCard closing tags (slot-using form)', () => {
        const live = stripHtmlComments(readFileSync(CARD_INSIGHTS_PATH, 'utf8'));
        const closeMatches = live.match(/<\/CountCard>/g) ?? [];
        expect(closeMatches.length).toBeGreaterThanOrEqual(4);
    });
});

describe('CountCard adversarial NIP-11 behavior — Number coercion (CARD-03)', () => {
    it('Number("<img src=x onerror=alert(1)>") is NaN', () => {
        expect(Number.isNaN(Number('<img src=x onerror=alert(1)>'))).toBe(true);
    });

    it('String(NaN) contains no executable HTML', () => {
        expect(String(NaN)).not.toMatch(/<script|<img|onerror=/i);
    });

    it('a numeric input round-trips through Number()', () => {
        expect(Number(1500)).toBe(1500);
    });
});

describe('CountCard adversarial NIP-11 behavior — text-bind escapes HTML (CARD-02)', () => {
    it('escapeHtml on adversarial software field produces no executable markup', () => {
        const out = escapeHtml('<img src=x onerror=alert(1)>');
        // Security contract: angle-brackets are entity-encoded so the browser
        // cannot parse this as an HTML tag. Tag-shaped patterns (`<img`, `<script`,
        // and any `<\w` opener) MUST NOT appear unescaped in the output. We do not
        // assert on bare `onerror=` because escapeHtml only neutralizes the tag
        // delimiters — once the surrounding `<...>` is gone, the substring is
        // inert text. The structural test above (CardInsights bottomText migration)
        // is what guarantees `onerror=` never reaches a render context as part of
        // a live tag. This assertion locks the helper-level "no live tag" contract.
        expect(out).not.toMatch(/<\s*\w/);
        expect(out).toContain('&lt;');
        expect(out).toContain('&gt;');
    });

    it('escapeHtml on a benign software string passes through entity-encoded', () => {
        // Sanity check — the "happy path" produces visible-text output.
        const out = escapeHtml('strfry');
        expect(out).toBe('strfry');
    });
});
