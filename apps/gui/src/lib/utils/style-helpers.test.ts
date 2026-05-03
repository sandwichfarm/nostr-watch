import { describe, it, expect } from 'vitest';
import { bannerStyleString } from './style-helpers';

describe('bannerStyleString', () => {
    // -------------------------------------------------------------------------
    // Happy-path acceptance — dark variant (default)
    // -------------------------------------------------------------------------

    it('returns the dark gradient + url() string for a valid http banner', () => {
        const out = bannerStyleString('https://example.com/banner.png');
        expect(out).toContain("url('https://example.com/banner.png')");
        expect(out).toContain('linear-gradient(rgba(0, 0, 0, 0.8), rgba(0, 0, 0, 0.8))');
        expect(out).toContain('background-repeat: no-repeat');
        expect(out).toContain('background-size: cover');
    });

    it('returns the dark gradient + url() string for a valid https banner', () => {
        const out = bannerStyleString('https://example.com/x.jpg', { darkMode: true });
        expect(out).toContain("url('https://example.com/x.jpg')");
        expect(out).toContain('rgba(0, 0, 0, 0.8)');
    });

    // -------------------------------------------------------------------------
    // Happy-path acceptance — light variant
    // -------------------------------------------------------------------------

    it('returns the light gradient when darkMode is false', () => {
        const out = bannerStyleString('https://example.com/x.png', { darkMode: false });
        expect(out).toContain(
            'linear-gradient(rgba(255, 255, 255, 0.8), rgba(255, 255, 255, 0.8))'
        );
        expect(out).toContain("url('https://example.com/x.png')");
        expect(out).not.toContain('rgba(0, 0, 0,');
    });

    // -------------------------------------------------------------------------
    // Opacity prop (PageHeader bgOpacity pattern)
    // -------------------------------------------------------------------------

    it('honors the opacity option in the dark gradient', () => {
        const out = bannerStyleString('https://x.com/b.png', { opacity: 0.2 });
        expect(out).toContain('linear-gradient(rgba(0, 0, 0, 0.2), rgba(0, 0, 0, 0.2))');
    });

    it('honors the opacity option in the light gradient', () => {
        const out = bannerStyleString('https://x.com/b.png', { darkMode: false, opacity: 0.5 });
        expect(out).toContain(
            'linear-gradient(rgba(255, 255, 255, 0.5), rgba(255, 255, 255, 0.5))'
        );
    });

    it('defaults opacity to 0.8 when option omitted', () => {
        const out = bannerStyleString('https://x.com/b.png');
        expect(out).toContain('rgba(0, 0, 0, 0.8)');
    });

    // -------------------------------------------------------------------------
    // Ampersand encoding pass-through (delegates to safeImageUrl which delegates
    // to escapeHtml)
    // -------------------------------------------------------------------------

    it('encodes ampersands in banner query strings via safeImageUrl', () => {
        const out = bannerStyleString('https://example.com/b.png?a=1&b=2');
        expect(out).toContain("url('https://example.com/b.png?a=1&amp;b=2')");
    });

    // -------------------------------------------------------------------------
    // CSS-context breakout regression (CSS-02 — canonical payload from CONTEXT)
    // -------------------------------------------------------------------------

    it('rejects the canonical CSS-context single-quote breakout payload (CSS-02)', () => {
        const payload =
            "x'); position:fixed; top:0; left:0; width:100vw; height:100vh; background:url('y";
        expect(bannerStyleString(payload)).toBe('');
    });

    it('returns empty (no style) when banner contains a single quote', () => {
        expect(bannerStyleString("https://x.com/b'.png")).toBe('');
    });

    it('returns empty when banner contains a double quote', () => {
        expect(bannerStyleString('https://x.com/b".png')).toBe('');
    });

    // -------------------------------------------------------------------------
    // Scheme rejection (delegated to safeImageUrl)
    // -------------------------------------------------------------------------

    it('rejects javascript: schemes', () => {
        expect(bannerStyleString('javascript:alert(1)')).toBe('');
    });

    it('rejects data:text/html (non-image data: subtypes)', () => {
        expect(bannerStyleString('data:text/html,<script>alert(1)</script>')).toBe('');
    });

    it('accepts data:image/ subtypes', () => {
        const out = bannerStyleString('data:image/png;base64,iVBORw0KGgo');
        expect(out).toContain("url('data:image/png;base64,iVBORw0KGgo')");
    });

    it('rejects file: URLs', () => {
        expect(bannerStyleString('file:///etc/passwd')).toBe('');
    });

    it('rejects vbscript: URLs', () => {
        expect(bannerStyleString('vbscript:msgbox')).toBe('');
    });

    // -------------------------------------------------------------------------
    // Boundary / type cases
    // -------------------------------------------------------------------------

    it('returns empty for empty string', () => {
        expect(bannerStyleString('')).toBe('');
    });

    it('returns empty for null', () => {
        expect(bannerStyleString(null)).toBe('');
    });

    it('returns empty for undefined', () => {
        expect(bannerStyleString(undefined)).toBe('');
    });

    it('returns empty for numeric input', () => {
        expect(bannerStyleString(42)).toBe('');
    });

    it('returns empty for objects', () => {
        expect(bannerStyleString({})).toBe('');
    });

    // -------------------------------------------------------------------------
    // Anti-assertion (CSS-02 / ROADMAP success criterion 2)
    // -------------------------------------------------------------------------

    it('rejected payloads cannot inject position/top/left/width/height declarations', () => {
        const payload =
            "x'); position:fixed; top:0; left:0; width:100vw; height:100vh; background:url('y";
        const out = bannerStyleString(payload);
        expect(out).not.toMatch(/position:/);
        expect(out).not.toMatch(/top:/);
        expect(out).not.toMatch(/left:/);
        expect(out).not.toMatch(/width:/);
        expect(out).not.toMatch(/height:/);
        expect(out).toBe('');
    });

    it('accepted banners produce exactly one url(...) declaration', () => {
        const out = bannerStyleString('https://example.com/b.png');
        const matches = out.match(/url\(/g) ?? [];
        expect(matches.length).toBe(1);
    });
});
