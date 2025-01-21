import { derived, get } from 'svelte/store';
import { eventsArray } from './events.js'; 
import { throttledDerived } from '$lib/utils/stores.js';
import { StateManager } from '@nostrwatch/route66';
import { relayCheckAggregates } from './checks.js';
import { doAggregateCache } from './app.js';

export const softwares = throttledDerived(eventsArray, ($eventsArray) => {
  const software = new Set();

  $eventsArray.forEach((check) => {
    if (check?.software) {
      software.add(check.software.toLowerCase());
    }
  });

  let softwaresArray = Array.from(software).sort();

  if(softwaresArray.length){
    if(get(doAggregateCache)) StateManager.set('aggregate:softwares', softwaresArray);
  }
  else {
    softwaresArray = StateManager.get('aggregate:softwares')
  }

  return softwaresArray;
});

export const softwareCounts = derived(relayCheckAggregates, ($relayCheckAggregates) => {
  const counts = new Map();
  $relayCheckAggregates.forEach((relayCheck) => {
    const sw = relayCheck?.software?.toLowerCase() || 'unknown';
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

export const softwareVersionCounts = derived(relayCheckAggregates, ($relayCheckAggregates) => {
  const counts = new Map();

  $relayCheckAggregates.forEach((relayCheck) => {
    const sw = (relayCheck?.software?.toLowerCase()) || 'unknown';
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

export const softwareRelays = derived(relayCheckAggregates, ($relayCheckAggregates) => {
  const softwareRelays = new Map();

  $relayCheckAggregates.forEach((relayCheck) => {
    const sw = relayCheck?.software?.toLowerCase() || 'unknown';
    if (!softwareRelays.has(sw)) {
      softwareRelays.set(sw, []);
    }
    softwareRelays.get(sw).push(relayCheck.relay);
  });

  return softwareRelays;
})

type MapStringSet = Map<string, Set<string>>;

export const softwareOperatorPubkeysMap = derived(relayCheckAggregates, ($relayCheckAggregates) => {
  const softwareOperators: MapStringSet = new Map<string, Set<string>>();

  $relayCheckAggregates.forEach((relayCheck) => {
    const sw = relayCheck?.software?.toLowerCase() || 'unknown';
    if (!softwareOperators.has(sw)) {
      softwareOperators.set(sw, new Set());
    }
    softwareOperators.get(sw)?.add(relayCheck.operatorPubkey);
  });
  return softwareOperators;
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