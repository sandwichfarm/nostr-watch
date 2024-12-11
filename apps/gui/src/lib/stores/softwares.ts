import { derived, get } from 'svelte/store';
import { eventsArray } from './events.js'; 
import { throttledDerived } from '$lib/utils/stores.js';
import { StateManager } from '@nostrwatch/nip66';
import { relayAggregates } from './checks.js';
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

export const softwareCounts = derived(relayAggregates, ($relayAggregates) => {
  const counts = new Map();
  $relayAggregates.forEach((relayCheck) => {
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

export const softwareVersionCounts = derived(relayAggregates, ($relayAggregates) => {
  const counts = new Map();

  $relayAggregates.forEach((relayCheck) => {
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

  $softwareVersionCounts.forEach((versionMap, software) => {
    const total = Array.from(versionMap.values()).reduce((sum, count) => sum + count, 0);
    const softwarePercentMap = new Map();

    versionMap.forEach((count, version) => {
      const percent = ((count / total) * 100).toFixed(1);
      softwarePercentMap.set(version, parseFloat(percent));
    });

    percentages.set(software, softwarePercentMap);
  });

  return percentages;
});
