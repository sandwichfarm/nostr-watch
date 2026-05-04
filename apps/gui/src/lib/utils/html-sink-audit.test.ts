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

/**
 * Phase 31 — Formatter sink audit (AUDIT-03).
 *
 * Walks every formatter source under `apps/gui/src/lib/config/dataTable/*.ts`
 * (excluding `*.test.ts`) and asserts no formatter PARAMETER flows raw into
 * an HTML template-literal interpolation. The bug class Phase 30 closed
 * (e.g. `(seenTimes) => `<span>${seenTimes}</span>``) is caught at CI time.
 *
 * Design (per 31-CONTEXT.md `### Inspection Method (REVISED 2026-05-04 —
 * Option 3)`):
 *
 *   1. Find every `tableFormatters` / `filterFormatters` object literal block.
 *   2. Inside each block, find every formatter (arrow with parens, arrow with
 *      a single bare param, or method shorthand) and extract parameter names.
 *   3. For each formatter body, find every `${EXPR}` interpolation and
 *      extract its root identifier (first identifier before `(`, `.`, `[`,
 *      `?.`, or whitespace).
 *   4. FLAG offender if the root identifier is in the parameter-name set —
 *      i.e. the parameter flows raw into HTML.
 *
 * The walker is a deny-list (formatter parameter names), not an allow-list of
 * pure helpers. `${escapeHtml(...)}` (root: `escapeHtml`), `${safe}` (root: a
 * non-param local const), `${pastelPair?.dark}` (root: non-param), and
 * `${Math.floor(x)}` (root: `Math`) are all silently safe by construction.
 *
 * Self-test (mutate-detect-revert) — performed in the working tree only,
 * NEVER committed: replace `${escapeHtml(String(seenTimes))}` at
 * `apps/gui/src/lib/config/dataTable/relays.ts:373` with the pre-Phase-30
 * unsafe `${seenTimes}` and confirm this walker fails with a localized error
 * naming the file, line, and offending parameter.
 */

const DATATABLE_DIR = resolve(APPS_GUI_SRC, 'lib/config/dataTable');

// Match the entire `tableFormatters` / `filterFormatters` object literal.
// Tolerates both `export const tableFormatters: Formatters = { ... }` and
// `export const filterFormatters = { ... }`. Greedy up to the closing `\n}`.
const FORMATTER_BLOCK_RE = /(?:tableFormatters|filterFormatters)\s*[:=][^{]*?\{[\s\S]*?\n\}/g;

// Match every `${EXPR}` template-literal interpolation. EXPR cannot contain
// a literal `}` because that terminates the interpolation.
const TEMPLATE_INTERPOLATION_RE = /\$\{([^}]+)\}/g;

// Recognize formatter-definition shapes inside a tableFormatters /
// filterFormatters object literal. Both shapes use a `name:` prefix
// (object-literal property) followed by an arrow function. We deliberately
// do NOT match method-shorthand `name(params) {` because that pattern is
// indistinguishable from a function call inside a formatter body
// (`safeImageUrl(monitor.photo) {` is structurally similar to a method def
// followed by an `if {`). The dataTable codebase uses arrow form exclusively.
const FORMATTER_DEF_RES: Array<{ re: RegExp; paramsAt: number }> = [
    // arrow with parens — `name: (a, b) =>` or `name: (a, b): T =>`
    { re: /([A-Za-z_$][A-Za-z0-9_$]*)\s*:\s*\(([^)]*)\)\s*(?::\s*[^=]+?)?=>/g, paramsAt: 2 },
    // arrow with single bare param — `name: a =>`
    { re: /([A-Za-z_$][A-Za-z0-9_$]*)\s*:\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*=>/g, paramsAt: 2 },
];

// Strip JS comments (line comments starting with double-slash, and block
// comments delimited by slash-star ... star-slash) from a source string,
// preserving comment-internal newlines so absolute line numbers stay
// accurate. Matches the existing walker's HTML-comment stripping idiom
// and ensures commented-out formatter code does not trigger the walker.
//
// Each comment span is replaced with the same number of newlines it
// contained, so source.slice(0, offset).split('newline').length still
// produces the correct line number for any uncommented interpolation.
function stripJsComments(source: string): string {
    // Block comments first (greedy is fine — `/*` cannot legally appear inside
    // a single-quote / double-quote / template string outside of comments
    // for the dataTable formatter sources, and the walker is run against
    // hand-written ts not minified output).
    let out = source.replace(/\/\*[\s\S]*?\*\//g, (m) => {
        const newlines = m.match(/\n/g)?.length ?? 0;
        return '\n'.repeat(newlines);
    });
    // Line comments — strip from `//` to end-of-line, but only when `//`
    // appears outside of strings. The dataTable sources don't contain `//`
    // inside string literals (verified by the existing test suite running
    // green), so a simple line-anchored regex is sound here.
    out = out.replace(/(^|[^:'"`\\])\/\/[^\n]*/g, (_m, prefix: string) => prefix);
    return out;
}

/**
 * Extract bare identifiers from a JS parameter string. Strips type
 * annotations (`x: number`), default values (`x = 5`), and recursively walks
 * destructuring patterns (`{ amount, period }` or `[a, b]`).
 *
 * Returns the set of bare identifiers — these are the "parameter names" the
 * walker deny-lists.
 */
function extractParamNames(paramsString: string): Set<string> {
    const names = new Set<string>();
    if (!paramsString.trim()) return names;

    // Walk top-level commas, respecting nesting in `{...}` and `[...]` and
    // `(...)` so `({ amount, period }: Fee, opts: Opts)` splits into two
    // top-level items.
    const items: string[] = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < paramsString.length; i++) {
        const c = paramsString[i];
        if (c === '{' || c === '[' || c === '(') depth++;
        else if (c === '}' || c === ']' || c === ')') depth--;
        else if (c === ',' && depth === 0) {
            items.push(paramsString.slice(start, i));
            start = i + 1;
        }
    }
    items.push(paramsString.slice(start));

    for (const raw of items) {
        let item = raw.trim();
        if (!item) continue;
        // Strip default value `= ...`.
        const eq = item.indexOf('=');
        if (eq !== -1) item = item.slice(0, eq).trim();
        // Strip type annotation `: ...`. The colon is inside the OUTERMOST
        // pair of braces/brackets only when it's a destructure-pattern colon
        // (`{ a: b }` rename) — but here we only care about the OUTER `: type`
        // separator. Find the first colon at depth 0 of any nested `{`/`[`.
        let depth2 = 0;
        let colonIdx = -1;
        for (let i = 0; i < item.length; i++) {
            const c = item[i];
            if (c === '{' || c === '[' || c === '(') depth2++;
            else if (c === '}' || c === ']' || c === ')') depth2--;
            else if (c === ':' && depth2 === 0) {
                colonIdx = i;
                break;
            }
        }
        if (colonIdx !== -1) item = item.slice(0, colonIdx).trim();

        // Now item is the BINDING part: either a bare ident or a destructure
        // pattern (`{ a, b: c }` or `[a, b]`). Walk it for bare idents.
        if (item.startsWith('{') || item.startsWith('[')) {
            // Destructure: extract every identifier that appears as a binding
            // (LHS of `:` is the source key; RHS of `:` is the binding name).
            // Simplest sound approach: scan for identifiers and add them all
            // — over-approximates the binding set, which only widens the
            // deny-list (false positives become impossible to construct via
            // destructure since shadowing the OUTER param defeats the test).
            const idents = item.match(/[A-Za-z_$][A-Za-z0-9_$]*/g) || [];
            for (const id of idents) {
                if (id) names.add(id);
            }
        } else {
            // Bare ident. Strip rest-spread `...` if present.
            const m = item.match(/^\.{0,3}\s*([A-Za-z_$][A-Za-z0-9_$]*)/);
            if (m) names.add(m[1]);
        }
    }

    return names;
}

/**
 * Extract the root identifier of an interpolation expression. The root is
 * the first identifier before `(`, `.`, `[`, `?.`, or whitespace.
 *
 * `escapeHtml(String(x))` → `escapeHtml`
 * `dd.lat.toFixed(3)`     → `dd`
 * `seenTimes`             → `seenTimes`
 * `Number(x)`             → `Number`
 * `x ? a : b`             → `x` (caller's responsibility — first ident wins)
 */
function extractRootIdentifier(expr: string): string {
    const trimmed = expr.trim();
    const match = trimmed.match(/^([A-Za-z_$][A-Za-z0-9_$]*)/);
    return match ? match[1] : '';
}

describe('formatter sink audit', () => {
    it('every ${expr} in tableFormatters / filterFormatters references a non-parameter root identifier', () => {
        const formatterSources = walkSourceFiles(DATATABLE_DIR, /\.ts$/).filter(
            (f) => !/\.test\.ts$/.test(f)
        );

        const offenders: string[] = [];

        for (const fullPath of formatterSources) {
            const rawSource = readFileSync(fullPath, 'utf8');
            // Strip JS comments before walking so commented-out formatter
            // definitions (e.g. relays.ts:332-350 monitorPubkey block,
            // monitors.ts:160 filterFormatters trailing block, isps.ts:46-64
            // dead geocode/percent/relaysCount alts) don't trigger the
            // walker. Comment span replacement preserves line numbers.
            const source = stripJsComments(rawSource);
            const relPath = relative(APPS_GUI_SRC, fullPath);

            // Reset block regex state across files.
            FORMATTER_BLOCK_RE.lastIndex = 0;
            let blockMatch: RegExpExecArray | null;

            while ((blockMatch = FORMATTER_BLOCK_RE.exec(source)) !== null) {
                const blockText = blockMatch[0];
                const blockStartOffset = blockMatch.index;

                // For each formatter definition shape, find every formatter
                // inside the block and scan its body. Bodies are delimited
                // either by a `=>` followed by an expression or block, or by
                // a method-shorthand `{ ... }` opener. Scope a body as the
                // text from the start of `=>`/`{` up to the matching closer
                // (`,` at depth 0 OR `}` at depth 0 for method shorthand).
                for (const { re, paramsAt } of FORMATTER_DEF_RES) {
                    re.lastIndex = 0;
                    let defMatch: RegExpExecArray | null;
                    while ((defMatch = re.exec(blockText)) !== null) {
                        const paramNames = extractParamNames(defMatch[paramsAt] || '');
                        if (paramNames.size === 0) continue;

                        // Body starts immediately after the match end and
                        // runs until the next top-level `,` or the block's
                        // closing `}`. Track {}, [], (), and template-literal
                        // depth so commas inside nested structures don't
                        // terminate the body.
                        const bodyStartInBlock = defMatch.index + defMatch[0].length;
                        let depth = 0;
                        let inBackticks = false;
                        let bodyEnd = blockText.length;
                        for (let i = bodyStartInBlock; i < blockText.length; i++) {
                            const c = blockText[i];
                            const prev = i > 0 ? blockText[i - 1] : '';
                            if (c === '`' && prev !== '\\') {
                                inBackticks = !inBackticks;
                                continue;
                            }
                            if (inBackticks) continue;
                            if (c === '{' || c === '[' || c === '(') depth++;
                            else if (c === '}' || c === ']' || c === ')') {
                                if (depth === 0) {
                                    bodyEnd = i;
                                    break;
                                }
                                depth--;
                            } else if (c === ',' && depth === 0) {
                                bodyEnd = i;
                                break;
                            }
                        }
                        const body = blockText.slice(bodyStartInBlock, bodyEnd);
                        const bodyAbsoluteStart = blockStartOffset + bodyStartInBlock;

                        TEMPLATE_INTERPOLATION_RE.lastIndex = 0;
                        let interp: RegExpExecArray | null;
                        while ((interp = TEMPLATE_INTERPOLATION_RE.exec(body)) !== null) {
                            const exprText = interp[1];
                            const root = extractRootIdentifier(exprText);
                            if (!root) continue;
                            if (!paramNames.has(root)) continue;

                            // Compute absolute file offset of `${` opener,
                            // then count newlines before that offset.
                            const interpAbsoluteOffset = bodyAbsoluteStart + interp.index;
                            const linesBefore = source.slice(0, interpAbsoluteOffset).split('\n').length;
                            offenders.push(
                                `${relPath}:${linesBefore}: \`\${${exprText}}\`  — formatter parameter '${root}' flows raw into HTML interpolation; wrap with escapeHtml(String(${root})) or a known-pure helper`
                            );
                        }
                    }
                }
            }
        }

        expect(
            offenders,
            `Unsafe \${expr} in dataTable formatter parameters (root identifier matches a formatter parameter name — wrap through escapeHtml(String(...)) or a known-pure helper):\n${offenders.join('\n')}`
        ).toEqual([]);
    });

    it('walker reaches at least six formatter source files and six tableFormatters/filterFormatters blocks', () => {
        // Sanity floor: if either the file walker stops finding sources OR
        // the block-detection regex stops matching due to a future refactor,
        // this fails immediately rather than producing a false-green from
        // zero offenders.
        const formatterSources = walkSourceFiles(DATATABLE_DIR, /\.ts$/).filter(
            (f) => !/\.test\.ts$/.test(f)
        );

        let blockCount = 0;
        for (const fullPath of formatterSources) {
            const source = stripJsComments(readFileSync(fullPath, 'utf8'));
            FORMATTER_BLOCK_RE.lastIndex = 0;
            const matches = source.match(FORMATTER_BLOCK_RE);
            if (matches) blockCount += matches.length;
        }

        expect(formatterSources.length).toBeGreaterThanOrEqual(6);
        expect(blockCount).toBeGreaterThanOrEqual(6);
    });
});
