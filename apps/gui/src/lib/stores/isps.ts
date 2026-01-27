
import { derived, get, type Readable } from 'svelte/store';
import { eventsArray } from './events.js';
import { relayCheckAggregates, relayChecks } from './checks.js';
import { StateManager } from '@nostrwatch/route66';
import { doAggregateCache, isBootstrapping, tabState } from './app.js';
import softwares from '../config/dataTable/softwares.js';
import {
  useWorkerIsps,
  workerIsps,
  workerIspCounts,
  workerIspPercentages,
  workerSoftwaresByIsp,
  workerIspRows,
} from './dimension-stores.js';
import type { StoreIsp as WorkerStoreIsp, IspRow } from '$lib/workers/dimensions-derivation.worker';

// ============================================================================
// TYPES
// ============================================================================

export type StoreIsp = {
    title: string;
    as: string;
    asname: string;
};

// ============================================================================
// LEGACY DERIVED STORES (Main thread computation)
// ============================================================================

export const isps_legacy: Readable<StoreIsp[]> = derived(relayCheckAggregates, ($relayCheckAggregates) => {
    const ispsMap = new Map<string, StoreIsp>();
    $relayCheckAggregates.forEach((event) => {
        const title: string = event?.isp || 'unknown';
        const nextAs = event?.as || '';
        const nextAsname = event?.asname || '';
        const existing = ispsMap.get(title);
        if (!existing) {
            ispsMap.set(title, {
                title,
                as: nextAs,
                asname: nextAsname
            });
        } else if ((!existing.as && nextAs) || (!existing.asname && nextAsname)) {
            ispsMap.set(title, {
                title: existing.title,
                as: existing.as || nextAs,
                asname: existing.asname || nextAsname
            });
        }
    });
    let ispsArray = Array.from(ispsMap.values()).sort((a, b) => a.title.localeCompare(b.title));
    if(ispsArray.length) {
        if(get(doAggregateCache) && get(tabState) === 'leader' && !get(isBootstrapping)) {
            StateManager.set('aggregate:isps', ispsArray);
        }
    }
    else {
        const cached = StateManager.get('aggregate:isps');
        ispsArray = Array.isArray(cached) ? (cached as StoreIsp[]) : [];
    }

    return ispsArray;
});

export const ispCounts_legacy = derived(relayCheckAggregates, ($relayCheckAggregates) => {
    const counts = new Map();

    $relayCheckAggregates.forEach((relayCheck) => {
        const isp = relayCheck?.isp || 'unknown';
        counts.set(isp, (counts.get(isp) || 0) + 1);
    });

    if (!counts.size) {
        const cachedCounts = StateManager.get('aggregate:ispCounts') as
            | Record<string, number>
            | [string, number][]
            | undefined;
        if (Array.isArray(cachedCounts)) {
            for (const [isp, count] of cachedCounts) counts.set(isp, count);
        } else if (cachedCounts && typeof cachedCounts === 'object') {
            for (const [isp, count] of Object.entries(cachedCounts)) counts.set(isp, count);
        }
    } else {
        if(get(doAggregateCache) && get(tabState) === 'leader' && !get(isBootstrapping)) {
            StateManager.set('aggregate:ispCounts', Object.fromEntries(counts));
        }
    }

    return counts;
});

export const ispPercentages_legacy = derived(ispCounts_legacy, ($ispCounts) => {
    const total = Array.from($ispCounts.values()).reduce((sum, count) => sum + count, 0);
    const percentages = new Map();

    $ispCounts.forEach((count, isp) => {
        const percent = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';
        percentages.set(isp, parseFloat(percent));
    });

    return percentages;
});

export const softwaresByIsp_legacy: Readable<Map<string, string[]>> = derived(
    [relayCheckAggregates],
    ([$relayCheckAggregates]) => {
        const softwaresByIsp: Map<string, string[] | Set<string>> = new Map();
        $relayCheckAggregates.forEach((relayCheck) => {
            const isp = relayCheck?.isp || 'unknown';
            const softwares = softwaresByIsp.get(isp) || new Set();
            if((softwares as Set<string>).has(relayCheck.software)) return;
            (softwares as Set<string>).add(relayCheck.software);
            softwaresByIsp.set(isp, softwares);
        });
        softwaresByIsp.forEach((softwares, isp) => {
            softwaresByIsp.set(isp, Array.from(softwares));
        })
        return softwaresByIsp as Map<string, string[]>;
    }
);

export const ispRows_legacy = derived(
    [isps_legacy, ispCounts_legacy, ispPercentages_legacy, softwaresByIsp_legacy],
    ([$isps, $ispCounts, $ispPercentages, $softwaresByIsp]) => {
    const rows = $isps.map((isp) => {
        const count = $ispCounts.get(isp.title) || 0;
        const percent = $ispPercentages.get(isp.title) || 0;
        const softwares = $softwaresByIsp.get(isp.title) || [];
        const softwaresCount = softwares?.length;
        const { title:prettyName, asname, as } = isp;
        return {
            id: prettyName,
            prettyName,
            asname,
            as,
            count,
            percent,
            softwares,
            softwaresCount
        };
    });
    return rows;
})

// ============================================================================
// HYBRID STORES (Switch between worker and legacy based on feature flag)
// ============================================================================

/**
 * ISPs store - uses worker-computed values when enabled.
 */
export const isps: Readable<StoreIsp[]> = derived(
  [useWorkerIsps, workerIsps, isps_legacy],
  ([$useWorker, $worker, $legacy]) => {
    if ($useWorker && $worker.length > 0) return $worker as StoreIsp[];
    return $legacy;
  }
);

/**
 * ISP counts store - uses worker-computed values when enabled.
 */
export const ispCounts: Readable<Map<string, number>> = derived(
  [useWorkerIsps, workerIspCounts, ispCounts_legacy],
  ([$useWorker, $worker, $legacy]) => {
    if ($useWorker && Object.keys($worker).length > 0) {
      return new Map(Object.entries($worker));
    }
    return $legacy;
  }
);

/**
 * ISP percentages store - uses worker-computed values when enabled.
 */
export const ispPercentages: Readable<Map<string, number>> = derived(
  [useWorkerIsps, workerIspPercentages, ispPercentages_legacy],
  ([$useWorker, $worker, $legacy]) => {
    if ($useWorker && Object.keys($worker).length > 0) {
      return new Map(Object.entries($worker));
    }
    return $legacy;
  }
);

/**
 * Softwares by ISP store - uses worker-computed values when enabled.
 */
export const softwaresByIsp: Readable<Map<string, string[]>> = derived(
  [useWorkerIsps, workerSoftwaresByIsp, softwaresByIsp_legacy],
  ([$useWorker, $worker, $legacy]) => {
    if ($useWorker && Object.keys($worker).length > 0) {
      return new Map(Object.entries($worker));
    }
    return $legacy;
  }
);

/**
 * ISP rows store - uses worker-computed values when enabled.
 */
export const ispRows: Readable<IspRow[]> = derived(
  [useWorkerIsps, workerIspRows, ispRows_legacy],
  ([$useWorker, $worker, $legacy]) => {
    if ($useWorker && $worker.length > 0) return $worker;
    return $legacy as IspRow[];
  }
);
