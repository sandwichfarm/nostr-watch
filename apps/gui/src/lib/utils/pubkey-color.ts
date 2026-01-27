/**
 * Utility for deriving deterministic colors from pubkeys.
 * Colors are normalized for visibility in both dark and light modes.
 */

/**
 * Simple hash function to convert hex string to a number.
 */
function hashHex(hex: string): number {
    let hash = 0;
    for (let i = 0; i < hex.length; i++) {
        const char = hex.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
}

/**
 * Derives a hue value (0-360) from the first 6 characters of a pubkey.
 */
function hueFromPubkey(pubkey: string): number {
    const prefix = pubkey.slice(0, 6);
    const hash = hashHex(prefix);
    return hash % 360;
}

/**
 * Derives a saturation value from the pubkey to add variety.
 */
function saturationFromPubkey(pubkey: string): number {
    const chars = pubkey.slice(2, 4);
    const hash = hashHex(chars);
    // Keep saturation between 50-80% for vivid but not overwhelming colors
    return 50 + (hash % 30);
}

export interface PubkeyColorOptions {
    /** Whether to return dark mode compatible color (lighter) or light mode (darker) */
    mode: 'dark' | 'light';
}

/**
 * Generates a deterministic color from a pubkey, normalized for the given mode.
 *
 * @param pubkey - The nostr pubkey (hex string)
 * @param options - Options including the color mode
 * @returns HSL color string
 */
export function colorFromPubkey(pubkey: string, options: PubkeyColorOptions): string {
    if (!pubkey || typeof pubkey !== 'string') {
        return options.mode === 'dark' ? 'hsl(0, 0%, 70%)' : 'hsl(0, 0%, 40%)';
    }

    const hue = hueFromPubkey(pubkey);
    const saturation = saturationFromPubkey(pubkey);

    // Normalize lightness for visibility:
    // - Dark mode: higher lightness (60-75%) for visibility against dark backgrounds
    // - Light mode: lower lightness (35-50%) for visibility against light backgrounds
    const lightness = options.mode === 'dark' ? 65 : 42;

    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

/**
 * Returns CSS custom property expressions for both modes.
 * Useful for inline styles that need to work with CSS variables.
 */
export function colorVarsFromPubkey(pubkey: string): { dark: string; light: string } {
    return {
        dark: colorFromPubkey(pubkey, { mode: 'dark' }),
        light: colorFromPubkey(pubkey, { mode: 'light' })
    };
}

/**
 * Truncates a pubkey to show first 6 and last 6 characters with ellipsis.
 * Format: "abc123...xyz789"
 */
export function truncatePubkey(pubkey: string): string {
    if (!pubkey || typeof pubkey !== 'string') return '';
    if (pubkey.length <= 15) return pubkey;
    return `${pubkey.slice(0, 6)}...${pubkey.slice(-6)}`;
}
