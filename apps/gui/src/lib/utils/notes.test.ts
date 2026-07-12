import { describe, it, expect, vi } from 'vitest';
import { tick } from 'svelte';
import { get, writable, type Readable } from 'svelte/store';
import { nip19 } from 'nostr-tools';

// ---------------------------------------------------------------------------
// UserService mock — hoisted by vitest BEFORE notes.ts imports.
//
// CRITICAL: vi.mock target MUST match the source import literal — notes.ts:7
// imports from `$lib/stores/services.js` (with .js suffix; matches existing
// repo convention, e.g. monitors.test.ts:4). If we mock `$lib/stores/services`
// (no .js), Vitest does NOT intercept the import; the real `userService`
// writable (null by default in jsdom) is used; replaceNip19's npub branch
// exits at `if (!service) return { original, replacement: encoded }` — the
// attacker user.name payload is NEVER reached and FEED-03's attack-vector
// assertion would pass at HEAD AND at GREEN (false security regression
// coverage). The .js suffix is load-bearing.
//
// notes.ts:7 imports `userService` from `$lib/stores/services.js`. The npub
// branch of `replaceNip19` reads `get(userService)`, calls `userFromPubkey(data)`,
// awaits `user.ready()`, and interpolates `user.name` — that interpolation is
// FEED-03's LIVE vuln. The stub returns an attacker-controlled `name` so the
// test can assert the GREEN escapeHtml wrap closes the vector.
//
// The stub User is intentionally minimal — only the fields replaceNip19
// touches. Every other field is undefined so accidental new dependencies
// surface as test failures rather than silent passes.
// ---------------------------------------------------------------------------
vi.mock('$lib/stores/services.js', () => {
    const stubUser = {
        name: '<img src=x onerror=alert(1)>',
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

// notes.ts MUST be imported AFTER the vi.mock call (vitest hoists the mock,
// but explicit ordering documents intent).
import { parseNote, type ParseConfig } from './notes';

/**
 * Drain the parseNote pipeline. The pipeline is async (markdown via marked,
 * replaceNip19 via service.ready(), applySanitize after Phase 28). Wait for:
 *   - one Svelte tick (microtask flush)
 *   - one 50ms macrotask (marked parse + DOMPurify wrap)
 *   - one more Svelte tick (subscriber update)
 * CONTEXT.md decisions section approves this pattern.
 */
async function drain<T>(store: Readable<T>): Promise<T> {
    await tick();
    await new Promise((r) => setTimeout(r, 50));
    await tick();
    return get(store);
}

/**
 * The 4 caller files all pass this exact shape (with minor truncate
 * differences). Mirroring the literal makes the assertions reflect production.
 */
const CALLER_CONFIG: ParseConfig = {
    removeHashtags: true,
    nip19: true,
    markdown: true,
    images: true,
    videos: true,
    truncate: false,
    sanitize: false,         // <-- Phase 28 makes this a no-op
    replaceAmpersand: true,
};

// Reader.svelte calls with markdown:false for wiki content (kind:30818).
// FEED-04: same pipeline must reach applySanitize.
const WIKI_CONFIG: ParseConfig = {
    ...CALLER_CONFIG,
    markdown: false,
};

// ===========================================================================
// Attack-vector describes — every assertion below MUST FAIL at HEAD.
// ===========================================================================

describe('parseNote — XSS hardening — bare attack payloads (FEED-01)', () => {
    it('strips bare <script> from raw input', async () => {
        const out = await drain(parseNote('<script>alert(1)</script>', CALLER_CONFIG));
        expect(out).not.toMatch(/<script\b/i);
        expect(out).not.toContain('alert(1)');
    });

    it('strips event-handler <img> injection', async () => {
        const out = await drain(parseNote('<img src=x onerror=alert(1)>', CALLER_CONFIG));
        expect(out).not.toMatch(/onerror=/i);
        expect(out).not.toContain('alert(1)');
    });

    it('strips combined script + event-handler payload (ROADMAP criterion 1)', async () => {
        const payload = '<script>alert(1)</script><img src=x onerror=alert(1)>';
        const out = await drain(parseNote(payload, CALLER_CONFIG));
        expect(out).not.toMatch(/<script\b/i);
        expect(out).not.toMatch(/onerror=/i);
    });

    it('strips raw iframe navigation payloads from user-authored HTML', async () => {
        const payload = '<iframe src="https://attacker.example/"></iframe>';
        const out = await drain(parseNote(payload, CALLER_CONFIG));
        expect(out).not.toMatch(/<iframe\b/i);
        expect(out).not.toContain('attacker.example');
    });
});

describe('parseNote — parseImages breakout (FEED-02)', () => {
    it('rejects parseImages URL with attribute-breakout chars', async () => {
        // Canonical breakout per ROADMAP criterion 2:
        // \S+ greedy-matches the whole `https://x.png"<script>...<img src="https://y.png`
        // segment, so naive interpolation produces `<img src="https://x.png"<script>...">`.
        // The new regex [^\s"'<>]+ + safeImageUrl belt-and-suspenders MUST close it.
        const payload = 'https://x.png"<script>alert(1)</script><img src="https://y.png';
        const out = await drain(parseNote(payload, CALLER_CONFIG));
        expect(out).not.toMatch(/<script\b/i);
        // Defense: even if marked turns it into something unexpected, the FINAL
        // applySanitize step strips the script tag.
    });

    it('preserves a safe HTTPS image URL', async () => {
        const out = await drain(parseNote('https://example.com/cat.png', CALLER_CONFIG));
        expect(out).toMatch(/<img\b[^>]*\bsrc=/i);
        // Either the raw URL or the entity-encoded form (DOMPurify may re-encode)
        // is acceptable — the contract is "the safe URL survives the pipeline."
        expect(out).toMatch(/example\.com\/cat\.png/);
    });
});

describe('parseNote — replaceNip19 user.name injection (FEED-03)', () => {
    it('escapes attacker-controlled kind:0 name in rendered <a>', async () => {
        // 32-byte hex pubkey -> npub1... via real nip19. The npub branch reads
        // user.name from the mocked service (attacker-controlled HTML payload).
        const pubkey = '00'.repeat(32);
        const npub = nip19.npubEncode(pubkey);
        const input = `nostr:${npub}`;
        const out = await drain(parseNote(input, CALLER_CONFIG));
        // The attacker's <img> tag must NOT appear as a live tag in output.
        expect(out).not.toMatch(/<img\b/i);
        // Visible-text form (entity-encoded) is acceptable. The <a> wrapper
        // itself MAY survive — that's the legitimate replaceNip19 output.
        // Contract: the user.name interpolation is HTML-escaped so the payload
        // renders as visible text, not as a live <img>.
        //
        // We do NOT assert on bare `onerror=` substring: escapeHtml only
        // neutralizes tag delimiters; once the surrounding `<...>` is gone,
        // the substring is inert text. This mirrors Phase 27's documented
        // finding (STATE.md decisions): "escapeHtml only neutralizes tag
        // delimiters; substring onerror= survives entity encoding (and is
        // inert without a live <...> around it)." The /<img\b/ assertion
        // above (no live tag opener) is what actually locks the security
        // contract — there can be no event-handler attribute without a live
        // tag context. The structural pattern below also locks "no live tag
        // opener anywhere in the output's user.name region."
        expect(out).not.toMatch(/<\s*img\b/i);
    });
});

describe('parseNote — sanitize:false is a no-op (FEED-05)', () => {
    it('strips <script> even when caller passes sanitize:false', async () => {
        // Every existing caller passes `sanitize: false`. Phase 28 makes the
        // option a no-op so the 4 callers transparently get sanitized output.
        const out = await drain(parseNote('<script>alert(1)</script>', { sanitize: false }));
        expect(out).not.toMatch(/<script\b/i);
        expect(out).not.toContain('alert(1)');
    });

    it('strips <script> with explicit sanitize:true (control case)', async () => {
        const out = await drain(parseNote('<script>alert(1)</script>', { sanitize: true }));
        expect(out).not.toMatch(/<script\b/i);
    });
});

describe('parseNote — markdown autolink javascript: (FEED-01 markdown path)', () => {
    it('strips javascript: href from markdown autolink', async () => {
        // marked produces `<a href="javascript:alert(1)">click me</a>` from
        // `[click me](javascript:alert(1))`. DOMPurify default config strips
        // `javascript:` from href. After Phase 28's always-on applySanitize
        // this MUST hold for every caller config.
        const out = await drain(parseNote('[click me](javascript:alert(1))', CALLER_CONFIG));
        expect(out).not.toMatch(/href=["']javascript:/i);
        expect(out).not.toMatch(/javascript:alert/i);
    });
});

describe('parseNote — wiki content path (FEED-04)', () => {
    it('strips <script> in markdown:false wiki path (broader WIKI_CONFIG)', async () => {
        // Broader-shape coverage: WIKI_CONFIG spreads CALLER_CONFIG, so all
        // image/video/nip19/etc. transforms are also enabled. Proves the
        // applySanitize step closes <script> regardless of which sync/async
        // transforms ran before it.
        const payload = '<script>alert(1)</script>some wiki content';
        const out = await drain(parseNote(payload, WIKI_CONFIG));
        expect(out).not.toMatch(/<script\b/i);
        expect(out).toContain('some wiki content');
    });

    it('strips <script> with literal {markdown: false} (production wiki call shape)', async () => {
        // routes/relays/software/[softwareKey]/+page.svelte:88 calls
        // parseNote(input, {markdown: false}) — LITERAL, no spread. All other
        // config fields are undefined → falsy → those pipeline steps skip
        // (no images, no videos, no nip19, no removeHashtags, no replaceAmpersand,
        // no truncate). This test mirrors the production call shape exactly,
        // proving the applySanitize step still runs even when every other
        // transform is disabled. WIKI_CONFIG case above provides broader coverage.
        const payload = '<script>alert(1)</script>some wiki content';
        const out = await drain(parseNote(payload, { markdown: false }));
        expect(out).not.toMatch(/<script\b/i);
        expect(out).toContain('some wiki content');
    });
});

// ===========================================================================
// Positive-case describe — locks GREEN preservation contract.
// ===========================================================================

describe('parseNote — preserves valid content', () => {
    it('renders a valid YouTube link as <iframe src=...>', async () => {
        const out = await drain(parseNote('https://youtu.be/dQw4w9WgXcQ', CALLER_CONFIG));
        // YouTube embed survival contract: <iframe src="https://www.youtube.com/embed/<videoId>">
        // MUST survive DOMPurify. A loose `toContain('dQw4w9WgXcQ')` would pass
        // whether the iframe survives, falls back to <a>, or renders as raw text —
        // production embed could silently break and tests would still pass. We
        // lock the contract by asserting the iframe shape with src=.
        //
        // GREEN constraint: raw <iframe> stays disallowed. YouTube survives only
        // because replaceYoutubeLink stores a validated videoId behind a token
        // before sanitize and restores an app-generated iframe after sanitize.
        // The iframe src is locked by replaceYoutubeLink's regex
        // (videoId = [a-zA-Z0-9_-]+) so no attacker input can reach it.
        expect(out).toMatch(/<iframe\b[^>]*\bsrc=["']https:\/\/www\.youtube\.com\/embed\/dQw4w9WgXcQ/);
    });

    it('renders a valid nostr:nevent1... reference as <a href=njump.me>', async () => {
        const id = 'aa'.repeat(32);
        const author = '00'.repeat(32);
        const nevent = nip19.neventEncode({ id, relays: [], author });
        const out = await drain(parseNote(`nostr:${nevent}`, CALLER_CONFIG));
        expect(out).toContain('njump.me/nevent1');
        expect(out).toContain('View Attached Event');
    });
});

// ===========================================================================
// Sanity describes — pass at HEAD; document the contracts.
// ===========================================================================

describe('parseNote — pipeline composition contract (sanity)', () => {
    it('returns a Writable<string> store synchronously', () => {
        const store = parseNote('hi', CALLER_CONFIG);
        expect(typeof (store as unknown as { subscribe: unknown }).subscribe).toBe('function');
    });

    it('initial store value is the raw input synchronously', () => {
        // Phase 28 must preserve the synchronous initial value — callers
        // (FeedNote.svelte etc.) bind to the store and rely on the first emit
        // being the raw input. After applySync runs, the value is updated;
        // after the async pipeline drains, the final value is sanitized.
        const store = parseNote('hi', CALLER_CONFIG);
        // Subscribe synchronously — first callback fires with current value.
        let first: string | undefined;
        const unsub = store.subscribe((v) => {
            if (first === undefined) first = v;
        });
        unsub();
        expect(first).toBe('hi');
    });
});
