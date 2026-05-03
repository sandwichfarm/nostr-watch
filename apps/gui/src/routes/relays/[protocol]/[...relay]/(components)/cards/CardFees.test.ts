import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { safeHttpUrl } from '$utils/sanitize';

// Resolved relative to this file:
// apps/gui/src/routes/relays/[protocol]/[...relay]/(components)/cards/CardFees.test.ts
const CARD_FEES_PATH = resolve(__dirname, 'CardFees.svelte');

/**
 * Strip every HTML comment block (<!-- ... -->) from the source so the
 * structural assertions only inspect LIVE code. The dead-code commented
 * block at CardFees.svelte:84-138 is intentionally out of scope for Phase 26
 * (see 26-CONTEXT.md Deferred Ideas).
 *
 * Uses the [\s\S] pattern to match across newlines and a non-greedy quantifier
 * so adjacent comment blocks aren't merged.
 */
function stripHtmlComments(source: string): string {
    return source.replace(/<!--[\s\S]*?-->/g, '');
}

describe('CardFees href sink', () => {
    // ---------------------------------------------------------------------
    // Structural assertions: read the LIVE source (comment-stripped) and
    // prove the wiring. Mirrors Phase 25's banner-style-structural.test.ts.
    // ---------------------------------------------------------------------

    it('imports safeHttpUrl from $utils/sanitize', () => {
        const source = readFileSync(CARD_FEES_PATH, 'utf8');
        expect(source).toMatch(
            /import\s*\{[^}]*\bsafeHttpUrl\b[^}]*\}\s*from\s*['"]\$utils\/sanitize['"]/
        );
    });

    it('has zero raw paymentsUrl interpolations at href= bindings (live code only)', () => {
        const liveSource = stripHtmlComments(readFileSync(CARD_FEES_PATH, 'utf8'));
        // Match either `href="{paymentsUrl}"` (current vuln shape) or
        // `href={paymentsUrl}` (alternative shape). The `\b` after `paymentsUrl`
        // ensures we don't accidentally match `safePaymentsUrl`.
        expect(liveSource).not.toMatch(/href\s*=\s*["{]\s*\{?\s*paymentsUrl\b/);
    });

    it('calls safeHttpUrl(paymentsUrl) at least once in live code', () => {
        const liveSource = stripHtmlComments(readFileSync(CARD_FEES_PATH, 'utf8'));
        expect(liveSource).toMatch(/safeHttpUrl\s*\(\s*paymentsUrl\s*\)/);
    });

    it('binds <Button href> to a safe* identifier (the wrapped value), not raw paymentsUrl', () => {
        const liveSource = stripHtmlComments(readFileSync(CARD_FEES_PATH, 'utf8'));
        // The dynamic href in the live code must reference a `safe*` identifier
        // (case-insensitive: safePaymentsUrl, safePaymentUrl, paymentsUrlSafe — all OK).
        expect(liveSource).toMatch(/href\s*=\s*["{]\s*\{?\s*safe[A-Za-z]*\b/i);
        // And no raw paymentsUrl at any href= binding.
        expect(liveSource).not.toMatch(/href\s*=\s*["{]\s*\{?\s*paymentsUrl\b/);
    });

    // ---------------------------------------------------------------------
    // Behavior assertions: direct safeHttpUrl invocation. Phase 24's
    // sanitize.test.ts exhaustively tests safeHttpUrl; these 6 cases prove
    // the imported helper still rejects every canonical attack payload and
    // accepts the safe one — i.e. the wiring imports the right helper.
    // ---------------------------------------------------------------------

    it('rejects javascript: scheme', () => {
        expect(safeHttpUrl('javascript:alert(1)')).toBe('');
    });
    it('rejects data: scheme', () => {
        expect(safeHttpUrl('data:text/html,<script>alert(1)</script>')).toBe('');
    });
    it('rejects vbscript: scheme', () => {
        expect(safeHttpUrl('vbscript:msgbox')).toBe('');
    });
    it('rejects file: scheme', () => {
        expect(safeHttpUrl('file:///etc/passwd')).toBe('');
    });
    it('rejects attribute-breakout payload', () => {
        expect(safeHttpUrl('http://x" onerror="alert(1)" x="')).toBe('');
    });
    it('accepts safe https URL', () => {
        expect(safeHttpUrl('https://relay.example/pay')).toBe('https://relay.example/pay');
    });
});
