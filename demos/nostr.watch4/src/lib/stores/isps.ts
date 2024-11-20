import { derived } from 'svelte/store';
import { checks } from './checks.js'; 

export const isps = derived(checks, ($checks) => {
    const versions = new Set();

    $checks.forEach((check) => {
        versions.add(check.version);
    });

    return Array.from(versions);
});