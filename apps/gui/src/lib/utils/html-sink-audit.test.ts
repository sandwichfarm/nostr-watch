/**
 * Cross-cutting {@html} audit — TEST-06.
 *
 * Walks every .svelte file in apps/gui/src and asserts every `{@html EXPR}`
 * matches a known-safe whitelist pattern. A new `{@html}` sink that doesn't
 * fit one of the whitelisted shapes fails this test loudly with a clear
 * "must be added to whitelist with security justification" message.
 *
 * The whitelist is INTENTIONALLY narrow. Adding an entry requires a written
 * security justification in code review. The whitelist should shrink, not
 * grow, as MIGR-01 (formatter migration to Svelte components, deferred to
 * v2.6+ as AUDIT-01) progresses.
 *
 * Inventory at v2.5 close (12 LIVE sinks; HTML comments stripped before walk):
 *   - PageHeader: safeSubtitle (Phase 24)                                — 1
 *   - 4 feed components: $content (Phase 28 DOMPurify)                    — 4
 *     (FeedNoteContent, FeedNote, FeedMasonryNote, Reader x1)
 *   - Reader: $content (second sink)                                      — 1
 *   - CardLimitation: $NIP_11_LIMITATIONS?.[key] (static dict)            — 1
 *   - JsonHighlighter: highlightedHtml (local escapeHtml)                 — 1
 *   - 2 DataTables: $config.tableFormatters[column.key](...) (#899/#900)  — 2
 *   - 2 Filters: $config.filterFormatters[filter.key](value) (#899/#900)  — 2
 *
 * Note: a third Reader `{@html $readerContent}` exists at Reader.svelte:110
 * but is wrapped in an `<!-- ... -->` comment block (dead Dialog code, lines
 * 101-115). The walker strips HTML comments before counting, matching the
 * live runtime surface — 12 sinks. The `$readerContent` whitelist entry stays
 * in case the dead-code block is re-enabled in the future.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, join, relative } from 'path';

// apps/gui/src — resolved relative to this file (apps/gui/src/lib/utils/...)
const APPS_GUI_SRC = resolve(__dirname, '../..');

// Capture the EXPR inside `{@html EXPR}`. `[^}]+` is fine — Svelte `{@html}`
// cannot contain a literal `}` in the expression because it terminates the
// directive.
const HTML_SINK_RE = /\{@html\s+([^}]+)\}/g;

const WHITELIST_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
    { pattern: /^safeSubtitle$/, reason: 'PageHeader — wrapped via Phase 24 safe* helper' },
    { pattern: /^\$content$/, reason: 'parseNote-produced store — Phase 28 always-on DOMPurify' },
    { pattern: /^\$readerContent$/, reason: 'Reader alt path — same parseNote sanitization' },
    {
        pattern: /^\$NIP_11_LIMITATIONS\?\.\[key\](\s*\|\|\s*['"][^'"]*['"])?$/,
        reason: 'CardLimitation — static dictionary lookup, no relay input',
    },
    { pattern: /^highlightedHtml$/, reason: 'JsonHighlighter — local escapeHtml on every value' },
    {
        pattern: /^\$config\.tableFormatters\[column\.key\]\(row\[column\.key\],\s*row\)$/,
        reason: 'DataTable cells — registered formatters, encode-on-output safe (#899/#900)',
    },
    {
        pattern: /^\$config\.filterFormatters\[filter\.key\]\(value\)$/,
        reason: 'Filters — registered formatters, encode-on-output safe (#899/#900)',
    },
];

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

describe('html-sink audit', () => {
    it('every {@html EXPR} across apps/gui/src/**/*.svelte matches a known-safe whitelist', () => {
        const allSvelte = walkSourceFiles(APPS_GUI_SRC, /\.svelte$/);
        const offenders: Array<{ file: string; expr: string }> = [];

        for (const fullPath of allSvelte) {
            const source = readFileSync(fullPath, 'utf8');
            // Strip HTML comments so commented-out `{@html ...}` examples / dead
            // code blocks don't trigger the walker.
            const live = source.replace(/<!--[\s\S]*?-->/g, '');
            HTML_SINK_RE.lastIndex = 0; // reset regex state across files
            let match: RegExpExecArray | null;
            while ((match = HTML_SINK_RE.exec(live)) !== null) {
                const trimmed = match[1].trim();
                const ok = WHITELIST_PATTERNS.some(({ pattern }) => pattern.test(trimmed));
                if (!ok) {
                    offenders.push({ file: relative(APPS_GUI_SRC, fullPath), expr: trimmed });
                }
            }
        }

        expect(
            offenders,
            `Unknown {@html} sinks (must be added to whitelist with security justification):\n${offenders
                .map((o) => `  ${o.file}: ${o.expr}`)
                .join('\n')}`
        ).toEqual([]);
    });

    it('v2.5 inventory contains at least 12 live {@html} sinks', () => {
        // Locks the LIVE inventory floor at v2.5 close. HTML comments are
        // stripped before counting (matches the runtime surface — dead-code
        // sinks like Reader.svelte:110 inside <!-- ... --> are not rendered).
        //
        // A future contributor REMOVING a live sink (shrinking the canary
        // surface) will fail this test, prompting an explicit decision to
        // lower the floor. ADDING a new sink without whitelist coverage is
        // still caught by the first test above.
        //
        // The plan-time inventory listed 13 (counting the commented-out
        // $readerContent at Reader.svelte:110). Live count is 12.
        const allSvelte = walkSourceFiles(APPS_GUI_SRC, /\.svelte$/);
        let totalSinkCount = 0;

        for (const fullPath of allSvelte) {
            const source = readFileSync(fullPath, 'utf8');
            const live = source.replace(/<!--[\s\S]*?-->/g, '');
            HTML_SINK_RE.lastIndex = 0;
            const matches = live.match(HTML_SINK_RE);
            if (matches) totalSinkCount += matches.length;
        }

        expect(totalSinkCount).toBeGreaterThanOrEqual(12);
    });
});
