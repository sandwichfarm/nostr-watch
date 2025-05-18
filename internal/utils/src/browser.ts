/// <reference lib="dom" />
export function isBrowser(): boolean {
    try {
        // Check if we're in Deno
        if (typeof Deno !== 'undefined') {
            return false;
        }
        
        // Check if we're in Node.js
        if (typeof process !== 'undefined' && process.versions && process.versions.node) {
            return false;
        }
        
        // Check if window or self (global in web workers) is defined
        return typeof window !== 'undefined' || typeof self !== 'undefined';
    } catch (e) {
        // In case of any unexpected errors, assume it's not a browser
        return false;
    }
}