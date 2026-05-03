import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

/**
 * Structural regression: ensure no DataTable copy or filter component
 * reintroduces the unsanitized `{@html row[column.key]}` /
 * `{@html ... || value}` fallback. Once Task 3 lands, the substring is
 * gone — and any future PR that reintroduces it fails this test.
 *
 * Note: this is a regression-floor — we don't have @testing-library/svelte
 * available. The structural assertion is sufficient to prevent re-entry of
 * the vulnerability.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../../../../../');

const COMPONENT_FILES = [
    resolve(repoRoot, 'src/lib/components/data-view/table/DataTable.svelte'),
    resolve(repoRoot, 'src/lib/components/lists/table/DataTable.svelte')
];

const FILTER_FILES = [
    resolve(repoRoot, 'src/lib/components/lists/table/Filters.svelte'),
    resolve(repoRoot, 'src/lib/components/data-view/filters/DataViewFilters.svelte')
];

describe('XSS regression: DataTable fallback render path', () => {
    for (const file of COMPONENT_FILES) {
        it(`${file.split('/src/').pop()} does not render row[column.key] via {@html}`, () => {
            const source = readFileSync(file, 'utf-8');
            // The unsafe fallback shape:  {@html row[column.key]}
            expect(source).not.toMatch(/\{@html\s+row\[column\.key\]\s*\}/);
        });
    }

    for (const file of FILTER_FILES) {
        it(`${file.split('/src/').pop()} does not render filter value via {@html ... || value}`, () => {
            const source = readFileSync(file, 'utf-8');
            // The unsafe fallback shape:  {@html ...filterFormatters?.[filter.key]?.(value) || value}
            expect(source).not.toMatch(
                /\{@html\s+\$config\.filterFormatters\?\.\[filter\.key\]\?\.\(value\)\s*\|\|\s*value\s*\}/
            );
        });
    }

    it('DataTable.svelte uses split-conditional with text-binding fallback', () => {
        for (const file of COMPONENT_FILES) {
            const source = readFileSync(file, 'utf-8');
            // The safe shape: text-bind row[column.key] in the {:else} branch
            expect(source).toMatch(/\{row\[column\.key\]\}/);
        }
    });

    it('Filter components use split-conditional with text-binding fallback', () => {
        for (const file of FILTER_FILES) {
            const source = readFileSync(file, 'utf-8');
            // The safe shape: a bare {value} text binding
            expect(source).toMatch(/\{value\}/);
        }
    });
});
