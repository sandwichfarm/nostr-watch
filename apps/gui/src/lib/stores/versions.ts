import { derived, get, type Readable } from 'svelte/store';
import { throttledDerived } from '$lib/utils/stores.js';
import { StateManager } from '@nostrwatch/route66';
import { relayCheckAggregates } from './checks.js';
import { doAggregateCache, isBootstrapping, tabState } from './app.js';
import { useWorkerVersions, workerVersions } from './dimension-stores';

// ============================================================================
// LEGACY STORE (Derived from relayCheckAggregates)
// ============================================================================

export const versions_legacy = throttledDerived(relayCheckAggregates, ($relayCheckAggregates) => {
    const versions = new Set<string>();

    $relayCheckAggregates.forEach((relayCheck) => {
        if(relayCheck?.version)
            versions.add(relayCheck.version);
    });
    const finalVersions = Array.from(versions).sort()
    if(finalVersions.length){
        if(get(doAggregateCache) && get(tabState) === 'leader' && !get(isBootstrapping)) {
            StateManager.set('aggregate:versions', finalVersions);
        }
        return finalVersions;
    }

    const cached = StateManager.get('aggregate:versions');
    return Array.isArray(cached) ? cached : [];
});

// ============================================================================
// HYBRID STORE (Worker-fed with legacy fallback)
// ============================================================================

/** List of unique version strings sorted alphabetically */
export const versions: Readable<string[]> = derived(
    [useWorkerVersions, workerVersions, versions_legacy],
    ([$useWorker, $worker, $legacy]) => {
        if ($useWorker && $worker.length > 0) return $worker;
        return $legacy;
    }
);
