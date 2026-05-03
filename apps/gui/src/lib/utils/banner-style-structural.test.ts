import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, join } from 'path';

// apps/gui/src — resolved relative to this file (apps/gui/src/lib/utils/...)
const APPS_GUI_SRC = resolve(__dirname, '../..');

const BANNER_SINK_FILES = [
    'lib/components/data-view/table/DataTable.svelte',
    'lib/components/lists/table/DataTable.svelte',
    'routes/relays/[protocol]/[...relay]/(components)/cards/CardOperator.svelte',
    'lib/components/layout/PageHeader.svelte',
];

// Detection regex — domain-specific: matches `url('${…banner…}')` interpolations
// (case-insensitive, so `row.banner`, `$profile.banner`, AND `safeBanner` all match).
// The original narrower `/background:\s*url\('\$\{/` was a false-pass — real sinks
// always have `linear-gradient(...)` between `background:` and `url(`, so the
// narrower regex matched 0 hits even before the fix. A broader `/url\(\s*['"]\$\{/`
// would falsely flag the legitimate network-icon CSS in lib/config/dataTable/relays.ts:340
// (which uses internal `iconPath` + allowlist-validated `safeNetwork`). The
// domain-specific shape below targets the actual vulnerability class — banner-named
// interpolations in CSS url() declarations — with no false positives.
const RAW_BANNER_INTERPOLATION_RE = /url\(\s*['"]\$\{[^}]*banner/i;

// The structural test file itself contains the regex source (which mentions `banner`
// and `url(`/`${`). Whitelist this single file from cross-tree scanning. The helper
// file does NOT need whitelisting — it interpolates `${safe}`, not `${banner}`, so
// RAW_BANNER_INTERPOLATION_RE does not match. sanitize.test.ts:144 also does NOT need
// whitelisting — its placeholder is `${...}`, no `banner` keyword.
const WHITELIST_RE = /lib\/utils\/banner-style-structural\.test\.ts$/;

function walkSourceFiles(dir: string, ext: RegExp): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        const st = statSync(full);
        if (st.isDirectory()) {
            if (entry === 'node_modules' || entry === '.svelte-kit') continue;
            out.push(...walkSourceFiles(full, ext));
        } else if (ext.test(entry)) {
            out.push(full);
        }
    }
    return out;
}

describe('banner sink structural', () => {
    // -------------------------------------------------------------------------
    // Per-file checks: each of the 4 banner sinks imports + calls bannerStyleString,
    // and contains zero `url('${…banner…}')` interpolations.
    // -------------------------------------------------------------------------

    BANNER_SINK_FILES.forEach((rel) => {
        it(`${rel} imports + calls bannerStyleString and has no banner-named url() interpolation`, () => {
            const full = join(APPS_GUI_SRC, rel);
            const source = readFileSync(full, 'utf8');

            // (a) The helper is referenced by name (covers both import and call site).
            expect(source).toContain('bannerStyleString');

            // (b) At least one CALL site (not just an import).
            const callMatches = source.match(/bannerStyleString\s*\(/g) ?? [];
            expect(callMatches.length).toBeGreaterThanOrEqual(1);

            // (c) No `url('${…banner…}')` interpolation remains in this file
            // (case-insensitive — covers row.banner, $profile.banner, safeBanner).
            expect(source).not.toMatch(RAW_BANNER_INTERPOLATION_RE);

            // (d) Import path is `$utils/style-helpers` (the project alias for
            // apps/gui/src/lib/utils, per svelte.config.js + vite.config.ts).
            expect(source).toMatch(/from\s+['"]\$utils\/style-helpers['"]/);
        });
    });

    // -------------------------------------------------------------------------
    // Cross-tree check: zero banner-named url() interpolations anywhere in
    // apps/gui/src outside the structural test file itself.
    // -------------------------------------------------------------------------

    it('apps/gui/src has zero banner-named url() interpolations outside the structural test', () => {
        const allFiles = walkSourceFiles(APPS_GUI_SRC, /\.(svelte|ts)$/);
        const candidates = allFiles.filter((f) => !WHITELIST_RE.test(f));
        const offenders: string[] = [];
        for (const file of candidates) {
            const src = readFileSync(file, 'utf8');
            if (RAW_BANNER_INTERPOLATION_RE.test(src)) offenders.push(file);
        }
        expect(
            offenders,
            `unguarded banner interpolation in: ${offenders.join(', ')}`
        ).toEqual([]);
    });
});
