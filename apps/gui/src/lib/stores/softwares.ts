import { derived, get, type Readable } from 'svelte/store';
import { throttledDerived } from '$lib/utils/stores.js';
import { StateManager } from '@nostrwatch/route66';
import { relayCheckAggregates } from './checks.js';
import { doAggregateCache, isBootstrapping, tabState } from './app.js';
import { deterministicHash } from '@nostrwatch/route66/utils';
import type { Pubkey } from '$lib/models/User.js';
import {
  useWorkerSoftwares,
  workerSoftwares,
  workerSoftwareCounts,
  workerSoftwarePercentages,
  workerSoftwareVersions,
  workerSoftwareVersionCounts,
  workerSoftwareRelays,
  workerSoftwareOperatorPubkeys,
  workerIspsBySoftware,
  workerSoftwareGeocodes,
  workerSoftwareRows,
} from './dimension-stores.js';
import type { SoftwareRow } from '$lib/workers/dimensions-derivation.worker';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export const softwareKey = (software: string) => {
  return software?.toLowerCase()
}

export const softwareCleanKey = (software: string) => {
  return softwareKey(software).replace(/ /g, '-');
}

// ============================================================================
// LEGACY DERIVED STORES (Main thread computation)
// ============================================================================

export const softwares_legacy: Readable<string[]> = throttledDerived(relayCheckAggregates, ($relayCheckAggregates) => {
  const software: Set<string> = new Set();

  $relayCheckAggregates.forEach((relayCheck) => {
    const sw = relayCheck?.software;
    if (typeof sw === 'string' && sw.length) software.add(sw.toLowerCase());
  })

  let softwaresArray: string[] = Array.from(software).sort();

  if(softwaresArray.length){
    if(get(doAggregateCache) && get(tabState) === 'leader' && !get(isBootstrapping)) {
      StateManager.set('aggregate:softwares', softwaresArray);
    }
  }
  else {
    const cached = StateManager.get('aggregate:softwares')
    softwaresArray = Array.isArray(cached) ? cached : [];
  }

  return softwaresArray;
}, 100);

export const softwareCounts_legacy = derived(relayCheckAggregates, ($relayCheckAggregates) => {
  const counts = new Map();
  $relayCheckAggregates.forEach((relayCheck) => {
    const sw = softwareKey(relayCheck?.software) || 'unknown';
    let count = counts.get(sw) || 0;
    count++;
    counts.set(sw, count);
  });
  return counts;
});

export const softwarePercentages_legacy = derived(softwareCounts_legacy, ($softwareCounts) => {
  const total = Array.from($softwareCounts.values()).reduce((sum, count) => sum + count, 0);
  const percentages = new Map();
  $softwareCounts.forEach((count, software) => {
    const percent = ((count / total) * 100).toFixed(1);
    percentages.set(software, parseFloat(percent));
  });
  return percentages;
});

export const softwareVersions_legacy = derived(relayCheckAggregates, ($relayCheckAggregates) => {
  const uniqueMap = new Map<string, Set<string>>()
  for (const relayCheck of $relayCheckAggregates) {
    const sw = softwareKey(relayCheck?.software) || 'unknown'
    if (!uniqueMap.has(sw)) {
      uniqueMap.set(sw, new Set())
    }
    uniqueMap.get(sw)!.add(relayCheck.version)
  }
  const result = new Map<string, string[]>()
  for (const [softwareName, versionsSet] of uniqueMap.entries()) {
    result.set(softwareName, Array.from(versionsSet))
  }
  return result
})


export const softwareVersionCounts_legacy = derived(relayCheckAggregates, ($relayCheckAggregates) => {
  const counts = new Map();

  $relayCheckAggregates.forEach((relayCheck) => {
    const sw = (softwareKey(relayCheck?.software)) || 'unknown';
    const ver = (relayCheck?.version?.toLowerCase()) || 'unknown';

    if (!counts.has(sw)) {
      counts.set(sw, new Map());
    }

    const versionMap = counts.get(sw);
    const currentCount = versionMap.get(ver) || 0;
    versionMap.set(ver, currentCount + 1);
  });
  return counts;
});

export const softwareVersionPercentages_legacy = derived(softwareVersionCounts_legacy, ($softwareVersionCounts) => {
  const percentages = new Map();

  $softwareVersionCounts.forEach((versionMap: Map<string, number>, software: string) => {
    const total: number = Array.from(versionMap.values()).reduce((sum, count) => sum + count, 0);
    const softwarePercentMap = new Map();

    versionMap.forEach((count: number, version: string) => {
      const percent = ((count / total) * 100).toFixed(1);
      softwarePercentMap.set(version, parseFloat(percent));
    });

    percentages.set(software, softwarePercentMap);
  });

  return percentages;
});

export const softwareRelaysStore_legacy = derived(relayCheckAggregates, ($relayCheckAggregates) => {
  const map: Map<string, string[]> = new Map();
  $relayCheckAggregates.forEach((relayCheck) => {
    const sw = softwareKey(relayCheck?.software) || 'unknown';
    if (!map.has(sw)) map.set(sw, []);
    (map.get(sw) as string[]).push(relayCheck.relay);
  });
  return map;
})

type MapStringSet = Map<string, Set<string>>;

export const softwareOperatorPubkeysMap_legacy = derived(relayCheckAggregates, ($relayCheckAggregates) => {
  const softwareOperators: MapStringSet = new Map<string, Set<string>>();

  $relayCheckAggregates.forEach((relayCheck) => {
    const sw = softwareKey(relayCheck?.software) || 'unknown';
    if (!softwareOperators.has(sw)) {
      softwareOperators.set(sw, new Set());
    }
    softwareOperators.get(sw)?.add(relayCheck.operatorPubkey);
  });
  return softwareOperators;
})

export const ispsBySoftware_legacy: Readable<Map<string, Set<string>>> = derived(relayCheckAggregates, ($relayCheckAggregates) => {
  const ispsBySoftware: Map<string, Set<string>> = new Map();
  $relayCheckAggregates.forEach((relayCheck) => {
    const isp = relayCheck?.isp || 'unknown';
    const software = relayCheck?.software || 'unknown';
    const isps = ispsBySoftware.get(software) || new Set();
    if((isps as Set<string>).has(isp)) return;
    (isps as Set<string>).add(isp);
    ispsBySoftware.set(software, isps);
  });
  return ispsBySoftware;
})

export const softwareGeocodesStore_legacy = derived(relayCheckAggregates, ($relayCheckAggregates) => {
  const map: Map<string, string[]> = new Map();
  $relayCheckAggregates.forEach((relayCheck) => {
    const sw = softwareKey(relayCheck?.software) || 'unknown';
    if (!map.has(sw)) map.set(sw, []);
    if(!relayCheck?.geocode) return;
    (map.get(sw) as string[]).push(relayCheck.geocode);
  });
  return map;
})

export const softwareRows_legacy = derived(relayCheckAggregates, () => {
  const rows: any[] = [];
  const $softwares = get(softwares_legacy);
  if(!$softwares?.length) return rows;
  $softwares.forEach((name: string) => {
    const row = {
      id: deterministicHash(name),
      name,
      versions: get(softwareVersions_legacy)?.get(name) || [],
      versionsNum: get(softwareVersions_legacy)?.get(name)?.length || 0,
      totalDeployed: get(softwareCounts_legacy)?.get(name) || 0,
      marketShare: get(softwarePercentages_legacy)?.get(name) || 0,
    };
    rows.push(row);
  });
  return rows;
})

// ============================================================================
// HYBRID STORES (Switch between worker and legacy based on feature flag)
// ============================================================================

/**
 * Softwares store - uses worker-computed values when enabled.
 */
export const softwares: Readable<string[]> = derived(
  [useWorkerSoftwares, workerSoftwares, softwares_legacy],
  ([$useWorker, $worker, $legacy]) => {
    if ($useWorker && $worker.length > 0) return $worker;
    return $legacy;
  }
);

/**
 * Software counts store - uses worker-computed values when enabled.
 */
export const softwareCounts: Readable<Map<string, number>> = derived(
  [useWorkerSoftwares, workerSoftwareCounts, softwareCounts_legacy],
  ([$useWorker, $worker, $legacy]) => {
    if ($useWorker && Object.keys($worker).length > 0) {
      return new Map(Object.entries($worker));
    }
    return $legacy;
  }
);

/**
 * Software percentages store - uses worker-computed values when enabled.
 */
export const softwarePercentages: Readable<Map<string, number>> = derived(
  [useWorkerSoftwares, workerSoftwarePercentages, softwarePercentages_legacy],
  ([$useWorker, $worker, $legacy]) => {
    if ($useWorker && Object.keys($worker).length > 0) {
      return new Map(Object.entries($worker));
    }
    return $legacy;
  }
);

/**
 * Software versions store - uses worker-computed values when enabled.
 */
export const softwareVersions: Readable<Map<string, string[]>> = derived(
  [useWorkerSoftwares, workerSoftwareVersions, softwareVersions_legacy],
  ([$useWorker, $worker, $legacy]) => {
    if ($useWorker && Object.keys($worker).length > 0) {
      return new Map(Object.entries($worker));
    }
    return $legacy;
  }
);

/**
 * Software version counts store - uses worker-computed values when enabled.
 */
export const softwareVersionCounts: Readable<Map<string, Map<string, number>>> = derived(
  [useWorkerSoftwares, workerSoftwareVersionCounts, softwareVersionCounts_legacy],
  ([$useWorker, $worker, $legacy]) => {
    if ($useWorker && Object.keys($worker).length > 0) {
      const result = new Map<string, Map<string, number>>();
      for (const [sw, versionCounts] of Object.entries($worker)) {
        result.set(sw, new Map(Object.entries(versionCounts)));
      }
      return result;
    }
    return $legacy;
  }
);

/**
 * Software version percentages store - derived from version counts.
 */
export const softwareVersionPercentages: Readable<Map<string, Map<string, number>>> = derived(
  softwareVersionCounts,
  ($softwareVersionCounts) => {
    const percentages = new Map<string, Map<string, number>>();

    $softwareVersionCounts.forEach((versionMap, software) => {
      const total = Array.from(versionMap.values()).reduce((sum, count) => sum + count, 0);
      const softwarePercentMap = new Map<string, number>();

      versionMap.forEach((count, version) => {
        const percent = total > 0 ? parseFloat(((count / total) * 100).toFixed(1)) : 0;
        softwarePercentMap.set(version, percent);
      });

      percentages.set(software, softwarePercentMap);
    });

    return percentages;
  }
);

/**
 * Software relays store - uses worker-computed values when enabled.
 */
export const softwareRelaysStore: Readable<Map<string, string[]>> = derived(
  [useWorkerSoftwares, workerSoftwareRelays, softwareRelaysStore_legacy],
  ([$useWorker, $worker, $legacy]) => {
    if ($useWorker && Object.keys($worker).length > 0) {
      return new Map(Object.entries($worker));
    }
    return $legacy;
  }
);

/**
 * Software operator pubkeys map - uses worker-computed values when enabled.
 */
export const softwareOperatorPubkeysMap: Readable<Map<string, Set<string>>> = derived(
  [useWorkerSoftwares, workerSoftwareOperatorPubkeys, softwareOperatorPubkeysMap_legacy],
  ([$useWorker, $worker, $legacy]) => {
    if ($useWorker && Object.keys($worker).length > 0) {
      const result = new Map<string, Set<string>>();
      for (const [sw, pubkeys] of Object.entries($worker)) {
        result.set(sw, new Set(pubkeys));
      }
      return result;
    }
    return $legacy;
  }
);

/**
 * ISPs by software store - uses worker-computed values when enabled.
 */
export const ispsBySoftware: Readable<Map<string, Set<string>>> = derived(
  [useWorkerSoftwares, workerIspsBySoftware, ispsBySoftware_legacy],
  ([$useWorker, $worker, $legacy]) => {
    if ($useWorker && Object.keys($worker).length > 0) {
      const result = new Map<string, Set<string>>();
      for (const [sw, isps] of Object.entries($worker)) {
        result.set(sw, new Set(isps));
      }
      return result;
    }
    return $legacy;
  }
);

/**
 * Software geocodes store - uses worker-computed values when enabled.
 */
export const softwareGeocodesStore: Readable<Map<string, string[]>> = derived(
  [useWorkerSoftwares, workerSoftwareGeocodes, softwareGeocodesStore_legacy],
  ([$useWorker, $worker, $legacy]) => {
    if ($useWorker && Object.keys($worker).length > 0) {
      return new Map(Object.entries($worker));
    }
    return $legacy;
  }
);

/**
 * Software rows store - uses worker-computed values when enabled.
 */
export const softwareRows: Readable<SoftwareRow[]> = derived(
  [useWorkerSoftwares, workerSoftwareRows, softwareRows_legacy],
  ([$useWorker, $worker, $legacy]) => {
    if ($useWorker && $worker.length > 0) return $worker;
    return $legacy as SoftwareRow[];
  }
);

// ============================================================================
// DERIVED STORES (These still derive from hybrid stores above)
// ============================================================================

export const operatorPubkeySoftwaresMap = derived(softwareOperatorPubkeysMap, ($softwareOperatorPubkeysMap) => {
  const operatorSoftware: MapStringSet = new Map<Pubkey, Set<string>>();
  $softwareOperatorPubkeysMap.forEach((pubkeys, software) => {
    pubkeys.forEach((pubkey) => {
      if (!operatorSoftware.has(pubkey)) {
        operatorSoftware.set(pubkey, new Set());
      }
      operatorSoftware.get(pubkey)?.add(software);
    });
  });
  return operatorSoftware;
})

export const operatorPubkeySoftwareCounts = derived(operatorPubkeySoftwaresMap, ($operatorPubkeySoftwaresMap) => {
  const result = new Map<Pubkey, Map<string, number>>();
  $operatorPubkeySoftwaresMap.forEach((softwares, pubkey) => {
    const counts = new Map();
    softwares.forEach((software) => {
      const count = counts.get(software) || 0;
      counts.set(software, count + 1);
    });
    result.set(pubkey, counts)
  });
  return result;
})
