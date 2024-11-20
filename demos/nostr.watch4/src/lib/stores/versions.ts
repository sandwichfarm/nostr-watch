import { derived } from 'svelte/store';
import { checks } from './checks.js'; 

export const versions = derived(checks, ($checks) => {
    const versions = new Set();

    $checks.forEach((check) => {
        if(check?.version)
            versions.add(check.version);
    });

    return Array.from(versions);
});