import { describe, it, expect } from 'vitest';
import { escapeHtml, safeImageUrl } from './sanitize';

describe('escapeHtml', () => {
    it('escapes <script> tags', () => {
        expect(escapeHtml('<script>alert(1)</script>')).toBe(
            '&lt;script&gt;alert(1)&lt;/script&gt;'
        );
    });

    it('escapes ampersand', () => {
        expect(escapeHtml('a & b')).toBe('a &amp; b');
    });

    it('escapes double quotes', () => {
        expect(escapeHtml('he said "hi"')).toBe('he said &quot;hi&quot;');
    });

    it('escapes single quotes', () => {
        expect(escapeHtml("it's")).toBe('it&#39;s');
    });

    it('returns empty string for null', () => {
        expect(escapeHtml(null)).toBe('');
    });

    it('returns empty string for undefined', () => {
        expect(escapeHtml(undefined)).toBe('');
    });

    it('returns empty string for numbers', () => {
        expect(escapeHtml(123)).toBe('');
    });

    it('returns empty string for objects', () => {
        expect(escapeHtml({})).toBe('');
    });

    it('encodes & before other entities (no double-encoding regression)', () => {
        // If we escaped < first, we would produce &lt; and then re-encode the &.
        // The correct order produces &amp;lt; ONLY if we double-encoded — we should not.
        // 'a<b' must become 'a&lt;b', not 'a&amp;lt;b'.
        expect(escapeHtml('a<b')).toBe('a&lt;b');
        // And a literal & followed by < must encode the & once and the < once.
        expect(escapeHtml('&<')).toBe('&amp;&lt;');
    });

    it('handles empty string', () => {
        expect(escapeHtml('')).toBe('');
    });
});

describe('safeImageUrl', () => {
    it('accepts a valid https URL', () => {
        expect(safeImageUrl('https://example.com/x.png')).toBe(
            'https://example.com/x.png'
        );
    });

    it('accepts a valid http URL', () => {
        expect(safeImageUrl('http://example.com/x.png')).toBe(
            'http://example.com/x.png'
        );
    });

    it('accepts a data:image/ URL', () => {
        const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA';
        expect(safeImageUrl(dataUrl)).toBe(dataUrl);
    });

    it('rejects data:image/svg+xml that contains <', () => {
        // SVG data URLs can carry script — reject any with raw < anyway via the breakout filter.
        expect(safeImageUrl('data:image/svg+xml,<svg></svg>')).toBe('');
    });

    it('rejects data:text/html', () => {
        expect(safeImageUrl('data:text/html,<script>alert(1)</script>')).toBe('');
    });

    it('rejects javascript: URLs', () => {
        expect(safeImageUrl('javascript:alert(1)')).toBe('');
    });

    it('rejects vbscript: URLs', () => {
        expect(safeImageUrl('vbscript:msgbox')).toBe('');
    });

    it('rejects file: URLs', () => {
        expect(safeImageUrl('file:///etc/passwd')).toBe('');
    });

    it('rejects the canonical attack payload (double-quote breakout)', () => {
        expect(safeImageUrl('http://x" onerror="alert(1)" x="')).toBe('');
    });

    it('rejects a single-quote breakout payload', () => {
        expect(safeImageUrl("http://x' onerror='alert(1)")).toBe('');
    });

    it('encodes ampersands in query strings', () => {
        expect(safeImageUrl('https://example.com/img?a=1&b=2')).toBe(
            'https://example.com/img?a=1&amp;b=2'
        );
    });

    it('returns empty string for empty string', () => {
        expect(safeImageUrl('')).toBe('');
    });

    it('returns empty string for null', () => {
        expect(safeImageUrl(null)).toBe('');
    });

    it('returns empty string for undefined', () => {
        expect(safeImageUrl(undefined)).toBe('');
    });

    it('returns empty string for numeric input', () => {
        expect(safeImageUrl(42)).toBe('');
    });

    it('rejects URLs without http/https/data:image prefix', () => {
        expect(safeImageUrl('not a url')).toBe('');
        expect(safeImageUrl('//example.com/x.png')).toBe('');
        expect(safeImageUrl('example.com/x.png')).toBe('');
    });

    it('rejects URLs containing newline characters', () => {
        expect(safeImageUrl('https://x.com/\n<script>')).toBe('');
        expect(safeImageUrl('https://x.com/\rfoo')).toBe('');
    });

    it('rejects URLs containing backslashes', () => {
        expect(safeImageUrl('https://x.com/\\foo')).toBe('');
    });

    it('rejects URLs containing < or >', () => {
        expect(safeImageUrl('https://x.com/<script>')).toBe('');
        expect(safeImageUrl('https://x.com/>foo')).toBe('');
    });
});
