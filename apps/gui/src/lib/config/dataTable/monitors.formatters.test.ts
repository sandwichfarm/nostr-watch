import { describe, it, expect, vi, beforeEach } from 'vitest';

// monitorsMap is a Svelte-store-shape mock whose subscribe callback fires
// synchronously with whatever Map we want for that test. Each test installs
// its own monitor record by calling setMonitor(...) before invoking the
// formatter.

const ATTACK_URL = `http://x" onerror="alert(1)" x="`;
const ATTACK_NAME = `</span><script>alert(1)</script>`;
const ATTACK_HEX_PUBKEY = '"><script>alert(1)</script>';
const VALID_HEX_PUBKEY = '0'.repeat(64);

let mockMonitors = new Map();

function setMonitor(pubkey: string, monitor: any) {
    mockMonitors = new Map([[pubkey, monitor]]);
}

vi.mock('$lib/stores/monitors.js', () => ({
    monitorsMap: {
        subscribe: vi.fn((cb: (m: Map<string, any>) => void) => {
            cb(mockMonitors);
            return () => {};
        })
    }
}));

vi.mock('$lib/stores/nip05s.js', () => ({
    validNip05s: {
        subscribe: vi.fn((cb: (v: any[]) => void) => {
            cb([]);
            return () => {};
        })
    }
}));

vi.mock('$lib/utils/pfp.js', () => ({
    PFP: { generate: vi.fn(() => 'data:image/png;base64,iVBORw0KGgo') }
}));

vi.mock('$app/stores', () => ({
    page: { subscribe: vi.fn() }
}));

import { tableFormatters, filterFormatters } from './monitors';
import { get } from 'svelte/store';
import { validNip05s } from '$lib/stores/nip05s.js';

beforeEach(() => {
    mockMonitors = new Map();
});

describe('XSS regression: monitors table formatters', () => {
    it('nip05 formatter escapes attacker-controlled nip05 value', () => {
        const out = tableFormatters.nip05(ATTACK_NAME, { pubkey: VALID_HEX_PUBKEY });
        expect(out).not.toContain('<script>');
        expect(out).toContain('&lt;script&gt;');
    });

    it('pubkey formatter rejects non-hex pubkey at entry guard', () => {
        const out = tableFormatters.pubkey(ATTACK_HEX_PUBKEY);
        expect(out).not.toContain('<script>');
        expect(out).not.toContain('"><');
    });

    it('pubkey formatter rejects malicious monitor.photo URL', () => {
        setMonitor(VALID_HEX_PUBKEY, {
            pubkey: VALID_HEX_PUBKEY,
            photo: ATTACK_URL,
            profile: { name: 'safe', photo: '' }
        });
        const out = tableFormatters.pubkey(VALID_HEX_PUBKEY);
        expect(out).not.toContain('onerror=');
        expect(out).not.toContain('x"');
    });

    it('pubkey formatter escapes attacker-controlled monitor.profile.name', () => {
        setMonitor(VALID_HEX_PUBKEY, {
            pubkey: VALID_HEX_PUBKEY,
            photo: '',
            profile: { name: ATTACK_NAME, photo: '' }
        });
        const out = tableFormatters.pubkey(VALID_HEX_PUBKEY);
        expect(out).not.toContain('<script>');
        expect(out).toContain('&lt;script&gt;');
    });

    it('checks formatter escapes attacker-controlled check labels', () => {
        const out = tableFormatters.checks(['<script>alert(1)</script>', 'normal']);
        expect(out).not.toContain('<script>alert(1)');
        expect(out).toContain('&lt;script&gt;');
    });
});

describe('XSS regression: monitors filter formatters', () => {
    it('filterFormatters.pubkey rejects malicious monitor.profile.photo URL', () => {
        setMonitor(VALID_HEX_PUBKEY, {
            pubkey: VALID_HEX_PUBKEY,
            profile: { name: 'safe', photo: ATTACK_URL }
        });
        const out = filterFormatters.pubkey(VALID_HEX_PUBKEY);
        expect(out).not.toContain('onerror=');
        expect(out).not.toContain('x"');
    });

    it('filterFormatters.pubkey escapes attacker-controlled monitor.profile.name', () => {
        setMonitor(VALID_HEX_PUBKEY, {
            pubkey: VALID_HEX_PUBKEY,
            profile: { name: ATTACK_NAME, photo: '' }
        });
        const out = filterFormatters.pubkey(VALID_HEX_PUBKEY);
        expect(out).not.toContain('<script>');
        expect(out).toContain('&lt;script&gt;');
    });

    it('filterFormatters.pubkey rejects non-hex pubkey at entry guard', () => {
        const out = filterFormatters.pubkey(ATTACK_HEX_PUBKEY);
        expect(out).not.toContain('<script>');
        expect(out).not.toContain('"><');
    });
});
