import { derived, get, type Readable } from 'svelte/store';
import { eventsArray } from './events.js'; 
import { throttledDerived } from '$lib/utils/stores.js';
import { StateManager } from '@nostrwatch/route66';
import { relayCheckAggregates } from './checks.js';
import { doAggregateCache } from './app.js';
import type { Nip66CheckEvent } from '@nostrwatch/route66/models';
import { deterministicHash } from '@nostrwatch/route66/utils';

export const softwareKey = (software: string) => {
  return software?.toLowerCase()
}

export const softwareCleanKey = (software: string) => {
  return softwareKey(software).replace(/ /g, '-');
}

export const softwares: Readable<string[]> = throttledDerived(eventsArray, ($eventsArray: Nip66CheckEvent[]) => {
  const software: Set<string> = new Set();

  $eventsArray.forEach((check) => {
    if (check?.software) {
      software.add(check.software.toLowerCase());
    }
  });

  let softwaresArray: string[] = Array.from(software).sort();

  if(softwaresArray.length){
    if(get(doAggregateCache)) StateManager.set('aggregate:softwares', softwaresArray);
  }
  else {
    softwaresArray = StateManager.get('aggregate:softwares')
  }

  return softwaresArray;
}, 100);

export const softwareCounts = derived(relayCheckAggregates, ($relayCheckAggregates) => {
  const counts = new Map();
  $relayCheckAggregates.forEach((relayCheck) => {
    const sw = softwareKey(relayCheck?.software) || 'unknown';
    let count = counts.get(sw) || 0;
    count++;
    counts.set(sw, count);
  });
  return counts;
});

export const softwarePercentages = derived(softwareCounts, ($softwareCounts) => {
  const total = Array.from($softwareCounts.values()).reduce((sum, count) => sum + count, 0);
  const percentages = new Map();
  $softwareCounts.forEach((count, software) => {
    const percent = ((count / total) * 100).toFixed(1);
    percentages.set(software, parseFloat(percent));
  });
  return percentages;
});

export const softwareVersions = derived(relayCheckAggregates, ($relayCheckAggregates) => {
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


export const softwareVersionCounts = derived(relayCheckAggregates, ($relayCheckAggregates) => {
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

export const softwareVersionPercentages = derived(softwareVersionCounts, ($softwareVersionCounts) => {
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

export const softwareRelaysStore = derived(relayCheckAggregates, ($relayCheckAggregates) => {
  const map: Map<string, string[]> = new Map();
  $relayCheckAggregates.forEach((relayCheck) => {
    const sw = softwareKey(relayCheck?.software) || 'unknown';
    if (!map.has(sw)) map.set(sw, []);
    (map.get(sw) as string[]).push(relayCheck.relay);
  });
  return map;
})

type MapStringSet = Map<string, Set<string>>;

export const softwareOperatorPubkeysMap = derived(relayCheckAggregates, ($relayCheckAggregates) => {
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

export const ispsBySoftware: Readable<Map<string, Set<string>>> = derived(relayCheckAggregates, ($relayCheckAggregates) => {
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

export const operatorPubkeySoftwaresMap = derived(softwareOperatorPubkeysMap, ($softwareOperatorPubkeysMap) => {
  const operatorSoftware: MapStringSet = new Map<string, Set<string>>();

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

export const softwareGeocodesStore = derived(relayCheckAggregates, ($relayCheckAggregates) => {
  const map: Map<string, string[]> = new Map();
  $relayCheckAggregates.forEach((relayCheck) => {
    const sw = softwareKey(relayCheck?.software) || 'unknown';
    if (!map.has(sw)) map.set(sw, []);
    if(!relayCheck?.geocode) return;
    (map.get(sw) as string[]).push(relayCheck.geocode);
  });
  return map;
})

export const softwareRows = derived(relayCheckAggregates, () => {
  const rows: any[] = [];
  const $softwares = get(softwares);
  if(!$softwares?.length) return rows;
  $softwares.forEach((name: string) => {
    const row = {
      id: deterministicHash(name),
      name,
      versions: get(softwareVersions)?.get(name) || [],
      versionsNum: get(softwareVersions)?.get(name)?.length || 0,
      totalDeployed: get(softwareCounts)?.get(name) || 0,
      marketShare: get(softwarePercentages)?.get(name) || 0,
    };
    rows.push(row);
  });
  return rows;
})