import { describe, it, expect, vi } from 'vitest';

// Stub out the store / framework imports that touch localStorage, IndexedDB,
// or SvelteKit runtime at module load time. Mirror the mock block from
// relays.formatters.test.ts so operators.ts loads cleanly under vitest.

vi.mock('$lib/stores/monitors.js', () => ({
    monitorsMap: { subscribe: vi.fn() }
}));

vi.mock('$lib/stores/checks.js', () => ({
    relaySpeedGroupResolver: { subscribe: vi.fn(() => () => {}) },
    relayChecksActiveKeys: { subscribe: vi.fn() },
    relayCheckAggregator: vi.fn(),
    relayChecksDerivationStats: { subscribe: vi.fn(), set: vi.fn() },
    overrideRelayChecksActiveKeys: { subscribe: vi.fn(), set: vi.fn() },
    eventsChecks: { subscribe: vi.fn() },
    relayChecks: { subscribe: vi.fn() },
    relayCheckMap: { subscribe: vi.fn() },
    relayCheckAggregates: { subscribe: vi.fn() },
    relaysForMiniSearch: { subscribe: vi.fn() },
    relayLivenessCounts: { subscribe: vi.fn() },
    SpeedGroupBars: {},
    SpeedGroupColors: {},
    SpeedGroups: { Mid: 'Mid' }
}));

vi.mock('$stores/relays', () => ({
    relays: { subscribe: vi.fn() }
}));

vi.mock('$lib/stores/relays', () => ({
    relays: { subscribe: vi.fn() }
}));

vi.mock('$app/stores', () => ({
    page: { subscribe: vi.fn() }
}));

vi.mock('$stores/nip11-validations', () => ({
    nip11ValidationErrorCount: { subscribe: vi.fn() }
}));

vi.mock('$lib/stores/helpers/helpers-pubkey', () => ({
    pubkeyProfile: vi.fn(() => undefined),
    pubkeyUserInstance: vi.fn(() => undefined)
}));

// PFP.generate uses canvas — keep deterministic and benign in jsdom.
vi.mock('$lib/utils/pfp', () => ({
    PFP: { generate: vi.fn(() => 'data:image/png;base64,iVBORw0KGgo') }
}));

import { tableFormatters, filterFormatters } from './operators';

const ATTACK_URL = `http://x" onerror="alert(1)" x="`;
const ATTACK_DESC = `<img src=x onerror=alert(1)>`;
const ATTACK_NAME = `</span><script>alert(1)</script>`;
const ATTACK_HEX_PUBKEY = '"><script>alert(1)</script>';
const VALID_HEX_PUBKEY = '0'.repeat(64);

describe('XSS regression: operators table formatters', () => {
    it('name formatter escapes attacker-controlled name and rejects malicious photo URL', () => {
        const out = tableFormatters.name(ATTACK_NAME, {
            pubkey: VALID_HEX_PUBKEY,
            photo: ATTACK_URL
        });
        expect(out).not.toContain('<script>');
        expect(out).not.toContain('onerror=');
        expect(out).not.toContain('x"');
        // The attack name must appear escaped in the output
        expect(out).toContain('&lt;script&gt;');
        // Malicious photo URL rejected — no <img> element rendered
        expect(out).not.toContain('<img');
    });

    it('name formatter rejects non-hex pubkey at entry guard', () => {
        const out = tableFormatters.name('Alice', { pubkey: ATTACK_HEX_PUBKEY });
        // Entry guard should reject — ATTACK_HEX_PUBKEY substring must NOT appear
        expect(out).not.toContain('"><script>');
        expect(out).not.toContain('<script>');
        // No href containing a literal `"`-breakout
        expect(out).not.toMatch(/href="[^"]*"[^>]*"/);
    });

    it('name formatter renders safe PFP path for empty profile name', () => {
        const out = tableFormatters.name('', { pubkey: VALID_HEX_PUBKEY });
        expect(out).toContain('font-mono');
        expect(out).toContain(`/operators/${VALID_HEX_PUBKEY}`);
    });

    it('about formatter escapes attacker-controlled HTML', () => {
        const out = tableFormatters.about(ATTACK_DESC, { pubkey: VALID_HEX_PUBKEY });
        expect(out).not.toContain('<img src=x');
        expect(out).toContain('&lt;img');
    });

    it('reference formatter rejects non-nostr-identifier strings', () => {
        const out = tableFormatters.reference('not-a-nostr-id"><script>');
        expect(out).not.toContain('<script>');
    });

    it('reference formatter accepts valid npub identifier', () => {
        const out = tableFormatters.reference('npub1abc123');
        expect(out).toContain('https://njump.me/npub1abc123');
    });
});

describe('XSS regression: operators filter formatters', () => {
    it('filterFormatters.name escapes attacker-controlled software name', () => {
        const out = filterFormatters.name(ATTACK_NAME);
        expect(out).not.toContain('<script>');
        expect(out).toContain('&lt;script&gt;');
    });

    it('filterFormatters.softwares escapes attacker-controlled software name', () => {
        const out = filterFormatters.softwares(ATTACK_NAME);
        expect(out).not.toContain('<script>');
        expect(out).toContain('&lt;script&gt;');
    });
});
