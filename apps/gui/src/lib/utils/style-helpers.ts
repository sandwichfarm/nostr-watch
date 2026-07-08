/**
 * CSS style-string helpers for banner-URL sinks.
 *
 * Centralizes the `background: linear-gradient(...), url('...'); ...` template
 * shared by PageHeader, the two DataTable variants, and CardOperator. All four
 * sinks pre-Phase-25 inlined the template literal — three of them did so without
 * gating the relay-controlled banner through `safeImageUrl`, leaving a CSS-context
 * single-quote breakout open. This helper closes that vector at every sink and
 * makes regression a build-fail event (see banner-style-structural.test.ts).
 *
 * See apps/gui/src/lib/utils/sanitize.ts for the trust-boundary statement and
 * helper-per-sink table; CSS `url('…')` sinks delegate to `safeImageUrl`.
 */

import { safeImageUrl } from './sanitize';

export interface BannerStyleOptions {
    /** Dark gradient overlay (rgba(0, 0, 0, ...)). Defaults to `true`. */
    darkMode?: boolean;
    /** Gradient opacity, 0..1. Defaults to `0.8` (matches DataTable/CardOperator sinks). */
    opacity?: number;
}

/**
 * Build a safe `background: linear-gradient(...), url('...'); ...` string from
 * a relay-controlled banner URL. The banner is validated via `safeImageUrl`
 * (which rejects `["'<>\n\r\\]` — closing the CSS-context single-quote breakout
 * from CSS-02) before being interpolated.
 *
 * @param banner Relay-controlled banner URL (typically NIP-11 `banner` or kind:0
 *               `banner`). May be any value — non-strings are rejected and
 *               produce `''`.
 * @param opts   `darkMode` (default `true` — dark gradient overlay) and
 *               `opacity` (default `0.8`).
 * @returns The full style declaration string when banner is accepted; `''` when
 *          banner is missing, non-string, or rejected by `safeImageUrl`. Caller
 *          binds the result directly to `style={...}` (Svelte renders `''` as
 *          no style attribute applied).
 */
export function bannerStyleString(
    banner: unknown,
    opts: BannerStyleOptions = {}
): string {
    const safe = safeImageUrl(banner);
    if (safe === '') return '';
    const darkMode = opts.darkMode !== false; // default true
    const opacity = typeof opts.opacity === 'number' ? opts.opacity : 0.8;
    const overlay = darkMode
        ? `rgba(0, 0, 0, ${opacity}), rgba(0, 0, 0, ${opacity})`
        : `rgba(255, 255, 255, ${opacity}), rgba(255, 255, 255, ${opacity})`;
    return `background: linear-gradient(${overlay}), url('${safe}'); background-repeat: no-repeat; background-size: cover;`;
}
