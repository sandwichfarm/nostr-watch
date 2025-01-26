/// <reference lib="dom" />
export function isBrowser(): boolean {
    try {
        // Check if window or self (global in web workers) is defined
        return typeof window !== 'undefined' || typeof self !== 'undefined';
    } catch (e) {
        // In case of any unexpected errors, assume it's not a browser
        return false;
    }
}