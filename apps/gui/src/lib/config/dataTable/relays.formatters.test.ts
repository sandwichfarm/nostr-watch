import { describe, it, expect, vi } from 'vitest';

// Stub out the store / framework imports that touch localStorage, IndexedDB,
// or SvelteKit runtime at module load time. Keep mocks minimal — the goal is
// to exercise the real formatter logic on attacker-controlled inputs, not to
// substitute the formatters.

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

import { tableFormatters as relayFormatters } from './relays';
import { tableFormatters as softwareFormatters } from './softwares';
import { tableFormatters as ispFormatters } from './isps';

const ATTACK_URL = `http://x" onerror="alert(1)" x="`;
const ATTACK_DESC = `<img src=x onerror=alert(1)>`;
const ATTACK_NAME = `</span><script>alert(1)</script>`;

describe('XSS regression: relay table formatters', () => {
    it('relay formatter does not emit unescaped attack payload as icon src', () => {
        const out = relayFormatters.relay('wss://test.example', { icon: ATTACK_URL });
        // The dangerous chars from ATTACK_URL must NOT appear unescaped.
        expect(out).not.toContain('onerror=');
        expect(out).not.toContain(`x"`);
        // And there should be no <img> at all (URL was rejected — fallback span instead).
        expect(out).not.toContain('<img');
    });

    it('relay formatter accepts a benign https icon', () => {
        const out = relayFormatters.relay('wss://test.example', {
            icon: 'https://cdn.example.com/icon.png'
        });
        expect(out).toContain('https://cdn.example.com/icon.png');
        expect(out).toContain('<img');
    });

    it('description formatter HTML-escapes the description', () => {
        const out = relayFormatters.description(ATTACK_DESC, { relay: 'wss://test.example' });
        expect(out).not.toContain('<img src=x');
        expect(out).toContain('&lt;img');
    });

    it('name formatter HTML-escapes the name', () => {
        const out = relayFormatters.name(ATTACK_NAME, { relay: 'wss://test.example' });
        expect(out).not.toContain('<script>');
        expect(out).toContain('&lt;script&gt;');
    });

    it('software formatter rejects malicious icon URL', () => {
        const out = softwareFormatters.name('strfry', { icon: ATTACK_URL });
        expect(out).not.toContain('onerror=');
        // No <img> when the URL is rejected — fallback span.
        expect(out).not.toContain('<img');
    });

    it('isp formatter rejects malicious icon URL', () => {
        const out = ispFormatters.prettyName('Cloudflare', { icon: ATTACK_URL });
        expect(out).not.toContain('onerror=');
        expect(out).not.toContain('<img');
    });
});
